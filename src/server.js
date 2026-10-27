const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = parsedUrl.pathname === '/' ? '/src/index.html' : parsedUrl.pathname;
    let filePath = path.join(PUBLIC_DIR, pathname);

    fs.stat(filePath, (statErr, stats) => {
      if (statErr) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        return res.end('<h1>404 Not Found</h1>', 'utf-8');
      }

      if (stats.isDirectory()) {
        const indexCandidate = path.join(filePath, 'index.html');
        if (fs.existsSync(indexCandidate)) {
          filePath = indexCandidate;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          return res.end('<h1>404 Not Found</h1>', 'utf-8');
        }
      }

      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          if (err.code === 'ENOENT' || err.code === 'EISDIR') {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>', 'utf-8');
          } else {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Server Error: ${err.code}`, 'utf-8');
          }
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
        }
      });
    });
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server Error', 'utf-8');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/src/index.html`);
});
