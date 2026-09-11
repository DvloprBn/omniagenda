import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  evaluateConflict,
  NON_BLOCKING_STATUSES,
  type Interval,
  type ResourceBooking,
} from '@omniagenda/core';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarAccessService } from '../calendar-access/calendar-access.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';
import type { Prisma } from '../../generated/prisma/client';

/** Estados terminales — no se pueden mover ni cambiar (solo son historia). */
const TERMINAL_STATUSES = new Set(['cancelada', 'rechazada', 'completada', 'no_show', 'expirada']);
/** Ventana extra que se consulta alrededor del rango, para poder evaluar el colchón. */
const MAX_BUFFER_MS = 24 * 60 * 60 * 1000;

interface ListRange {
  from: Date;
  to: Date;
}

/**
 * EL ÚNICO ESCRITOR de `bookings` + `booking_resources`. Mantiene el ESPEJO
 * (`booking_resources.{start_time,end_time,status}`) sincronizado con la
 * reserva padre — el `EXCLUDE USING gist` no puede hacer join, así que
 * necesita esas columnas en `booking_resources`, y solo este servicio las
 * escribe, siempre dentro de una transacción.
 *
 * Defensa en profundidad contra doble-reserva:
 *   1. pre-chequeo con `evaluateConflict` de `@omniagenda/core` (mensaje
 *      claro + considera ocurrencias virtuales que se le pasen).
 *   2. la restricción `EXCLUDE` de PostgreSQL dentro de la transacción — la
 *      garantía real contra la condición de carrera de dos peticiones
 *      simultáneas.
 */
