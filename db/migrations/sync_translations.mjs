/**
 * Sync new translation keys to all non-English translation files.
 * Inserts new keys right after `return_to_terminal` in each file.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '../../zarva-mobile/src/i18n/translations');

// New keys with their translations per language
// Format: { langCode: { key: 'translated text' } }
const NEW_KEYS = {
    as: {
        retake: 'পুনৰ তুলক',
        remove: 'আঁতৰাওক',
        uploaded_securely: 'সুৰক্ষিতভাৱে আপলোড হ\'ল',
        remove_document: 'দস্তাবেজ আঁতৰাওক?',
        confirm_remove_doc: 'আপুনি নিশ্চিত নে এই আপলোড আঁতৰাব বিচাৰে?',
        incomplete_info: 'অসম্পূৰ্ণ',
        please_upload_all_docs: 'অনুগ্ৰহ কৰি সকলো নথি আপলোড কৰক আৰু আপোনাৰ আধাৰ নম্বৰ দিয়ক।',
        submitting_application: 'নামভৰ্তি সম্পূৰ্ণ কৰা হৈছে...',
        uploading_documents: 'সুৰক্ষিতভাৱে আপলোড হৈছে...',
        protocol_required: 'প্ৰট\'কল প্ৰয়োজন',
        please_read_agreement: 'অনুগ্ৰহ কৰি চুক্তিৰ তলত স্ক্ৰল কৰক।',
        account_suspended: 'একাউণ্ট স্থগিত',
        account_blocked_desc: 'আপোনাৰ একাউণ্ট সাময়িকভাৱে স্থগিত কৰা হৈছে। আমাৰ সৈতে যোগাযোগ কৰক।',
        blocked_reason_label: 'স্থগিতৰ কাৰণ',
        contact_support_blocked: 'সহায়ৰ সৈতে যোগাযোগ কৰক',
        policy_enforcement: 'নীতি প্ৰয়োগ',
    },
    bn: {
        retake: 'পুনরায় তুলুন',
        remove: 'সরান',
        uploaded_securely: 'নিরাপদে আপলোড হয়েছে',
        remove_document: 'ডকুমেন্ট সরাবেন?',
        confirm_remove_doc: 'আপনি কি নিশ্চিত এই আপলোড সরাতে চান?',
        incomplete_info: 'অসম্পূর্ণ',
        please_upload_all_docs: 'সমস্ত ডকুমেন্ট আপলোড করুন এবং আধার নম্বর দিন।',
        submitting_application: 'নথিভুক্তি সম্পন্ন হচ্ছে...',
        uploading_documents: 'নিরাপদে আপলোড হচ্ছে...',
        protocol_required: 'প্রোটোকল প্রয়োজন',
        please_read_agreement: 'চুক্তির শেষ পর্যন্ত স্ক্রল করুন।',
        account_suspended: 'অ্যাকাউন্ট স্থগিত',
        account_blocked_desc: 'আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে। সহায়তার জন্য যোগাযোগ করুন।',
        blocked_reason_label: 'স্থগিতের কারণ',
        contact_support_blocked: 'সহায়তার সাথে যোগাযোগ করুন',
        policy_enforcement: 'নীতি প্রয়োগ',
    },
    gu: {
        retake: 'ફરી ક્લિક કરો',
        remove: 'દૂર કરો',
        uploaded_securely: 'સુરક્ષિત રીતે અપલોડ થયેલ',
        remove_document: 'દસ્તાવેજ દૂર કરો?',
        confirm_remove_doc: 'શું તમે ખાતરી કરો છો કે આ અપલોડ દૂર કરવા ઇચ્છો છો?',
        incomplete_info: 'અધૂરું',
        please_upload_all_docs: 'કૃપા કરીને બધા દસ્તાવેજ અપલોડ કરો અને આધાર નંબર દાખલ કરો.',
        submitting_application: 'નોંધણી પૂર્ણ થઈ રહી છે...',
        uploading_documents: 'સુરક્ષિત રીતે અપલોડ થઈ રહ્યું છે...',
        protocol_required: 'પ્રોટોકોલ જરૂરી',
        please_read_agreement: 'કૃપા કરીને સ્ક્રોલ કરીને સમજૂતી સુધી પહોંચો.',
        account_suspended: 'ખાતું સ્થગિત',
        account_blocked_desc: 'તમારું ખાતું અસ્થાયી રૂપે સ્થગિત કરવામાં આવ્યું છે. સહાય માટે સંપર્ક કરો.',
        blocked_reason_label: 'સ્થગિતૈ કારણ',
        contact_support_blocked: 'સહાય સાથે સંપર્ક કરો',
        policy_enforcement: 'નીતિ અમલ',
    },
    hi: {
        retake: 'पुनः लें',
        remove: 'हटाएं',
        uploaded_securely: 'सुरक्षित रूप से अपलोड किया गया',
        remove_document: 'दस्तावेज़ हटाएं?',
        confirm_remove_doc: 'क्या आप इस अपलोड को हटाना चाहते हैं?',
        incomplete_info: 'अधूरा',
        please_upload_all_docs: 'कृपया सभी दस्तावेज़ अपलोड करें और आधार नंबर दर्ज करें।',
        submitting_application: 'नामांकन पूरा हो रहा है...',
        uploading_documents: 'सुरक्षित अपलोड हो रहा है...',
        protocol_required: 'प्रोटोकॉल आवश्यक है',
        please_read_agreement: 'कृपया अनुबंध के अंत तक स्क्रॉल करें।',
        account_suspended: 'खाता निलंबित',
        account_blocked_desc: 'आपका खाता अस्थायी रूप से निलंबित किया गया है। सहायता के लिए संपर्क करें।',
        blocked_reason_label: 'निलंबन का कारण',
        contact_support_blocked: 'सहायता से संपर्क करें',
        policy_enforcement: 'नीति प्रवर्तन',
    },
    kn: {
        retake: 'ಮರು ತೆಗೆಯಿರಿ',
        remove: 'ತೆಗೆದುಹಾಕಿ',
        uploaded_securely: 'ಸುರಕ್ಷಿತವಾಗಿ ಅಪ್ಲೋಡ್ ಆಗಿದೆ',
        remove_document: 'ದಾಖಲೆ ತೆಗೆದುಹಾಕಲೇ?',
        confirm_remove_doc: 'ಈ ಅಪ್ಲೋಡ್ ತೆಗೆದುಹಾಕಲು ಖಚಿತಪಡಿಸಿ.',
        incomplete_info: 'ಅಪೂರ್ಣ',
        please_upload_all_docs: 'ದಯವಿಟ್ಟು ಎಲ್ಲಾ ದಾಖಲೆಗಳನ್ನು ಅಪ್ಲೋಡ್ ಮಾಡಿ ಮತ್ತು ಆಧಾರ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ.',
        submitting_application: 'ನೋಂದಣಿ ಪೂರ್ಣಗೊಳ್ಳುತ್ತಿದೆ...',
        uploading_documents: 'ಸುರಕ್ಷಿತವಾಗಿ ಅಪ್ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
        protocol_required: 'ಪ್ರೋಟೋಕಾಲ್ ಅಗತ್ಯ',
        please_read_agreement: 'ದಯವಿಟ್ಟು ಒಪ್ಪಂದದ ಕೊನೆಗೆ ಸ್ಕ್ರೋಲ್ ಮಾಡಿ.',
        account_suspended: 'ಖಾತೆ ಸ್ಥಗಿತ',
        account_blocked_desc: 'ನಿಮ್ಮ ಖಾತೆ ತಾತ್ಕಾಲಿಕವಾಗಿ ಸ್ಥಗಿತಗೊಂಡಿದೆ. ಸಹಾಯಕ್ಕಾಗಿ ಸಂಪರ್ಕಿಸಿ.',
        blocked_reason_label: 'ಸ್ಥಗಿತದ ಕಾರಣ',
        contact_support_blocked: 'ಬೆಂಬಲವನ್ನು ಸಂಪರ್ಕಿಸಿ',
        policy_enforcement: 'ನೀತಿ ಜಾರಿ',
    },
    ml: {
        retake: 'വീണ്ടും എടുക്കുക',
        remove: 'നീക്കം ചെയ്യുക',
        uploaded_securely: 'സുരക്ഷിതമായി അപ്‌ലോഡ് ചെയ്തു',
        remove_document: 'പ്രമാണം നീക്കം ചെയ്യണോ?',
        confirm_remove_doc: 'ഈ അപ്‌ലോഡ് നീക്കം ചെയ്യണമെന്ന് ഉറപ്പാണോ?',
        incomplete_info: 'അപൂർണ്ണം',
        please_upload_all_docs: 'എല്ലാ രേഖകളും അപ്‌ലോഡ് ചെയ്ത് ആധാർ നമ്പർ നൽകുക.',
        submitting_application: 'ഒട്ടിക്കൽ പൂർത്തിയാകുന്നു...',
        uploading_documents: 'സുരക്ഷിതമായി അപ്‌ലോഡ് ചെയ്യുന്നു...',
        protocol_required: 'പ്രോട്ടോക്കോൾ ആവശ്യമാണ്',
        please_read_agreement: 'ദയവായി കരാർ അവസാനം വരെ സ്ക്രോൾ ചെയ്യുക.',
        account_suspended: 'അക്കൗണ്ട് സസ്പെൻഡ് ചെയ്തു',
        account_blocked_desc: 'നിങ്ങളുടെ അക്കൗണ്ട് താൽക്കാലികമായി സസ്പെൻഡ് ചെയ്തിരിക്കുന്നു. ദയവായി ബന്ധപ്പെടുക.',
        blocked_reason_label: 'സസ്പെൻഷൻ കാരണം',
        contact_support_blocked: 'പിന്തുണ ബന്ധപ്പെടുക',
        policy_enforcement: 'നയ നിർദ്ദേശം',
    },
    mr: {
        retake: 'पुन्हा घ्या',
        remove: 'काढा',
        uploaded_securely: 'सुरक्षितपणे अपलोड झाले',
        remove_document: 'दस्तऐवज काढायचा?',
        confirm_remove_doc: 'हे अपलोड काढायचे आहे का?',
        incomplete_info: 'अपूर्ण',
        please_upload_all_docs: 'कृपया सर्व कागदपत्रे अपलोड करा आणि आधार क्रमांक द्या.',
        submitting_application: 'नोंदणी पूर्ण होत आहे...',
        uploading_documents: 'सुरक्षितपणे अपलोड होत आहे...',
        protocol_required: 'प्रोटोकॉल आवश्यक',
        please_read_agreement: 'कृपया कराराच्या शेवटापर्यंत स्क्रोल करा.',
        account_suspended: 'खाते निलंबित',
        account_blocked_desc: 'तुमचे खाते तात्पुरते निलंबित केले आहे. सहाय्यासाठी संपर्क करा.',
        blocked_reason_label: 'निलंबनाचे कारण',
        contact_support_blocked: 'सहाय्यास संपर्क करा',
        policy_enforcement: 'धोरण अंमलबजावणी',
    },
    or: {
        retake: 'ପୁଣି ନିଅନ୍ତୁ',
        remove: 'ଅପସାରଣ କରନ୍ତୁ',
        uploaded_securely: 'ସୁରକ୍ଷିତ ଭାବରେ ଅପଲୋଡ ହୋଇଛି',
        remove_document: 'ଦଲିଲ ଅପସାରଣ କରିବେ?',
        confirm_remove_doc: 'ଆପଣ ଏହି ଅପଲୋଡ ଅପସାରଣ କରିବାକୁ ନିଶ୍ଚିତ?',
        incomplete_info: 'ଅସମ୍ପୂର୍ଣ୍ଣ',
        please_upload_all_docs: 'ଦୟାକରି ସମସ୍ତ ଦଲିଲ ଅପଲୋଡ କରନ୍ତୁ ଏବଂ ଆଧାର ନମ୍ବର ଦିଅନ୍ତୁ।',
        submitting_application: 'ପଞ୍ଜୀକରଣ ସମ୍ପୂର୍ଣ ହେଉଛି...',
        uploading_documents: 'ସୁରକ୍ଷିତ ଭାବରେ ଅପଲୋଡ ହେଉଛି...',
        protocol_required: 'ପ୍ରୋଟୋକଲ ଆବଶ୍ୟକ',
        please_read_agreement: 'ଦୟାକରି ଚୁକ୍ତିର ଶେଷ ପର୍ଯ୍ୟନ୍ତ ସ୍କ୍ରୋଲ କରନ୍ତୁ।',
        account_suspended: 'ଆକାଉଣ୍ଟ ସ୍ଥଗିତ',
        account_blocked_desc: 'ଆପଣଙ୍କ ଆକାଉଣ୍ଟ ସାମୟିକ ଭାବରେ ସ୍ଥଗିତ ହୋଇଛି। ସହାୟତା ପାଇଁ ଯୋଗାଯୋଗ କରନ୍ତୁ।',
        blocked_reason_label: 'ସ୍ଥଗିତ କାରଣ',
        contact_support_blocked: 'ସହାୟତା ସହ ଯୋଗାଯୋଗ',
        policy_enforcement: 'ନୀତି ଲଗୁ',
    },
    pa: {
        retake: 'ਦੁਬਾਰਾ ਲਓ',
        remove: 'ਹਟਾਓ',
        uploaded_securely: 'ਸੁਰੱਖਿਅਤ ਢੰਗ ਨਾਲ ਅਪਲੋਡ ਹੋਇਆ',
        remove_document: 'ਦਸਤਾਵੇਜ਼ ਹਟਾਓ?',
        confirm_remove_doc: 'ਕੀ ਤੁਸੀਂ ਇਸ ਅਪਲੋਡ ਨੂੰ ਹਟਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ?',
        incomplete_info: 'ਅਧੂਰਾ',
        please_upload_all_docs: 'ਕਿਰਪਾ ਕਰਕੇ ਸਾਰੇ ਦਸਤਾਵੇਜ਼ ਅਪਲੋਡ ਕਰੋ ਅਤੇ ਆਧਾਰ ਨੰਬਰ ਦਿਓ।',
        submitting_application: 'ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਮੁਕੰਮਲ ਹੋ ਰਹੀ ਹੈ...',
        uploading_documents: 'ਸੁਰੱਖਿਅਤ ਢੰਗ ਨਾਲ ਅਪਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...',
        protocol_required: 'ਪ੍ਰੋਟੋਕੋਲ ਲੋੜੀਂਦਾ',
        please_read_agreement: 'ਕਿਰਪਾ ਕਰਕੇ ਸਮਝੌਤੇ ਦੇ ਅੰਤ ਤੱਕ ਸਕ੍ਰੋਲ ਕਰੋ।',
        account_suspended: 'ਖਾਤਾ ਮੁਅੱਤਲ',
        account_blocked_desc: 'ਤੁਹਾਡਾ ਖਾਤਾ ਅਸਥਾਈ ਤੌਰ \'ਤੇ ਮੁਅੱਤਲ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਸਹਾਇਤਾ ਲਈ ਸੰਪਰਕ ਕਰੋ।',
        blocked_reason_label: 'ਮੁਅੱਤਲੀ ਦਾ ਕਾਰਨ',
        contact_support_blocked: 'ਸਹਾਇਤਾ ਨਾਲ ਸੰਪਰਕ ਕਰੋ',
        policy_enforcement: 'ਨੀਤੀ ਲਾਗੂ',
    },
    ta: {
        retake: 'மீண்டும் எடுக்கவும்',
        remove: 'அகற்றவும்',
        uploaded_securely: 'பாதுகாப்பாக பதிவேற்றப்பட்டது',
        remove_document: 'ஆவணத்தை நீக்கவும்?',
        confirm_remove_doc: 'இந்த பதிவேற்றத்தை நீக்க விரும்புகிறீர்களா?',
        incomplete_info: 'முழுமையற்றது',
        please_upload_all_docs: 'அனைத்து ஆவணங்களையும் பதிவேற்றவும் மற்றும் ஆதார் எண்ணை உள்ளிடவும்.',
        submitting_application: 'பதிவு நிறைவடைகிறது...',
        uploading_documents: 'பாதுகாப்பாக பதிவேற்றுகிறது...',
        protocol_required: 'நெறிமுறை தேவை',
        please_read_agreement: 'ஒப்பந்தத்தின் கடைசி வரை ஸ்க்ரோல் செய்யவும்.',
        account_suspended: 'கணக்கு நிறுத்தப்பட்டது',
        account_blocked_desc: 'உங்கள் கணக்கு தற்காலிகமாக நிறுத்தப்பட்டுள்ளது. ஆதரவை தொடர்பு கொள்ளவும்.',
        blocked_reason_label: 'நிறுத்தத்தின் காரணம்',
        contact_support_blocked: 'ஆதரவை தொடர்பு கொள்ளவும்',
        policy_enforcement: 'கொள்கை அமலாக்கம்',
    },
    te: {
        retake: 'మళ్ళీ తీయండి',
        remove: 'తొలగించు',
        uploaded_securely: 'సురక్షితంగా అప్‌లోడ్ చేయబడింది',
        remove_document: 'పత్రాన్ని తొలగించాలా?',
        confirm_remove_doc: 'ఈ అప్‌లోడ్‌ని తొలగించాలని మీకు నిశ్చయంగా ఉందా?',
        incomplete_info: 'అసంపూర్ణం',
        please_upload_all_docs: 'దయచేసి అన్ని పత్రాలు అప్‌లోడ్ చేయండి మరియు ఆధార్ నంబర్ నమోదు చేయండి.',
        submitting_application: 'నమోదు పూర్తవుతోంది...',
        uploading_documents: 'సురక్షితంగా అప్‌లోడ్ అవుతోంది...',
        protocol_required: 'ప్రోటోకాల్ అవసరం',
        please_read_agreement: 'దయచేసి ఒప్పందం చివరి వరకు స్క్రోల్ చేయండి.',
        account_suspended: 'ఖాతా నిలిపివేయబడింది',
        account_blocked_desc: 'మీ ఖాతా తాత్కాలికంగా నిలిపివేయబడింది. సహాయానికి సంప్రదించండి.',
        blocked_reason_label: 'నిలిపివేత కారణం',
        contact_support_blocked: 'మద్దతును సంప్రదించండి',
        policy_enforcement: 'విధాన అమలు',
    },
};

const LANGUAGES = Object.keys(NEW_KEYS);
let successCount = 0;

for (const lang of LANGUAGES) {
    const filePath = join(dir, `${lang}.js`);
    let content = readFileSync(filePath, 'utf8');

    // Find the position right after return_to_terminal
    const anchor = `return_to_terminal:`;
    const anchorIdx = content.indexOf(anchor);
    if (anchorIdx === -1) {
        console.warn(`⚠️  ${lang}.js: anchor 'return_to_terminal' not found, skipping`);
        continue;
    }

    // Find end of that line
    const lineEnd = content.indexOf('\n', anchorIdx);
    if (lineEnd === -1) {
        console.warn(`⚠️  ${lang}.js: could not find line end`);
        continue;
    }

    // Build the new keys block
    const translations = NEW_KEYS[lang];
    const newBlock = Object.entries(translations)
        .map(([k, v]) => `    ${k}: '${v.replace(/'/g, "\\'")}',`)
        .join('\n');

    // Insert after the return_to_terminal line
    content = content.slice(0, lineEnd + 1) + '\n    // ── Document Upload UX ──────────────────────────\n' + newBlock + '\n\n    // ── Blocked Account ──────────────────────────────\n' + '' + '\n' + content.slice(lineEnd + 1);

    // Wait — let's just build a clean insert
    // The block above already mixes both sections, let's rebuild properly:
    const docUploadKeys = ['retake','remove','uploaded_securely','remove_document','confirm_remove_doc','incomplete_info','please_upload_all_docs','uploading_documents','submitting_application','protocol_required','please_read_agreement'];
    const blockedKeys = ['account_suspended','account_blocked_desc','blocked_reason_label','contact_support_blocked','policy_enforcement'];

    const docBlock = docUploadKeys.map(k => `    ${k}: '${translations[k].replace(/'/g, "\\'")}',`).join('\n');
    const blockedBlock = blockedKeys.map(k => `    ${k}: '${translations[k].replace(/'/g, "\\'")}',`).join('\n');

    const insertBlock = `\n    // ── Document Upload UX ──────────────────────────────\n${docBlock}\n\n    // ── Blocked Account ─────────────────────────────────\n${blockedBlock}\n`;

    // Read fresh (content was corrupted above) and insert cleanly
    const fresh = readFileSync(filePath, 'utf8');
    const freshAnchorIdx = fresh.indexOf(anchor);
    const freshLineEnd = fresh.indexOf('\n', freshAnchorIdx);
    const finalContent = fresh.slice(0, freshLineEnd + 1) + insertBlock + fresh.slice(freshLineEnd + 1);

    writeFileSync(filePath, finalContent, 'utf8');
    console.log(`✅ ${lang}.js — ${Object.keys(translations).length} keys added`);
    successCount++;
}

console.log(`\n🎉 Done. Updated ${successCount}/${LANGUAGES.length} files.`);
