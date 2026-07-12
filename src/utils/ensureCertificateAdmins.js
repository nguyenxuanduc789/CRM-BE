const CertificateAdmin = require('../models/certificateAdmin.model');

const DEFAULT_ADMINS = [
  { email: 'ducprokb1234@gmail.com', name: 'Duc Pro KB' },
  { email: 'customercare@khitamtherapy.com', name: 'Customer Care' },
];

let ensured = false;

const ensureCertificateAdmins = async () => {
  if (ensured) return;
  for (const admin of DEFAULT_ADMINS) {
    await CertificateAdmin.findOneAndUpdate(
      { email: admin.email },
      { email: admin.email, role: 'admin', name: admin.name, active: true },
      { upsert: true }
    );
  }
  ensured = true;
};

const DEFAULT_ADMIN_EMAILS = DEFAULT_ADMINS.map((a) => a.email);

module.exports = {
  ensureCertificateAdmins,
  DEFAULT_ADMIN_EMAILS,
};
