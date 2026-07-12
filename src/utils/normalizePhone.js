/**
 * Chuẩn hóa SĐT VN — Excel thường mất số 0 đầu (909040303 → 0909040303)
 */
const normalizeVietnamesePhone = (phone) => {
  if (phone === null || phone === undefined || phone === '') return '';

  let s = String(phone).trim().replace(/\s/g, '');
  if (/^\d+\.\d+$/.test(s)) {
    s = s.split('.')[0];
  }
  s = s.replace(/[^\d]/g, '');

  if (!s) return '';

  if (s.startsWith('84') && s.length >= 11) {
    s = `0${s.slice(2)}`;
  }

  if (!s.startsWith('0') && s.length >= 9 && s.length <= 10) {
    s = `0${s}`;
  }

  return s;
};

module.exports = { normalizeVietnamesePhone };