@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CalendarAccessService,
  ) {}

  // ---------------------------------------------------------------- crear
  async create(caller: AuthenticatedUser, calendarId: string, dto: CreateBookingDto) {
    const start = new Date(dto.starts_at);
    const end = new Date(dto.ends_at);
    this.assertWindow(start, end);

    await this.assertResourcesUsable(dto.resource_ids);

    const blocking = dto.blocking ?? true;
    const status = dto.status ?? 'pendiente';

    // 1. Pre-chequeo de aplicación.
    const soft = await this.preflightConflict({
      calendarId,
      resourceIds: dto.resource_ids,
      interval: { start: start.getTime(), end: end.getTime() },
      bufferMinutes: dto.buffer_minutes ?? 0,
    });

    // 2. Escritura atómica — la EXCLUDE es la garantía real.
    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const created = await tx.bookings.create({
          data: {
            calendar_id: calendarId,
            title: dto.title,
            status,
            source_type: dto.source_type,
            source_id: dto.source_id,
            created_by: caller.userId,
            starts_at: start,
            ends_at: end,
          },
        });
        await tx.booking_resources.createMany({
          data: dto.resource_ids.map((rid) => ({
            booking_id: created.booking_id,
            resource_id: rid,
            start_time: start,
            end_time: end,
            status,
            blocking,
          })),
        });
        return created;
      });
      return { ...(await this.withResources(booking.booking_id)), warnings: soft };
    } catch (e) {
      throw this.translateWriteError(e);
    }
  }

  // ----------------------------------------------------------- reprogramar
  async reschedule(caller: AuthenticatedUser, calendarId: string, bookingId: string, dto: RescheduleBookingDto) {
    const booking = await this.loadInCalendar(calendarId, bookingId);
    this.assertCanModify(caller, calendarId, booking);
    if (TERMINAL_STATUSES.has(booking.status)) {
      throw new BadRequestException(`Una reserva "${booking.status}" no se puede mover`);
    }

    const start = dto.starts_at ? new Date(dto.starts_at) : booking.starts_at;
    const end = dto.ends_at ? new Date(dto.ends_at) : booking.ends_at;
    this.assertWindow(start, end);

    const resourceIds = dto.resource_ids ?? booking.booking_resources.map((br) => br.resource_id);
    if (dto.resource_ids) await this.assertResourcesUsable(dto.resource_ids);
    const blocking = booking.booking_resources[0]?.blocking ?? true;

    const soft = await this.preflightConflict({
      calendarId,
      resourceIds,
      interval: { start: start.getTime(), end: end.getTime() },
      bufferMinutes: dto.buffer_minutes ?? 0,
      ignoreBookingId: bookingId,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.bookings.update({ where: { booking_id: bookingId }, data: { starts_at: start, ends_at: end } });
        await tx.booking_resources.deleteMany({ where: { booking_id: bookingId } });
        await tx.booking_resources.createMany({
          data: resourceIds.map((rid) => ({
            booking_id: bookingId, resource_id: rid, start_time: start, end_time: end, status: booking.status, blocking,
          })),
        });
      });
    } catch (e) {
      throw this.translateWriteError(e);
    }
    return { ...(await this.withResources(bookingId)), warnings: soft };
  }

  // -------------------------------------------------------- cambiar estado
  async changeStatus(caller: AuthenticatedUser, calendarId: string, bookingId: string, newStatus: string) {
    const booking = await this.loadInCalendar(calendarId, bookingId);

    // Un `booker` (no manager) solo puede CANCELAR su propia reserva.
    const isManager = await this.hasManager(caller, calendarId);
    if (!isManager) {
      if (booking.created_by !== caller.userId) {
        throw new ForbiddenException('Solo puedes cambiar el estado de tus propias reservas');
      }
      if (newStatus !== 'cancelada') {
        throw new ForbiddenException('Como reservante solo puedes cancelar; confirmar/completar/… lo hace un manager del calendario');
      }
    }

    try {
      await this.prisma.$transaction([
        this.prisma.bookings.update({ where: { booking_id: bookingId }, data: { status: newStatus } }),
        this.prisma.booking_resources.updateMany({ where: { booking_id: bookingId }, data: { status: newStatus } }),
      ]);
    } catch (e) {
      // Reactivar (volver a un estado que bloquea) puede chocar si el hueco ya se ocupó.
      throw this.translateWriteError(e);
    }
    return this.withResources(bookingId);
  }

  // ---------------------------------------------------------------- listar
  async list(caller: AuthenticatedUser, calendarId: string, range: ListRange) {
    const view = await this.resolveView(caller, calendarId);
    const rows = await this.prisma.bookings.findMany({
      where: { calendar_id: calendarId, starts_at: { lt: range.to }, ends_at: { gt: range.from } },
      include: { booking_resources: { select: { resource_id: true, blocking: true } } },
      orderBy: { starts_at: 'asc' },
    });
    return rows.map((b) => this.shape(b, view));
  }

  async findOne(caller: AuthenticatedUser, calendarId: string, bookingId: string) {
    const view = await this.resolveView(caller, calendarId);
    const b = await this.prisma.bookings.findFirst({
      where: { booking_id: bookingId, calendar_id: calendarId },
      include: { booking_resources: { select: { resource_id: true, blocking: true } } },
    });
    if (!b) throw new NotFoundException('Reserva no encontrada');
    return this.shape(b, view);
  }

  // --------------------------------------------------------------- borrar
  async remove(caller: AuthenticatedUser, calendarId: string, bookingId: string): Promise<void> {
    await this.access.assertCalendarAccess(caller, calendarId, 'manager');
    const b = await this.prisma.bookings.findFirst({ where: { booking_id: bookingId, calendar_id: calendarId }, select: { booking_id: true } });
    if (!b) throw new NotFoundException('Reserva no encontrada');
    await this.prisma.bookings.delete({ where: { booking_id: bookingId } }); // cascade -> booking_resources
  }

  // ============================================================ internos

  private assertWindow(start: Date, end: Date): void {
    if (!(start.getTime() < end.getTime())) {
      throw new BadRequestException('starts_at debe ser anterior a ends_at');
    }
  }

  private async assertResourcesUsable(resourceIds: string[]): Promise<void> {
    const found = await this.prisma.resources.findMany({ where: { resource_id: { in: resourceIds } }, select: { resource_id: true, active: true } });
    if (found.length !== resourceIds.length) throw new NotFoundException('Alguno de los recursos no existe');
    const inactive = found.filter((r) => !r.active);
    if (inactive.length) throw new BadRequestException('Alguno de los recursos está inactivo');
  }

  /**
   * Corre `evaluateConflict` de `@omniagenda/core`. Lanza 409 si hay
   * conflicto DURO (traslape real, o colchón ENTRE calendarios violado —
   * ver `crossCalendarBufferMinutes` en el núcleo); devuelve los BLANDOS
   * (colchón general) como avisos.
   */
  private async preflightConflict(args: {
    calendarId: string;
    resourceIds: string[];
    interval: Interval;
    bufferMinutes: number;
    ignoreBookingId?: string;
  }): Promise<ResourceBooking[]> {
    // El colchón ENTRE CALENDARIOS es una propiedad del RECURSO (cuánto
    // tarda en trasladarse), no algo que decide quien agenda — igual que
    // `location_change_buffer_minutes` en Espiral vive en el artista, no
    // en la cita. Simplificación documentada en el núcleo: un solo valor
    // para toda la reserva — se toma el máximo entre los recursos
    // involucrados (la restricción más conservadora).
    const resourceRows = await this.prisma.resources.findMany({
      where: { resource_id: { in: args.resourceIds } },
      select: { calendar_switch_buffer_minutes: true },
    });
    const crossCalendarBufferMinutes = resourceRows.reduce((max, r) => Math.max(max, r.calendar_switch_buffer_minutes), 0);
    const widestBufferMs = Math.max(args.bufferMinutes, crossCalendarBufferMinutes) * 60_000;

    const windowStart = new Date(args.interval.start - widestBufferMs - MAX_BUFFER_MS);
    const windowEnd = new Date(args.interval.end + widestBufferMs + MAX_BUFFER_MS);
    const existingRows = await this.prisma.booking_resources.findMany({
      where: {
        resource_id: { in: args.resourceIds },
        status: { notIn: [...NON_BLOCKING_STATUSES] },
        start_time: { lt: windowEnd },
        end_time: { gt: windowStart },
        ...(args.ignoreBookingId ? { booking_id: { not: args.ignoreBookingId } } : {}),
      },
      select: {
        booking_id: true, resource_id: true, start_time: true, end_time: true, status: true, blocking: true,
        bookings: { select: { calendar_id: true } },
      },
    });
    const existing: ResourceBooking[] = existingRows.map((r) => ({
      bookingId: r.booking_id,
      resourceId: r.resource_id,
      calendarId: r.bookings.calendar_id,
      interval: { start: r.start_time.getTime(), end: r.end_time.getTime() },
      status: r.status,
      blocking: r.blocking,
    }));

    const report = evaluateConflict(
      {
        resourceIds: args.resourceIds,
        calendarId: args.calendarId,
        interval: args.interval,
        bufferMinutes: args.bufferMinutes,
        crossCalendarBufferMinutes,
        ignoreBookingId: args.ignoreBookingId,
      },
      existing,
    );
    if (!report.ok) {
      const crossCalendar = report.hard.filter((h) => h.calendarId !== args.calendarId);
      throw new ConflictException({
        message: crossCalendar.length
          ? 'No da tiempo de trasladar el recurso desde/hacia otra sucursal en ese horario'
          : 'El horario choca con otra reserva del mismo recurso',
        conflicts: report.hard.map((h) => ({ booking_id: h.bookingId, resource_id: h.resourceId, calendar_id: h.calendarId })),
      });
    }
    return report.soft;
  }

  /** Traduce el error de escritura: una violación de la EXCLUDE → 409 legible; lo demás se relanza. */
  private translateWriteError(e: unknown): Error {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('no_overlapping_resource_bookings') || msg.includes('23P01') || msg.toLowerCase().includes('exclusion')) {
      return new ConflictException('Otra reserva ocupó ese horario mientras se guardaba — vuelve a intentar');
    }
    if (msg.includes('booking_resources_time_order') || msg.includes('bookings_time_order')) {
      return new BadRequestException('El rango de tiempo no es válido (inicio < fin)');
    }
    return e instanceof Error ? e : new Error(msg);
  }

  private async loadInCalendar(calendarId: string, bookingId: string) {
    const b = await this.prisma.bookings.findFirst({
      where: { booking_id: bookingId, calendar_id: calendarId },
      include: { booking_resources: true },
    });
    if (!b) throw new NotFoundException('Reserva no encontrada');
    return b;
  }

  private async hasManager(caller: AuthenticatedUser, calendarId: string): Promise<boolean> {
    const role = await this.access.effectiveRole(caller, calendarId);
    return role === 'manager';
  }

  /** `booker` puede mover SU propia reserva; `manager` cualquiera. Lanza si no. */
  private async assertCanModify(caller: AuthenticatedUser, calendarId: string, booking: { created_by: string | null }): Promise<void> {
    if (await this.hasManager(caller, calendarId)) return;
    // el guard @CalendarRole('booker') ya garantizó al menos booker
    if (booking.created_by !== caller.userId) {
      throw new ForbiddenException('Solo puedes mover tus propias reservas (un manager del calendario puede mover cualquiera)');
    }
  }

  private async withResources(bookingId: string) {
    return this.prisma.bookings.findUniqueOrThrow({
      where: { booking_id: bookingId },
      include: { booking_resources: { select: { resource_id: true, start_time: true, end_time: true, status: true, blocking: true } } },
    });
  }

  /** Nivel de detalle que se devuelve: 'full' vs 'busy_only' (sin título/creador/source). */
  private async resolveView(caller: AuthenticatedUser, calendarId: string): Promise<'full' | 'busy_only'> {
    const calendar = await this.prisma.calendars.findUnique({ where: { calendar_id: calendarId }, select: { visibility: true } });
    if (!calendar) throw new NotFoundException('Calendario no encontrado');
    const role = await this.access.effectiveRole(caller, calendarId);
    if (role) return 'full'; // miembro real (o admin+ global)
    if (calendar.visibility === 'public') return 'full';
    if (calendar.visibility === 'busy_only') return 'busy_only';
    throw new ForbiddenException('Necesitas permiso "viewer" sobre este calendario');
  }

  private shape(
    b: { booking_id: string; calendar_id: string; title: string | null; status: string; source_type: string | null; source_id: string | null; created_by: string | null; starts_at: Date; ends_at: Date; booking_resources: { resource_id: string; blocking: boolean }[] },
    view: 'full' | 'busy_only',
  ) {
    const base = {
      booking_id: b.booking_id,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      status: b.status,
      resource_ids: b.booking_resources.map((r) => r.resource_id),
      blocking: b.booking_resources.every((r) => r.blocking),
    };
    if (view === 'busy_only') return base;
    return {
      ...base,
      calendar_id: b.calendar_id,
      title: b.title,
      source_type: b.source_type,
      source_id: b.source_id,
      created_by: b.created_by,
    };
  }
}
