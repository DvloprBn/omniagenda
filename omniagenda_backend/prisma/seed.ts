// Siembra de DESARROLLO — datos de DEMOSTRACION, todos ficticios (este
// repo es publico: nunca un dato real de nadie). Idempotente: usa ids
// fijos y `upsert`, se puede correr muchas veces.
//
// El vertical del demo (estetica) es solo ilustrativo — el motor es ciego
// al negocio; ver PLAN_DESARROLLO.md §0.4 y CONTRATO_DE_INTEGRACION.md.
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CAL = '00000000-0000-4000-8000-00000000ca11';
const R_ESTILISTA = '00000000-0000-4000-8000-0000000000e1';
const R_MANICURISTA = '00000000-0000-4000-8000-0000000000e2';
const R_ESTACION = '00000000-0000-4000-8000-0000000000e3';
const BOOKING = '00000000-0000-4000-8000-0000000000b1';

const L_A_V = { open: '10:00', close: '19:00' };
const semanaLaboral = { mon: L_A_V, tue: L_A_V, wed: L_A_V, thu: L_A_V, fri: L_A_V, sat: { open: '10:00', close: '15:00' }, sun: null };

async function main() {
  console.log('Sembrando calendario de demo...');
  await prisma.calendars.upsert({
    where: { calendar_id: CAL },
    update: {},
    create: { calendar_id: CAL, name: 'Demo — Estetica (ficticia)', timezone: 'America/Mexico_City', visibility: 'busy_only' },
  });

  console.log('Sembrando recursos de demo...');
  for (const r of [
    { resource_id: R_ESTILISTA, name: 'Estilista de prueba', kind: 'person' },
    { resource_id: R_MANICURISTA, name: 'Manicurista de prueba', kind: 'person' },
    { resource_id: R_ESTACION, name: 'Estacion 1', kind: 'room' },
  ]) {
    await prisma.resources.upsert({ where: { resource_id: r.resource_id }, update: {}, create: r });
  }

  console.log('Sembrando horarios semanales...');
  for (const rid of [R_ESTILISTA, R_MANICURISTA, R_ESTACION]) {
    await prisma.schedule_rules.upsert({
      where: { resource_id_calendar_id: { resource_id: rid, calendar_id: CAL } },
      update: { weekly_hours: semanaLaboral },
      create: { resource_id: rid, calendar_id: CAL, weekly_hours: semanaLaboral },
    });
  }

  console.log('Sembrando una reserva de ejemplo (estilista + estacion, 1 h)...');
  const start = new Date('2026-12-15T16:00:00.000Z'); // 10:00 CST
  const end = new Date('2026-12-15T17:00:00.000Z');
  const existing = await prisma.bookings.findUnique({ where: { booking_id: BOOKING } });
  if (!existing) {
    await prisma.bookings.create({
      data: {
        booking_id: BOOKING,
        calendar_id: CAL,
        title: 'Corte y peinado (demo)',
        status: 'confirmada',
        source_type: 'demo',
        source_id: 'seed-1',
        starts_at: start,
        ends_at: end,
        booking_resources: {
          create: [
            { resource_id: R_ESTILISTA, start_time: start, end_time: end, status: 'confirmada', blocking: true },
            { resource_id: R_ESTACION, start_time: start, end_time: end, status: 'confirmada', blocking: true },
          ],
        },
      },
    });
    console.log('  reserva de ejemplo creada');
  } else {
    console.log('  la reserva de ejemplo ya existia');
  }

  const counts = {
    calendars: await prisma.calendars.count(),
    resources: await prisma.resources.count(),
    schedule_rules: await prisma.schedule_rules.count(),
    bookings: await prisma.bookings.count(),
    booking_resources: await prisma.booking_resources.count(),
  };
  console.log('Listo.', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
