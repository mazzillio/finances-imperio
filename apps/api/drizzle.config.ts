import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile();
} catch {
  // sem .env: usa as variáveis do ambiente
}

// Migrations usam a conexão direta do Neon: o pooler (PgBouncer em modo transaction)
// não aceita os comandos de sessão que o drizzle-kit usa.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
