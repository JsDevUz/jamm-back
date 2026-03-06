const axios = require('axios');

const API_URL = 'http://localhost:3000';
const testEmail = `test_${Date.now()}@example.com`;
const testPassword = 'password123';
const testUsername = `user_${Date.now()}`;

async function runTest() {
  console.log('--- STARTING EMAIL VERIFICATION TEST ---');

  try {
    // 1. SIGNUP
    console.log(`1. Signing up user: ${testEmail}...`);
    const signupRes = await axios.post(`${API_URL}/auth/signup`, {
      email: testEmail,
      password: testPassword,
      username: testUsername,
      nickname: 'Tester',
      phone: '+998901234567',
    });
    console.log('Signup Result:', signupRes.data.message);

    // 2. LOGIN (Should fail)
    console.log('2. Attempting login before verification (should fail)...');
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: testEmail,
        password: testPassword,
      });
      console.log('ERROR: Login unexpectedly succeeded!');
    } catch (err) {
      console.log('Expected Error received:', err.response?.data?.message);
    }

    // 3. GET TOKEN (In real world, user would get this from email. Here we query DB or assume mock logged it)
    console.log(
      '3. Please check the server logs (yarn start:dev) for the verification link.',
    );
    console.log(
      'Wait... I will simulate the verification by manually calling the verify endpoint if I had the token.',
    );
    console.log(
      "Since I am an AI, I can't see the server stdout easily without command_status, but let's assume I can get it.",
    );
  } catch (error) {
    console.error('Test Failed:', error.message);
  }
}

runTest();
