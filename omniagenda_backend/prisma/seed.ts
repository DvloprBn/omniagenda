// Siembra de DESARROLLO — datos FICTICIOS (este repo es publico: nunca un
// dato real de nadie). Idempotente: ids fijos + upsert, se corre muchas
// veces sin duplicar. Se deja crecer con el tiempo (mas datos de
// demostracion) en vez de borrarse antes de cada entrega — el dueño pidio
// explicitamente que esta siembra se quede tal cual hasta produccion, para
// poder revisar cada funcionalidad con datos reales de un vistazo.
//
// Cinco partes:
//   1. Auth (portado de OmniUser): 6 roles del sistema + 7 cuentas de
//      prueba (una por rol, mas una extra), contrasena compartida SOLO
//      de prueba.
//   2. Demo del motor: 2 calendarios (vertical elegido — PLAN_DESARROLLO.md
//      §11 — estetica MULTISUCURSAL, ficticia), recursos, horarios,
//      y membresias de calendario (Fase 3).
//   3. El estilista trabaja en AMBAS sucursales con horarios distintos y
//      tiene un colchon de traslado configurado (Fase 4, generalizacion de
//      `location_change_buffer_minutes` de Espiral — ver
//      DOCUMENTO_VIVO_ARQUITECTURA.md §11).
//   4. Esa MISMA cuenta estilista queda VINCULADA al recurso estilista
//      (`resources.user_id`, generaliza `artists.user_id` de Espiral) —
//      asi puede ver su propia agenda con GET /me/schedule, combinada de
//      las 2 sucursales, sin que nadie le de membresia manual en ninguna.
//   5. Reservas de demostracion: la original (fija, 2026-12-15, la que
//      usan los scripts de prueba) MAS un lote fechado alrededor del
//      2026-09-11 (cuando se sembro este lote) — para que la Fase 5b
//      (vistas de calendario) tenga contenido real que revisar al abrir
//      el panel sin tener que navegar 3 meses al futuro.
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

// `key` distingue cuentas del mismo rol (dos cuentas pueden ser "usuario"
// — la generica y la del estilista — y necesitan cada una su propio id
// real, `key` es lo que evita que una sobrescriba a la otra al armar el
// mapa de abajo).
const TEST_ACCOUNTS = [
  { key: 'super', email: 'super+omniagenda@example.com', role: 'super' },
  { key: 'director', email: 'director+omniagenda@example.com', role: 'director' },
  { key: 'admin', email: 'admin+omniagenda@example.com', role: 'admin' },
  { key: 'manager', email: 'manager+omniagenda@example.com', role: 'manager' },
  { key: 'staff', email: 'staff+omniagenda@example.com', role: 'staff' },
  { key: 'usuario', email: 'usuario+omniagenda@example.com', role: 'usuario' },
  // Rol "usuario" a proposito — el vinculo recurso<->cuenta es ORTOGONAL
  // al RBAC (PLAN_DESARROLLO.md/DOCUMENTO_VIVO_ARQUITECTURA.md §13): no
  // hace falta un rol especial para que una cuenta represente un recurso.
  { key: 'estilista', email: 'estilista+omniagenda@example.com', role: 'usuario' },
] as const;

// ─────────────────────────── 2. DEMO ───────────────────────────

const CAL = '00000000-0000-4000-8000-00000000ca11'; // Sucursal Centro
const CAL_NORTE = '00000000-0000-4000-8000-00000000ca12'; // Sucursal Norte
const R_ESTILISTA = '00000000-0000-4000-8000-0000000000e1';
const R_MANICURISTA = '00000000-0000-4000-8000-0000000000e2';
const R_ESTACION = '00000000-0000-4000-8000-0000000000e3';
const BOOKING = '00000000-0000-4000-8000-0000000000b1';

