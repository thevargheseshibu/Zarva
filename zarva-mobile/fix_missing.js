const fs = require('fs');
const path = require('path');

function createStubs() {
  const missing = [
    'src/features/notifications/store.js',
    'src/features/notifications/fcmHandler.js',
    'src/features/notifications/screens/NotificationsListScreen.jsx',
    'src/features/notifications/components/NotificationItem.jsx',
    'src/features/notifications/hooks/useJobAlert.js',
    'src/features/notifications/hooks/useAlertNavigation.js',
    'src/features/worker/onboarding/OnboardingLocation.jsx',
    'src/features/worker/onboarding/onboardingStore.js',
    'src/features/worker/hooks/useAvailabilityToggle.js',
    'src/features/worker/hooks/useWorkerStats.js',
    'src/features/inspection/store.js',
    'src/features/inspection/components/OTPVerifyBlock.jsx',
    'src/features/inspection/components/InspectionTimerBar.jsx',
    'src/features/inspection/components/PauseResumePanel.jsx',
    'src/features/inspection/hooks/useInspectionOTP.js',
    'src/features/inspection/hooks/useInspectionTimer.js',
    'src/features/inspection/hooks/useInspectionStatus.js',
    'src/features/payment/store.js',
    'src/features/payment/components/BillLineItem.jsx',
    'src/features/payment/components/PaymentMethodCard.jsx',
    'src/features/payment/components/WalletBalanceChip.jsx',
    'src/features/payment/hooks/usePaymentGuard.js',
    'src/features/payment/hooks/useWalletBalance.js',
    'src/features/jobs/components/JobCard.jsx',
    'src/features/jobs/components/PriceEstimateCard.jsx',
    'src/features/jobs/components/JobStatusBadge.jsx',
    'src/features/jobs/hooks/useJobTimer.js',
    'src/features/jobs/hooks/useJobSearch.js',
    'src/features/jobs/hooks/useJobFirebase.js',
    'src/features/customer/store.js',
    'src/features/customer/screens/AddressesScreen.jsx',
    'src/features/customer/hooks/useChatMessages.js'
  ];

  missing.forEach(file => {
    const fullPath = path.join(__dirname, 'src', file.replace('src/', ''));
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, '// Auto-generated stub\nexport default {};\n');
    }
  });
}

function fixImportTypos() {
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

    const all = getAllFiles(path.join(__dirname, 'src'));
    all.forEach(f => {
        let content = fs.readFileSync(f, 'utf8');
        let changed = false;
        
        const typoPatches = [
            { match: /\.\.\/\.\.\/@/g, replace: '@' },
            { match: /\.\.\/@/g, replace: '@' }
        ];

        typoPatches.forEach(p => {
           if (content.match(p.match)) {
               content = content.replace(p.match, p.replace);
               changed = true;
           }
        });

        if (changed) fs.writeFileSync(f, content);
    });
}

createStubs();
fixImportTypos();
console.log('Stubs created and typos fixed.');
