/**
 * src/i18n/translations/en.js
 * 
 * Master translation file (English).
 * This is the SINGLE SOURCE OF TRUTH for all keys in the app.
 * All other language files must mirror these exact keys.
 */

export default {
    // ── App General ───────────────────────────────────
    loading: 'Loading...',
    continue: 'Continue',
    back: 'Back',
    cancel: 'Cancel',
    retry: 'Retry',
    save: 'Save',
    submit: 'Submit',
    optional: 'Optional',
    search: 'Search',
    done: 'Done',
    yes: 'Yes',
    no: 'No',

    // ── Language Screen ───────────────────────────────
    choose_language_title: 'Choose your language',
    search_language: 'Search language...',

    // ── Auth & Onboarding ─────────────────────────────
    phone_entry_title: 'Enter your number',
    phone_entry_sub: "We'll send you a verification code",
    get_otp_whatsapp: 'Get OTP via WhatsApp',
    get_otp_sms: 'Get OTP via SMS',
    sending: 'Sending...',
    terms_text_1: "By continuing, you agree to ZARVA's",
    terms_text_2: 'Terms of Service',
    terms_text_3: 'and',
    terms_text_4: 'Privacy Policy',

    enter_6_digit_code: 'Enter the 6-digit code',
    sent_to_number: 'Sent to',
    resend_in: 'Resend in',
    resend_otp: 'Resend OTP',
    verify: 'Verify',

    // ── Role Selection ────────────────────────────────
    choose_role: 'Choose your role',
    customer: 'Customer',
    customer_desc: 'I want to hire skilled professionals',
    worker: 'Service Provider',
    worker_desc: 'I want to offer my services and earn',

    // ── Customer Home ─────────────────────────────────
    customer_home_greeting: 'What do you need today?',
    home_search_placeholder: 'Search for electric, plumbing...',
    recent_posts: 'Recent Posts',
    active_job: 'Active Job',

    // ── Service Categories ────────────────────────────
    cat_electrician: 'Electrician',
    cat_plumber: 'Plumber',
    cat_carpenter: 'Carpenter',
    cat_ac_repair: 'AC Repair',
    cat_painter: 'Painter',
    cat_cleaner: 'Cleaner',
    cat_driver: 'Driver',
    cat_mason: 'Mason',

    // ── Job Posting (Dynamic Questions) ───────────────
    whats_the_issue: "What's the issue?",
    upload_photo: 'Upload Photo',
    uploading: 'Uploading...',
    get_price_estimate: 'Get Price Estimate',
    price_breakdown: 'Price Breakdown',
    fee_labour: 'Labour (Est.)',
    fee_travel: 'Travel Charge',
    fee_platform: 'Platform Fee',
    total_amount: 'Total Amount',
    advance: 'Advance',
    find_worker: 'Find Worker',

    // ── Job Searching / Radar ─────────────────────────
    finding_workers_nearby: 'Finding workers nearby',
    please_wait: 'Please wait...',

    // ── Job Status Labels ─────────────────────────────
    status_open: 'Open',
    status_assigned: 'Assigned',
    status_worker_en_route: 'En Route',
    status_worker_arrived: 'Arrived',
    status_in_progress: 'In Progress',
    status_pending_completion: 'Pending Completion',
    status_completed: 'Completed',
    status_cancelled: 'Cancelled',
    status_disputed: 'Disputed',

    // ── My Jobs ───────────────────────────────────────
    my_jobs_title: 'My Jobs',
    filter_all: 'All',
    filter_active: 'Active',
    filter_past: 'Past',
    no_jobs_found: 'No jobs found.',

    // ── Customer Live Tracking & Action ───────────────
    worker_assigned: 'Worker Assigned',
    call_worker: 'Call Worker',
    navigate_map: 'Navigate Map',
    worker_arrived_desc: 'Your worker has arrived.',
    your_start_code: 'Your Start Code:',
    share_code_to_start: 'Share this 4-digit code with the worker to start the job.',
    job_in_progress: 'Job in Progress',
    report_issue: 'Report Issue',
    enter_end_otp: 'Enter End OTP',
    ask_worker_for_otp: 'Ask your worker for the 4-digit End OTP to finish the job.',

    // ── Payment ──────────────────────────────────────
    payment_summary: 'Payment Summary',
    pay_now: 'Pay Now',
    pay_cash: 'Mark as Cash Paid',

    // ── Rating ────────────────────────────────────────
    rate_worker: 'Rate Worker',
    write_review: 'Write a review...',
    submit_review: 'Submit Review',

    // ── Worker Home ───────────────────────────────────
    worker_home_greeting: 'Hello, {{name}}',
    go_online: 'Go Online',
    go_offline: 'Go Offline',
    earnings_today: "Today's Earnings",
    stats_jobs: 'Jobs',
    stats_rating: 'Rating',

    // ── Worker Available Jobs ─────────────────────────
    available_jobs_title: 'Available Jobs',
    distance_away: '{{distance}} km away',
    accept_job: 'Accept Job',
    decline_job: 'Not Interested',
    go_online_to_see_jobs: 'Go online to see available jobs',

    // ── Worker Active Job Actions ─────────────────────
    ive_arrived: "I've Arrived",
    start_job: 'Start Job',
    mark_complete: 'Mark Complete',
    ask_user_for_start_code: 'Ask the customer for their 4-digit Start Code',
    show_this_code_to_user: 'Show this 4-digit code to the customer to finish the job.',
    your_end_otp: 'Your End OTP:',

    // ── Worker Earnings ───────────────────────────────
    earnings_title: 'Earnings',
    tab_today: 'Today',
    tab_this_week: 'This Week',
    tab_this_month: 'This Month',

    // ── Profile & Settings ────────────────────────────
    profile_title: 'Profile',
    edit_profile: 'Edit Profile',
    language: 'Language',
    logout: 'Logout',

    // ── Errors ────────────────────────────────────────
    error_generic: 'Something went wrong. Please try again.',
    error_network: 'Network error. Check your connection.',
    error_otp_invalid: 'The code you entered is incorrect.',
    error_upload: 'Failed to upload photo.',
};
