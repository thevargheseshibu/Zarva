export const parseJobDescription = (rawDesc) => {
    let textDesc = rawDesc;
    let photoUrl = null;

    if (!rawDesc) return { text: '', photo: null };

    if (typeof rawDesc === 'string' && rawDesc.startsWith('{')) {
        try {
            const parsed = JSON.parse(rawDesc);
            const textParts = [];
            for (const key in parsed) {
                const val = parsed[key];
                if (typeof val === 'string') {
                    if (val.startsWith('http://') || val.startsWith('https://')) {
                        photoUrl = val;
                    } else if (val !== 'SKIPPED') {
                        textParts.push(val);
                    }
                }
            }
            textDesc = textParts.join(' | ');
        } catch (e) {
            textDesc = rawDesc; // Fallback if parse fails
        }
    } else if (typeof rawDesc === 'object') {
        const textParts = [];
        for (const key in rawDesc) {
            const val = rawDesc[key];
            if (typeof val === 'string') {
                if (val.startsWith('http://') || val.startsWith('https://')) {
                    photoUrl = val;
                } else if (val !== 'SKIPPED') {
                    textParts.push(val);
                }
            }
        }
        textDesc = textParts.join(' | ');
    }

    return { text: textDesc, photo: photoUrl };
};
