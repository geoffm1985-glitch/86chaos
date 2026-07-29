const PROTECTED_ROOT_ADMIN_EMAILS = ['geoffm1985@gmail.com'];

function normalizeEmail(value = '') {
  return String(value || '').toLowerCase().trim();
}

function protectedRootAdminEmails() {
  return [...PROTECTED_ROOT_ADMIN_EMAILS];
}

function isProtectedRootAdminEmail(email = '') {
  return PROTECTED_ROOT_ADMIN_EMAILS.includes(normalizeEmail(email));
}

function mergeProtectedRootAdminEmails(emails = []) {
  const out = new Set((emails || []).map(normalizeEmail).filter(Boolean));
  PROTECTED_ROOT_ADMIN_EMAILS.forEach(email => out.add(email));
  return Array.from(out);
}

function protectedRootAdminError() {
  return new Error('This is the protected root administrator account and cannot be revoked, deleted, disabled, or downgraded from inside 86 Chaos.');
}

module.exports = {
  PROTECTED_ROOT_ADMIN_EMAILS,
  normalizeEmail,
  protectedRootAdminEmails,
  isProtectedRootAdminEmail,
  mergeProtectedRootAdminEmails,
  protectedRootAdminError
};
