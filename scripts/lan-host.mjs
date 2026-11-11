import { networkInterfaces } from 'node:os';

// Interfaces virtuais (Docker, VMs, VPN) não são a rede local.
const VIRTUAL = /^(docker|br-|veth|virbr|vmnet|vboxnet|tun|tap|tailscale|zt|wg|lo)/;

/** IP desta máquina na rede local. LAN_HOST=<ip> escolhe outro. */
export function lanHost() {
  if (process.env.LAN_HOST) return process.env.LAN_HOST;
  const candidates = Object.entries(networkInterfaces())
    .filter(([name]) => !VIRTUAL.test(name))
    .flatMap(([, addrs]) => addrs ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  // Prefere as faixas típicas de roteador doméstico.
  return candidates.find((ip) => ip.startsWith('192.168.')) ?? candidates[0];
}

export function requireLanHost(command) {
  const host = lanHost();
  if (!host) {
    console.error(`Não achei o IP da rede local. Informe com LAN_HOST=<ip> pnpm ${command}`);
    process.exit(1);
  }
  return host;
}
