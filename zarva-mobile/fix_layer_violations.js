const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const MOVES = [
  // Move i18n setup to app layer
  { from: 'src/shared/i18n/merger.js', to: 'src/app/i18n/merger.js', aliasFrom: '@shared/i18n/merger', aliasTo: '@app/i18n/merger' },
  { from: 'src/shared/i18n/index.js', to: 'src/app/i18n/index.js', aliasFrom: '@shared/i18n', aliasTo: '@app/i18n' },
  { from: 'src/shared/i18n/useTranslation.js', to: 'src/app/i18n/useTranslation.js', aliasFrom: '@shared/i18n/useTranslation', aliasTo: '@app/i18n/useTranslation' },
  { from: 'src/shared/i18n/LanguageContext.js', to: 'src/app/i18n/LanguageContext.js', aliasFrom: '@shared/i18n/LanguageContext', aliasTo: '@app/i18n/LanguageContext' },

  // Move Global State to Shared to allow features to import them cleanly
  { from: 'src/features/auth/store.js', to: 'src/shared/store/authStore.js', aliasFrom: '@auth/store', aliasTo: '@shared/store/authStore' },
  { from: 'src/features/auth/otpStore.js', to: 'src/shared/store/otpStore.js', aliasFrom: '@auth/otpStore', aliasTo: '@shared/store/otpStore' },
  
  { from: 'src/features/worker/store.js', to: 'src/shared/store/workerStore.js', aliasFrom: '@worker/store', aliasTo: '@shared/store/workerStore' },
  { from: 'src/features/jobs/store.js', to: 'src/shared/store/jobStore.js', aliasFrom: '@jobs/store', aliasTo: '@shared/store/jobStore' },
  
  { from: 'src/features/payment/customerWalletStore.js', to: 'src/shared/store/customerWalletStore.js', aliasFrom: '@payment/customerWalletStore', aliasTo: '@shared/store/customerWalletStore' },
  { from: 'src/features/payment/workerWalletStore.js', to: 'src/shared/store/workerWalletStore.js', aliasFrom: '@payment/workerWalletStore', aliasTo: '@shared/store/workerWalletStore' },

  // Move Zarva specific API client out of generic Infra into Shared
  { from: 'src/infra/api/client.js', to: 'src/shared/api/client.js', aliasFrom: '@infra/api/client', aliasTo: '@shared/api/client' },
  { from: 'src/infra/api/interceptors.js', to: 'src/shared/api/interceptors.js', aliasFrom: '@infra/api/interceptors', aliasTo: '@shared/api/interceptors' }
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

// 1. Move the problem files
MOVES.forEach(m => {
   const fromPath = path.join(__dirname, m.from);
   const toPath = path.join(__dirname, m.to);
   
   if (fs.existsSync(fromPath)) {
      const dir = path.dirname(toPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.renameSync(fromPath, toPath);
   }
});

// 2. Global Regex Replacement for Imports
const allFiles = getAllFiles(srcDir);
allFiles.forEach(f => {
   let content = fs.readFileSync(f, 'utf8');
   let changed = false;

   MOVES.forEach(m => {
       // Escape special chars in aliasFrom
       const safeFrom = m.aliasFrom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       // Regex handles matching exact import paths
       const regexStr = "from\\s+['\"]" + safeFrom + "['\"]";
       const regex = new RegExp(regexStr, 'g');
       
       if (content.match(regex)) {
           content = content.replace(regex, `from '${m.aliasTo}'`);
           changed = true;
       }
       
       // Handle require() and dynamic import()
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
   
   // Replace loose imports from specific stores
   if (content.includes("from '@shared/i18n'") && !content.includes("from '@shared/i18n/")) {
        content = content.replace(/from '@shared\/i18n'/g, "from '@app/i18n'");
        changed = true;
   }

   if (changed) {
       fs.writeFileSync(f, content);
   }
});

console.log("Layer violation fixes applied.");
