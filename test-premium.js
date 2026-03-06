const jwt = require('jsonwebtoken');
const http = require('http');

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OWE2OWFkODEzNTFhYTE2NWZhODFmMTYiLCJlbWFpbCI6IjFAZ21haWwuY29tIiwiaWF0IjoxNzcyNTI2MzE5LCJleHAiOjE3NzMxMzExMTl9.ryAUyLluUh6mjCkeaipFaLBpkGg2dqCyfVy5UzluxWA';

const req = http.request(
  'http://localhost:3000/premium/redeem',
  {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
  },
);

req.write(JSON.stringify({ code: 'JAMM-PREMIUM-2026' }));
req.end();
