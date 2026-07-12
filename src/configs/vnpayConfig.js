const vnpayConfig = {
  vnp_TmnCode: '7WZSHEZ1',
  vnp_HashSecret: 'C6VIKWPYVQU5PU46R06764I6O4ARMLES',
  vnp_Url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  vnp_ReturnUrl: 'http://localhost:3056/api/order/vnpay-return', // Cập nhật cổng 3056
  vnp_IpnUrl: 'http://localhost:3056/api/order/vnpay-notify',   // Cập nhật cổng 3056
};

module.exports = vnpayConfig;