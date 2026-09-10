-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "created_by" VARCHAR(64);

-- CreateTable
CREATE TABLE "roles" (
    "role_id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 0,
    "max_count" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(150),
    "role_id" INTEGER NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "totp_secret_encrypted" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "token_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMPTZ(6),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("token_id")
);

-- CreateTable
CREATE TABLE "totp_recovery_codes" (
    "code_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "totp_recovery_codes_pkey" PRIMARY KEY ("code_id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "token_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("token_id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "security_event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fingerprint" VARCHAR(64) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "identifier" TEXT NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "attempts" INTEGER NOT NULL,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'nuevo',
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_note" TEXT,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("security_event_id")
);

-- CreateTable
CREATE TABLE "calendar_members" (
    "calendar_member_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calendar_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "calendar_role" VARCHAR(20) NOT NULL,
    "granted_by" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_members_pkey" PRIMARY KEY ("calendar_member_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "security_events_fingerprint_key" ON "security_events"("fingerprint");

-- CreateIndex
CREATE INDEX "calendar_members_user_id_idx" ON "calendar_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_members_calendar_id_user_id_key" ON "calendar_members"("calendar_id", "user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totp_recovery_codes" ADD CONSTRAINT "totp_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_members" ADD CONSTRAINT "calendar_members_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("calendar_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calendar_members" ADD CONSTRAINT "calendar_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ── SQL a mano ──────────────────────────────────────────────────────────
-- Los 3 roles de calendario son un conjunto cerrado; un valor fuera de la
-- lista es un bug, no un dato. Barato de garantizar en la base.
ALTER TABLE "calendar_members"
  ADD CONSTRAINT "calendar_members_role_valid"
  CHECK ("calendar_role" IN ('viewer', 'booker', 'manager'));
