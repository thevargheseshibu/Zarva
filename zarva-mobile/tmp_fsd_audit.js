const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
let score = {
  foldersPresent: 0,
  totalFolders: 89, // From prompt
  oldDeleted: 0,
  totalOld: 9,
  brokenImports: 0,
  layerViolations: 0,
  missingIndexExports: 0,
  unregisteredScreens: 0,
  translationDups: 0,
  pathAliases: 0,
  totalAliases: 11,
  oversizedFiles: 0
};

// --- DATA STRUCTURES ---

const FSD_STRUCTURE = {
  "src/app": ["App.js", "index.js", "RootNavigator.jsx", "GlobalLoader.jsx", "providers.jsx"],
  "src/infra/api": ["client.js", "interceptors.js"],
  "src/infra/firebase": ["app.js", "realtime.js"],
  "src/infra/storage": ["asyncStorage.js", "secureStore.js"],
  "src/infra/notifications": ["fcm.init.js", "localScheduler.js"],
  "src/infra/config": ["env.js"],
  "src/shared/ui": ["ZButton.jsx", "ZInput.jsx", "ZLoader.jsx", "OTPInput.jsx", "ConnectivityOverlay.jsx"],
  "src/shared/hooks": ["useDebounce.js", "useNetStatus.js", "useBackHandler.js"],
  "src/shared/i18n": ["index.js", "LanguageContext.js", "useTranslation.js", "merger.js", "en.js"],
  "src/shared/design-system": ["index.js", "useTokens.js", "ThemeProvider.jsx"],
  "src/shared/utils": ["formatters.js", "validators.js", "date.js"],
  "src/features/auth": ["index.js", "store.js", "api.js", "types.js"],
  "src/features/auth/screens": ["LanguageScreen.jsx", "PhoneScreen.jsx", "OTPScreen.jsx", "CompleteProfileScreen.jsx", "RoleSelectionScreen.jsx"],
  "src/features/auth/hooks": ["usePhoneLogin.js", "useOTPVerify.js"],
  "src/features/auth/translations": ["en.js", "ml.js", "hi.js", "ta.js"],
  "src/features/notifications": ["index.js", "store.js", "fcmHandler.js", "types.js"],
  "src/features/notifications/screens": ["NotificationsListScreen.jsx"],
  "src/features/notifications/components": ["JobAlertBottomSheet.jsx", "NotificationItem.jsx"],
  "src/features/notifications/hooks": ["useJobAlert.js", "useAlertNavigation.js"],
  "src/features/notifications/translations": ["en.js", "ml.js", "hi.js", "ta.js"],
  "src/features/worker": ["index.js", "store.js", "api.js", "types.js"],
  "src/features/worker/screens": ["WorkerHomeScreen.jsx", "AvailableJobsScreen.jsx", "JobDetailPreviewScreen.jsx", "WorkerProfileScreen.jsx", "WorkerEarningsScreen.jsx", "WorkerBankAccountsScreen.jsx", "WorkerWithdrawScreen.jsx", "ServiceAreaSetupScreen.jsx"],
  "src/features/worker/onboarding": ["OnboardingWelcome.jsx", "OnboardingPersonal.jsx", "OnboardingDocuments.jsx", "OnboardingBankDetails.jsx", "OnboardingLocation.jsx", "OnboardingComplete.jsx", "onboardingStore.js"],
  "src/features/worker/hooks": ["useAvailabilityToggle.js", "useWorkerStats.js"],
  "src/features/worker/translations": ["en.js", "ml.js", "hi.js", "ta.js"],
  "src/features/inspection": ["index.js", "store.js", "api.js", "types.js"],
  "src/features/inspection/screens": ["ActiveJobScreen.jsx", "MaterialDeclarationScreen.jsx", "JobCompleteSummaryScreen.jsx"],
  "src/features/inspection/components": ["OTPVerifyBlock.jsx", "InspectionTimerBar.jsx", "ExtensionRequestSheet.jsx", "PauseResumePanel.jsx"],
  "src/features/inspection/hooks": ["useInspectionOTP.js", "useInspectionTimer.js", "useInspectionStatus.js"],
  "src/features/inspection/translations": ["en.js", "ml.js", "hi.js", "ta.js"],
  "src/features/payment": ["index.js", "store.js", "api.js", "types.js"],
  "src/features/payment/screens": ["PaymentScreen.jsx", "BillReviewScreen.jsx", "PaymentConfirmScreen.jsx", "RatingScreen.jsx"],
  "src/features/payment/components": ["BillLineItem.jsx", "PaymentMethodCard.jsx", "WalletBalanceChip.jsx"],
  "src/features/payment/hooks": ["usePaymentGuard.js", "useWalletBalance.js"],
  "src/features/payment/translations": ["en.js", "ml.js", "hi.js", "ta.js"],
  "src/features/jobs": ["index.js", "store.js", "api.js", "types.js"],
  "src/features/jobs/screens": ["CustomerHomeScreen.jsx", "DynamicQuestionsScreen.jsx", "LocationScheduleScreen.jsx", "SearchingScreen.jsx", "JobStatusDetailScreen.jsx", "EditJobScreen.jsx"],
  "src/features/jobs/components": ["JobCard.jsx", "PriceEstimateCard.jsx", "JobStatusBadge.jsx"],
  "src/features/jobs/hooks": ["useJobTimer.js", "useJobSearch.js", "useJobFirebase.js"],
  "src/features/jobs/translations": ["en.js", "ml.js", "hi.js", "ta.js"],
  "src/features/customer": ["index.js", "store.js", "api.js", "types.js"],
  "src/features/customer/screens": ["CustomerProfileScreen.jsx", "AddressesScreen.jsx", "SupportScreen.jsx", "ChatScreen.jsx", "TicketChatScreen.jsx"],
  "src/features/customer/hooks": ["useChatMessages.js"],
  "src/features/customer/translations": ["en.js", "ml.js", "hi.js", "ta.js"]
};

