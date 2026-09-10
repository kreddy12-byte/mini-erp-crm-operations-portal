-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- AlterTable: keep existing staff accounts; password_hash becomes nullable for Google-only users.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

ALTER TABLE "users"
ADD COLUMN "email_verified_at" TIMESTAMPTZ(3),
ADD COLUMN "google_id" TEXT,
ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

-- Existing seeded/staff users remain able to sign in without a new verification email.
UPDATE "users"
SET "email_verified_at" = COALESCE("email_verified_at", "created_at")
WHERE "email_verified_at" IS NULL;

CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_tokens_token_hash_idx" ON "auth_tokens"("token_hash");
CREATE INDEX "auth_tokens_user_id_type_idx" ON "auth_tokens"("user_id", "type");

ALTER TABLE "auth_tokens"
ADD CONSTRAINT "auth_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
