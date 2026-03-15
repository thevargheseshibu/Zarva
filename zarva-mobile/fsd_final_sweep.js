const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'src');

const mapping = [
  // Features (Specific first)
  { pattern: /from\s+['"](\.\.\/)+features\/auth\/([^'"]+)/g, replacement: "from '@auth/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/jobs\/([^'"]+)/g, replacement: "from '@jobs/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/inspection\/([^'"]+)/g, replacement: "from '@inspection/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/payment\/([^'"]+)/g, replacement: "from '@payment/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/notifications\/([^'"]+)/g, replacement: "from '@notifications/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/worker\/([^'"]+)/g, replacement: "from '@worker/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/customer\/([^'"]+)/g, replacement: "from '@customer/$2" },
  { pattern: /from\s+['"](\.\.\/)+features\/([^'"]+)/g, replacement: "from '@features/$2" },
  
  // Shared & Layers
  { pattern: /from\s+['"](\.\.\/)+shared\/([^'"]+)/g, replacement: "from '@shared/$2" },
  { pattern: /from\s+['"](\.\.\/)+infra\/([^'"]+)/g, replacement: "from '@infra/$2" },
  { pattern: /from\s+['"](\.\.\/)+app\/([^'"]+)/g, replacement: "from '@app/$2" },
  { pattern: /from\s+['"](\.\.\/)+navigation\/([^'"]+)/g, replacement: "from '@navigation/$2" },

  // Omitted Folder Patterns (e.g. ../../i18n -> @shared/i18n)
  { pattern: /from\s+['"](\.\.\/)+i18n(\/|['"])/g, replacement: "from '@shared/i18n$2" },
  { pattern: /from\s+['"](\.\.\/)+utils(\/|['"])/g, replacement: "from '@shared/utils$2" },
  { pattern: /from\s+['"](\.\.\/)+design-system(\/|['"])/g, replacement: "from '@shared/design-system$2" },
  { pattern: /from\s+['"](\.\.\/)+hooks(\/|['"])/g, replacement: "from '@shared/hooks$2" },
  { pattern: /from\s+['"](\.\.\/)+ui(\/|['"])/g, replacement: "from '@shared/ui$2" },
  
  // Specific fix for RootNavigator (which is in app, but often mis-referred as in navigation/app)
  { pattern: /from\s+['"]@navigation\/RootNavigator['"]/g, replacement: "from '@app/RootNavigator'" },
  
  // Catch-all for malformed aliases with relative prefixes
  { pattern: /from\s+['"]\.*\/+(@app|@shared|@features|@infra|@navigation|@auth|@worker|@customer|@jobs|@payment|@inspection|@notifications)(\/|['"])/g, replacement: "from '$1$2" }
];

function walk(dir) {
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
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  mapping.forEach(m => {
    content = content.replace(m.pattern, m.replacement);
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Final Sweep Fixed: ${filePath}`);
  }
}

walk(root);
console.log('Final codebase sweep complete.');
