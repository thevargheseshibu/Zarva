const fs = require('fs');
const file = 'zarva-mobile/src/screens/customer/JobStatusDetailScreen.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace map source to use job.worker.lat from DB if worker_arrived
const oldHtmlCall = "generateMapHTML(assignedWorker?.lat, assignedWorker?.lng, job?.lat, job?.lng)";
const newHtmlCall = "generateMapHTML((status === 'worker_arrived' && job?.worker?.lat) ? job.worker.lat : assignedWorker?.lat, (status === 'worker_arrived' && job?.worker?.lng) ? job.worker.lng : assignedWorker?.lng, job?.lat, job?.lng)";

if (content.includes(oldHtmlCall)) {
    content = content.replace(oldHtmlCall, newHtmlCall);
    fs.writeFileSync(file, content, 'utf8');
}
