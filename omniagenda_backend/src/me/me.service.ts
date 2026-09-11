import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * "Mi agenda" — la vista PERSONAL de quien inicia sesión, para el caso
 * (Espiral: `artists.user_id`, generalizado aquí) de que la cuenta
 * represente un RECURSO real (ej. un estilista). A diferencia de
 * `BookingsService.list` (acotado a UN calendario, gateado por
 * `@CalendarRole`), esto cruza TODOS los calendarios donde ese recurso
 * trabaja — un estilista de 2 sucursales ve su agenda combinada con una
 * sola cuenta, sin que nadie tenga que darle membresía manual en cada una.
 *
 * Sin riesgo de IDOR: la consulta siempre se ancla en `caller.userId` (del
 * token, nunca de un parámetro de ruta) — no hay ningún id que alguien
 * pueda manipular para ver la agenda de otro recurso.
 */
@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  /** El recurso que esta cuenta representa, o `null` si no representa ninguno. */
  async myResource(userId: string) {
    return this.prisma.resources.findUnique({ where: { user_id: userId } });
  }

  /**
   * @throws {NotFoundException} si la cuenta no tiene ningún recurso vinculado.
   */
  async schedule(userId: string, from: Date, to: Date) {
    const resource = await this.myResource(userId);
    if (!resource) {
      throw new NotFoundException('Tu cuenta no está vinculada a ningún recurso agendable — pide que un manager te vincule desde /resources.');
    }

    const bookings = await this.prisma.bookings.findMany({
      where: {
        starts_at: { lt: to },
        ends_at: { gt: from },
        booking_resources: { some: { resource_id: resource.resource_id } },
      },
      include: {
        booking_resources: { select: { resource_id: true, blocking: true } },
        calendars: { select: { name: true, timezone: true } },
      },
      orderBy: { starts_at: 'asc' },
    });

    return {
      resource: { resource_id: resource.resource_id, name: resource.name, kind: resource.kind },
      bookings: bookings.map((b) => ({
        booking_id: b.booking_id,
        calendar_id: b.calendar_id,
        calendar_name: b.calendars.name,
        title: b.title,
        status: b.status,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        resource_ids: b.booking_resources.map((r) => r.resource_id),
      })),
    };
  }
}
