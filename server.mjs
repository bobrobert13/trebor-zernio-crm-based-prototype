#!/usr/bin/env node
/**
 * @file server.mjs — Servidor ligero del prototipo (sin dependencias externas).
 * - Sirve los estáticos de la raíz (abrir http://localhost:8787/index.html).
 * - Proxy /zernio/* → https://zernio.com/api/v1/* (la key viaja por el header
 *   X-Zernio-Key desde el browser; evita CORS y permite modo live real).
 * - POST /webhooks/zernio?secret=... — receptor de webhooks con verificación
 *   HMAC-SHA256 (x-zernio-signature). Los eventos quedan en memoria y el
 *   frontend hace polling en GET /webhooks/events.
 * - GET /api/health — detección del servidor por el frontend.
 *
 * Uso: node server.mjs  (PORT=8787 por defecto, configurable con env PORT).
 * Para entrega real de webhooks usa un túnel (ngrok http 8787) y registra
 * la URL pública con ?secret=... en Configuración → Webhooks.
 */
import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const ZERNIO = { host: 'zernio.com', base: '/api/v1' };
const MAX_BODY = 10 * 1024 * 1024; // 10 MB
const WEBHOOK_MAX = 200; // eventos en memoria (cola acotada)
const TUNNEL_FILE = join(ROOT, '.tunnel-url');
const USAGE_FILE = join(ROOT, 'data', 'usage.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
  '.yaml': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** Cola de eventos de webhook recibidos (para polling del frontend). */
const webhookEvents = [];

/** Ids ya recibidos (dedupe: Zernio entrega at-least-once). */
const seenWebhookIds = new Set();

/**
 * Medidor local de consumo por workspace (para el panel Billing y detectar
 * abuso por negocio). Persistido en data/usage.json con debounce.
 */
const usageStore = { byKey: {} }; // { [keyHash]: { total, byEndpoint, byDay, updatedAt } }
let usageDirty = false;
let usageTimer = null;

/** Hash corto de la key (nunca persistir el secreto). */
function keyHash(key) {
  return createHash('sha256').update(String(key || '')).digest('hex').slice(0, 16);
}

/** Carga lazy del medidor desde disco (merge: nunca descarta contadores en memoria). */
async function loadUsage() {
  try {
    const raw = await readFile(USAGE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    for (const [hash, entry] of Object.entries(parsed.byKey || {})) {
      if (!usageStore.byKey[hash] || (entry.updatedAt || 0) > (usageStore.byKey[hash].updatedAt || 0)) {
        usageStore.byKey[hash] = entry;
      }
    }
  } catch {
    // sin archivo aún o corrupto: se mantiene lo que haya en memoria
  }
}

/** Poda entradas inactivas y días viejos (retención 90 días). */
function pruneUsage() {
  const cutoff = Date.now() - 90 * 864e5;
  for (const [hash, entry] of Object.entries(usageStore.byKey)) {
    if ((entry.updatedAt || 0) < cutoff) {
      delete usageStore.byKey[hash];
      continue;
    }
    if (entry.byDay) {
      for (const day of Object.keys(entry.byDay)) {
        if (day < new Date(cutoff).toISOString().slice(0, 10)) delete entry.byDay[day];
      }
    }
  }
}

/** Persiste el medidor (debounce 2s; flush inmediato si ya hay timer). */
function scheduleUsageWrite() {
  usageDirty = true;
  if (usageTimer) return;
  usageTimer = setTimeout(async () => {
    usageTimer = null;
    if (!(await flushUsage())) {
      // reintenta en 5s si la escritura falló
      usageTimer = setTimeout(async () => {
        usageTimer = null;
        await flushUsage();
      }, 5000);
    }
  }, 2000);
}

async function flushUsage() {
  if (!usageDirty) return true;
  usageDirty = false;
  try {
    pruneUsage();
    await mkdir(join(ROOT, 'data'), { recursive: true });
    await writeFile(USAGE_FILE, JSON.stringify(usageStore), 'utf8');
    return true;
  } catch (err) {
    usageDirty = true; // reintenta en el próximo flush
    console.error('[usage] no se pudo persistir:', err.message);
    return false;
  }
}

/** Registra una llamada del proxy para la key dada. */
function recordUsage(apiKey, endpoint) {
  const hash = keyHash(apiKey);
  const day = new Date().toISOString().slice(0, 10);
  const entry = (usageStore.byKey[hash] = usageStore.byKey[hash] || { total: 0, byEndpoint: {}, byDay: {}, updatedAt: Date.now() });
  entry.total += 1;
  entry.byEndpoint[endpoint] = (entry.byEndpoint[endpoint] || 0) + 1;
  entry.byDay[day] = (entry.byDay[day] || 0) + 1;
  entry.updatedAt = Date.now();
  scheduleUsageWrite();
}

/** Lee el medidor de un workspace (por hash) o todos si no se filtra. */
async function usageSnapshot(wsHash) {
  await loadUsage();
  if (usageDirty) await flushUsage();
  if (wsHash) return { ws: wsHash, ...(usageStore.byKey[wsHash] || { total: 0, byEndpoint: {}, byDay: {} }) };
  return { workspaces: usageStore.byKey };
}

/**
 * Lee la URL pública del túnel (env TUNNEL_URL o fichero .tunnel-url).
 * @returns {Promise<string|null>} URL https del túnel o null.
 */
async function tunnelUrl() {
  if (process.env.TUNNEL_URL) return process.env.TUNNEL_URL;
  try {
    const info = await stat(TUNNEL_FILE);
    if (Date.now() - info.mtimeMs > 10 * 60 * 1000) return null; // URL caducada (túnel muerto)
    const raw = await readFile(TUNNEL_FILE, 'utf8');
    const url = raw.trim();
    return url.startsWith('https://') ? url : null;
  } catch {
    return null;
  }
}

/** Headers CORS restringidos: solo refleja origen si es localhost (protege el feed de webhooks). */
function corsHeaders(req) {
  const origin = req.headers.origin || '';
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    ...(local ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Zernio-Key, X-Zernio-Secret',
  };
}

/** Lee el body completo de una petición (con límite). */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Body demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Verifica x-zernio-signature (HMAC-SHA256 del body crudo con el secret). */
function verifySignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Proxy: reenvía la petición al API de Zernio inyectando la key. */
function proxyZernio(req, res, apiPath, apiKey) {
  if (!apiKey) {
    res.writeHead(401, { ...corsHeaders(req), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Falta X-Zernio-Key en la petición' }));
    return;
  }
  // Medidor local de consumo (panel Billing del centro)
  recordUsage(apiKey, apiPath.split('?')[0]);
  const upstream = httpsRequest(
    {
      host: ZERNIO.host,
      path: `${ZERNIO.base}${apiPath}`,
      method: req.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}),
        ...(req.headers['content-length'] ? { 'Content-Length': req.headers['content-length'] } : {}),
      },
    },
    (upRes) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.writeHead(upRes.statusCode || 502, {
        ...corsHeaders(req),
        ...pickHeaders(upRes.headers),
      });
      upRes.pipe(res);
    }
  );
  upstream.setTimeout(15000, () => upstream.destroy(new Error('upstream timeout')));
  upstream.on('error', (err) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, { ...corsHeaders(req), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Proxy: ${err.message}` }));
  });
  req.on('error', () => {});
  res.on('error', () => {});
  req.pipe(upstream);
}

/** Reenvía solo headers seguros del upstream. */
function pickHeaders(headers) {
  const safe = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!['transfer-encoding', 'connection', 'keep-alive'].includes(k)) safe[k] = v;
  }
  return safe;
}

/** Sirve un estático de la raíz (protege contra path traversal). */
async function serveStatic(req, res, urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, corsHeaders(req));
    res.end('Forbidden');
    return;
  }
  try {
    const info = await stat(filePath);
    const target = info.isDirectory() ? join(filePath, 'index.html') : filePath;
    const body = await readFile(target);
    res.writeHead(200, { ...corsHeaders(req), 'Content-Type': MIME[extname(target)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { ...corsHeaders(req), 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

/** Receptor de webhooks: verifica firma y encola el evento. */
async function handleWebhook(req, res, url) {
  const secret = url.searchParams.get('secret') || '';
  const body = await readBody(req);
  const signature = req.headers['x-zernio-signature'];
  if (!verifySignature(body, signature, secret)) {
    res.writeHead(401, { ...corsHeaders(req), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Firma HMAC inválida (x-zernio-signature)' }));
    return;
  }
  let event;
  try {
    event = JSON.parse(body.toString('utf8'));
  } catch {
    event = { raw: body.toString('utf8') };
  }
  // Dedupe por id de evento (entrega at-least-once de Zernio)
  const eventId = event && (event.id || (event.message && event.message.id));
  if (eventId) {
    if (seenWebhookIds.has(eventId)) {
      res.writeHead(200, { ...corsHeaders(req), 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, duplicate: true }));
      return;
    }
    seenWebhookIds.add(eventId);
    if (seenWebhookIds.size > WEBHOOK_MAX * 2) {
      const first = seenWebhookIds.values().next().value;
      seenWebhookIds.delete(first);
    }
  }
  webhookEvents.unshift({ id: eventId || null, receivedAt: new Date().toISOString(), event });
  if (webhookEvents.length > WEBHOOK_MAX) webhookEvents.length = WEBHOOK_MAX;
  res.writeHead(200, { ...corsHeaders(req), 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, received: webhookEvents.length }));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  try {
    if (pathname === '/api/health') {
      res.writeHead(200, { ...corsHeaders(req), 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, server: 'zernio-mvp', proxy: true, webhooks: true, uptime: process.uptime() }));
      return;
    }

    if (pathname === '/api/tunnel') {
      const url = await tunnelUrl();
      res.setHeader('Vary', 'Origin');
      res.writeHead(200, { ...corsHeaders(req), 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url }));
      return;
    }

    if (pathname === '/api/usage') {
      const ws = url.searchParams.get('ws');
      const apiKey = req.headers['x-zernio-key'] || '';
      // Sin ws: snapshot completo del centro — solo desde la propia máquina
      if (!ws && !isLoopback(req)) {
        res.writeHead(403, { ...corsHeaders(req), 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Snapshot global solo disponible en localhost' }));
        return;
      }
      // Con ws: solo el dueño de esa key (el hash debe coincidir con la key del request)
      if (ws && keyHash(apiKey) !== ws) {
        res.writeHead(403, { ...corsHeaders(req), 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Medidor: hash de key no coincide' }));
        return;
      }
      res.setHeader('Vary', 'Origin');
      res.writeHead(200, { ...corsHeaders(req), 'Content-Type': 'application/json' });
      res.end(JSON.stringify(await usageSnapshot(ws)));
      return;
    }

    if (pathname === '/webhooks/events') {
      res.writeHead(200, { ...corsHeaders(req), 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ events: webhookEvents }));
      return;
    }

    if (pathname === '/webhooks/zernio') {
      await handleWebhook(req, res, url);
      return;
    }

    if (pathname.startsWith('/zernio/')) {
      proxyZernio(req, res, pathname.slice('/zernio'.length) + url.search, req.headers['x-zernio-key']);
      return;
    }

    await serveStatic(req, res, pathname === '/' ? '/index.html' : pathname);
  } catch (err) {
    res.writeHead(500, { ...corsHeaders(req), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Error interno' }));
  }
});

/** ¿El request viene de la propia máquina? (protege el snapshot global del medidor). */
function isLoopback(req) {
  const addr = req.socket && req.socket.remoteAddress;
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

server.listen(PORT, () => {
  console.log(`[zernio-mvp] http://localhost:${PORT}`);
  console.log(`[zernio-mvp] proxy /zernio/* → https://${ZERNIO.host}${ZERNIO.base}/*`);
  console.log(`[zernio-mvp] webhooks  POST /webhooks/zernio?secret=...  (GET /webhooks/events)`);
});

// Flush del medidor al apagar (no perder los últimos 2s de conteos)
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, async () => {
    await flushUsage();
    process.exit(0);
  });
}
