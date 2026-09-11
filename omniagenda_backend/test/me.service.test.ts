import { Test } from '@nestjs/testing';
import { MeService } from '../src/me/me.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

/**
 * Integración real — "Mi agenda" (GET /me/schedule). Sin equivalente en
 * OmniUser: cruza TODOS los calendarios donde el recurso vinculado
 * trabaja, ancorado siempre en el userId del token (nunca IDOR). Ver
 * DOCUMENTO_VIVO_ARQUITECTURA.md §13.
 */
describe('MeService — agenda personal vía resources.user_id (integración, Postgres real)', () => {
  let service: MeService;
  let prisma: PrismaService;
  const resourceIds: string[] = [];
  const userIds: string[] = [];
  const calendarIds: string[] = [];
  const bookingIds: string[] = [];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ providers: [MeService, PrismaService] }).compile();
    service = mod.get(MeService);
    prisma = mod.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.bookings.deleteMany({ where: { booking_id: { in: bookingIds } } });
    await prisma.resources.deleteMany({ where: { resource_id: { in: resourceIds } } });
    await prisma.calendars.deleteMany({ where: { calendar_id: { in: calendarIds } } });
    await prisma.users.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('lanza 404 si la cuenta no representa ningún recurso', async () => {
    const role = await prisma.roles.findUniqueOrThrow({ where: { name: 'usuario' } });
    const u = await prisma.users.create({ data: { email: `test.me.unlinked.${Date.now()}@example.com`, password_hash: 'x', role_id: role.role_id } });
    userIds.push(u.user_id);

    await expect(service.schedule(u.user_id, new Date('2026-01-01'), new Date('2026-01-31'))).rejects.toThrow(NotFoundException);
  });

  it('devuelve reservas combinadas de VARIOS calendarios para el recurso vinculado', async () => {
    const role = await prisma.roles.findUniqueOrThrow({ where: { name: 'usuario' } });
    const u = await prisma.users.create({ data: { email: `test.me.linked.${Date.now()}@example.com`, password_hash: 'x', role_id: role.role_id } });
    userIds.push(u.user_id);

    const resource = await prisma.resources.create({ data: { name: 'test-me-resource', kind: 'person', user_id: u.user_id } });
    resourceIds.push(resource.resource_id);

    const calA = await prisma.calendars.create({ data: { name: 'test-me-cal-a', timezone: 'America/Mexico_City', visibility: 'busy_only' } });
    const calB = await prisma.calendars.create({ data: { name: 'test-me-cal-b', timezone: 'America/Mexico_City', visibility: 'busy_only' } });
    calendarIds.push(calA.calendar_id, calB.calendar_id);

    const startA = new Date('2026-06-01T10:00:00.000Z');
    const endA = new Date('2026-06-01T11:00:00.000Z');
    const bookingA = await prisma.bookings.create({
      data: {
        calendar_id: calA.calendar_id,
        title: 'Cita en calendario A',
        status: 'confirmada',
        source_type: 'test',
        source_id: 'me-test-a',
        starts_at: startA,
        ends_at: endA,
        booking_resources: { create: [{ resource_id: resource.resource_id, start_time: startA, end_time: endA, status: 'confirmada', blocking: true }] },
      },
    });
    bookingIds.push(bookingA.booking_id);

    const startB = new Date('2026-06-02T10:00:00.000Z');
    const endB = new Date('2026-06-02T11:00:00.000Z');
    const bookingB = await prisma.bookings.create({
      data: {
        calendar_id: calB.calendar_id,
        title: 'Cita en calendario B',
        status: 'confirmada',
        source_type: 'test',
        source_id: 'me-test-b',
        starts_at: startB,
        ends_at: endB,
        booking_resources: { create: [{ resource_id: resource.resource_id, start_time: startB, end_time: endB, status: 'confirmada', blocking: true }] },
      },
    });
    bookingIds.push(bookingB.booking_id);

    const result = await service.schedule(u.user_id, new Date('2026-06-01T00:00:00Z'), new Date('2026-06-03T00:00:00Z'));

    expect(result.resource.resource_id).toBe(resource.resource_id);
    expect(result.bookings).toHaveLength(2);
    const calendarIdsInResult = result.bookings.map((b) => b.calendar_id).sort();
    expect(calendarIdsInResult).toEqual([calA.calendar_id, calB.calendar_id].sort());
  });

  it('no incluye reservas fuera del rango [from, to)', async () => {
    const role = await prisma.roles.findUniqueOrThrow({ where: { name: 'usuario' } });
    const u = await prisma.users.create({ data: { email: `test.me.range.${Date.now()}@example.com`, password_hash: 'x', role_id: role.role_id } });
    userIds.push(u.user_id);

    const resource = await prisma.resources.create({ data: { name: 'test-me-range-resource', kind: 'person', user_id: u.user_id } });
    resourceIds.push(resource.resource_id);

    const cal = await prisma.calendars.create({ data: { name: 'test-me-range-cal', timezone: 'America/Mexico_City', visibility: 'busy_only' } });
    calendarIds.push(cal.calendar_id);

    const start = new Date('2026-07-01T10:00:00.000Z');
    const end = new Date('2026-07-01T11:00:00.000Z');
    const booking = await prisma.bookings.create({
      data: {
        calendar_id: cal.calendar_id,
        title: 'Fuera de rango',
        status: 'confirmada',
        source_type: 'test',
        source_id: 'me-test-range',
        starts_at: start,
        ends_at: end,
        booking_resources: { create: [{ resource_id: resource.resource_id, start_time: start, end_time: end, status: 'confirmada', blocking: true }] },
      },
    });
    bookingIds.push(booking.booking_id);

    const result = await service.schedule(u.user_id, new Date('2026-08-01T00:00:00Z'), new Date('2026-08-31T00:00:00Z'));
    expect(result.bookings).toHaveLength(0);
  });
});
