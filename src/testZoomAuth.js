require('dotenv').config();
const axios = require('axios');

const accountId = process.env.ZOOM_ACCOUNT_ID;
const clientId = process.env.ZOOM_CLIENT_ID;
const clientSecret = process.env.ZOOM_CLIENT_SECRET;

console.log('Testing Zoom Auth with:');
console.log('Account ID:', accountId);
console.log('Client ID:', clientId);
console.log('Client Secret:', clientSecret ? '***' + clientSecret.slice(-4) : 'undefined');

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

axios.post(
  `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
  null,
  {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }
)
.then(res => {
  console.log('✅ Access token received successfully!');
  console.log('Token starts with:', res.data.access_token.substring(0, 15) + '...');
})
.catch(error => {
  console.log('❌ Auth Failed!');
  if (error.response) {
    console.log('Status:', error.response.status);
    console.log('Error Data:', error.response.data);
  } else {
    console.log('Error Message:', error.message);
  }
});
