-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "calendar_switch_buffer_minutes" INTEGER NOT NULL DEFAULT 0;

-- ── SQL a mano ──────────────────────────────────────────────────────────
-- Un colchon negativo no tiene sentido fisico. Barato de garantizar en la base.
ALTER TABLE "resources"
  ADD CONSTRAINT "resources_calendar_switch_buffer_non_negative"
  CHECK ("calendar_switch_buffer_minutes" >= 0);
