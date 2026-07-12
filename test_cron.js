require('dotenv').config();
const mongoose = require('mongoose');
const { sendInstallmentReminders } = require('./src/cron/cron_remind_installment');

mongoose.connect(process.env.URL_CLOUD_MONGO, {
    maxPoolSize: 50
}).then(async () => {
    console.log('Connected Mongodb Success');
    await sendInstallmentReminders();
    console.log('Test completed');
    process.exit(0);
}).catch(err => {
    console.log(err);
    process.exit(1);
});
