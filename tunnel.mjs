#!/usr/bin/env node
/**
 * @file tunnel.mjs — Levanta un túnel HTTPS público hacia el server local
 * para recibir webhooks reales de Zernio (sin dependencias externas).
 *
 * Prioridad de binarios:
 *   1. cloudflared  → quick tunnel (sin cuenta): https://<rand>.trycloudflare.com
 *   2. ngrok        → requiere authtoken configurado: https://<sub>.ngrok.io
 *
 * La URL pública se guarda en `.tunnel-url` (la lee server.mjs en /api/tunnel)
 * y se imprime en consola para registrarla en Zernio.
 *
 * Uso: node tunnel.mjs [port]   (default 8787)
 * Instalación cloudflared (1 línea): ver docs/POST-IMPLEMENTATION.md.
 */
import { spawn, spawnSync } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const PORT = Number(process.argv[2]) || 8787;
const TUNNEL_FILE = join(dirname(fileURLToPath(import.meta.url)), '.tunnel-url');

/** @param {string} name — binario a buscar. @returns {boolean} */
function hasBinary(name) {
  return spawnSync('which', [name], { stdio: 'ignore' }).status === 0;
}

/** Extrae la URL https del stdout de cloudflared (quick tunnel). */
function cloudflaredUrl(line) {
  const m = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  return m ? m[0] : null;
}

/** Obtiene la URL pública desde la API local de ngrok (127.0.0.1:4040). */
function ngrokUrl() {
  return new Promise((resolve) => {
    request('http://127.0.0.1:4040/api/tunnels', (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const tunnel = JSON.parse(body).tunnels.find((t) => t.public_url && t.public_url.startsWith('https'));
          resolve(tunnel ? tunnel.public_url : null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function persist(url) {
  await writeFile(TUNNEL_FILE, url, 'utf8');
  console.log(`[tunnel] URL pública guardada en ${TUNNEL_FILE}`);
  console.log(`[tunnel] REGISTRA EN ZERNIO → Configuración → Webhooks: ${url}/webhooks/zernio?secret=<tu-secret>`);
}

/** Elimina la URL persistida (el túnel ya no sirve). */
async function clearTunnelFile() {
  try {
    await unlink(TUNNEL_FILE);
  } catch {
    // archivo inexistente: ok
  }
}

/** Registra cleanup del child ante cualquier señal de terminación. */
function wireSignals(child) {
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  signals.forEach((sig) => {
    process.on(sig, () => {
      child.kill(sig);
      clearTunnelFile().finally(() => setTimeout(() => process.exit(0), 500));
    });
  });
  child.on('exit', (code) => {
    console.error(`[tunnel] proceso terminado (${code})`);
    clearTunnelFile().finally(() => process.exit(code || 1));
  });
}

async function main() {
  if (hasBinary('cloudflared')) {
    console.log(`[tunnel] cloudflared quick tunnel → http://localhost:${PORT}`);
    const child = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`]);
    let buffer = '';
    let persisted = false;
    wireSignals(child);
    // cloudflared loguea el banner por stderr: se parsea desde ambas corrientes
    const onData = async (chunk) => {
      if (persisted) return; // no acumular más buffer
      buffer += chunk.toString();
      const url = cloudflaredUrl(buffer);
      if (url) {
        persisted = true;
        console.log(`[tunnel] URL HTTPS: ${url}`);
        await persist(url);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    return;
  }

  if (hasBinary('ngrok')) {
    console.log(`[tunnel] ngrok → http://localhost:${PORT} (requiere authtoken configurado)`);
    const child = spawn('ngrok', ['http', String(PORT)]);
    wireSignals(child);
    const timer = setInterval(async () => {
      const url = await ngrokUrl();
      if (url) {
        clearInterval(timer);
        console.log(`[tunnel] URL HTTPS: ${url}`);
        await persist(url);
      }
    }, 1500);
    return;
  }

  console.error('[tunnel] No se encontró cloudflared ni ngrok.');
  console.error('[tunnel] Instala cloudflared (sin cuenta):');
  console.error('  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared');
  process.exit(1);
}

main();
