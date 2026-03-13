import http from 'http';

// Test Redis connection directly
async function testRedis() {
  try {
    console.log('Testing Redis connection...');
    
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: '/api/debug/redis-test',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

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

// Since there's no debug endpoint, let me create a simple test to check if the OTP is actually in Redis
async function checkJob15Otp() {
  try {
    console.log('Checking Job 15 OTP directly...');
    
    // First, get a dev token
    const postData = JSON.stringify({
      phone: '+919746020743' // Worker phone number
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
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status === 'ok' && parsed.token) {
            console.log('✓ Got dev token');
            
            // Now check the worker job endpoint
            checkWorkerJob(parsed.token);
          }
        } catch (e) {
          console.log('Failed to get token');
        }
      });
    });

    req.on('error', (err) => {
      console.error('Request Error:', err.message);
    });

    req.write(postData);
    req.end();

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

async function checkWorkerJob(token) {
  const options = {
    hostname: 'localhost',
    port: process.env.PORT || 3000,
    path: '/api/worker/jobs/15',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

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
        
        if (parsed.job) {
          console.log('\n=== JOB 15 OTP CHECK ===');
          console.log('Job ID:', parsed.job.id);
          console.log('Status:', parsed.job.status);
          console.log('End OTP:', parsed.job.end_otp);
          
          if (parsed.job.status === 'pending_completion' && !parsed.job.end_otp) {
            console.log('❌ ISSUE: Job is pending completion but no end OTP available for worker!');
          } else if (parsed.job.status === 'pending_completion' && parsed.job.end_otp) {
            console.log('✅ Job has end OTP for worker:', parsed.job.end_otp);
          }
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
}

checkJob15Otp();