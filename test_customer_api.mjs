import fetch from 'node-fetch';

async function testFetch() {
    try {
        console.log("Fetching job 20...");
        // This won't work without a valid JWT token. 
        // We'll see if the server crashes from a 401 or if it crashes deeply.
        const res = await fetch('http://localhost:3000/api/jobs/20', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer asdfasdfasdfasdf',
                'Content-Type': 'application/json'
            }
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Body:', text);
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

testFetch();