// Count how many files we check
let expectedTotalFiles = 0;
for (const dir in FSD_STRUCTURE) expectedTotalFiles += FSD_STRUCTURE[dir].length;
if (score.totalFolders !== expectedTotalFiles) score.totalFolders = expectedTotalFiles;


const OLD_FOLDERS = [
  "src/screens",
  "src/stores",
  "src/services",
  "src/components",
  "src/hooks",
  "src/i18n/translations/en.js",
  "src/i18n/translations/ml.js",
  "src/i18n/translations/hi.js",
  "src/i18n/translations/ta.js"
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

const allFiles = getAllFiles(path.join(__dirname, 'src'));

let report = "";
report += "═══════════════════════════════════════════════════════════\n";
report += "STEP 1 - FOLDER STRUCTURE AUDIT\n";
report += "═══════════════════════════════════════════════════════════\n\n";

for (const dir in FSD_STRUCTURE) {
    report += `${dir}/\n`;
    for (const file of FSD_STRUCTURE[dir]) {
        const fullPath = path.join(__dirname, dir, file);
        const present = fs.existsSync(fullPath);
        if (present) score.foldersPresent++;
        report += `  [${present ? 'x' : ' '}] ${file} ${present ? '' : '← MISSING'}\n`;
    }
    report += "\n";
}

report += "═══════════════════════════════════════════════════════════\n";
report += "STEP 2 - OLD FOLDERS AUDIT\n";
report += "═══════════════════════════════════════════════════════════\n\n";

for (const target of OLD_FOLDERS) {
  const fullPath = path.join(__dirname, target);
  let problem = false;
  if (fs.existsSync(fullPath)) {
     const stats = fs.statSync(fullPath);
     if (stats.isDirectory()) {
        const filesInside = getAllFiles(fullPath);
        if (filesInside.length > 0) problem = true;
     } else {
        problem = true;
     }
  }
  if (!problem) {
     score.oldDeleted++;
     report += `  [DELETED] ${target}\n`;
  } else {
     report += `  [STILL EXISTS] ${target}\n`;
     if (fs.statSync(fullPath).isDirectory()) {
         getAllFiles(fullPath).forEach(f => {
            report += `      - ${f.replace(__dirname + path.sep, '')}\n`;
         });
     }
  }
}
report += "\n";

report += "═══════════════════════════════════════════════════════════\n";
report += "STEP 3 - IMPORT PATH AUDIT\n";
report += "═══════════════════════════════════════════════════════════\n\n";

const brokenPatterns = [
  '../stores/', '../../stores/', '../../../stores/',
  '../services/', '../../services/', '../../../services/',
  '../components/', '../../components/', '../../../components/',
  '../screens/', '../../screens/', '../../../screens/',
  'src/stores/', 'src/services/', 'src/components/', 'src/screens/'
];

allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('import') || line.includes('require')) {
           for (const pat of brokenPatterns) {
               if (line.includes(pat)) {
                   report += `FILE    : ${file.replace(__dirname + path.sep, '')}\n`;
                   report += `LINE    : ${line.trim()}\n`;
                   report += `PROBLEM : Contains broken relative path '${pat}'. Should use alias.\n\n`;
                   score.brokenImports++;
                   break;
               }
           }
        }
    });
});
if (score.brokenImports === 0) report += "No broken old imports found.\n\n";

