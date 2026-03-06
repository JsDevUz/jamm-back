const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign({ sub: "69a15e7fe79bbf94c0f5882f", email: "1@gmail.com" }, "gapbor-super-secret-key-2026", { expiresIn: '7d' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/courses/69a2cdd47dbf578b776a064a/lessons/69a41f6c40b4c8034edc9117/stream?token=${token}`,
  method: 'GET',
};

const req = http.request(options, res => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  let data = '';
  res.on('data', chunk => {
    data += chunk.toString('hex');
    if (data.length > 100) {
        console.log('Hex bytes:', data.substring(0, 50));
        res.destroy();
    }
  });

});
req.end();
