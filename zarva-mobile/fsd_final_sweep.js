const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'src');

const mapping = [
  // Patterns for relative paths going up to layers/features
  { pattern: /from\s+['"](\.\.\/)+app\/([^'"]+)/g, replacement: "from '@app/$2" },
  { pattern: /from\s+['"](\.\.\/)+shared\/([^'"]+)/g, replacement: "from '@shared/$2" },
  { pattern: /from\s+['"](\.\.\/)+infra\/([^'"]+)/g, replacement: "from '@infra/$2" },
  { pattern: /from\s+['"](\.\.\/)+navigation\/([^'"]+)/g, replacement: "from '@navigation/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/auth\/([^'"]+)/g, replacement: "from '@auth/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/jobs\/([^'"]+)/g, replacement: "from '@jobs/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/inspection\/([^'"]+)/g, replacement: "from '@inspection/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/payment\/([^'"]+)/g, replacement: "from '@payment/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/notifications\/([^'"]+)/g, replacement: "from '@notifications/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/worker\/([^'"]+)/g, replacement: "from '@worker/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/customer\/([^'"]+)/g, replacement: "from '@customer/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/([^'"]+)/g, replacement: "from '@features/$2" },
  
  // Specific catch-all for omitted layer names
  { pattern: /from\s+['"](\.\.\/)+i18n(\/|['"])/g, replacement: "from '@shared/i18n$2" },
  { pattern: /from\s+['"](\.\.\/)+utils(\/|['"])/g, replacement: "from '@shared/utils$2" },
  { pattern: /from\s+['"](\.\.\/)+design-system(\/|['"])/g, replacement: "from '@shared/design-system$2" },
  { pattern: /from\s+['"](\.\.\/)+hooks\/useT(['"])/g, replacement: "from '@shared/i18n/useTranslation$2" },
  { pattern: /from\s+['"](\.\.\/)+hooks\/uiStore(['"])/g, replacement: "from '@shared/hooks/uiStore$2" },
  { pattern: /from\s+['"](\.\.\/)+ui\/([^'"]+)/g, replacement: "from '@shared/ui/$2" },

  // ASSETS (Handle require paths too)
  { pattern: /require\(['"](\.\.\/)+assets\/([^'"]+)/g, replacement: "require('@assets/$2" },

  // LOCAL relative redirects in features
  { pattern: /from\s+['"]\.\/client(['"])/g, replacement: "from '@infra/api/client$1" },
  { pattern: /from\s+['"]\.\/Card(['"])/g, replacement: "from '@shared/ui/ZCard$1" },
  { pattern: /from\s+['"]\.\/FadeInView(['"])/g, replacement: "from '@shared/ui/FadeInView$1" },
  { pattern: /from\s+['"]\.\/ZLoader(['"])/g, replacement: "from '@shared/ui/ZLoader$1" },
  { pattern: /from\s+['"]\.\/PremiumButton(['"])/g, replacement: "from '@shared/ui/PremiumButton$1" },
  { pattern: /from\s+['"]\.\/OTPInput(['"])/g, replacement: "from '@shared/ui/OTPInput$1" },
  { pattern: /from\s+['"]\.\/StatusPill(['"])/g, replacement: "from '@shared/ui/StatusPill$1" },
  { pattern: /from\s+['"]\.\/MainBackground(['"])/g, replacement: "from '@shared/ui/MainBackground$1" },

  // Global Alias Standardizations
  { pattern: /from\s+['"]@shared\/hooks\/useT(['"])/g, replacement: "from '@shared/i18n/useTranslation$1" },
  { pattern: /from\s+['"]@navigation\/RootNavigator(['"])/g, replacement: "from '@app/RootNavigator$1" },
  { pattern: /from\s+['"]@notifications\/JobAlertService(['"])/g, replacement: "from '@notifications$1" },
  
  // Internal Shared standardizations
  { pattern: /from\s+['"]\.\.\/hooks\/useT(['"])/g, replacement: "from '@shared/i18n/useTranslation$1" },
  { pattern: /from\s+['"]\.\.\/design-system(['"])/g, replacement: "from '@shared/design-system$1" },

  // Special case: src/app/index.js self-reference
  // (Assuming we run this script and it might hit index.js)
  { pattern: /from\s+['"]@app\/App(['"])/g, replacement: "from './App$1" },
  
  // Cleanup malformed aliases with relative prefixes
  { pattern: /from\s+['"]\.*\/+(@app|@shared|@features|@infra|@navigation|@auth|@worker|@customer|@jobs|@payment|@inspection|@notifications|@assets)(\/|['"])/g, replacement: "from '$1$2" }
];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fixImports(fullPath);
    }
  }
}

function fixImports(filePath) {
  if (filePath.endsWith('app\\index.js')) return; // Skip entry point to avoid breaking relative fix

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  mapping.forEach(m => {
    content = content.replace(m.pattern, m.replacement);
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`FSD Sweep Fixed: ${filePath}`);
  }
}

walk(root);
console.log('Final FSD sweep completed.');
