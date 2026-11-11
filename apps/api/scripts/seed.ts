// Cria as categorias padrão do clube. Pode rodar mais de uma vez: ignora as que já existem.
import { createDb } from '../src/db/client.js';
import { categories } from '../src/db/schema.js';

try {
  process.loadEnvFile();
} catch {
  // sem .env
}

const DEFAULTS = [
  { type: 'entrada', name: 'Buy-in torneio', color: '#1b7a4b' },
  { type: 'entrada', name: 'Venda do bar', color: '#2e8c8c' },
  { type: 'entrada', name: 'Buy-in cash', color: '#2f6f9f' },
  { type: 'saida', name: 'Premiação torneio', color: '#b8382e' },
  { type: 'saida', name: 'Compras do bar', color: '#d08a1c' },
  { type: 'saida', name: 'Saque cash', color: '#7a5bb5' },
  { type: 'saida', name: 'Marketing', color: '#d0629b' },
  { type: 'saida', name: 'Funcionários', color: '#3b6ea8' },
] as const;

const db = createDb();
const inserted = await db.insert(categories).values([...DEFAULTS]).onConflictDoNothing().returning();
console.log(`${inserted.length} categorias criadas (${DEFAULTS.length - inserted.length} já existiam).`);
process.exit(0);