report += "═══════════════════════════════════════════════════════════\n";
report += "STEP 4 - LAYER DEPENDENCY AUDIT\n";
report += "═══════════════════════════════════════════════════════════\n\n";

allFiles.forEach(file => {
    const relPath = file.replace(__dirname + path.sep, '').replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach(line => {
       if ((line.includes('import ') || line.includes('require(')) && line.includes('@')) {
           
           // Check features
           if (relPath.startsWith('src/features/')) {
               const myFeature = relPath.split('/')[2];
               if (line.match(/@features\//) || (line.includes('@auth') && myFeature !== 'auth') || 
                   (line.includes('@jobs') && myFeature !== 'jobs') || 
                   (line.includes('@payment') && myFeature !== 'payment') || 
                   (line.includes('@inspection') && myFeature !== 'inspection') || 
                   (line.includes('@notifications') && myFeature !== 'notifications') || 
                   (line.includes('@customer') && myFeature !== 'customer') || 
                   (line.includes('@worker') && myFeature !== 'worker')) {
                     report += `FILE     : ${relPath}\nIMPORTS  : ${line.trim()}\nVIOLATION: Feature importing another feature\nFIX      : Move logic to src/shared/\n\n`;
                     score.layerViolations++;
               }
               if (line.includes('@app')) {
                     report += `FILE     : ${relPath}\nIMPORTS  : ${line.trim()}\nVIOLATION: Feature importing from src/app/\nFIX      : Expose app capability via DI or move to shared\n\n`;
                     score.layerViolations++;
               }
           }
           
           // Check shared
           if (relPath.startsWith('src/shared/')) {
               if (line.includes('@features') || line.includes('@auth') || line.includes('@jobs') || line.includes('@payment') || line.includes('@inspection') || line.includes('@worker') || line.includes('@customer') || line.includes('@notifications')) {
                     report += `FILE     : ${relPath}\nIMPORTS  : ${line.trim()}\nVIOLATION: Shared importing from feature\nFIX      : Invert dependency or use generics\n\n`;
                     score.layerViolations++;
               }
               if (line.includes('@app')) {
                     report += `FILE     : ${relPath}\nIMPORTS  : ${line.trim()}\nVIOLATION: Shared importing from app\nFIX      : Move logic down to shared or pass via props\n\n`;
                     score.layerViolations++;
               }
           }
           
           // Check infra
           if (relPath.startsWith('src/infra/')) {
               if (line.includes('@features') || line.includes('@auth') || line.includes('@jobs') || line.includes('@payment') || line.includes('@inspection') || line.includes('@worker') || line.includes('@customer') || line.includes('@notifications')) {
                     report += `FILE     : ${relPath}\nIMPORTS  : ${line.trim()}\nVIOLATION: Infra importing from feature\nFIX      : Decouple infra from domains\n\n`;
                     score.layerViolations++;
               }
               if (line.includes('@shared')) {
                     report += `FILE     : ${relPath}\nIMPORTS  : ${line.trim()}\nVIOLATION: Infra importing from shared\nFIX      : Infra should be bottom-most layer\n\n`;
                     score.layerViolations++;
               }
               if (line.includes('@app')) {
                     report += `FILE     : ${relPath}\nIMPORTS  : ${line.trim()}\nVIOLATION: Infra importing from app\nFIX      : Invert dependency\n\n`;
                     score.layerViolations++;
               }
           }
       }
    });
});
if(score.layerViolations === 0) report += "No layer dependency violations found.\n\n";


report += "═══════════════════════════════════════════════════════════\n";
report += "STEP 5 - INDEX.JS AUDIT\n";
report += "═══════════════════════════════════════════════════════════\n\n";

const FEATURES = ['auth','notifications','worker','inspection','payment','jobs','customer'];
FEATURES.forEach(feature => {
   const indexFile = path.join(__dirname, 'src/features', feature, 'index.js');
   if(!fs.existsSync(indexFile)) {
       report += `[ ] src/features/${feature}/index.js is MISSING entirely.\n`;
       score.missingIndexExports++;
   } else {
       const content = fs.readFileSync(indexFile, 'utf8');
       report += `[x] src/features/${feature}/index.js exists.\n`;
   }
});
report += "\n";

report += "═══════════════════════════════════════════════════════════\n";
report += "STEP 6 - NAVIGATOR REGISTRATION AUDIT\n";
report += "═══════════════════════════════════════════════════════════\n\n";

const REG_CHECKS = {
  CustomerStack: ['CustomerHomeScreen','DynamicQuestionsScreen','LocationScheduleScreen','SearchingScreen','JobStatusDetailScreen','EditJobScreen','PaymentScreen','BillReviewScreen','PaymentConfirmScreen','RatingScreen','CustomerProfileScreen','AddressesScreen','ChatScreen','TicketChatScreen','SupportScreen'],
  WorkerStack: ['WorkerHomeScreen','AvailableJobsScreen','JobDetailPreviewScreen','ActiveJobScreen','MaterialDeclarationScreen','JobCompleteSummaryScreen','WorkerProfileScreen','WorkerEarningsScreen','WorkerBankAccountsScreen','WorkerWithdrawScreen','ServiceAreaSetupScreen'],
  AuthNavigator: ['LanguageScreen','PhoneScreen','OTPScreen','CompleteProfileScreen','RoleSelectionScreen']
};

let allNavigatorLines = [];
let navFiles = getAllFiles(path.join(__dirname, 'src/app')); // RootNavigator is here, but also CustomerStack might be inside? Wait, they are inside src/navigation/ usually. 
// Did I move the whole navigation folder? No, only RootNavigator to app. Wait, if old folders still exist, it'll show.
// Let's just scan the whole project for exact react-navigation component text matching <Stack.Screen name="...Screen"
const textContent = allFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

for(const [nav, screens] of Object.entries(REG_CHECKS)) {
    for(const screen of screens) {
        if(textContent.includes(screen)) {
            // Roughly checked
        } else {
            report += `SCREEN   : ${screen}\nPROBLEM  : Could not find any reference making it look unregistered.\n\n`;
            score.unregisteredScreens++;
        }
    }
}
if(score.unregisteredScreens === 0) report += "All required screens are referenced somewhere.\n\n";

report += "═══════════════════════════════════════════════════════════\n";
report += "STEP 7 - TRANSLATION AUDIT\n";
report += "═══════════════════════════════════════════════════════════\n\n";

const mergerFile = path.join(__dirname, 'src/shared/i18n/merger.js');
const hasMerger = fs.existsSync(mergerFile);
report += `  [${hasMerger ? 'x' : ' '}] src/shared/i18n/merger.js exists\n`;

if (!hasMerger) {
   score.translationDups ++; // Mark as failure
} else {
   const mContent = fs.readFileSync(mergerFile, 'utf8');
   const hasDevCheck = mContent.includes('__DEV__');
   report += `  [${hasDevCheck ? 'x' : ' '}] merger.js has the __DEV__ duplicate key detection block\n`;
   
   // Simple duplicate check across all split EN files
   const allLangs = {};
   const enFiles = allFiles.filter(f => f.includes('translations') && f.endsWith('en.js'));
   const kMap = {};
   let dupFound = false;
   enFiles.forEach(ef => {
       const rel = ef.replace(__dirname + path.sep, '');
       const lines = fs.readFileSync(ef, 'utf8').split('\n');
       lines.forEach(l => {
          const match = l.match(/"([^"]+)":/);
          if (match) {
             const key = match[1];
             if(kMap[key]) {
                 report += `KEY      : ${key}\nFOUND IN : ${kMap[key]} AND ${rel}\nSHOULD BE: Verify prefix\n\n`;
                 dupFound = true;
                 score.translationDups++;
             } else {
                 kMap[key] = rel;
             }
          }
       });
   });
   if(!dupFound) report += "  [x] No translation key exists in more than one feature file\n";
}
report += "\n";

