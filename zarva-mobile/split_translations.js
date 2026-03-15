const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const langs = ['en', 'ml', 'hi', 'ta'];

const rules = [
  { prefix: 'auth_', dest: 'src/features/auth/translations' },
  { prefix: 'otp_', dest: 'src/features/auth/translations' },
  { prefix: 'phone_', dest: 'src/features/auth/translations' },
  { prefix: 'login_', dest: 'src/features/auth/translations' },
  
  { prefix: 'profile_', dest: 'src/features/customer/translations' },
  { prefix: 'customer_', dest: 'src/features/customer/translations' },
  { prefix: 'chat_', dest: 'src/features/customer/translations' },

  { prefix: 'job_', dest: 'src/features/jobs/translations' },
  { prefix: 'search_', dest: 'src/features/jobs/translations' },
  { prefix: 'category_', dest: 'src/features/jobs/translations' },

  { prefix: 'inspection_', dest: 'src/features/inspection/translations' },
  { prefix: 'active_job_', dest: 'src/features/inspection/translations' },
  { prefix: 'extension_', dest: 'src/features/inspection/translations' },
  { prefix: 'pause_', dest: 'src/features/inspection/translations' },
  { prefix: 'resume_', dest: 'src/features/inspection/translations' },

  { prefix: 'payment_', dest: 'src/features/payment/translations' },
  { prefix: 'bill_', dest: 'src/features/payment/translations' },
  { prefix: 'wallet_', dest: 'src/features/payment/translations' },
  { prefix: 'rating_', dest: 'src/features/payment/translations' },

  { prefix: 'notification_', dest: 'src/features/notifications/translations' },
  { prefix: 'alert_', dest: 'src/features/notifications/translations' },

  { prefix: 'worker_', dest: 'src/features/worker/translations' },
  { prefix: 'onboarding_', dest: 'src/features/worker/translations' },
  { prefix: 'earnings_', dest: 'src/features/worker/translations' },

  { prefix: 'common_', dest: 'src/shared/i18n' },
  { prefix: 'error_', dest: 'src/shared/i18n' },
  { prefix: 'button_', dest: 'src/shared/i18n' },
];

langs.forEach(lang => {
  const fileParams = path.join(__dirname, `src/i18n/translations/${lang}.js`);
  if (!fs.existsSync(fileParams)) return;
  
  let content = fs.readFileSync(fileParams, 'utf8');
  
  // Quick and dirty eval to get object, assuming it's `export default { ... }` or similar.
  // Actually, standard `export default` might cause issues in plain node evaluate. Let's do a trick.
  let objText = content.replace(/export\s+default\s+/, 'module.exports = ');
  
  // write temp file
  const tempPath = path.join(__dirname, `temp_${lang}.js`);
  fs.writeFileSync(tempPath, objText);
  let dict = {};
  try {
     dict = require(tempPath);
  } catch (e) {
     console.error('Failed to parse translation file', fileParams, e);
     return;
  }
  
  // Group keys
  const grouped = {};
  // Initialize all dests to empty objects so files are always guaranteed to exist for imports
  for (const rule of Object.values(rules)) {
     if (!grouped[rule.dest]) grouped[rule.dest] = {};
  }
  if (!grouped['src/shared/i18n']) grouped['src/shared/i18n'] = {};
  
  for (const [key, val] of Object.entries(dict)) {
      let matched = false;
      for (const rule of rules) {
         if (key.startsWith(rule.prefix)) {
             grouped[rule.dest][key] = val;
             matched = true;
             break;
         }
      }
      if (!matched) {
         grouped['src/shared/i18n'][key] = val;
      }
  }
  
  // Write to destination
  for (const [dest, values] of Object.entries(grouped)) {
      const destFile = path.join(__dirname, dest, `${lang}.js`);
      fs.mkdirSync(path.join(__dirname, dest), { recursive: true });
      
      let outStr = `export default {\n`;
      for (const [k, v] of Object.entries(values)) {
          outStr += `  "${k}": ${JSON.stringify(v)},\n`;
      }
      outStr += `};\n`;
      
      fs.writeFileSync(destFile, outStr);
  }
  
  // Clean up
  fs.unlinkSync(tempPath);
});

console.log('Translations split successfully.');
