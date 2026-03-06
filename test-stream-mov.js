const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign({ sub: "69a187508c66df1a53557c76", email: "3@gmail.com" }, "gapbor-super-secret-key-2026", { expiresIn: '7d' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/courses/69a2cdd47dbf578b776a064a/lessons/69a400d78858306a80c50ef0/stream?token=${token}`,
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Body:', data));
});
req.end();
