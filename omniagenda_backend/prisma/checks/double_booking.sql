-- Verificacion en vivo de la restriccion `no_overlapping_resource_bookings`.
-- Corre dentro de UNA transaccion que hace ROLLBACK al final: no deja datos.
--
--   docker compose exec -T omniagenda_db \
--     psql -U omniagenda_user -d omniagenda_db -v ON_ERROR_STOP=1 \
--     -f - < omniagenda_backend/prisma/checks/double_booking.sql
--
-- Cada bloque imprime PASS o FAIL. Si algo imprime FAIL, la garantia esta rota.

\set ON_ERROR_STOP on
BEGIN;

-- --- Datos base -------------------------------------------------------------
INSERT INTO calendars (calendar_id, name, timezone)
  VALUES ('11111111-1111-1111-1111-111111111111', 'check', 'America/Mexico_City');
INSERT INTO resources (resource_id, name)
  VALUES ('22222222-2222-2222-2222-222222222222', 'recurso A'),
         ('33333333-3333-3333-3333-333333333333', 'recurso B');
INSERT INTO bookings (booking_id, calendar_id, status, starts_at, ends_at)
  VALUES ('44444444-4444-4444-4444-444444444444',
          '11111111-1111-1111-1111-111111111111', 'confirmada',
          '2026-06-15T10:00:00-06:00', '2026-06-15T13:00:00-06:00');

-- Reserva ancla: recurso A, 10:00–11:00, bloqueante, confirmada.
INSERT INTO booking_resources (booking_id, resource_id, start_time, end_time, status, blocking)
  VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
          '2026-06-15T10:00:00-06:00', '2026-06-15T11:00:00-06:00', 'confirmada', true);

-- --- 1) Traslape real, mismo recurso, ambos bloqueantes -> DEBE FALLAR ------
SAVEPOINT s1;
DO $$
BEGIN
  INSERT INTO booking_resources (booking_id, resource_id, start_time, end_time, status, blocking)
    VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
            '2026-06-15T10:30:00-06:00', '2026-06-15T11:30:00-06:00', 'confirmada', true);
  RAISE EXCEPTION 'FAIL 1: la base ACEPTO un traslape que debia rechazar';
EXCEPTION
  WHEN exclusion_violation THEN RAISE NOTICE 'PASS 1: traslape mismo recurso rechazado por PostgreSQL';
END $$;
ROLLBACK TO SAVEPOINT s1;

-- --- 2) Adyacente exacto (11:00–12:00), mismo recurso -> DEBE PASAR ---------
SAVEPOINT s2;
DO $$
BEGIN
  INSERT INTO booking_resources (booking_id, resource_id, start_time, end_time, status, blocking)
    VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
            '2026-06-15T11:00:00-06:00', '2026-06-15T12:00:00-06:00', 'confirmada', true);
  RAISE NOTICE 'PASS 2: reservas pegadas (fin == inicio) no chocan (rango semiabierto)';
EXCEPTION
  WHEN exclusion_violation THEN RAISE EXCEPTION 'FAIL 2: la base rechazo dos reservas ADYACENTES (deberia permitirlas)';
END $$;
ROLLBACK TO SAVEPOINT s2;

-- --- 3) Traslape pero status = 'cancelada' -> DEBE PASAR -------------------
SAVEPOINT s3;
DO $$
BEGIN
  INSERT INTO booking_resources (booking_id, resource_id, start_time, end_time, status, blocking)
    VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
            '2026-06-15T10:30:00-06:00', '2026-06-15T11:30:00-06:00', 'cancelada', true);
  RAISE NOTICE 'PASS 3: un traslape con estado no-bloqueante (cancelada) no dispara la restriccion';
EXCEPTION
  WHEN exclusion_violation THEN RAISE EXCEPTION 'FAIL 3: una reserva CANCELADA bloqueo el horario';
END $$;
ROLLBACK TO SAVEPOINT s3;

-- --- 4) Traslape pero blocking = false -> DEBE PASAR ----------------------
SAVEPOINT s4;
DO $$
BEGIN
  INSERT INTO booking_resources (booking_id, resource_id, start_time, end_time, status, blocking)
    VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
            '2026-06-15T10:30:00-06:00', '2026-06-15T11:30:00-06:00', 'confirmada', false);
  RAISE NOTICE 'PASS 4: un bloque no-bloqueante (blocking=false) traslapado no dispara la restriccion';
EXCEPTION
  WHEN exclusion_violation THEN RAISE EXCEPTION 'FAIL 4: un bloque blocking=false bloqueo el horario';
END $$;
ROLLBACK TO SAVEPOINT s4;

-- --- 5) Traslape en OTRO recurso -> DEBE PASAR ---------------------------
SAVEPOINT s5;
DO $$
BEGIN
  INSERT INTO booking_resources (booking_id, resource_id, start_time, end_time, status, blocking)
    VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
            '2026-06-15T10:30:00-06:00', '2026-06-15T11:30:00-06:00', 'confirmada', true);
  RAISE NOTICE 'PASS 5: el mismo horario en OTRO recurso es libre';
EXCEPTION
  WHEN exclusion_violation THEN RAISE EXCEPTION 'FAIL 5: un recurso distinto choco contra el ancla';
END $$;
ROLLBACK TO SAVEPOINT s5;

-- --- 6) CHECK de orden temporal (fin <= inicio) -> DEBE FALLAR -----------
SAVEPOINT s6;
DO $$
BEGIN
  INSERT INTO booking_resources (booking_id, resource_id, start_time, end_time, status, blocking)
    VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
            '2026-06-15T12:00:00-06:00', '2026-06-15T12:00:00-06:00', 'confirmada', true);
  RAISE EXCEPTION 'FAIL 6: la base acepto start_time == end_time';
EXCEPTION
  WHEN check_violation THEN RAISE NOTICE 'PASS 6: CHECK (start_time < end_time) rechaza un rango de duracion 0';
END $$;
ROLLBACK TO SAVEPOINT s6;

ROLLBACK;
