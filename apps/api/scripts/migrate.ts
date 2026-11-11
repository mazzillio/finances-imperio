// Aplica as migrations de ./drizzle usando o mesmo driver da API.
// Funciona no Neon e no Postgres local do docker-compose (via NEON_LOCAL_PROXY),
// e registra em drizzle.__drizzle_migrations, a mesma tabela do drizzle-kit.
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { createDb } from '../src/db/client.js';

try {
  process.loadEnvFile();
} catch {
  // sem .env
}

const db = createDb(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations aplicadas.');
process.exit(0);
