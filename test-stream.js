const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/courses/fdf/lessons/67c33f200caaaeddde5248cd/stream',
  method: 'GET'
};

const req = http.request(options, res => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Body:', data));
});
req.end();
