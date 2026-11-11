// Cria um ADMINISTRADOR (é o primeiro acesso do dono). Colaboradores entram por convite, pela tela.
// Uso: pnpm user:create <usuario> <senha>
//  ou: SEED_PASSWORD="..." pnpm user:create <usuario>   (a senha não fica no histórico do terminal)
import bcrypt from 'bcryptjs';
import { createDb } from '../src/db/client.js';
import { users } from '../src/db/schema.js';

try {
  process.loadEnvFile();
} catch {
  // sem .env
}

const username = process.argv[2]?.trim();
const password = process.argv[3] ?? process.env.SEED_PASSWORD;
if (!username || !password || password.length < 8) {
  console.error('Uso: pnpm user:create <usuario> <senha com 8+ caracteres>');
  process.exit(1);
}

const db = createDb();
const passwordHash = await bcrypt.hash(password, 12);
try {
  await db.insert(users).values({ username, passwordHash, isAdmin: true });
} catch (e) {
  const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
  if (code !== '23505') throw e;
  console.error(`Já existe um usuário chamado "${username}". Nada foi alterado.`);
  process.exit(1);
}
console.log(`Administrador "${username}" criado.`);
process.exit(0);
