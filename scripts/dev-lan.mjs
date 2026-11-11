// Sobe API e front em modo dev visíveis para a rede local (qualquer aparelho no mesmo Wi-Fi).
// O IP é detectado automaticamente; para escolher outro: LAN_HOST=192.168.0.10 pnpm dev:lan
// Portas: WEB_PORT e API_PORT (padrão 5173 e 3000).
import { spawn } from 'node:child_process';
import { requireLanHost } from './lan-host.mjs';

const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
const API_PORT = Number(process.env.API_PORT ?? 3000);

const host = requireLanHost('dev:lan');

const apiUrl = `http://${host}:${API_PORT}`;
const webUrl = `http://${host}:${WEB_PORT}`;

// Variáveis do ambiente têm prioridade sobre os arquivos .env (no Node e no Vite),
// então os .env de cada app continuam valendo para o `pnpm dev` normal.
const children = [
  spawn('pnpm', ['--filter', '@imperio/api', 'dev'], {
    stdio: 'inherit',
    detached: true,
    env: {
      ...process.env,
      PORT: String(API_PORT),
      // Libera o front tanto pelo localhost quanto pelo IP da rede.
      WEB_ORIGIN: `http://localhost:${WEB_PORT},${webUrl}`,
    },
  }),
  spawn('pnpm', ['--filter', '@imperio/web', 'exec', 'vite', '--host', '0.0.0.0', '--port', String(WEB_PORT), '--strictPort'], {
    stdio: 'inherit',
    detached: true,
    env: {
      ...process.env,
      // O navegador de outro aparelho precisa chamar a API pelo IP, não por localhost.
      VITE_API_URL: apiUrl,
    },
  }),
];

console.log(`\n  Finanças na rede: ${webUrl}\n  API na rede:      ${apiUrl}\n`);

// Cada filho roda no próprio grupo de processos (detached): encerrar o grupo
// derruba também os netos (nest, vite), não só o pnpm. O SIGKILL depois de uns
// segundos pega o que tiver subido no meio do encerramento (ex.: nest em watch).
let stopping = false;
function signalAll(signal) {
  for (const child of children) {
    try {
      process.kill(-child.pid, signal);
    } catch {
      // grupo já encerrado
    }
  }
}
function stop() {
  if (stopping) return;
  stopping = true;
  signalAll('SIGTERM');
  setTimeout(() => {
    signalAll('SIGKILL');
    process.exit();
  }, 3000);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) {
  child.on('exit', (code) => {
    if (!stopping) process.exitCode = code ?? 0;
    stop();
  });
}
