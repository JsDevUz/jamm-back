const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign({ sub: "69a15e7fe79bbf94c0f5882f", email: "1@gmail.com" }, "gapbor-super-secret-key-2026", { expiresIn: '7d' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/courses`,
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Courses:', JSON.stringify(JSON.parse(data).filter(c => c.name === 'fdf'), null, 2)));
});
req.end();
