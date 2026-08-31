-- schema.prisma's WorkspaceSetting model had allowGoogleLogin /
-- allowEmailPasswordLogin / allowPublicOnboarding fields that were never
-- captured in the init migration -- the local dev database was kept in
-- sync with `prisma db push` at some point, which updates the schema
-- directly without ever generating a migration file, masking the drift
-- until a fresh `migrate deploy` against a real, migration-only database
-- hit it as a live "column does not exist" error.
ALTER TABLE "workspace_settings"
  ADD COLUMN "allow_google_login" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allow_email_password_login" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allow_public_onboarding" BOOLEAN NOT NULL DEFAULT true;

-- Same drift, users table: password_hash/is_active back the email/password
-- login path fixed earlier today -- without these columns every query
-- touching User (i.e. every authenticated request) would fail the same way.
ALTER TABLE "users"
  ADD COLUMN "password_hash" TEXT,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
