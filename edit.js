const fs = require('fs');
const file = 'zarva-mobile/src/screens/customer/JobStatusDetailScreen.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace OTP display logic
content = content.replace(
    "{job?.start_otp || '----'}",
    "{status === 'worker_arrived' ? job?.inspection_otp : job?.start_otp || '----'}"
);

// Replace OTP Title
content = content.replace(
    "{t('share_start_code')}",
    "{status === 'worker_arrived' ? (t('share_service_code') || 'Share Service Code') : t('share_start_code')}"
);

// Replace OTP Subtitle
content = content.replace(
    "{t('share_start_code_desc')}",
    "{status === 'worker_arrived' ? (t('share_service_code_desc') || 'Share this code with the worker to confirm arrival') : t('share_start_code_desc')}"
);

// Replace worker jobs count display
content = content.replace(
    "{t('completed_jobs_count').replace('%{count}', assignedWorker.completed_jobs || 0)}",
    "{assignedWorker.completed_jobs || 0} Jobs"
);

// Replace worker rating display
content = content.replace(
    "{assignedWorker.rating || t('new_worker')}",
    "{assignedWorker.rating ? Number(assignedWorker.rating).toFixed(1) : t('new_worker')}"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Replacements executed on ' + file);
