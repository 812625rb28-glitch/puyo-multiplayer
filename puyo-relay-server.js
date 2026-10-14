const http = require('node:http');
const { randomUUID } = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const KEEP_MS = 20 * 60 * 1000; // メッセージを最大20分保持
const MAX_BODY = 16 * 1024;
const topics = new Map();
const ipHits = new Map();

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' });
  res.end(body);
}
function topicMessages(name) {
  const now = Date.now();
  let arr = (topics.get(name) || []).filter(x => now - x.time * 1000 < KEEP_MS);
  topics.set(name, arr);
  return arr;
}
function allowed(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now(); let a = (ipHits.get(ip) || []).filter(t => now - t < 60000);
  if (a.length >= 180) { ipHits.set(ip, a); return false; }
  a.push(now); ipHits.set(ip, a); return true;
}
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return send(res, 400, 'Bad URL'); }
  const match = url.pathname.match(/^\/([a-zA-Z0-9_-]{1,100})(\/json)?\/?$/);
  if (!match) return send(res, 404, 'Not found');
  const name = match[1], isJson = !!match[2];
  if (req.method === 'POST' && !isJson) {
    if (!allowed(req)) return send(res, 429, 'Rate limit');
    let body = '', tooLarge = false;
    req.on('data', chunk => { body += chunk; if (Buffer.byteLength(body) > MAX_BODY) tooLarge = true; });
    req.on('end', () => {
      if (tooLarge) return send(res, 413, 'Message too large');
      const msg = { id: randomUUID(), time: Math.floor(Date.now() / 1000), event: 'message', message: body };
      const arr = topicMessages(name); arr.push(msg); topics.set(name, arr);
      for (const client of (clients.get(name) || [])) {
        try { client.write(JSON.stringify(msg) + '\n'); } catch {}
      }
      send(res, 200, JSON.stringify({ id: msg.id, time: msg.time }), 'application/json; charset=utf-8');
    });
    return;
  }
  if (req.method === 'GET' && isJson) {
    const raw = url.searchParams.get('since') || 'all';
    let cutoff = 0;
    if (/^\d+$/.test(raw)) cutoff = Number(raw);
    else if (/^(\d+)(s|m|h)$/.test(raw)) { const m = raw.match(/^(\d+)(s|m|h)$/); cutoff = Math.floor(Date.now()/1000) - Number(m[1]) * ({s:1,m:60,h:3600}[m[2]]); }
    const poll = url.searchParams.get('poll') === '1';
    const arr = topicMessages(name).filter(m => !cutoff || m.time >= cutoff);
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
    for (const m of arr) res.write(JSON.stringify(m) + '\n');
    if (poll) return res.end();
    if (!clients.has(name)) clients.set(name, new Set());
    const set = clients.get(name); set.add(res);
    const heartbeat = setInterval(() => { if (!res.destroyed) res.write('\n'); }, 20000);
    req.on('close', () => { clearInterval(heartbeat); set.delete(res); if (!set.size) clients.delete(name); });
    return;
  }
  send(res, 405, 'Method not allowed');
});
const clients = new Map();
server.listen(PORT, '0.0.0.0', () => console.log(`Puyo relay listening on ${PORT}`));
