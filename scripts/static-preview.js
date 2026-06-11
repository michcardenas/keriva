// Mini servidor estático para previsualizar el build web exportado (dist/).
// No usa el dev-server de Expo (sin HMR), así evita el bucle de recarga del
// navegador headless. Sirve dist/ con fallback SPA a index.html.
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 8082;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = path.join(DIST, urlPath);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Fallback SPA → index.html
      filePath = path.join(DIST, 'index.html');
    }
    fs.readFile(filePath, (e, data) => {
      if (e) {
        res.writeHead(500);
        res.end('Error');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        // Sin caché: el navegador del celular siempre trae la última versión.
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Static preview on http://localhost:${PORT}`);
});
