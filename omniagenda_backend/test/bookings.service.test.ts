import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { BookingsService } from '../src/bookings/bookings.service';
import { CalendarAccessService } from '../src/calendar-access/calendar-access.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/auth/jwt-payload.interface';

/**
 * Integración real — el ESCRITOR ÚNICO de bookings/booking_resources.
 * Prueba: transacción atómica, espejo en sync, la EXCLUDE como backstop,
 * multi-recurso, mover, cancelar.
 */
describe('BookingsService (integración, Postgres real)', () => {
  let svc: BookingsService;
  let prisma: PrismaService;
  let calId = '';
  let calId2 = '';
  let r1 = '';
  let r2 = '';
  let r3 = ''; // recurso con colchón entre calendarios (el "estilista que viaja")
  const admin: AuthenticatedUser = { userId: randomUUID(), role: 'admin', roleLevel: 3, mustChangePassword: false };
  const cleanup = { calIds: [] as string[], resIds: [] as string[] };

  const iso = (h: number, m = 0) => new Date(Date.UTC(2026, 6, 20, h, m)).toISOString();
  const create = (over: Record<string, unknown> = {}) =>
    svc.create(admin, calId, { starts_at: iso(16), ends_at: iso(17), resource_ids: [r1], ...over } as never);
  const ABIERTO_TODO_EL_DIA = { mon: { open: '00:00', close: '23:59' }, tue: { open: '00:00', close: '23:59' }, wed: { open: '00:00', close: '23:59' }, thu: { open: '00:00', close: '23:59' }, fri: { open: '00:00', close: '23:59' }, sat: { open: '00:00', close: '23:59' }, sun: { open: '00:00', close: '23:59' } };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ providers: [BookingsService, CalendarAccessService, PrismaService] }).compile();
    svc = mod.get(BookingsService);
    prisma = mod.get(PrismaService);
    await prisma.$connect();

    const cal = await prisma.calendars.create({ data: { name: 't-book', timezone: 'America/Mexico_City', visibility: 'private' } });
    const cal2 = await prisma.calendars.create({ data: { name: 't-book-2', timezone: 'America/Mexico_City', visibility: 'private' } });
    calId = cal.calendar_id;
    calId2 = cal2.calendar_id;
    cleanup.calIds.push(calId, calId2);
    const a = await prisma.resources.create({ data: { name: 't-r1', kind: 'person' } });
    const b = await prisma.resources.create({ data: { name: 't-r2', kind: 'room' } });
    const c = await prisma.resources.create({ data: { name: 't-r3-viajero', kind: 'person', calendar_switch_buffer_minutes: 30 } });
    r1 = a.resource_id; r2 = b.resource_id; r3 = c.resource_id;
    cleanup.resIds.push(r1, r2, r3);
    for (const rid of [r1, r2]) {
      await prisma.schedule_rules.create({ data: { resource_id: rid, calendar_id: calId, weekly_hours: ABIERTO_TODO_EL_DIA } });
    }
    // r3 atiende en AMBOS calendarios (la sucursal Norte del ejemplo).
    await prisma.schedule_rules.create({ data: { resource_id: r3, calendar_id: calId, weekly_hours: ABIERTO_TODO_EL_DIA } });
    await prisma.schedule_rules.create({ data: { resource_id: r3, calendar_id: calId2, weekly_hours: ABIERTO_TODO_EL_DIA } });
  });

  afterAll(async () => {
    await prisma.bookings.deleteMany({ where: { calendar_id: { in: cleanup.calIds } } });
    await prisma.schedule_rules.deleteMany({ where: { calendar_id: { in: cleanup.calIds } } });
    await prisma.calendar_members.deleteMany({ where: { calendar_id: { in: cleanup.calIds } } });
    await prisma.calendars.deleteMany({ where: { calendar_id: { in: cleanup.calIds } } });
    await prisma.resources.deleteMany({ where: { resource_id: { in: cleanup.resIds } } });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.bookings.deleteMany({ where: { calendar_id: { in: [calId, calId2] } } });
  });

  it('crea la reserva + el espejo booking_resources con los mismos start/end/status', async () => {
    const b = await create({ status: 'confirmada' });
    expect(b.booking_resources).toHaveLength(1);
    const br = b.booking_resources[0]!;
    expect(new Date(br.start_time).getTime()).toBe(new Date(b.starts_at).getTime());
    expect(br.status).toBe('confirmada');
    expect(br.blocking).toBe(true);
  });

  it('un traslape del mismo recurso -> 409 y NO deja fila huérfana en bookings', async () => {
    await create({ starts_at: iso(16), ends_at: iso(17) });
    const before = await prisma.bookings.count({ where: { calendar_id: calId } });
    await expect(create({ starts_at: iso(16, 30), ends_at: iso(17, 30) })).rejects.toMatchObject({ status: 409 });
    expect(await prisma.bookings.count({ where: { calendar_id: calId } })).toBe(before); // la tx hizo rollback
  });

  it('reservas adyacentes (fin == inicio) conviven', async () => {
    await create({ starts_at: iso(16), ends_at: iso(17) });
    await expect(create({ starts_at: iso(17), ends_at: iso(18) })).resolves.toBeDefined();
  });

  it('un traslape con status "cancelada" NO bloquea', async () => {
    await create({ starts_at: iso(16), ends_at: iso(17), status: 'cancelada' });
    await expect(create({ starts_at: iso(16, 30), ends_at: iso(17, 30) })).resolves.toBeDefined();
  });

  it('multi-recurso: si UNO de los recursos está ocupado, la reserva entera falla (atómica)', async () => {
    await create({ resource_ids: [r2], starts_at: iso(16), ends_at: iso(17) });
    const before = await prisma.bookings.count({ where: { calendar_id: calId } });
    await expect(create({ resource_ids: [r1, r2], starts_at: iso(16, 30), ends_at: iso(17, 30) })).rejects.toMatchObject({ status: 409 });
    expect(await prisma.bookings.count({ where: { calendar_id: calId } })).toBe(before);
    expect(await prisma.booking_resources.count({ where: { resource_id: r1, start_time: new Date(iso(16, 30)) } })).toBe(0);
  });

  it('mover a un hueco libre reescribe el espejo; mover encima de otra -> 409', async () => {
    const a = await create({ starts_at: iso(16), ends_at: iso(17) });
    await create({ starts_at: iso(18), ends_at: iso(19) });
    const moved = await svc.reschedule(admin, calId, a.booking_id, { starts_at: iso(20), ends_at: iso(21) });
    expect(new Date(moved.booking_resources[0]!.start_time).getTime()).toBe(new Date(iso(20)).getTime());
    await expect(svc.reschedule(admin, calId, a.booking_id, { starts_at: iso(18, 30), ends_at: iso(19, 30) })).rejects.toMatchObject({ status: 409 });
  });

  it('cancelar libera el horario para una reserva nueva', async () => {
    const a = await create({ starts_at: iso(16), ends_at: iso(17) });
    await svc.changeStatus(admin, calId, a.booking_id, 'cancelada');
    await expect(create({ starts_at: iso(16), ends_at: iso(17) })).resolves.toBeDefined();
  });

  it('un bloque no-bloqueante (blocking:false) se guarda y no rechaza a otro', async () => {
    await create({ blocking: false, starts_at: iso(16), ends_at: iso(17) });
    await expect(create({ starts_at: iso(16, 30), ends_at: iso(17, 30) })).resolves.toBeDefined();
  });

  it('rechaza starts_at >= ends_at', async () => {
    await expect(create({ starts_at: iso(17), ends_at: iso(16) })).rejects.toMatchObject({ status: 400 });
  });

  // ── Colchón ENTRE CALENDARIOS (sucursales) — generaliza el "colchón de
  // traslado" de Espiral. r3 tiene calendar_switch_buffer_minutes=30.
  describe('colchón entre calendarios (resources.calendar_switch_buffer_minutes)', () => {
    it('una reserva en OTRO calendario demasiado cerca -> 409 (imposibilidad física, no un aviso)', async () => {
      await svc.create(admin, calId, { starts_at: iso(16), ends_at: iso(17), resource_ids: [r3] } as never);
      // 15 min despues, en la OTRA sucursal — el recurso necesita 30.
      await expect(
        svc.create(admin, calId2, { starts_at: iso(17, 15), ends_at: iso(18, 15), resource_ids: [r3] } as never),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('con margen suficiente entre sucursales -> ok', async () => {
      await svc.create(admin, calId, { starts_at: iso(16), ends_at: iso(17), resource_ids: [r3] } as never);
      // 45 min despues (> 30 del colchón) en la otra sucursal.
      await expect(
        svc.create(admin, calId2, { starts_at: iso(17, 45), ends_at: iso(18, 45), resource_ids: [r3] } as never),
      ).resolves.toBeDefined();
    });

    it('el mismo margen corto, pero en el MISMO calendario, NO dispara el colchón entre sucursales', async () => {
      await svc.create(admin, calId, { starts_at: iso(16), ends_at: iso(17), resource_ids: [r3] } as never);
      // 15 min despues, en la MISMA sucursal — nunca "viajó" a ningún lado.
      const r = await svc.create(admin, calId, { starts_at: iso(17, 15), ends_at: iso(18, 15), resource_ids: [r3] } as never);
      expect(r.warnings).toEqual([]); // tampoco genera un aviso: no se pidió bufferMinutes general
    });
  });
});
