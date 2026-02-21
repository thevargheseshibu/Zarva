/**
 * services/worker.service.js — Worker Onboarding Logic
 *
 * Handles database operations and strict validation for the worker onboarding flow.
 * Note: `onboarding_status` in API maps directly to `kyc_status` in MySQL.
 */

const ALLOWED_SKILLS = new Set([
    'electrician', 'plumber', 'carpenter', 'ac_technician',
    'painter', 'cleaner', 'driver'
]);

/**
 * Validates array of skills against the allowed enum list.
 */
function validateSkills(skills) {
    if (!Array.isArray(skills)) return false;
    for (const skill of skills) {
        if (!ALLOWED_SKILLS.has(skill)) return false;
    }
    return true;
}

/**
 * 1. Start Onboarding
 * Upgrades user role (if not already worker) and creates draft profile.
 */
export async function startOnboarding(userId, pool) {
    const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (!users.length) throw Object.assign(new Error('User not found'), { status: 404 });

    const currentRole = users[0].role;
    if (currentRole === 'worker' || currentRole === 'admin') {
        throw Object.assign(new Error(`User already has role: ${currentRole}`), { status: 400 });
    }

    // Attempt to grab name from customer profile if it exists
    const [custRows] = await pool.query('SELECT name FROM customer_profiles WHERE user_id = ?', [userId]);
    const defaultName = custRows[0]?.name || 'Pending Onboarding';

    // 1. Upgrade Role
    await pool.query("UPDATE users SET role = 'worker' WHERE id = ?", [userId]);

    // 2. Create Draft Profile (INSERT IGNORE in case they restarted)
    await pool.query(
        `INSERT IGNORE INTO worker_profiles (user_id, name, category, kyc_status)
     VALUES (?, ?, 'general', 'draft')`,
        [userId, defaultName]
    );

    return { roles: ['worker'] }; // Simulate returning the JSON roles array per requirements
}

/**
 * 2. Update Profile
 * Sets demographic and skill data. Progresses status from 'draft' to 'documents_pending'.
 */
export async function updateProfile(userId, profileData, pool) {
    const { full_name, dob, gender, skills, experience_years, service_pincodes } = profileData;

    if (!full_name || !dob || !gender || !skills || experience_years === undefined || !service_pincodes) {
        throw Object.assign(new Error('Missing required profile fields'), { status: 400 });
    }

    if (!validateSkills(skills)) {
        throw Object.assign(new Error(`Invalid skills provided. Allowed: ${[...ALLOWED_SKILLS].join(', ')}`), { status: 400 });
    }

    if (!Array.isArray(service_pincodes)) {
        throw Object.assign(new Error('service_pincodes must be an array'), { status: 400 });
    }

    const [rows] = await pool.query('SELECT kyc_status FROM worker_profiles WHERE user_id = ?', [userId]);
    if (!rows.length) throw Object.assign(new Error('Worker profile not found'), { status: 404 });

    // Update profile
    await pool.query(
        `UPDATE worker_profiles 
        SET name = ?, dob = ?, gender = ?, skills = ?, experience_years = ?, service_pincodes = ? 
      WHERE user_id = ?`,
        [full_name, dob, gender, JSON.stringify(skills), experience_years, JSON.stringify(service_pincodes), userId]
    );

    // Progress status if it was draft
    if (rows[0].kyc_status === 'draft') {
        await pool.query("UPDATE worker_profiles SET kyc_status = 'documents_pending' WHERE user_id = ?", [userId]);
    }

    return { success: true };
}

/**
 * 3. Update Payment
 * Saves payment details securely.
 */
export async function updatePayment(userId, paymentData, pool) {
    const { payment_method, payment_details } = paymentData;

    if (payment_method !== 'upi' && payment_method !== 'bank') {
        throw Object.assign(new Error("payment_method must be 'upi' or 'bank'"), { status: 400 });
    }

    if (!payment_details || typeof payment_details !== 'object') {
        throw Object.assign(new Error('payment_details object is required'), { status: 400 });
    }

    if (payment_method === 'upi' && !payment_details.upi_id) {
        throw Object.assign(new Error('upi_id is required for UPI method'), { status: 400 });
    }

    if (payment_method === 'bank' && (!payment_details.account_no || !payment_details.ifsc)) {
        throw Object.assign(new Error('account_no and ifsc are required for bank method'), { status: 400 });
    }

    await pool.query(
        `UPDATE worker_profiles SET payment_method = ?, payment_details = ? WHERE user_id = ?`,
        [payment_method, JSON.stringify(payment_details), userId]
    );

    return { success: true };
}

