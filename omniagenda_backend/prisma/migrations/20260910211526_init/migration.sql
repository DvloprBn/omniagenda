-- CreateTable
CREATE TABLE "resources" (
    "resource_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "kind" VARCHAR(30) NOT NULL DEFAULT 'person',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("resource_id")
);

-- CreateTable
CREATE TABLE "calendars" (
    "calendar_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'private',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("calendar_id")
);

-- CreateTable
CREATE TABLE "schedule_rules" (
    "schedule_rule_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource_id" UUID NOT NULL,
    "calendar_id" UUID NOT NULL,
    "weekly_hours" JSONB NOT NULL,
    "recurrence" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("schedule_rule_id")
);

-- CreateTable
CREATE TABLE "time_off" (
    "time_off_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource_id" UUID NOT NULL,
    "calendar_id" UUID,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" VARCHAR(200),
    "created_by" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_off_pkey" PRIMARY KEY ("time_off_id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "booking_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calendar_id" UUID NOT NULL,
    "title" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "source_type" VARCHAR(40),
    "source_id" VARCHAR(64),
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("booking_id")
);

-- CreateTable
CREATE TABLE "booking_resources" (
    "booking_resource_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "booking_resources_pkey" PRIMARY KEY ("booking_resource_id")
);

-- CreateIndex
CREATE INDEX "resources_active_idx" ON "resources"("active");

-- CreateIndex
CREATE INDEX "calendars_active_idx" ON "calendars"("active");

-- CreateIndex
CREATE INDEX "schedule_rules_calendar_id_idx" ON "schedule_rules"("calendar_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_rules_resource_id_calendar_id_key" ON "schedule_rules"("resource_id", "calendar_id");

-- CreateIndex
CREATE INDEX "time_off_resource_id_start_date_end_date_idx" ON "time_off"("resource_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "bookings_calendar_id_starts_at_idx" ON "bookings"("calendar_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_source_type_source_id_idx" ON "bookings"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "booking_resources_booking_id_idx" ON "booking_resources"("booking_id");

-- CreateIndex
CREATE INDEX "booking_resources_resource_id_start_time_idx" ON "booking_resources"("resource_id", "start_time");

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("resource_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("calendar_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("resource_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("calendar_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("calendar_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_resources" ADD CONSTRAINT "booking_resources_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_resources" ADD CONSTRAINT "booking_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("resource_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- ============================================================================
-- A PARTIR DE AQUI: SQL escrito A MANO. El DSL de Prisma no expresa `EXCLUDE`
-- ni `CHECK`. Si se regenera esta migracion, hay que volver a pegar este
-- bloque. Ver DOCUMENTO_VIVO_ARQUITECTURA.md §1 y omniagenda_backend/prisma/
-- checks/status-sync.mjs (verifica que el WHERE de abajo siga coincidiendo
-- con NON_BLOCKING_STATUSES de @omniagenda/core).
-- ============================================================================

-- btree_gist permite mezclar una comparacion de igualdad (=) sobre un uuid
-- con una de traslape (&&) sobre un rango, dentro del mismo indice GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Rangos con extremos coherentes (inicio < fin). Barato y atrapa datos
-- corruptos antes de que lleguen a la logica de traslape.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_time_order" CHECK ("starts_at" < "ends_at");

ALTER TABLE "booking_resources"
  ADD CONSTRAINT "booking_resources_time_order" CHECK ("start_time" < "end_time");

-- Ausencia: rango de dias inclusivo, mismo criterio que `artist_time_off`
-- de Espiral ("se va 15 dias" -> start_date == end_date es valido).
ALTER TABLE "time_off"
  ADD CONSTRAINT "time_off_date_range_valid" CHECK ("start_date" <= "end_date");

-- ── LA GARANTIA REAL CONTRA DOBLE-RESERVA ──
-- Dos renglones del MISMO recurso cuyos rangos [start_time, end_time) se
-- traslapan no pueden coexistir, SIEMPRE QUE ambos bloqueen y su estado
-- ocupe el calendario. tstzrange(a, b) es '[)' por defecto: inclusivo en
-- el inicio, exclusivo en el fin — igual semantica que el `Interval`
-- semiabierto de omniagenda_core, asi que dos reservas pegadas (fin == 
-- inicio) NO chocan.
--
-- El WHERE de abajo DEBE coincidir, caracter por caracter, con
-- NON_BLOCKING_STATUSES de omniagenda_core/src/conflict/status.ts.
ALTER TABLE "booking_resources"
  ADD CONSTRAINT "no_overlapping_resource_bookings"
  EXCLUDE USING gist (
    "resource_id" WITH =,
    tstzrange("start_time", "end_time") WITH &&
  )
  WHERE (blocking = true AND status NOT IN ('cancelada', 'rechazada', 'expirada'));
