/* ZIP HTML Opener - service worker
   Menyajikan file hasil ekstrak ZIP (disimpan di Cache API) di alamat virtual <scope>__zip__/... */
const CACHE = 'zip-opener-v1';
const SCOPE = self.registration.scope;
const BASE = new URL(SCOPE).pathname + '__zip__/';
const keyFor = p => SCOPE + 'k/' + encodeURIComponent(p);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || !u.pathname.startsWith(BASE)) return;
  e.respondWith(serve(e.request, u));
});

async function serve(req, u) {
  let p = u.pathname.slice(BASE.length);
  try { p = decodeURIComponent(p); } catch (_) {}
  const cache = await caches.open(CACHE);
  let res = await cache.match(keyFor(p));
  if (!res && (p === '' || p.endsWith('/'))) res = await cache.match(keyFor(p + 'index.html'));
  if (!res) {
    return new Response('File tidak ada di dalam ZIP: ' + p, {
      status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  const range = req.headers.get('range');
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return res;

  // Dukungan Range supaya audio/video bisa seek (wajib untuk Safari)
  const blob = await res.blob();
  const size = blob.size;
  let s, e;
  if (m[1] === '') { s = Math.max(0, size - parseInt(m[2], 10)); e = size - 1; }
  else { s = parseInt(m[1], 10); e = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1); }
  if (s >= size || s > e) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  }
  return new Response(blob.slice(s, e + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${s}-${e}/${size}`,
      'Content-Length': String(e - s + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}
