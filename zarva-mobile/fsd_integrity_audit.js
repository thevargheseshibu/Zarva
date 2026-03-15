const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function getAllFiles(dirPath, array) {
  if (!fs.existsSync(dirPath)) return array || [];
  array = array || [];
  for (const file of fs.readdirSync(dirPath)) {
    const full = path.join(dirPath, file);
    if (fs.statSync(full).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'android' && file !== 'ios' && file !== '.expo')
        getAllFiles(full, array);
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx'))
        array.push(full);
    }
  }
  return array;
}

function rel(p) { return p.replace(ROOT + path.sep, '').replace(/\\/g, '/'); }

// ─────────────────────────────────────────────────────────
// STEP 1 — EMPTY / TRUNCATED FILE AUDIT
// ─────────────────────────────────────────────────────────
const SCAN_DIRS = ['src/app', 'src/infra', 'src/shared', 'src/features'];

let step1 = [];

SCAN_DIRS.forEach(dir => {
  const files = getAllFiles(path.join(ROOT, dir));
  files.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    const lc = lines.length;
    const trimmed = content.trim();
    const r = rel(f);

    const issues = [];

    // Check 1: Under 15 lines and NOT a simple export index
    const isIndexFile = f.endsWith('index.js');
    const hasOnlyExports = /^(\/\/[^\n]*\n|export\s|import\s|\n|\s)*$/.test(trimmed);
    if (lc < 15 && !isIndexFile && !hasOnlyExports) {
      issues.push(`Under 15 lines (${lc}) — likely truncated or stub`);
    }
    if (lc < 15 && isIndexFile && trimmed.length < 10) {
      issues.push(`Empty index.js (${lc} lines)`);
    }

    // Check 2: Placeholder comments
    const placeholders = [
      '// ... rest of code',
      '// implement logic here',
      '// TODO: implement',
      'return null;',
      'Auto-generated stub',
      '// placeholder',
      '// auto-generated',
      '// stub',
    ];
    placeholders.forEach(p => {
      if (content.toLowerCase().includes(p.toLowerCase())) {
        issues.push(`Contains placeholder: "${p}"`);
      }
    });

    // Check 3: Empty component body
    if (/const\s+\w+\s*=\s*\(\)\s*=>\s*\{\s*return\s+null;\s*\}/.test(content) && lc < 20) {
      issues.push('Empty component pattern (returns null)');
    }

    // Check 4: Abrupt end / syntax issues — file ends without proper closing
    const lastLine = lines[lines.length - 1].trim();
    if (lastLine !== '' && lastLine !== '}' && lastLine !== '};' && lastLine !== ');' && !lastLine.startsWith('//') && !lastLine.startsWith('export') && !lastLine.startsWith('module') && lc > 5) {
      // Check specifically for abrupt ending
      if (!lastLine.endsWith(';') && !lastLine.endsWith('}') && !lastLine.endsWith(')') && !lastLine.endsWith(',') && !lastLine.endsWith('"') && !lastLine.endsWith("'") && !lastLine.endsWith('`') && !lastLine.endsWith('0')) {
        issues.push(`File ends abruptly on: "${lastLine.substring(0, 60)}"`);
      }
    }

    if (issues.length > 0) {
      step1.push({ file: r, issues, lines: lc });
    }
  });
});

// ─────────────────────────────────────────────────────────
// STEP 2 — LOST AND FOUND (Unmigrated Legacy Files)
// ─────────────────────────────────────────────────────────
const LEGACY_DIRS = ['src/screens', 'src/components', 'src/stores', 'src/services', 'src/hooks'];

