import http from 'http';

// Test the /api/me endpoint to see what profile data is returned
function getDevToken() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      phone: '+919746020743' // The worker's phone number from our check
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
          console.log('Dev login response:', JSON.stringify(parsed, null, 2));
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

// Test the /api/me endpoint
async function testProfile() {
  try {
    console.log('Getting dev token...');
    const token = await getDevToken();
    console.log('✓ Got dev token:', token.substring(0, 20) + '...');

    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: '/api/me',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    console.log('Testing /api/me endpoint...');

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
          
          if (res.statusCode === 200 && parsed.user) {
            console.log('\n=== PROFILE ANALYSIS ===');
            const user = parsed.user;
            console.log('User ID:', user.id);
            console.log('Role:', user.role);
            console.log('Active Role:', user.active_role);
            console.log('Name:', user.name);
            console.log('Onboarding Complete:', user.onboarding_complete);
            
            if (user.profile) {
              console.log('\nProfile Data:');
              console.log('KYC Status:', user.profile.kyc_status);
              console.log('Is Verified:', user.profile.is_verified);
              console.log('Category:', user.profile.category);
              
              // Check the condition that determines verification pending
              const shouldShowPending = user.active_role === 'worker' && user.profile.kyc_status !== 'approved';
              console.log('\nShould show verification pending:', shouldShowPending);
              
              if (shouldShowPending) {
                console.log('⚠️  This worker will see VerificationPending screen!');
                console.log('Reason: KYC status is "' + user.profile.kyc_status + '" but needs to be "approved"');
              } else {
                console.log('✅ This worker should have normal access');
              }
            } else {
              console.log('⚠️  No profile data found!');
            }
          } else {
            console.log('✗ Failed to get profile data');
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

testProfile();