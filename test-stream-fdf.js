const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign({ sub: "69a187508c66df1a53557c76", email: "3@gmail.com" }, "gapbor-super-secret-key-2026", { expiresIn: '7d' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/courses/fdf/lessons/67c33f200caaaeddde5248cd/stream?token=${token}`,
  method: 'GET'
};

const req = http.request(options, res => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Body snippet:', data.substring(0, 100)));
});
req.end();