const FSD_MAP = {
  // auth
  'src/screens/auth/BlockedScreen.jsx':               'src/features/auth/screens/BlockedScreen.jsx',
  'src/screens/auth/RoleSelection.jsx':               'src/features/auth/screens/RoleSelectionScreen.jsx',
  'src/screens/auth/SplashScreen.jsx':                'src/features/auth/screens/SplashScreen.jsx',
  'src/screens/auth/CompleteProfileScreen.jsx':       'src/features/auth/screens/CompleteProfileScreen.jsx',
  'src/screens/auth/LanguageScreen.jsx':              'src/features/auth/screens/LanguageScreen.jsx',
  'src/screens/auth/OTPScreen.jsx':                   'src/features/auth/screens/OTPScreen.jsx',
  'src/screens/auth/PhoneScreen.jsx':                 'src/features/auth/screens/PhoneScreen.jsx',
  // customer screens
  'src/screens/customer/CreateCustomJobScreen.jsx':   'src/features/jobs/screens/CreateCustomJobScreen.jsx',
  'src/screens/customer/MyCustomRequestsScreen.jsx':  'src/features/jobs/screens/MyCustomRequestsScreen.jsx',
  'src/screens/customer/MyJobsScreen.jsx':            'src/features/jobs/screens/MyJobsScreen.jsx',
  'src/screens/customer/PriceEstimateScreen.jsx':     'src/features/jobs/screens/PriceEstimateScreen.jsx',
  'src/screens/customer/WorkerReputationScreen.jsx':  'src/features/customer/screens/WorkerReputationScreen.jsx',
  'src/screens/customer/AddressesScreen.jsx':         'src/features/customer/screens/AddressesScreen.jsx',
  // shared screens
  'src/screens/shared/ChatScreen.jsx':                'src/features/customer/screens/ChatScreen.jsx',
  'src/screens/shared/support/CreateTicketScreen.jsx':'src/features/customer/screens/CreateTicketScreen.jsx',
  'src/screens/shared/support/SelectJobScreen.jsx':   'src/features/customer/screens/SelectJobScreen.jsx',
  'src/screens/shared/support/SupportHomeScreen.jsx': 'src/features/customer/screens/SupportScreen.jsx',
  'src/screens/shared/support/TicketChatScreen.jsx':  'src/features/customer/screens/TicketChatScreen.jsx',
  'src/screens/shared/support/TicketListScreen.jsx':  'src/features/customer/screens/TicketListScreen.jsx',
  'src/screens/shared/support/SupportNavigator.jsx':  'src/app/SupportNavigator.jsx',
  // worker screens
  'src/screens/worker/AddBankAccountScreen.jsx':                   'src/features/worker/screens/AddBankAccountScreen.jsx',
  'src/screens/worker/AlertPreferencesScreen.jsx':                 'src/features/worker/screens/AlertPreferencesScreen.jsx',
  'src/screens/worker/EarningsScreen.jsx':                         'src/features/worker/screens/WorkerEarningsScreen.jsx',
  'src/screens/worker/ExtensionRequestScreen.jsx':                 'src/features/inspection/components/ExtensionRequestSheet.jsx',
  'src/screens/worker/MyWorkScreen.jsx':                           'src/features/worker/screens/MyWorkScreen.jsx',
  'src/screens/worker/OnboardingWelcome.jsx':                      'src/features/worker/onboarding/OnboardingWelcome.jsx',
  'src/screens/worker/VerificationPendingScreen.jsx':              'src/features/worker/onboarding/VerificationPendingScreen.jsx',
  'src/screens/worker/WorkerTransactionHistoryScreen.jsx':         'src/features/worker/screens/WorkerTransactionHistoryScreen.jsx',
  'src/screens/worker/WorkerWalletScreen.jsx':                     'src/features/worker/screens/WorkerWalletScreen.jsx',
  'src/screens/worker/onboarding/OnboardingAgreement.jsx':         'src/features/worker/onboarding/OnboardingComplete.jsx',
  'src/screens/worker/onboarding/OnboardingBasicInfo.jsx':         'src/features/worker/onboarding/OnboardingPersonal.jsx',
  'src/screens/worker/onboarding/OnboardingPayment.jsx':           'src/features/worker/onboarding/OnboardingBankDetails.jsx',
  'src/screens/worker/onboarding/OnboardingSkills.jsx':            'src/features/worker/onboarding/OnboardingSkills.jsx',
  'src/screens/worker/onboarding/PendingApproval.jsx':             'src/features/worker/onboarding/PendingApproval.jsx',
  'src/screens/worker/onboarding/ServiceAreaSetupScreen.jsx':      'src/features/worker/screens/ServiceAreaSetupScreen.jsx',
  // components
  'src/components/JobAlertBottomSheet.jsx':   'src/features/notifications/components/JobAlertBottomSheet.jsx',
  'src/components/ActivityCard.jsx':          'src/features/jobs/components/ActivityCard.jsx',
  'src/components/FadeInView.jsx':            'src/shared/ui/FadeInView.jsx',
  'src/components/GoldButton.jsx':            'src/shared/ui/GoldButton.jsx',
  'src/components/LocationInput.jsx':         'src/features/jobs/components/LocationInput.jsx',
  'src/components/MainBackground.jsx':        'src/shared/ui/MainBackground.jsx',
  'src/components/MapPickerModal.jsx':        'src/shared/ui/MapPickerModal.jsx',
  'src/components/NotCoveredView.jsx':        'src/shared/ui/NotCoveredView.jsx',
  'src/components/PremiumButton.jsx':         'src/shared/ui/PremiumButton.jsx',
  'src/components/PremiumHeader.jsx':         'src/shared/ui/PremiumHeader.jsx',
  'src/components/PremiumTabBar.jsx':         'src/shared/ui/PremiumTabBar.jsx',
  'src/components/RadarAnimation.jsx':        'src/shared/ui/RadarAnimation.jsx',
  'src/components/StatusPill.jsx':            'src/shared/ui/StatusPill.jsx',
  'src/components/WorkerCard.jsx':            'src/shared/ui/WorkerCard.jsx',
  'src/components/ZarvaHeader.jsx':           'src/shared/ui/ZarvaHeader.jsx',
  'src/components/ZarvaSplash.jsx':           'src/shared/ui/ZarvaSplash.jsx',
  // stores  
  'src/stores/customerWalletStore.js':        'src/features/payment/customerWalletStore.js',
  'src/stores/uiStore.js':                    'src/shared/hooks/uiStore.js',
  'src/stores/workerWalletStore.js':          'src/features/payment/workerWalletStore.js',
  'src/stores/otpStore.js':                   'src/features/auth/otpStore.js',
  // services
  'src/services/api/coverageApi.js':          'src/infra/api/coverageApi.js',
  'src/services/api/walletApi.js':            'src/features/payment/api.js',
  'src/services/api/chatApi.js':              'src/features/customer/api.js',
  'src/services/JobAlertService.js':          'src/features/notifications/JobAlertService.js',
  // hooks
  'src/hooks/useT.js':                        'src/shared/i18n/useTranslation.js',
};

