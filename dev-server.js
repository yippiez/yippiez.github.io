#!/usr/bin/env node
// Zero-dependency static dev server with live reload.
// Usage: node dev-server.js [port]   (default 8080)
// Serves the repo root and reloads any open page when a file changes.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2] || process.env.PORT || '8080', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
};

// live-reload client injected into every HTML page
const RELOAD_SNIPPET = `
<script>
(function(){
  var es = new EventSource('/__livereload');
  es.onmessage = function(){ location.reload(); };
  es.onerror = function(){ /* server restarting; EventSource auto-retries */ };
})();
</script>`;

const clients = new Set();
function broadcast() {
  for (const res of clients) res.write('data: reload\n\n');
}

// debounce rapid bursts of change events
let timer = null;
function scheduleReload(file) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log('  ↻ change:', file, '→ reloading', clients.size, 'client(s)');
    broadcast();
  }, 80);
}

try {
  fs.watch(ROOT, { recursive: true }, (_evt, file) => {
    if (!file) return;
    if (file.includes('.git/') || file.startsWith('.git')) return;
    if (file.endsWith('~') || file.endsWith('.swp')) return;
    scheduleReload(file);
  });
} catch (e) {
  console.warn('recursive watch unavailable:', e.message);
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // live-reload SSE stream
  if (urlPath === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('retry: 500\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let rel = urlPath;
  if (rel.endsWith('/')) rel += 'index.html';
  const fp = path.join(ROOT, rel);

  // keep requests inside the repo
  if (!fp.startsWith(ROOT)) return send(res, 403, 'text/plain', 'forbidden');

  fs.readFile(fp, (err, data) => {
    if (err) {
      // fall back to directory index
      fs.readFile(path.join(fp, 'index.html'), (e2, d2) => {
        if (e2) return send(res, 404, 'text/plain', 'not found: ' + rel);
        send(res, 200, MIME['.html'], injectReload(d2));
      });
      return;
    }
    const ext = path.extname(fp).toLowerCase();
    if (ext === '.html') return send(res, 200, MIME['.html'], injectReload(data));
    send(res, 200, MIME[ext] || 'application/octet-stream', data);
  });
});

function injectReload(buf) {
  const html = buf.toString('utf8');
  if (html.includes('</body>')) return html.replace('</body>', RELOAD_SNIPPET + '\n</body>');
  return html + RELOAD_SNIPPET;
}

server.listen(PORT, () => {
  console.log(`\n  dev server + live reload`);
  console.log(`  ├─ http://localhost:${PORT}/url/molecule/`);
  console.log(`  ├─ http://localhost:${PORT}/url/cad/`);
  console.log(`  └─ watching ${ROOT} (edit a file to auto-reload)\n`);
});
