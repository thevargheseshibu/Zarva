const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const MOVES = [
  // Revert Move i18n setup to app layer back to shared
  { to: 'src/shared/i18n/merger.js', from: 'src/app/i18n/merger.js', aliasTo: '@shared/i18n/merger', aliasFrom: '@app/i18n/merger' },
  { to: 'src/shared/i18n/index.js', from: 'src/app/i18n/index.js', aliasTo: '@shared/i18n', aliasFrom: '@app/i18n' },
  { to: 'src/shared/i18n/useTranslation.js', from: 'src/app/i18n/useTranslation.js', aliasTo: '@shared/i18n/useTranslation', aliasFrom: '@app/i18n/useTranslation' },
  { to: 'src/shared/i18n/LanguageContext.js', from: 'src/app/i18n/LanguageContext.js', aliasTo: '@shared/i18n/LanguageContext', aliasFrom: '@app/i18n/LanguageContext' },

  // Revert Global State moves
  { to: 'src/features/auth/store.js', from: 'src/shared/store/authStore.js', aliasTo: '@auth/store', aliasFrom: '@shared/store/authStore' },
  { to: 'src/features/auth/otpStore.js', from: 'src/shared/store/otpStore.js', aliasTo: '@auth/otpStore', aliasFrom: '@shared/store/otpStore' },
  
  { to: 'src/features/worker/store.js', from: 'src/shared/store/workerStore.js', aliasTo: '@worker/store', aliasFrom: '@shared/store/workerStore' },
  { to: 'src/features/jobs/store.js', from: 'src/shared/store/jobStore.js', aliasTo: '@jobs/store', aliasFrom: '@shared/store/jobStore' },
  
  { to: 'src/features/payment/customerWalletStore.js', from: 'src/shared/store/customerWalletStore.js', aliasTo: '@payment/customerWalletStore', aliasFrom: '@shared/store/customerWalletStore' },
  { to: 'src/features/payment/workerWalletStore.js', from: 'src/shared/store/workerWalletStore.js', aliasTo: '@payment/workerWalletStore', aliasFrom: '@shared/store/workerWalletStore' },

  // Revert Zarva specific API client out of Shared back to Infra
  { to: 'src/infra/api/client.js', from: 'src/shared/api/client.js', aliasTo: '@infra/api/client', aliasFrom: '@shared/api/client' },
  { to: 'src/infra/api/interceptors.js', from: 'src/shared/api/interceptors.js', aliasTo: '@infra/api/interceptors', aliasFrom: '@shared/api/interceptors' }
];

function getAllFiles(dirPath, arrayOfFiles) {
    if(!fs.existsSync(dirPath)) return [];
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
               arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
            }
        } else {
            if (file.endsWith('.js') || file.endsWith('.jsx')) {
               arrayOfFiles.push(path.join(dirPath, file));
            }
        }
    });
    return arrayOfFiles;
}

// 1. Move the files back
MOVES.forEach(m => {
   const fromPath = path.join(__dirname, m.from);
   const toPath = path.join(__dirname, m.to);
   
   if (fs.existsSync(fromPath)) {
      const dir = path.dirname(toPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.renameSync(fromPath, toPath);
   }
});

// 2. Global Regex Replacement for Imports back
const allFiles = getAllFiles(srcDir);
allFiles.forEach(f => {
   let content = fs.readFileSync(f, 'utf8');
   let changed = false;

   MOVES.forEach(m => {
       const safeFrom = m.aliasFrom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       const regexStr = "from\\s+['\"]" + safeFrom + "['\"]";
       const regex = new RegExp(regexStr, 'g');
       
       if (content.match(regex)) {
           content = content.replace(regex, `from '${m.aliasTo}'`);
           changed = true;
       }
       
       const regexReq = "require\\(['\"]" + safeFrom + "['\"]\\)";
       const rr = new RegExp(regexReq, 'g');
       if (content.match(rr)) {
           content = content.replace(rr, `require('${m.aliasTo}')`);
           changed = true;
       }

       const regexDyn = "import\\(['\"]" + safeFrom + "['\"]\\)";
       const rd = new RegExp(regexDyn, 'g');
       if (content.match(rd)) {
           content = content.replace(rd, `import('${m.aliasTo}')`);
           changed = true;
       }
   });

   if (changed) {
       fs.writeFileSync(f, content);
   }
});

console.log("Reverts applied.");
