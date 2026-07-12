const mongoose = require('mongoose');
const Certificate = require('./src/models/certificate.model.js');

const URI = 'mongodb+srv://ducprokb1234:Qu8JeVkU0ztydjsY@cluster0.dsbpjbn.mongodb.net/khitam?retryWrites=true&w=majority';

mongoose.connect(URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('DB Connected');
    
    const query = {
      $or: [
        { courseCode: { $regex: 'HC', $options: 'i' } },
        { certNumber: { $regex: 'HC', $options: 'i' } }
      ],
      $or: [
        { courseName: { $exists: false } },
        { courseName: '' },
        { courseName: null },
        { courseName: '—' }
      ]
    };
    
    const docs = await Certificate.find(query);
    console.log('Found ' + docs.length + ' certificates missing courseName with HC');
    
    let updatedCount = 0;
    for (const doc of docs) {
      doc.courseName = 'Coach';
      await doc.save();
      updatedCount++;
    }
    
    console.log('Update complete. Total updated: ' + updatedCount);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
