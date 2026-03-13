import http from 'http';

// First, get a dev token for the customer
function getDevToken() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      phone: '+919496229341' // Customer phone number
    });

    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: '/api/auth/dev-login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status === 'ok' && parsed.token) {
            resolve(parsed.token);
          } else {
            reject(new Error('Failed to get dev token: ' + data));
          }
        } catch (e) {
          reject(new Error('Failed to parse response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Test the /api/jobs/15 endpoint
async function testJob15() {
  try {
    console.log('Getting customer dev token...');
    const token = await getDevToken();
    console.log('✓ Got dev token:', token.substring(0, 20) + '...');

    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: '/api/jobs/15',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    console.log('Testing /api/jobs/15 endpoint...');

    const req = http.request(options, (res) => {
      let data = '';
      
      console.log('Status Code:', res.statusCode);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response Body:', data);
        
        try {
          const parsed = JSON.parse(data);
          console.log('Parsed Response:', JSON.stringify(parsed, null, 2));
          
          if (res.statusCode === 200 && parsed.job) {
            const job = parsed.job;
            console.log('\n=== JOB 15 ANALYSIS ===');
            console.log('Job ID:', job.id);
            console.log('Status:', job.status);
            console.log('End OTP:', job.end_otp);
            console.log('Completion Code:', job.completion_code);
            
            if (job.status === 'pending_completion' && !job.end_otp) {
              console.log('❌ ISSUE: Job is pending completion but no end OTP available!');
            } else if (job.status === 'pending_completion' && job.end_otp) {
              console.log('✅ Job has end OTP for completion');
            } else {
              console.log('ℹ️  Job status:', job.status);
            }
          } else {
            console.log('✗ Failed to get job data');
          }
        } catch (e) {
          console.log('Raw Response:', data);
        }
      });
    });

    req.on('error', (err) => {
      console.error('Request Error:', err.message);
    });

    req.end();

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testJob15();