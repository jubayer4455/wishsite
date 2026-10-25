const http = require('http');
const fs = require('fs');
const path = require('path');
const proposalsHandler = require('./api/proposals');

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (urlObj.pathname === '/api/proposals') {
    return proposalsHandler(req, res);
  }

  // Serve index.html for root and query routes
  if (urlObj.pathname === '/' || urlObj.pathname === '/index.html') {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) {
        res.statusCode = 500;
        return res.end('Server Error');
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(content);
    });
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`💌 আমাদের গল্প শুরু হোক server running at http://localhost:${PORT}`);
});
