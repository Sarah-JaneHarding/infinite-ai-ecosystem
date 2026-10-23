// Prisma 7 moved the connection URL out of schema.prisma. The CLI (migrate, db pull, studio)
// reads it from here; the running application passes a driver adapter to `PrismaClient`
// instead (src/client.ts), so this URL is only ever used by tooling.
//
// `migrate` needs the schema owner's URL, the app needs `app_rw` - see docs/DEV_SETUP.md. Both
// arrive as DATABASE_URL, set by whoever runs the command.
//
// `prisma generate` (our postinstall) loads this file too but never connects, and it must work
// on a machine with no database configured. So a missing DATABASE_URL does not stop the config
// loading; it resolves to a placeholder whose host is unresolvable by definition (RFC 2606's
// `.invalid`), so a `migrate` run without the variable fails at once and says so.

import { defineConfig, env } from 'prisma/config';

const UNSET = 'postgresql://DATABASE_URL-not-set@database.invalid:5432/unset';

function databaseUrl(): string {
  try {
    return env('DATABASE_URL');
  } catch (error) {
    if (error instanceof Error && error.message.includes('DATABASE_URL')) return UNSET;
    throw error;
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: databaseUrl() },
});
