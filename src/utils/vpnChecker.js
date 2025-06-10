// backend/utils/vpnChecker.js
const axios = require('axios');

// Kiểm tra IP có phải VPN không
const checkVPN = async (ip) => {
  try {
    const response = await axios.get(`https://vpnapi.io/api/${ip}?key=06e9b76d6be64a9eb1e6e8d24e09d3c7`);
    return response.data.security.is_vpn;
  } catch (error) {
    console.error(error);
    return false;
  }
};

module.exports = { checkVPN };