let step2 = [];

LEGACY_DIRS.forEach(dir => {
  const files = getAllFiles(path.join(ROOT, dir));
  files.forEach(f => {
    const r = rel(f);
    const mapped = FSD_MAP[r];
    const destExists = mapped && fs.existsSync(path.join(ROOT, mapped));
    step2.push({ old: r, target: mapped || '— No mapping defined —', destExists });
  });
});

// ─────────────────────────────────────────────────────────
// STEP 3 — CRITICAL FILES CHECK
// ─────────────────────────────────────────────────────────
const CRITICAL = [
  { path: 'src/infra/api/client.js', keyword: 'axios', label: 'Axios config' },
  { path: 'src/infra/firebase/app.js', keyword: 'initializeApp', label: 'Firebase init' },
  { path: 'src/infra/notifications/fcm.init.js', keyword: 'setBackgroundMessageHandler', label: 'FCM setup' },
  { path: 'src/shared/i18n/merger.js', keyword: '__DEV__', label: '__DEV__ duplicate check' },
  { path: 'src/shared/design-system/useTokens.js', keyword: 'useColorScheme', label: 'Theme logic' },
  { path: 'src/features/jobs/screens/SearchingScreen.jsx', keyword: 'useEffect', label: 'Screen logic present' },
  { path: 'src/features/inspection/screens/ActiveJobScreen.jsx', keyword: 'useEffect', label: 'Screen logic present' },
  { path: 'src/features/payment/screens/PaymentScreen.jsx', keyword: 'useEffect', label: 'Screen logic present' },
  { path: 'src/features/auth/screens/OTPScreen.jsx', keyword: 'useEffect', label: 'Screen logic present' },
];