/**
 * 4. Submit Documents
 * Asserts document ownership/upload validity and registers them.
 */
export async function submitDocuments(userId, docs, pool) {
    const { aadhar_front_key, aadhar_back_key, photo_key } = docs;

    if (!aadhar_front_key || !aadhar_back_key || !photo_key) {
        throw Object.assign(new Error('Missing required S3 upload keys'), { status: 400 });
    }

    const keysToVerify = [aadhar_front_key, aadhar_back_key, photo_key];

    // Verify all keys belong to user and are confirmed (is_used = 1)
    const [tokens] = await pool.query(
        `SELECT s3_key FROM s3_upload_tokens 
      WHERE user_id = ? AND is_used = 1 AND s3_key IN (?, ?, ?)`,
        [userId, ...keysToVerify]
    );

    if (tokens.length !== keysToVerify.length) {
        console.error(`[Worker Onboarding] S3 Token Mismatch for U:${userId}. Expected 3 confirmed keys, found ${tokens.length}`);
        throw Object.assign(new Error('One or more document keys are invalid, unconfirmed, or do not belong to you.'), { status: 400 });
    }

    console.log(`[Worker Onboarding] Valid S3 keys matched for U:${userId}. Inserting into worker_documents schema.`);

    // Insert into worker_documents
    // (IGNORE in case they repeatedly submit)
    await pool.query(
        `INSERT IGNORE INTO worker_documents (worker_id, doc_type, s3_key) VALUES 
      (?, 'aadhaar_front', ?),
      (?, 'aadhaar_back', ?),
      (?, 'selfie', ?)`,
        [userId, aadhar_front_key, userId, aadhar_back_key, userId, photo_key]
    );

    // Update status
    console.log(`[Worker Onboarding] Documents Saved. Progressing pipeline to pending_review for U:${userId}`);
    await pool.query(`UPDATE worker_profiles SET kyc_status = 'pending_review' WHERE user_id = ?`, [userId]);

    return { success: true };
}

/**
 * 5. Agree to Terms
 */
export async function agreeToTerms(userId, nameTyped, ipAddress, pool) {
    if (!nameTyped || nameTyped.trim().length === 0) {
        throw Object.assign(new Error('You must type your name to agree.'), { status: 400 });
    }

    const [profiles] = await pool.query('SELECT name FROM worker_profiles WHERE user_id = ?', [userId]);
    if (!profiles.length) throw Object.assign(new Error('Worker profile not found'), { status: 404 });

    const profileName = profiles[0].name;
    if (profileName.toLowerCase() !== nameTyped.trim().toLowerCase()) {
        throw Object.assign(new Error(`Typed name does not match profile name (${profileName}).`), { status: 400 });
    }

    await pool.query(
        `INSERT INTO worker_agreements (worker_id, name_typed, version, ip_address)
     VALUES (?, ?, 'v1.0', ?)`,
        [userId, nameTyped.trim(), ipAddress]
    );

    return { agreed: true, message: 'Application submitted for review' };
}

/**
 * 6. Get Onboarding Status
 */
export async function getOnboardingStatus(userId, pool) {
    const [profiles] = await pool.query('SELECT kyc_status, is_verified, payment_method, payment_details FROM worker_profiles WHERE user_id = ?', [userId]);

    if (!profiles.length) {
        return {
            onboarding_status: 'none',
            steps_complete: { profile: false, payment: false, documents: false, agreement: false },
            is_verified: false
        };
    }

    const prof = profiles[0];

    // Check docs
    const [docs] = await pool.query('SELECT COUNT(*) as count FROM worker_documents WHERE worker_id = ?', [userId]);
    const hasDocs = docs[0].count >= 3;

    // Check agreement
    const [agreements] = await pool.query('SELECT COUNT(*) as count FROM worker_agreements WHERE worker_id = ?', [userId]);
    const hasAgreement = agreements[0].count >= 1;

    // Profile is complete if it moved past draft (though could be more strict)
    const isProfileComplete = prof.kyc_status !== 'draft';
    const isPaymentComplete = prof.payment_method !== null && prof.payment_details !== null;

    return {
        onboarding_status: prof.kyc_status,
        steps_complete: {
            profile: isProfileComplete,
            payment: isPaymentComplete,
            documents: hasDocs,
            agreement: hasAgreement
        },
        is_verified: Boolean(prof.is_verified)
    };
}
