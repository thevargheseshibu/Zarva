const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'zarva-mobile/src');
const dirsToConvert = ['screens', 'components'];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    const hasTokensImport = /import\s+.*from\s+['"].*\/design-system\/tokens['"]/.test(content);
    const hasHexColors = /#[0-9a-fA-F]{3,6}/.test(content);
    const hasTypography = /import\s+\{.*fontSize.*\}\s+from\s+['"].*\/design-system\/typography['"]/.test(content);

    if (!content.includes('import React') && !content.includes('react-native')) return;

    if (hasTokensImport || hasHexColors || hasTypography || content.includes('tokens.colors') || content.includes('StyleSheet.create')) {
        
        // Remove old tokens and typography imports
        content = content.replace(/import\s+\{[^}]+\}\s+from\s+['"](?:\.\.\/|\.\/)+design-system\/(?:tokens|typography)['"];?\n?/g, '');
        
        if (!content.includes('useTokens')) {
            content = content.replace(/import React[^;]*;/, "$&\nimport { useTokens } from '../../design-system';");
        }

        if (content.includes('StyleSheet.create(') && !content.includes('createStyles = (tTheme)')) {
            content = content.replace(/const\s+styles\s*=\s*StyleSheet\.create\(/g, 'const createStyles = (tTheme) => StyleSheet.create(');
            
            content = content.replace(/export\s+default\s+function\s+([a-zA-Z0-9_]+)\s*\([\s\S]*?\)\s*\{/g, 
                (match) => {
                    if (match.includes('tTheme = useTokens()')) return match;
                    return match + `\n    const tTheme = useTokens();\n    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);`;
                }
            );

            // Same for const components
            content = content.replace(/export\s+const\s+([a-zA-Z0-9_]+)\s*=\s*\([\s\S]*?\)\s*=>\s*\{/g,
                (match) => {
                    if (match.includes('tTheme = useTokens()')) return match;
                    return match + `\n    const tTheme = useTokens();\n    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);`;
                }
            );
        }

        // Generic color mapping
        content = content.replace(/colors\.bg\.primary|#0A0118/g, "tTheme.background.app");
        content = content.replace(/colors\.bg\.surface|#140828/g, "tTheme.background.surface");
        content = content.replace(/colors\.bg\.elevated|#1A0B3B/g, "tTheme.background.surfaceRaised");
        
        content = content.replace(/colors\.accent\.primary|#7C3AED/g, "tTheme.brand.primary");
        content = content.replace(/colors\.accent\.secondary|#EC4899/g, "tTheme.brand.secondary");
        content = content.replace(/colors\.accent\.tertiary|#06B6D4/g, "tTheme.brand.accent");
        content = content.replace(/colors\.accent\.glow/g, "tTheme.brand.glow");
        content = content.replace(/colors\.accent\.border|colors\.border/g, "tTheme.border.default");
        
        content = content.replace(/colors\.success|colors\.status\.success|#10B981/g, "tTheme.status.success.base");
        content = content.replace(/colors\.warning|colors\.status\.warning|#F59E0B/g, "tTheme.status.warning.base");
        content = content.replace(/colors\.danger|colors\.status\.error|#EF4444/g, "tTheme.status.error.base");
        
        content = content.replace(/colors\.text\.primary|colors\.text\.inverse|#F8FAFC|#FFFFFF/g, "tTheme.text.primary");
        content = content.replace(/colors\.text\.secondary|#CBD5E1/g, "tTheme.text.secondary");
        content = content.replace(/colors\.text\.muted|colors\.text\.tertiary|#94A3B8/g, "tTheme.text.tertiary");
        
        // Exact string replacements for remaining spacing arrays
        content = content.replace(/spacing\[24\]/g, "tTheme.spacing['2xl']");
        content = content.replace(/spacing\[16\]/g, "tTheme.spacing.lg");
        content = content.replace(/spacing\[12\]/g, "tTheme.spacing.md");
        content = content.replace(/spacing\[8\]/g, "tTheme.spacing.sm");
        content = content.replace(/spacing\[4\]/g, "tTheme.spacing.xs");
        
        // Generic word boundaries for spacing dots
        content = content.replace(/\bspacing\.xxs\b/g, "tTheme.spacing.xxs");
        content = content.replace(/\bspacing\.xs\b/g, "tTheme.spacing.xs");
        content = content.replace(/\bspacing\.sm\b/g, "tTheme.spacing.sm");
        content = content.replace(/\bspacing\.md\b/g, "tTheme.spacing.md");
        content = content.replace(/\bspacing\.lg\b/g, "tTheme.spacing.lg");
        content = content.replace(/\bspacing\.xl\b/g, "tTheme.spacing.xl");
        content = content.replace(/\bspacing\.xxl\b/g, "tTheme.spacing.xxl");

        // Radius
        content = content.replace(/\bradius\.sm\b/g, "tTheme.radius.sm");
        content = content.replace(/\bradius\.md\b/g, "tTheme.radius.md");
        content = content.replace(/\bradius\.lg\b/g, "tTheme.radius.lg");
        content = content.replace(/\bradius\.xl\b/g, "tTheme.radius.xl");
        content = content.replace(/\bradius\.full\b/g, "tTheme.radius.full");

        // Typography sizes
        content = content.replace(/\bfontSize\.hero\b/g, "tTheme.typography.size.hero");
        content = content.replace(/\bfontSize\.title\b/g, "tTheme.typography.size.title");
        content = content.replace(/\bfontSize\.cardTitle\b/g, "tTheme.typography.size.cardTitle");
        content = content.replace(/\bfontSize\.body\b/g, "tTheme.typography.size.body");
        content = content.replace(/\bfontSize\.caption\b/g, "tTheme.typography.size.caption");
        content = content.replace(/\bfontSize\.micro\b/g, "tTheme.typography.size.micro");

        content = content.replace(/\bfontWeight\.regular\b/g, "tTheme.typography.weight.regular");
        content = content.replace(/\bfontWeight\.medium\b/g, "tTheme.typography.weight.medium");
        content = content.replace(/\bfontWeight\.semibold\b/g, "tTheme.typography.weight.semibold");
        content = content.replace(/\bfontWeight\.bold\b/g, "tTheme.typography.weight.bold");

        content = content.replace(/\btracking\.hero\b/g, "tTheme.typography.letterSpacing.hero");
        content = content.replace(/\btracking\.title\b/g, "tTheme.typography.letterSpacing.title");
        content = content.replace(/\btracking\.cardTitle\b/g, "tTheme.typography.letterSpacing.cardTitle");
        content = content.replace(/\btracking\.body\b/g, "tTheme.typography.letterSpacing.body");
        content = content.replace(/\btracking\.caption\b/g, "tTheme.typography.letterSpacing.caption");
        content = content.replace(/\btracking\.micro\b/g, "tTheme.typography.letterSpacing.micro");

        // Shadows
        content = content.replace(/\bshadows\.premium\b/g, "tTheme.shadows.premium");
        content = content.replace(/\bshadows\.accentGlow\b/g, "tTheme.shadows.accentGlow");

        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Migrated:', filePath);
        }
    }
}

function traverseDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDir(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            processFile(fullPath);
        }
    }
}

for (const subDir of dirsToConvert) {
    traverseDir(path.join(srcDir, subDir));
}

console.log("Migration complete!");
