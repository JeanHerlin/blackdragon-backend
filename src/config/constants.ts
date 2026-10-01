// Intentionally hardcoded rather than read from env/config: both password recovery and
// admin operational alerts must always reach this one fixed inbox even if the .env file
// is ever misconfigured, leaked, or edited by mistake — an explicit product decision.
export const ADMIN_NOTIFICATION_EMAIL = 'ramangajeanherlin@gmail.com';
