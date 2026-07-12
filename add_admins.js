const mongoose = require('mongoose');
const CertificateAdmin = require('./src/models/certificateAdmin.model.js');

const URI = 'mongodb+srv://ducprokb1234:Qu8JeVkU0ztydjsY@cluster0.dsbpjbn.mongodb.net/khitam?retryWrites=true&w=majority';

mongoose.connect(URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('DB Connected');
    
    const emails = [
      'academy@khitamtherapy.com',
      'khitamacademy@gmail.com',
      'truongxuan.fengshuix@gmail.com'
    ];
    
    for (const email of emails) {
      const existing = await CertificateAdmin.findOne({ email });
      if (!existing) {
        await CertificateAdmin.create({ email, role: 'admin' });
        console.log('Added:', email);
      } else {
        console.log('Already exists:', email);
      }
    }
    
    console.log('Done adding admins.');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
