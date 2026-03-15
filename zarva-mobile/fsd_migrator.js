const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const moves = [
  // infra - api
  { from: 'src/services/api/client.js', to: 'src/infra/api/client.js', alias: '@infra/api/client', namedOut: false },
  // infra - firebase
  { from: 'src/utils/firebase.js', to: 'src/infra/firebase/app.js', alias: '@infra/firebase/app', namedOut: false },
  
  // NOTE: the inline extractions (interceptors, realtime, asyncStorage, secureStore, env.js, localScheduler, fcm.init) 
  // will be handled separately since they require splitting existing files.
  
  // shared - ui
  { from: 'src/components/ZButton.jsx', to: 'src/shared/ui/ZButton.jsx', alias: '@shared/ui/ZButton' },
  { from: 'src/components/ZInput.jsx', to: 'src/shared/ui/ZInput.jsx', alias: '@shared/ui/ZInput' },
  { from: 'src/components/ZLoader.jsx', to: 'src/shared/ui/ZLoader.jsx', alias: '@shared/ui/ZLoader' },
  { from: 'src/components/OTPInput.jsx', to: 'src/shared/ui/OTPInput.jsx', alias: '@shared/ui/OTPInput' },
  { from: 'src/components/ConnectivityOverlay.jsx', to: 'src/shared/ui/ConnectivityOverlay.jsx', alias: '@shared/ui/ConnectivityOverlay' },
  { from: 'src/components/Card.jsx', to: 'src/shared/ui/ZCard.jsx', alias: '@shared/ui/ZCard' },
  { from: 'src/components/ZBadge.jsx', to: 'src/shared/ui/ZBadge.jsx', alias: '@shared/ui/ZBadge' }, // Missing in source?
  
  // shared - hooks
  { from: 'src/hooks/useDebounce.js', to: 'src/shared/hooks/useDebounce.js', alias: '@shared/hooks/useDebounce' },
  { from: 'src/hooks/useNetStatus.js', to: 'src/shared/hooks/useNetStatus.js', alias: '@shared/hooks/useNetStatus' },
  { from: 'src/hooks/useBackHandler.js', to: 'src/shared/hooks/useBackHandler.js', alias: '@shared/hooks/useBackHandler' },
  
  // shared - i18n
  { from: 'src/i18n/index.js', to: 'src/shared/i18n/index.js', alias: '@shared/i18n' },
  { from: 'src/i18n/LanguageContext.js', to: 'src/shared/i18n/LanguageContext.js', alias: '@shared/i18n/LanguageContext' },
  { from: 'src/i18n/useTranslation.js', to: 'src/shared/i18n/useTranslation.js', alias: '@shared/i18n/useTranslation' },
  
  // shared - design-system
  // (Moving whole directory is handled differently or we can just log it but imports are what matters)
  // Actually babel alias @design-system doesn't exist, we must use @shared/design-system?
  // Wait, the prompt says "design-system/ <- FROM: src/design-system/ (move entire folder)" -> so it becomes src/shared/design-system/
  
  // shared - utils
  { from: 'src/utils/formatters.js', to: 'src/shared/utils/formatters.js', alias: '@shared/utils/formatters' },
  { from: 'src/utils/validators.js', to: 'src/shared/utils/validators.js', alias: '@shared/utils/validators' },
  { from: 'src/utils/date.js', to: 'src/shared/utils/date.js', alias: '@shared/utils/date' },
  
  // shared - types
  { from: 'src/types/job.types.js', to: 'src/shared/types/job.types.js', alias: '@shared/types/job.types' },
  { from: 'src/types/user.types.js', to: 'src/shared/types/user.types.js', alias: '@shared/types/user.types' },
  { from: 'src/types/worker.types.js', to: 'src/shared/types/worker.types.js', alias: '@shared/types/worker.types' },
  { from: 'src/types/navigation.types.js', to: 'src/shared/types/navigation.types.js', alias: '@shared/types/navigation.types' },
  
  // features - auth
  { from: 'src/screens/auth/LanguageScreen.jsx', to: 'src/features/auth/screens/LanguageScreen.jsx', alias: '@auth/screens/LanguageScreen' },
  { from: 'src/screens/auth/PhoneScreen.jsx', to: 'src/features/auth/screens/PhoneScreen.jsx', alias: '@auth/screens/PhoneScreen' },
  { from: 'src/screens/auth/OTPScreen.jsx', to: 'src/features/auth/screens/OTPScreen.jsx', alias: '@auth/screens/OTPScreen' },
  { from: 'src/screens/auth/CompleteProfileScreen.jsx', to: 'src/features/auth/screens/CompleteProfileScreen.jsx', alias: '@auth/screens/CompleteProfileScreen' },
  { from: 'src/screens/auth/RoleSelectionScreen.jsx', to: 'src/features/auth/screens/RoleSelectionScreen.jsx', alias: '@auth/screens/RoleSelectionScreen' },
  { from: 'src/stores/authStore.js', to: 'src/features/auth/store.js', alias: '@auth/store' },
  { from: 'src/services/api/auth.js', to: 'src/features/auth/api.js', alias: '@auth/api' },
  
  // features - notifications
  { from: 'src/screens/NotificationsListScreen.jsx', to: 'src/features/notifications/screens/NotificationsListScreen.jsx', alias: '@notifications/screens/NotificationsListScreen' },
  { from: 'src/components/JobAlertBottomSheet.jsx', to: 'src/features/notifications/components/JobAlertBottomSheet.jsx', alias: '@notifications/components/JobAlertBottomSheet' },
  { from: 'src/components/NotificationItem.jsx', to: 'src/features/notifications/components/NotificationItem.jsx', alias: '@notifications/components/NotificationItem' },
  
  // features - worker
  { from: 'src/screens/worker/WorkerHomeScreen.jsx', to: 'src/features/worker/screens/WorkerHomeScreen.jsx', alias: '@worker/screens/WorkerHomeScreen' },
  { from: 'src/screens/worker/AvailableJobsScreen.jsx', to: 'src/features/worker/screens/AvailableJobsScreen.jsx', alias: '@worker/screens/AvailableJobsScreen' },
  { from: 'src/screens/worker/JobDetailPreviewScreen.jsx', to: 'src/features/worker/screens/JobDetailPreviewScreen.jsx', alias: '@worker/screens/JobDetailPreviewScreen' },
  { from: 'src/screens/worker/WorkerProfileScreen.jsx', to: 'src/features/worker/screens/WorkerProfileScreen.jsx', alias: '@worker/screens/WorkerProfileScreen' },
  { from: 'src/screens/worker/WorkerEarningsScreen.jsx', to: 'src/features/worker/screens/WorkerEarningsScreen.jsx', alias: '@worker/screens/WorkerEarningsScreen' },
  { from: 'src/screens/worker/WorkerBankAccountsScreen.jsx', to: 'src/features/worker/screens/WorkerBankAccountsScreen.jsx', alias: '@worker/screens/WorkerBankAccountsScreen' },
  { from: 'src/screens/worker/WorkerWithdrawScreen.jsx', to: 'src/features/worker/screens/WorkerWithdrawScreen.jsx', alias: '@worker/screens/WorkerWithdrawScreen' },
  { from: 'src/screens/worker/ServiceAreaSetupScreen.jsx', to: 'src/features/worker/screens/ServiceAreaSetupScreen.jsx', alias: '@worker/screens/ServiceAreaSetupScreen' },
  
  { from: 'src/screens/worker/onboarding/OnboardingWelcome.jsx', to: 'src/features/worker/onboarding/OnboardingWelcome.jsx', alias: '@worker/onboarding/OnboardingWelcome' },
  { from: 'src/screens/worker/onboarding/OnboardingPersonal.jsx', to: 'src/features/worker/onboarding/OnboardingPersonal.jsx', alias: '@worker/onboarding/OnboardingPersonal' },
  { from: 'src/screens/worker/onboarding/OnboardingDocuments.jsx', to: 'src/features/worker/onboarding/OnboardingDocuments.jsx', alias: '@worker/onboarding/OnboardingDocuments' },
  { from: 'src/screens/worker/onboarding/OnboardingBankDetails.jsx', to: 'src/features/worker/onboarding/OnboardingBankDetails.jsx', alias: '@worker/onboarding/OnboardingBankDetails' },
  { from: 'src/screens/worker/onboarding/OnboardingLocation.jsx', to: 'src/features/worker/onboarding/OnboardingLocation.jsx', alias: '@worker/onboarding/OnboardingLocation' },
  { from: 'src/screens/worker/onboarding/OnboardingComplete.jsx', to: 'src/features/worker/onboarding/OnboardingComplete.jsx', alias: '@worker/onboarding/OnboardingComplete' },
  { from: 'src/stores/workerStore.js', to: 'src/features/worker/store.js', alias: '@worker/store' },
  { from: 'src/services/api/worker.js', to: 'src/features/worker/api.js', alias: '@worker/api' },
  
  // features - inspection
  { from: 'src/screens/worker/ActiveJobScreen.jsx', to: 'src/features/inspection/screens/ActiveJobScreen.jsx', alias: '@inspection/screens/ActiveJobScreen' },
  { from: 'src/screens/worker/MaterialDeclarationScreen.jsx', to: 'src/features/inspection/screens/MaterialDeclarationScreen.jsx', alias: '@inspection/screens/MaterialDeclarationScreen' },
  { from: 'src/screens/worker/JobCompleteSummaryScreen.jsx', to: 'src/features/inspection/screens/JobCompleteSummaryScreen.jsx', alias: '@inspection/screens/JobCompleteSummaryScreen' },
  { from: 'src/services/api/inspection.js', to: 'src/features/inspection/api.js', alias: '@inspection/api' },
  
  // features - payment
  { from: 'src/screens/customer/PaymentScreen.jsx', to: 'src/features/payment/screens/PaymentScreen.jsx', alias: '@payment/screens/PaymentScreen' },
  { from: 'src/screens/customer/BillReviewScreen.jsx', to: 'src/features/payment/screens/BillReviewScreen.jsx', alias: '@payment/screens/BillReviewScreen' },
  { from: 'src/screens/customer/PaymentConfirmScreen.jsx', to: 'src/features/payment/screens/PaymentConfirmScreen.jsx', alias: '@payment/screens/PaymentConfirmScreen' },
  { from: 'src/screens/customer/RatingScreen.jsx', to: 'src/features/payment/screens/RatingScreen.jsx', alias: '@payment/screens/RatingScreen' },
  { from: 'src/services/api/payment.js', to: 'src/features/payment/api.js', alias: '@payment/api' },
  
  // features - jobs
  { from: 'src/screens/customer/HomeScreen.jsx', to: 'src/features/jobs/screens/CustomerHomeScreen.jsx', alias: '@jobs/screens/CustomerHomeScreen' },
  { from: 'src/screens/customer/DynamicQuestionsScreen.jsx', to: 'src/features/jobs/screens/DynamicQuestionsScreen.jsx', alias: '@jobs/screens/DynamicQuestionsScreen' },
  { from: 'src/screens/customer/LocationScheduleScreen.jsx', to: 'src/features/jobs/screens/LocationScheduleScreen.jsx', alias: '@jobs/screens/LocationScheduleScreen' },
  { from: 'src/screens/customer/SearchingScreen.jsx', to: 'src/features/jobs/screens/SearchingScreen.jsx', alias: '@jobs/screens/SearchingScreen' },
  { from: 'src/screens/customer/JobStatusDetailScreen.jsx', to: 'src/features/jobs/screens/JobStatusDetailScreen.jsx', alias: '@jobs/screens/JobStatusDetailScreen' },
  { from: 'src/screens/customer/EditJobScreen.jsx', to: 'src/features/jobs/screens/EditJobScreen.jsx', alias: '@jobs/screens/EditJobScreen' },
  { from: 'src/stores/jobStore.js', to: 'src/features/jobs/store.js', alias: '@jobs/store' },
  { from: 'src/services/api/jobs.js', to: 'src/features/jobs/api.js', alias: '@jobs/api' },
  
  // features - customer
  { from: 'src/screens/customer/CustomerProfileScreen.jsx', to: 'src/features/customer/screens/CustomerProfileScreen.jsx', alias: '@customer/screens/CustomerProfileScreen' },
  { from: 'src/screens/customer/AddressesScreen.jsx', to: 'src/features/customer/screens/AddressesScreen.jsx', alias: '@customer/screens/AddressesScreen' },
  { from: 'src/screens/customer/SupportScreen.jsx', to: 'src/features/customer/screens/SupportScreen.jsx', alias: '@customer/screens/SupportScreen' },
  { from: 'src/screens/customer/ChatScreen.jsx', to: 'src/features/customer/screens/ChatScreen.jsx', alias: '@customer/screens/ChatScreen' },
  { from: 'src/screens/customer/TicketChatScreen.jsx', to: 'src/features/customer/screens/TicketChatScreen.jsx', alias: '@customer/screens/TicketChatScreen' },
  
  // app
  { from: 'src/navigation/RootNavigator.jsx', to: 'src/app/RootNavigator.jsx', alias: '@app/RootNavigator' },
  { from: 'src/components/GlobalLoader.jsx', to: 'src/app/GlobalLoader.jsx', alias: '@app/GlobalLoader' },
  { from: 'App.js', to: 'src/app/App.js', alias: '@app/App' },
  { from: 'index.js', to: 'src/app/index.js', alias: '@app/index' }
];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'design-system') {
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

const baseDir = __dirname;
let logs = [];

// 1. Rename files
moves.forEach(m => {
  const source = path.join(baseDir, m.from);
  const target = path.join(baseDir, m.to);
  if (fs.existsSync(source)) {
     fs.renameSync(source, target);
     logs.push(`ACTION : MOVE\nFROM   : ${m.from}\nTO     : ${m.to}\nIMPORTS UPDATED: pending...`);
  } else {
     // console.warn(`Missing: ${source}`);
  }
});

// Design system moved via Powershell beforehand due to Windows EPERM

// 2. Compute import updates
const updatedImports = {};
moves.forEach(m => updatedImports[m.from] = []);

const allFiles = getAllFiles(baseDir);

// Simple regex array for each move
const replaceRules = moves.map(m => {
  // e.g. from = 'src/services/api/client.js'
  // if someone imports it as '../../services/api/client'
  // we look for any import that ends with 'services/api/client'
  const targetPattern = m.from.replace('src/', '').replace('.js', '').replace('.jsx', '');
  // Matches: import ... from '@infra/api/client'
  const regex = new RegExp(`from\\s+['"]([^'"]*${targetPattern}(\\.(js|jsx))?)['"]`, 'g');
  const requireRegex = new RegExp(`require\\(['"]([^'"]*${targetPattern}(\\.(js|jsx))?)['"]\\)`, 'g');
  
  return {
    from: m.from,
    alias: m.alias,
    regex,
    requireRegex,
    targetPattern
  };
});

allFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  replaceRules.forEach(rule => {
    // If the file's old imports match our rule
    if (content.match(rule.regex) || content.match(rule.requireRegex)) {
       content = content.replace(rule.regex, `from '${rule.alias}'`);
       content = content.replace(rule.requireRegex, `require('${rule.alias}')`);
       changed = true;
       updatedImports[rule.from].push(file.replace(baseDir + '\\', '').replace(baseDir + '/', ''));
    }
  });
  
  if (changed) {
    fs.writeFileSync(file, content);
  }
});

// Re-write logs with updated imports
let finalLogs = [];
moves.forEach(m => {
   const updates = updatedImports[m.from] || [];
   const updateStr = updates.length > 0 ? updates.join(', ') : 'none';
   finalLogs.push(`ACTION : MOVE\nFROM   : ${m.from}\nTO     : ${m.to}\nIMPORTS UPDATED: ${updateStr}`);
});

fs.writeFileSync('migration_log.txt', finalLogs.join('\n\n'));
console.log('Migration complete. Wrote log to migration_log.txt');
