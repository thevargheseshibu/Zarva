export const parseJobDescription = (rawDesc) => {
    let structuredQuestions = [];
    let photos = [];
    let textFallback = '';

    if (!rawDesc) return { text: '', photos: [], structured: [] };

    try {
        const parsed = typeof rawDesc === 'string' ? JSON.parse(rawDesc) : rawDesc;

        if (Array.isArray(parsed)) {
            // New Structured Format: [{question, answer}]
            parsed.forEach(item => {
                const val = String(item.answer || '');
                const questionLower = String(item.question || '').toLowerCase();

                // Detect images by URL prefix or label keywords
                const isImageUrl = val.startsWith('http') || val.startsWith('file://') || val.startsWith('content://');
                const isImageQuestion = questionLower.includes('photo') || questionLower.includes('image');

                if (isImageUrl) {
                    photos.push(val);
                } else if (val !== 'SKIPPED' && !isImageQuestion) {
                    structuredQuestions.push({
                        label: item.question,
                        value: val
                    });
                }
            });
        } else if (typeof parsed === 'object' && parsed !== null) {
            // Legacy/Flattened Format: {q1: val, q2: val}
            for (const key in parsed) {
                const val = String(parsed[key] || '');
                const keyLower = key.toLowerCase();

                const isImageUrl = val.startsWith('http') || val.startsWith('file://') || val.startsWith('content://');
                const isImageQuestion = keyLower.includes('photo') || keyLower.includes('image') || keyLower.includes('q3');

                if (isImageUrl) {
                    photos.push(val);
                } else if (val !== 'SKIPPED' && !isImageQuestion) {
                    structuredQuestions.push({
                        label: key.toUpperCase(),
                        value: val
                    });
                }
            }
            textFallback = String(rawDesc);
        }
    } catch (e) {
        textFallback = String(rawDesc);
    }

    const simpleText = structuredQuestions
        .map(q => q.value)
        .filter(v => v && v.trim() !== '')
        .join(' | ') || textFallback;

    return {
        text: simpleText || 'Service Request',
        photos: photos,
        structured: structuredQuestions
    };
};