let step3 = [];
CRITICAL.forEach(c => {
  const full = path.join(ROOT, c.path);
  if (!fs.existsSync(full)) {
    step3.push({ file: c.path, status: 'MISSING', label: c.label });
  } else {
    const content = fs.readFileSync(full, 'utf8');
    const lc = content.split('\n').length;
    if (lc < 10) {
      step3.push({ file: c.path, status: 'EMPTY', lines: lc, label: c.label });
    } else if (!content.includes(c.keyword)) {
      step3.push({ file: c.path, status: `PRESENT BUT MISSING KEY CONTENT ("${c.keyword}" not found)`, lines: lc, label: c.label });
    } else {
      step3.push({ file: c.path, status: 'PRESENT AND POPULATED', lines: lc, label: c.label });
    }
  }
});

// ─────────────────────────────────────────────────────────
// STEP 4 — BROKEN EXPORTS & IMPORTS AUDIT
// ─────────────────────────────────────────────────────────
const FEATURES = ['auth','notifications','worker','inspection','payment','jobs','customer'];
let step4 = [];

// 4a: Check index.js exports
FEATURES.forEach(feat => {
  const indexPath = path.join(ROOT, `src/features/${feat}/index.js`);
  if (!fs.existsSync(indexPath)) {
    step4.push({ file: `src/features/${feat}/index.js`, broken: 'index.js itself is missing', reason: 'File missing' });
    return;
  }
  const content = fs.readFileSync(indexPath, 'utf8');
  // Extract things it tries to export
  const importMatches = [...content.matchAll(/from\s+['"](.+)['"]/g)].map(m => m[1]);
  importMatches.forEach(imp => {
    if (imp.startsWith('./') || imp.startsWith('../')) {
      const targetFile = path.resolve(path.join(ROOT, `src/features/${feat}`), imp);
      const candidates = [targetFile, targetFile + '.js', targetFile + '.jsx', path.join(targetFile, 'index.js')];
      const exists = candidates.some(c => fs.existsSync(c));
      if (!exists) {
        step4.push({ file: `src/features/${feat}/index.js`, broken: imp, reason: 'Exported file does not exist at path' });
      }
    }
  });
});

// 4b: Check Navigator files for broken imports
const NAV_FILES = [
  'src/app/RootNavigator.jsx',
  'src/navigation/AuthNavigator.jsx',
  'src/navigation/CustomerNavigator.jsx',
  'src/navigation/CustomerStack.jsx',
  'src/navigation/WorkerNavigator.jsx',
  'src/navigation/WorkerStack.jsx',
  'src/navigation/OnboardingNavigator.jsx',
];

const ALIAS_MAP = {
  '@app': 'src/app',
  '@features': 'src/features',
  '@shared': 'src/shared',
  '@infra': 'src/infra',
  '@auth': 'src/features/auth',
  '@jobs': 'src/features/jobs',
  '@inspection': 'src/features/inspection',
  '@payment': 'src/features/payment',
  '@notifications': 'src/features/notifications',
  '@worker': 'src/features/worker',
  '@customer': 'src/features/customer',
};

NAV_FILES.forEach(navFile => {
  const full = path.join(ROOT, navFile);
  if (!fs.existsSync(full)) return;
  const content = fs.readFileSync(full, 'utf8');
  const importMatches = [...content.matchAll(/from\s+['"](@[^'"]+)['"]/g)];
  importMatches.forEach(m => {
    const imp = m[1];
    // Resolve alias
    let resolved = imp;
    for (const [alias, aliasPath] of Object.entries(ALIAS_MAP)) {
      if (imp.startsWith(alias + '/')) {
        resolved = aliasPath + imp.slice(alias.length);
        break;
      } else if (imp === alias) {
        resolved = aliasPath + '/index.js';
        break;
      }
    }
    const candidates = [
      path.join(ROOT, resolved),
      path.join(ROOT, resolved + '.js'),
      path.join(ROOT, resolved + '.jsx'),
      path.join(ROOT, resolved, 'index.js'),
    ];
    const exists = candidates.some(c => fs.existsSync(c));
    if (!exists) {
      step4.push({ file: navFile, broken: imp, reason: `Resolved to "${resolved}" — file not found` });
    }
  });
});

// ─────────────────────────────────────────────────────────
// STEP 5 — FINAL DAMAGE REPORT
// ─────────────────────────────────────────────────────────
const totalEmpty = step1.length;
const totalLeftBehind = step2.length;
const totalMissing = step3.filter(f => f.status === 'MISSING').length;
const totalEmpty3 = step3.filter(f => f.status === 'EMPTY').length;
const totalMissingContent = step3.filter(f => f.status.startsWith('PRESENT BUT')).length;

// ─────────────────────────────────────────────────────────
// WRITE REPORT
// ─────────────────────────────────────────────────────────
let report = '';
const div = '═══════════════════════════════════════════════════════════\n';

// STEP 1
report += div + 'STEP 1 — EMPTY / TRUNCATED FILE AUDIT\n' + div + '\n';
if (step1.length === 0) {
  report += 'No empty or truncated files found.\n\n';
} else {
  step1.forEach(f => {
    f.issues.forEach(issue => {
      report += `- FILE:  ${f.file}\n- ISSUE: ${issue}\n- LINES: ${f.lines}\n\n`;
    });
  });
}

// STEP 2
report += div + 'STEP 2 — LOST AND FOUND (Unmigrated Files)\n' + div + '\n';
if (step2.length === 0) {
  report += 'No files found in legacy directories. Migration appears complete.\n\n';
} else {
  step2.forEach(f => {
    const alreadyMoved = f.destExists ? ' ✅ Already at destination' : ' ⚠️ NOT at destination yet';
    report += `- FILE LEFT BEHIND:     ${f.old}\n- TARGET DESTINATION:   ${f.target}${alreadyMoved}\n\n`;
  });
}

// STEP 3
report += div + 'STEP 3 — CRITICAL FILES CHECK\n' + div + '\n';
step3.forEach(f => {
  const icon = f.status === 'PRESENT AND POPULATED' ? '✅' : (f.status === 'MISSING' ? '❌' : '⚠️');
  report += `${icon} ${f.file}\n   STATUS: ${f.status}\n   CHECKS FOR: ${f.label}\n`;
  if (f.lines) report += `   LINES:  ${f.lines}\n`;
  report += '\n';
});

// STEP 4
report += div + 'STEP 4 — BROKEN EXPORTS & IMPORTS AUDIT\n' + div + '\n';
if (step4.length === 0) {
  report += 'No broken exports or imports found in navigators or index files.\n\n';
} else {
  step4.forEach(f => {
    report += `- NAVIGATOR / INDEX: ${f.file}\n- BROKEN IMPORT:     ${f.broken}\n- REASON:            ${f.reason}\n\n`;
  });
}

// STEP 5
report += div + 'STEP 5 — FINAL DAMAGE REPORT\n' + div + '\n';
report += `Total empty/truncated/placeholder files found : ${totalEmpty}\n`;
report += `Total files left behind in legacy folders     : ${totalLeftBehind}\n`;
report += `Total critical FSD files completely missing   : ${totalMissing}\n`;
report += `Total critical files empty (< 10 lines)      : ${totalEmpty3}\n`;
report += `Total critical files missing key content     : ${totalMissingContent}\n`;

const overallPassed = totalLeftBehind === 0 && totalMissing === 0 && totalEmpty3 === 0;
report += `\nOVERALL INTEGRITY STATUS: ${overallPassed ? '✅ PASS' : '⚠️  ISSUES FOUND — review above'}\n`;

fs.writeFileSync(path.join(ROOT, 'fsd_integrity_report.md'), report);
console.log('Integrity audit complete. Report saved to fsd_integrity_report.md');