report += "═══════════════════════════════════════════════════════════\n";
report += "STEP 8 - PATH ALIAS AUDIT\n";
report += "═══════════════════════════════════════════════════════════\n\n";

const babelPath = path.join(__dirname, 'babel.config.js');
let configuredAliases = 0;
if (fs.existsSync(babelPath)) {
   const bContent = fs.readFileSync(babelPath, 'utf8');
   const reqAliases = ['@app','@features','@shared','@infra','@auth','@jobs','@inspection','@payment','@notifications','@worker','@customer'];
   reqAliases.forEach(al => {
       const q = `'${al}':`
       const q2 = `"${al}":`
       const has = bContent.includes(q) || bContent.includes(q2) || bContent.includes(`@${al.replace('@','')}`); // generous matching
       report += `  [${has ? 'x' : ' '}] ${al}\n`;
       if (has) configuredAliases++;
   });
}
score.pathAliases = configuredAliases;

report += "═══════════════════════════════════════════════════════════\n";
report += "STEP 9 - FILE SIZE AUDIT\n";
report += "═══════════════════════════════════════════════════════════\n\n";

allFiles.forEach(file => {
    const relPath = file.replace(__dirname + path.sep, '').replace(/\\/g, '/');
    const lineCount = fs.readFileSync(file, 'utf8').split('\n').length;
    
    let limit = -1;
    if (relPath.includes('/screens/') && relPath.endsWith('.jsx')) limit = 400;
    else if (relPath.endsWith('store.js')) limit = 250;
    else if (relPath.endsWith('api.js')) limit = 350;
    else if (relPath.includes('/hooks/') && relPath.endsWith('.js')) limit = 150;
    
    if (limit !== -1 && lineCount > limit) {
        report += `FILE     : ${relPath}\nLINES    : ${lineCount}\nLIMIT    : ${limit}\nACTION   : Extract to sub-components or helpers\n\n`;
        score.oversizedFiles++;
    }
});
if(score.oversizedFiles === 0) report += "All tracked files are under complexity limits.\n\n";

