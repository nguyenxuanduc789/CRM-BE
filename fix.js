const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'src/app.js',
    'src/controllers/affilite.controller.js',
    'src/controllers/emailController.js',
    'src/controllers/pipelineController.js',
    'src/cron/cron_remind_expiry.js',
    'src/cron/cron_remind_installment.js',
    'src/cron/cron_remind_tuition.js',
    'src/library/Mail/init.mailer.js'
];

filesToUpdate.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        
        // Regex with simple replacement
        // Arrays: ['tohai.le...', 'other...'] -> ['other...']
        content = content.replace(/'tohai\.le@khitamtherapy\.com',\s*/g, '');
        content = content.replace(/,\s*'tohai\.le@khitamtherapy\.com'/g, '');
        
        // Strings: 'tohai.le..., other...' -> 'other...'
        content = content.replace(/tohai\.le@khitamtherapy\.com,\s*/g, '');
        content = content.replace(/,\s*tohai\.le@khitamtherapy\.com/g, '');

        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed', file);
    }
});
