'use strict';
const http = require('http');

const TARGET = (process.env.REDIRECT_TARGET || 'http://76.164.197.86:25566').replace(/\/$/, '');
const PORT = Number(process.env.PORT || 10000);

http.createServer((req, res) => {
  const path = req.url || '/';
  res.writeHead(302, {
    Location: TARGET + path,
    'Cache-Control': 'no-store'
  });
  res.end();
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Render redirect listening on ${PORT} -> ${TARGET}`);
});