const L_A_V = { open: '10:00', close: '19:00' };
const semanaLaboral = { mon: L_A_V, tue: L_A_V, wed: L_A_V, thu: L_A_V, fri: L_A_V, sat: { open: '10:00', close: '15:00' }, sun: null };
// El estilista, en la sucursal Norte, SOLO martes y jueves (dias distintos
// a los de Centro a proposito — asi una reserva en Centro y otra el mismo
// dia en Norte son un caso real de "cambio de sucursal", no un choque de
// horario trivial).
const martesJueves = { mon: null, tue: L_A_V, wed: null, thu: L_A_V, fri: null, sat: null, sun: null };

/**
 * Reservas de demostracion visual — fechas FIJAS alrededor del
 * 2026-09-11 (cuando se escribio este lote), a proposito NO relativas a
 * "hoy" en tiempo de ejecucion: el dueño pidio que esta siembra se quede
 * tal cual hasta produccion, no que se recalcule cada vez que se vuelve a
 * sembrar. Cubre 2 semanas, las 2 sucursales, los 3 recursos y los 4
 * estados reales, para poder revisar cada vista de calendario (Fase 5b)
 * con contenido real sin tener que navegar meses al futuro hasta la
 * reserva de ejemplo original (2026-12-15).
 *
 * El estilista SOLO aparece en Centro lunes/miercoles/viernes/sabado y en
 * Norte martes/jueves — coherente con `schedule_rules` de arriba, nunca
 * el mismo dia en las 2 sucursales (ese caso ya lo prueba el colchon
 * entre calendarios en `agenda-e2e.sh` §6.5, no hace falta repetirlo aqui
 * con datos de demostracion visual).
 */
