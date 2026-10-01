// ROYOSHI HERE! THIS IS TO REDIRECT TO A NEW SERVER WHILE USING THE SAME DOMAIN! NOT MALICIOUS!

const http = require('http');

const TARGET = 'http://76.164.197.86:25566';

http.createServer((req, res) => {
  res.writeHead(302, {
    Location: TARGET + req.url
  });
  res.end();
}).listen(process.env.PORT || 10000, '0.0.0.0');