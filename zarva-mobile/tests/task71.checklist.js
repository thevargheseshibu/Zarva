const fs = require('fs');
const path = require('path');
const base = path.join(process.cwd(), 'src');
let pass = 0, total = 0;
const ok = (msg) => { total++; pass++; console.log('  [Pass]', msg); };
const fail = (msg) => { total++; console.error('  [FAIL]', msg); };
const assert = (cond, msg) => cond ? ok(msg) : fail(msg);

// ✅ 1. expo start launch readiness
console.log('\n--- 1. expo start launch readiness ---');
const idx = fs.readFileSync('index.js', 'utf8');
const app = fs.readFileSync('App.js', 'utf8');
const cfg = JSON.parse(fs.readFileSync('app.json', 'utf8'));
assert(idx.includes('registerRootComponent'), 'index.js: registerRootComponent called');
assert(idx.includes("import App from './App'"), 'index.js: imports App.js');
assert(app.includes('GestureHandlerRootView'), 'App.js: GestureHandlerRootView wrapper');
assert(app.includes('QueryClientProvider'), 'App.js: QueryClientProvider wrapper');
assert(app.includes('SafeAreaProvider'), 'App.js: SafeAreaProvider wrapper');
assert(app.includes('RootNavigator'), 'App.js: renders RootNavigator');
assert(cfg.expo.name === 'Zarva', 'app.json: name = Zarva');
assert(cfg.expo.android.package === 'com.zarva.app', 'app.json: android.package = com.zarva.app');
assert(!cfg.expo.plugins || !cfg.expo.plugins.includes('expo-router'), 'app.json: no expo-router plugin conflict');

// ✅ 2. Design tokens
console.log('\n--- 2. Design tokens ---');
const tok = fs.readFileSync(path.join(base, 'design-system/tokens.js'), 'utf8');
assert(tok.includes("'#0A0A0F'"), "colors.bg.primary = '#0A0A0F'");
assert(tok.includes("'#12121A'"), "colors.bg.elevated = '#12121A'");
assert(tok.includes("'#C9A84C'"), "colors.gold.primary = '#C9A84C'");
assert(tok.includes("'#F0EDE8'"), "colors.text.primary = '#F0EDE8'");
assert(tok.includes("'#2ECC8A'"), "colors.success = '#2ECC8A'");
assert(tok.includes("'#FF4D6A'"), "colors.error = '#FF4D6A'");
assert(tok.includes('xs: 4') || tok.includes('xs:4'), 'spacing.xs = 4');
assert(tok.includes('full: 999'), 'radius.full = 999');

// ✅ 3. GoldButton renders with gold background
console.log('\n--- 3. GoldButton ---');
const gb = fs.readFileSync(path.join(base, 'components/GoldButton.jsx'), 'utf8');
assert(gb.includes('colors.gold.primary'), 'GoldButton: backgroundColor = colors.gold.primary (#C9A84C)');
assert(gb.includes('colors.text.inverse'), 'GoldButton: label color = colors.text.inverse (#0A0A0F)');
assert(gb.includes('56'), 'GoldButton: height = 56px');
assert(gb.includes('radius.lg'), 'GoldButton: borderRadius = radius.lg (16px)');
assert(gb.includes('TouchableOpacity'), 'GoldButton: uses TouchableOpacity');
assert(gb.includes('ActivityIndicator'), 'GoldButton: loading spinner present');
assert(!gb.match(/:\s*(string|boolean|number)\b/), 'GoldButton: no TypeScript type annotations');

// ✅ 4. Completely separate navigators
console.log('\n--- 4. Navigator separation ---');
const cn = fs.readFileSync(path.join(base, 'navigation/CustomerNavigator.jsx'), 'utf8');
const wn = fs.readFileSync(path.join(base, 'navigation/WorkerNavigator.jsx'), 'utf8');
const stripComments = (src) => src.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
const cnCode = stripComments(cn);
const wnCode = stripComments(wn);
assert(!cnCode.toLowerCase().includes('worker'), 'CustomerNavigator: ZERO worker references in code (not comments)');
assert(!wnCode.toLowerCase().includes('customer'), 'WorkerNavigator: ZERO customer references in code (not comments)');
assert(cn.includes('HomeScreen') && cn.includes('MyJobsScreen'), 'CustomerNavigator: correct screens');
assert(wn.includes('AvailableJobsScreen') && wn.includes('MyWorkScreen'), 'WorkerNavigator: correct screens');
assert(cn.includes('createBottomTabNavigator'), 'CustomerNavigator: BottomTabs');
assert(wn.includes('createBottomTabNavigator'), 'WorkerNavigator: BottomTabs');
const cScreens = fs.readdirSync(path.join(base, 'screens/customer')).join(' ').toLowerCase();
const wScreens = fs.readdirSync(path.join(base, 'screens/worker')).join(' ').toLowerCase();
assert(!wScreens.includes('homescreen') && !wScreens.includes('myjobs'), 'Worker screens folder: no customer files');
assert(!cScreens.includes('available') && !cScreens.includes('mywork'), 'Customer screens folder: no worker files');

// ✅ 5. authStore role gates RootNavigator
console.log('\n--- 5. Role-gated RootNavigator ---');
const as = fs.readFileSync(path.join(base, 'stores/authStore.js'), 'utf8');
const rn = fs.readFileSync(path.join(base, 'navigation/RootNavigator.jsx'), 'utf8');
assert(as.includes('user:') && as.includes('token:') && as.includes('isAuthenticated:'), 'authStore: correct shape (user, token, isAuthenticated)');
assert(as.includes('login:') && as.includes('logout:'), 'authStore: login and logout actions present');
assert(!as.match(/:\s*(string|boolean|number)\b/), 'authStore: pure JavaScript (no TypeScript)');
assert(rn.includes('useAuthStore'), 'RootNavigator: reads useAuthStore');
assert(rn.includes('<AuthNavigator'), 'RootNavigator: renders AuthNavigator when not authenticated');
assert(rn.includes("<CustomerNavigator"), 'RootNavigator: renders CustomerNavigator for customer');
assert(rn.includes('<WorkerNavigator'), 'RootNavigator: renders WorkerNavigator for worker');
assert(rn.includes("role === 'customer'"), "RootNavigator: explicit role === 'customer' check");
assert(rn.includes("role === 'worker'"), "RootNavigator: explicit role === 'worker' check");
assert(rn.includes('<OnboardingNavigator'), 'RootNavigator: handles incomplete worker onboarding');
assert(rn.includes('NavigationContainer'), 'RootNavigator: wraps all in NavigationContainer');

console.log('\n=== Checklist Results:', pass, '/', total, 'PASSED ===');
process.exit(pass === total ? 0 : 1);
