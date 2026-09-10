// Siembra de DESARROLLO — datos FICTICIOS (este repo es publico: nunca un
// dato real de nadie). Idempotente: ids fijos + upsert, se corre muchas
// veces sin duplicar.
//
// Dos partes:
//   1. Auth (portado de OmniUser): 6 roles del sistema + 6 cuentas de
//      prueba, una por rol, contrasena compartida SOLO de prueba.
//   2. Demo del motor: 1 calendario "Estetica", 3 recursos, 3 horarios,
//      1 reserva, y una membresia de calendario para mostrar la capa de
//      permisos por calendario (Fase 3).
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ─────────────────────────── 1. AUTH ───────────────────────────

/** Contrasena SOLO de las cuentas de prueba de este seed. Nunca para una cuenta real. */
const TEST_PASSWORD = 'TestOnly123!';

// is_system:true en los 6 — los 5 de jerarquia porque la logica razona
// sobre su `level`; "usuario" porque AuthService.register() lo busca por
// nombre literal.
const ROLES = [
  { name: 'usuario', description: 'Cuenta publica autoregistrada — sin acceso al panel', is_system: true, level: 0, max_count: null },
  { name: 'staff', description: 'Operacion basica del panel', is_system: true, level: 1, max_count: null },
  { name: 'manager', description: 'Gestiona staff de su area', is_system: true, level: 2, max_count: null },
  { name: 'admin', description: 'Administra manager/staff, usuarios y seguridad', is_system: true, level: 3, max_count: null },
  { name: 'director', description: 'Direccion — un solo cargo real', is_system: true, level: 4, max_count: 1 },
  { name: 'super', description: 'Control tecnico total del proyecto — un solo cargo real', is_system: true, level: 5, max_count: 1 },
] as const;

const TEST_ACCOUNTS = [
  { email: 'super+omniagenda@example.com', role: 'super' },
  { email: 'director+omniagenda@example.com', role: 'director' },
  { email: 'admin+omniagenda@example.com', role: 'admin' },
  { email: 'manager+omniagenda@example.com', role: 'manager' },
  { email: 'staff+omniagenda@example.com', role: 'staff' },
  { email: 'usuario+omniagenda@example.com', role: 'usuario' },
] as const;

// ─────────────────────────── 2. DEMO ───────────────────────────

const CAL = '00000000-0000-4000-8000-00000000ca11';
const R_ESTILISTA = '00000000-0000-4000-8000-0000000000e1';
const R_MANICURISTA = '00000000-0000-4000-8000-0000000000e2';
const R_ESTACION = '00000000-0000-4000-8000-0000000000e3';
const BOOKING = '00000000-0000-4000-8000-0000000000b1';

const L_A_V = { open: '10:00', close: '19:00' };
const semanaLaboral = { mon: L_A_V, tue: L_A_V, wed: L_A_V, thu: L_A_V, fri: L_A_V, sat: { open: '10:00', close: '15:00' }, sun: null };

async function main() {
  // --- Auth ---
  console.log('Sembrando roles del sistema...');
  const roleByName = new Map<string, number>();
  for (const r of ROLES) {
    const role = await prisma.roles.upsert({
      where: { name: r.name },
      update: { description: r.description, is_system: r.is_system, level: r.level, max_count: r.max_count },
      create: r,
    });
    roleByName.set(r.name, role.role_id);
  }

  console.log('Sembrando cuentas de prueba...');
  const testPasswordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const userIdByRole = new Map<string, string>();
  for (const acc of TEST_ACCOUNTS) {
    const user = await prisma.users.upsert({
      where: { email: acc.email },
      update: {},
      create: {
        email: acc.email,
        password_hash: testPasswordHash,
        name: `Cuenta de prueba (${acc.role})`,
        role_id: roleByName.get(acc.role)!,
      },
    });
    userIdByRole.set(acc.role, user.user_id);
  }
  console.log(`  ${TEST_ACCOUNTS.length} cuentas (password compartida: ${TEST_PASSWORD})`);

  // --- Demo del motor ---
  console.log('Sembrando calendario + recursos de demo...');
  await prisma.calendars.upsert({
    where: { calendar_id: CAL },
    update: {},
    create: { calendar_id: CAL, name: 'Demo — Estetica (ficticia)', timezone: 'America/Mexico_City', visibility: 'busy_only' },
  });
  for (const r of [
    { resource_id: R_ESTILISTA, name: 'Estilista de prueba', kind: 'person' },
    { resource_id: R_MANICURISTA, name: 'Manicurista de prueba', kind: 'person' },
    { resource_id: R_ESTACION, name: 'Estacion 1', kind: 'room' },
  ]) {
    await prisma.resources.upsert({ where: { resource_id: r.resource_id }, update: {}, create: r });
  }
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
  const existingBooking = await prisma.bookings.findUnique({ where: { booking_id: BOOKING } });
  if (!existingBooking) {
    await prisma.bookings.create({
      data: {
        booking_id: BOOKING,
        calendar_id: CAL,
        title: 'Corte y peinado (demo)',
        status: 'confirmada',
        source_type: 'demo',
        source_id: 'seed-1',
        created_by: userIdByRole.get('manager') ?? null,
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
  }

  console.log('Sembrando membresias del calendario de demo (Fase 3)...');
  // La cuenta "staff" NO es admin global, pero se le da rol `manager`
  // SOBRE este calendario. La cuenta "usuario" recibe `booker`. Asi el
  // barrido de permisos por calendario tiene con que probarse.
  const membershipSeed: Array<[string, 'viewer' | 'booker' | 'manager']> = [
    ['staff', 'manager'],
    ['usuario', 'booker'],
  ];
  for (const [role, calRole] of membershipSeed) {
    const uid = userIdByRole.get(role);
    if (!uid) continue;
    await prisma.calendar_members.upsert({
      where: { calendar_id_user_id: { calendar_id: CAL, user_id: uid } },
      update: { calendar_role: calRole },
      create: { calendar_id: CAL, user_id: uid, calendar_role: calRole, granted_by: 'seed' },
    });
  }

  const counts = {
    roles: await prisma.roles.count(),
    users: await prisma.users.count(),
    calendars: await prisma.calendars.count(),
    resources: await prisma.resources.count(),
    bookings: await prisma.bookings.count(),
    calendar_members: await prisma.calendar_members.count(),
  };
  console.log('Listo.', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
