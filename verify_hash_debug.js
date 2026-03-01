
import bcrypt from 'bcrypt';

async function checkHash() {
    const end_hash = '$2b$10$3SKvjO0AxCYaldOIdb850OlrK83TC.Uu3z966dVEWsGGUnoXJ1LJu'; // Matches 4146
    const insp_hash = '$2b$10$KEfMcSByZn4E7FJnULk9z.Zg1IzrfQtyhQu6FOTMJ8Xzg8Gik73Ui';
    const start_hash = '$2b$10$o0L6pogWUwJ3LN085.aHVO0AlaWWJRgaSIPGG0b34ZpCZoHl6pJMe';

    const otp = '4146';

    console.log('End match:', await bcrypt.compare(otp, end_hash));
    console.log('Insp match:', await bcrypt.compare(otp, insp_hash));
    console.log('Start match:', await bcrypt.compare(otp, start_hash));
}

checkHash();
