const fs = require('fs');
const file = 'zarva-mobile/src/screens/customer/RatingScreen.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/navigation\.popToTop\(\)/g, "navigation.replace('CustomerTabs')");

fs.writeFileSync(file, content, 'utf8');
