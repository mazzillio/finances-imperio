import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema.js';

// Driver serverless do Neon via WebSocket: funciona em Node e na Vercel e suporta
// transações interativas (precisamos delas para atualizar daily_totals junto com o lançamento).
neonConfig.webSocketConstructor = ws;

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL não definida. Copie apps/api/.env.example para .env.');

  // Postgres local (docker-compose): o driver fala com o banco através do wsproxy do Neon,
  // sem TLS. Ex.: NEON_LOCAL_PROXY="localhost:5433". Sem a variável, conecta direto no Neon.
  // Lido aqui, e não no topo do módulo, porque os imports rodam antes do loadEnvFile().
  const localProxy = process.env.NEON_LOCAL_PROXY;
  if (localProxy) {
    neonConfig.wsProxy = () => `${localProxy}/v1`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
  }

  const pool = new Pool({ connectionString: url, max: 5 });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
