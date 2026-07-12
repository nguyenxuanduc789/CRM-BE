const mongoose = require('mongoose');
const LMSUser = require('./src/models/lms_user.model');

mongoose.connect('mongodb+srv://ducprokb1234:Qu8JeVkU0ztydjsY@cluster0.dsbpjbn.mongodb.net/khitam?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  const users = await LMSUser.find({});
  console.log('--- ALL USERS ---');
  users.forEach(u => {
    console.log(`Email: ${u.email} | Pass: ${u.password} | Role: ${u.role}`);
  });

  // If no trainer exists, we can create one
  const admin = await LMSUser.findOne({ role: 'admin' });
  const trainer = await LMSUser.findOne({ role: 'trainer' });
  
  console.log('\n--- ADMIN / TRAINER USERS ---');
  if (admin) console.log(`Admin Email: ${admin.email}`);
  if (trainer) console.log(`Trainer Email: ${trainer.email}`);
  
  process.exit();
}).catch(console.error);