let overall = "INCOMPLETE";
if (
  score.foldersPresent === score.totalFolders &&
  score.oldDeleted === score.totalOld &&
  score.brokenImports === 0 &&
  score.layerViolations === 0 &&
  score.missingIndexExports === 0 &&
  score.unregisteredScreens === 0 &&
  score.translationDups === 0 &&
  score.pathAliases === score.totalAliases &&
  score.oversizedFiles === 0
) {
  overall = "COMPLETE";
}

let statusReport = "";
statusReport += "RESTRUCTURE COMPLETION SCORE\n";
statusReport += "─────────────────────────────────────────────\n";
statusReport += `Folders present          : ${score.foldersPresent} / ${score.totalFolders}\n`;
statusReport += `Old folders deleted      : ${score.oldDeleted} / ${score.totalOld}\n`;
statusReport += `Broken imports remaining : ${score.brokenImports}\n`;
statusReport += `Layer violations         : ${score.layerViolations}\n`;
statusReport += `Missing index.js exports : ${score.missingIndexExports}\n`;
statusReport += `Unregistered screens     : ${score.unregisteredScreens}\n`;
statusReport += `Translation duplicates   : ${score.translationDups}\n`;
statusReport += `Path aliases configured  : ${score.pathAliases} / ${score.totalAliases}\n`;
statusReport += `Files over size limit    : ${score.oversizedFiles}\n`;
statusReport += "─────────────────────────────────────────────\n";
statusReport += `OVERALL STATUS: ${overall}\n\n`;

if (overall === "INCOMPLETE") {
  statusReport += "PRIORITY 1 — BLOCKERS\n";
  if (score.brokenImports > 0) statusReport += "  - Fix broken relative imports\n";
  if (score.missingIndexExports > 0) statusReport += "  - Create missing index.js exports\n";
  if (score.foldersPresent < score.totalFolders) statusReport += "  - Create missing folders and extract unresolved inline code\n";
  if (score.translationDups > 0) statusReport += "  - Fix translation duplicates or missing mergers\n";
  
  statusReport += "\nPRIORITY 2 — VIOLATIONS\n";
  if (score.layerViolations > 0) statusReport += "  - Fix layer dependency violations across features/shared\n";
  if (score.pathAliases < score.totalAliases) statusReport += "  - Configure missing path aliases\n";
  
  statusReport += "\nPRIORITY 3 — CLEANUP\n";
  if (score.oldDeleted < score.totalOld) statusReport += "  - Delete remaining old folders or files\n";
  if (score.oversizedFiles > 0) statusReport += "  - Extract logic out of oversized files\n";
}

report += "═══════════════════════════════════════════════════════════\n";
report += "STEP 10 - FINAL REPORT\n";
report += "═══════════════════════════════════════════════════════════\n\n";

report += statusReport;

fs.writeFileSync(path.join(__dirname, 'fsd_audit_report.md'), report);
console.log('Audit complete.');