const DEMO_BOOKINGS: Array<{
  id: string;
  calendarId: string;
  resourceIds: string[];
  title: string;
  status: 'confirmada' | 'pendiente' | 'cancelada' | 'completada';
  start: Date;
  end: Date;
}> = [
  { id: '00000000-0000-4000-8000-0000000000b2', calendarId: CAL, resourceIds: [R_ESTILISTA], title: 'Corte y barba (demo)', status: 'confirmada', start: new Date('2026-09-07T16:00:00.000Z'), end: new Date('2026-09-07T17:00:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000b3', calendarId: CAL, resourceIds: [R_MANICURISTA], title: 'Manicure gel (demo)', status: 'confirmada', start: new Date('2026-09-07T17:30:00.000Z'), end: new Date('2026-09-07T18:15:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000b4', calendarId: CAL_NORTE, resourceIds: [R_ESTILISTA], title: 'Corte (Sucursal Norte, demo)', status: 'confirmada', start: new Date('2026-09-08T16:00:00.000Z'), end: new Date('2026-09-08T17:00:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000b5', calendarId: CAL, resourceIds: [R_ESTILISTA, R_ESTACION], title: 'Coloración (demo)', status: 'pendiente', start: new Date('2026-09-09T18:00:00.000Z'), end: new Date('2026-09-09T19:00:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000b6', calendarId: CAL, resourceIds: [R_MANICURISTA], title: 'Manicure — canceló la clienta (demo)', status: 'cancelada', start: new Date('2026-09-09T20:00:00.000Z'), end: new Date('2026-09-09T20:45:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000b7', calendarId: CAL_NORTE, resourceIds: [R_ESTILISTA], title: 'Corte y peinado (Sucursal Norte, demo)', status: 'confirmada', start: new Date('2026-09-10T17:00:00.000Z'), end: new Date('2026-09-10T18:00:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000b8', calendarId: CAL, resourceIds: [R_ESTILISTA], title: 'Corte matutino (demo)', status: 'completada', start: new Date('2026-09-11T16:00:00.000Z'), end: new Date('2026-09-11T16:45:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000b9', calendarId: CAL, resourceIds: [R_MANICURISTA], title: 'Manicure (demo)', status: 'confirmada', start: new Date('2026-09-11T19:00:00.000Z'), end: new Date('2026-09-11T19:45:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000ba', calendarId: CAL, resourceIds: [R_ESTACION], title: 'Reservación de estación (demo)', status: 'pendiente', start: new Date('2026-09-11T22:00:00.000Z'), end: new Date('2026-09-11T23:00:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000bb', calendarId: CAL, resourceIds: [R_ESTILISTA], title: 'Corte de fin de semana (demo)', status: 'confirmada', start: new Date('2026-09-12T16:00:00.000Z'), end: new Date('2026-09-12T17:00:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000bc', calendarId: CAL, resourceIds: [R_MANICURISTA], title: 'Manicure (demo)', status: 'confirmada', start: new Date('2026-09-12T17:00:00.000Z'), end: new Date('2026-09-12T17:45:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000bd', calendarId: CAL, resourceIds: [R_ESTILISTA], title: 'Corte y peinado (demo)', status: 'confirmada', start: new Date('2026-09-14T16:00:00.000Z'), end: new Date('2026-09-14T17:00:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000be', calendarId: CAL_NORTE, resourceIds: [R_ESTILISTA], title: 'Corte (Sucursal Norte, demo)', status: 'pendiente', start: new Date('2026-09-15T16:00:00.000Z'), end: new Date('2026-09-15T17:00:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000bf', calendarId: CAL, resourceIds: [R_ESTACION, R_MANICURISTA], title: 'Pedicure + manicure combo (demo)', status: 'confirmada', start: new Date('2026-09-16T21:00:00.000Z'), end: new Date('2026-09-16T22:00:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000c0', calendarId: CAL_NORTE, resourceIds: [R_ESTILISTA], title: 'Corte (Sucursal Norte, demo)', status: 'confirmada', start: new Date('2026-09-17T20:00:00.000Z'), end: new Date('2026-09-17T21:00:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000c1', calendarId: CAL, resourceIds: [R_ESTILISTA], title: 'Corte (demo)', status: 'confirmada', start: new Date('2026-09-18T16:00:00.000Z'), end: new Date('2026-09-18T17:00:00.000Z') },
  { id: '00000000-0000-4000-8000-0000000000c2', calendarId: CAL, resourceIds: [R_MANICURISTA], title: 'Manicure (demo)', status: 'confirmada', start: new Date('2026-09-19T16:00:00.000Z'), end: new Date('2026-09-19T16:45:00.000Z') },
];

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
  const userIdByKey = new Map<string, string>();
  for (const acc of TEST_ACCOUNTS) {
    const user = await prisma.users.upsert({
      where: { email: acc.email },
      update: {},
      create: {
        email: acc.email,
        password_hash: testPasswordHash,
        name: `Cuenta de prueba (${acc.key})`,
        role_id: roleByName.get(acc.role)!,
      },
    });
    userIdByKey.set(acc.key, user.user_id);
  }
  console.log(`  ${TEST_ACCOUNTS.length} cuentas (password compartida: ${TEST_PASSWORD})`);

  // --- Demo del motor: estetica MULTISUCURSAL (ficticia) ---
  console.log('Sembrando calendarios (2 sucursales) + recursos de demo...');
  const centro = { name: 'Demo — Estetica, Sucursal Centro (ficticia)', timezone: 'America/Mexico_City', visibility: 'busy_only' };
  const norte = { name: 'Demo — Estetica, Sucursal Norte (ficticia)', timezone: 'America/Mexico_City', visibility: 'busy_only' };
  await prisma.calendars.upsert({ where: { calendar_id: CAL }, update: centro, create: { calendar_id: CAL, ...centro } });
  await prisma.calendars.upsert({ where: { calendar_id: CAL_NORTE }, update: norte, create: { calendar_id: CAL_NORTE, ...norte } });
  for (const r of [
    // 45 min de colchon: el tiempo real de traslado entre las 2 sucursales
    // ficticias — generaliza `location_change_buffer_minutes` de Espiral
    // (ahi vivia en el artista; aqui vive en el recurso, sin nombre de
    // negocio). Ver DOCUMENTO_VIVO_ARQUITECTURA.md §11.
    { resource_id: R_ESTILISTA, name: 'Estilista de prueba', kind: 'person', calendar_switch_buffer_minutes: 45 },
    { resource_id: R_MANICURISTA, name: 'Manicurista de prueba', kind: 'person', calendar_switch_buffer_minutes: 0 },
    { resource_id: R_ESTACION, name: 'Estacion 1', kind: 'room', calendar_switch_buffer_minutes: 0 },
  ]) {
    await prisma.resources.upsert({
      where: { resource_id: r.resource_id },
      update: { calendar_switch_buffer_minutes: r.calendar_switch_buffer_minutes },
      create: r,
    });
  }
  for (const rid of [R_ESTILISTA, R_MANICURISTA, R_ESTACION]) {
    await prisma.schedule_rules.upsert({
      where: { resource_id_calendar_id: { resource_id: rid, calendar_id: CAL } },
      update: { weekly_hours: semanaLaboral },
      create: { resource_id: rid, calendar_id: CAL, weekly_hours: semanaLaboral },
    });
  }
  // El estilista TAMBIEN atiende en la sucursal Norte, martes y jueves —
  // el caso real que motiva el colchon entre calendarios.
  await prisma.schedule_rules.upsert({
    where: { resource_id_calendar_id: { resource_id: R_ESTILISTA, calendar_id: CAL_NORTE } },
    update: { weekly_hours: martesJueves },
    create: { resource_id: R_ESTILISTA, calendar_id: CAL_NORTE, weekly_hours: martesJueves },
  });

  console.log('Vinculando la cuenta "estilista" al recurso estilista (resources.user_id)...');
  // Generaliza artists.user_id de Espiral: el recurso sigue siendo la
  // ficha real (horario, colchon); la cuenta es solo la credencial. Con
  // esto, GET /me/schedule le muestra su agenda combinada de las 2
  // sucursales sin necesitar membresia de calendario en ninguna.
  const estilistaUserId = userIdByKey.get('estilista');
  if (estilistaUserId) {
    await prisma.resources.update({ where: { resource_id: R_ESTILISTA }, data: { user_id: estilistaUserId } });
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
        created_by: userIdByKey.get('manager') ?? null,
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

  console.log(`Sembrando ${DEMO_BOOKINGS.length} reservas de demostracion (alrededor del 2026-09-11)...`);
  for (const b of DEMO_BOOKINGS) {
    const already = await prisma.bookings.findUnique({ where: { booking_id: b.id } });
    if (already) continue;
    await prisma.bookings.create({
      data: {
        booking_id: b.id,
        calendar_id: b.calendarId,
        title: b.title,
        status: b.status,
        source_type: 'demo',
        source_id: b.id,
        created_by: userIdByKey.get('manager') ?? null,
        starts_at: b.start,
        ends_at: b.end,
        booking_resources: {
          create: b.resourceIds.map((rid) => ({ resource_id: rid, start_time: b.start, end_time: b.end, status: b.status, blocking: true })),
        },
      },
    });
  }

  console.log('Sembrando membresias de las 2 sucursales (Fase 3)...');
  // La cuenta "staff" NO es admin global, pero se le da rol `manager`
  // SOBRE ambas sucursales (una recepcionista que ve las dos). La cuenta
  // "usuario" recibe `booker` solo en Centro. Asi el barrido de permisos
  // por calendario tiene con que probarse en ambos sentidos.
  const membershipSeed: Array<[string, string, 'viewer' | 'booker' | 'manager']> = [
    ['staff', CAL, 'manager'],
    ['staff', CAL_NORTE, 'manager'],
    ['usuario', CAL, 'booker'],
  ];
  for (const [role, calId, calRole] of membershipSeed) {
    const uid = userIdByKey.get(role);
    if (!uid) continue;
    await prisma.calendar_members.upsert({
      where: { calendar_id_user_id: { calendar_id: calId, user_id: uid } },
      update: { calendar_role: calRole },
      create: { calendar_id: calId, user_id: uid, calendar_role: calRole, granted_by: 'seed' },
    });
  }

  const counts = {
    roles: await prisma.roles.count(),
    users: await prisma.users.count(),
    calendars: await prisma.calendars.count(),
    resources: await prisma.resources.count(),
    schedule_rules: await prisma.schedule_rules.count(),
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
