const { execSync } = require('child_process');
const fs = require('fs');

try {
    // Get list of changed files
    const filesStr = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' }).trim();
    const files = filesStr.split('\n').filter(Boolean).filter(f => f.includes('zarva-mobile/src/'));

    const lostFunctionalities = [];

    for (const file of files) {
        let oldContent = '';
        let newContent = '';

        try {
            oldContent = execSync(`git show HEAD~1:"${file.trim()}"`, { encoding: 'utf8' });
        } catch (e) { }

        try {
            newContent = fs.readFileSync(file.trim(), 'utf8'); // use working tree content
        } catch (e) { }

        if (!oldContent || !newContent) continue;

        const extractPatterns = (content, regex) => {
            const matches = new Set();
            let match;
            while ((match = regex.exec(content)) !== null) {
                matches.add(match[0].trim());
            }
            return matches;
        };

        const patterns = [
            /apiClient\.[a-z]+\(['`"].*?['`"]/g,
            /navigation\.navigate\(['`"].*?['`"]/g,
            /navigation\.replace\(['`"].*?['`"]/g,
            /Location\.requestForegroundPermissionsAsync/g,
            /Location\.getCurrentPositionAsync/g,
            /Alert\.alert\(['`"].*?['`"]/g
        ];

        const fileLost = [];

        for (const regex of patterns) {
            const oldMatches = extractPatterns(oldContent, regex);
            const newMatches = extractPatterns(newContent, regex);

            for (const oldM of oldMatches) {
                if (!newMatches.has(oldM)) {
                    // Check for similar matches (interpolation differences)
                    const stripped = oldM.replace(/['"`$]/g, '');
                    let foundLooser = false;
                    for (const newM of newMatches) {
                        const newStripped = newM.replace(/['"`$]/g, '');
                        if (newStripped.includes(stripped) || stripped.includes(newStripped)) {
                            foundLooser = true;
                            break;
                        }
                    }
                    if (!foundLooser) {
                        fileLost.push(oldM);
                    }
                }
            }
        }

        if (fileLost.length > 0) {
            lostFunctionalities.push({ file, lost: [...new Set(fileLost)] });
        }
    }

    let report = '# Lost Functionality Report\n\n';
    lostFunctionalities.forEach(f => {
        report += `### ${f.file}\n`;
        f.lost.forEach(l => report += `- ${l}\n`);
        report += '\n';
    });

    fs.writeFileSync('lost_functionality_report.md', report);
    console.log('Report generated at lost_functionality_report.md');

} catch (e) {
    console.error(e);
}
