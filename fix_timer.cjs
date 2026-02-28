const fs = require('fs');
const file = 'zarva-mobile/src/screens/customer/JobStatusDetailScreen.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = "if (status === 'in_progress' && job?.work_started_at) {\n            const startMs = new Date(job.work_started_at).getTime();";
const replace = "let startTime = job?.job_started_at || job?.work_started_at;\n        if (status === 'in_progress' && startTime) {\n            const startMs = new Date(startTime).getTime();";

if (content.includes("job?.work_started_at) {")) {
    content = content.replace(/if \(status === 'in_progress' && job\?\.work_started_at\) \{\s*const startMs = new Date\(job\.work_started_at\)\.getTime\(\);/g, replace);
    fs.writeFileSync(file, content, 'utf8');
} else {
    console.log('Target not found in Timer file');
}

const workerFile = 'routes/worker.js';
let wContent = fs.readFileSync(workerFile, 'utf8');
const wTarget = "if (job.status === 'worker_arrived') {";
const wReplace = "if (job.status === 'worker_arrived') {\n            console.log('[OTP] Fast-track bypass invoked. Input: ' + inputOtp);";

if (wContent.includes(wTarget)) {
    wContent = wContent.replace(wTarget, wReplace);
    fs.writeFileSync(workerFile, wContent, 'utf8');
}
