const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname);
const port = process.env.PORT || 8000;

const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (!urlPath || urlPath === '/') urlPath = '/index.html';
    // prevent path traversal
    const safePath = path.normalize(path.join(root, urlPath));
    if (!safePath.startsWith(root)) {
      res.writeHead(400); res.end('Bad request'); return;
    }
    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404); res.end('Not found'); return;
      }
      const ext = path.extname(safePath).toLowerCase();
      const ctype = types[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ctype, 'Cache-Control': 'no-cache' });
      const stream = fs.createReadStream(safePath);
      stream.pipe(res);
    });
  } catch (e) {
    res.writeHead(500); res.end('Server error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Serving ${root} on http://0.0.0.0:${port}`);
});
