// Sobe o Drizzle Studio visível para a rede local.
// Porta: STUDIO_PORT (padrão 4983). Outro IP: LAN_HOST=192.168.0.10 pnpm db:studio:lan
//
// A tela do Studio é a página https://local.drizzle.studio, que chama este servidor (http) pelo
// navegador de quem acessa. Fora do localhost o navegador bloqueia essa mistura https -> http, então
// em cada aparelho é preciso liberar "Conteúdo não seguro" para local.drizzle.studio (uma vez só).
import { spawn } from 'node:child_process';
import { requireLanHost } from './lan-host.mjs';

const PORT = Number(process.env.STUDIO_PORT ?? 4983);
const host = requireLanHost('db:studio:lan');

const child = spawn('pnpm', ['--filter', '@imperio/api', 'exec', 'drizzle-kit', 'studio', '--host', '0.0.0.0', '--port', String(PORT)], {
  stdio: 'inherit',
});

console.log(`
  Drizzle Studio na rede: https://local.drizzle.studio?host=${host}&port=${PORT}
  Neste computador:       https://local.drizzle.studio?port=${PORT}

  Nos outros aparelhos, se a tela ficar carregando: no Chrome/Edge, clique no ícone à esquerda
  do endereço > Configurações do site > "Conteúdo não seguro" > Permitir, e recarregue.
`);

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', (code) => process.exit(code ?? 0));
