# QA Checklist - 86 Chaos 15.0.26 MFA Recovery & Safer Enforcement

- [ ] `/version.json` shows `15.0.26`.
- [ ] Account Security refresh shows browser/API project match on testing.
- [ ] Elevated account can enroll first SMS MFA factor.
- [ ] Elevated account can add a backup MFA phone after first enrollment.
- [ ] Wrong/missing SMS region/domain/provider errors show the detailed Firebase guidance instead of saying MFA is disabled.
- [ ] Super Admin can select a user, check MFA status, and see masked factors only.
- [ ] Super Admin cannot reset MFA without a recovery reason of at least 8 characters.
- [ ] Super Admin reset removes user MFA factors and writes an audit log entry.
- [ ] Reset user can log in with email/password and enroll a new phone before enforcement is enabled.
- [ ] Regular employee accounts are not forced into MFA when elevated-role enforcement is off.
- [ ] Firestore rules did not need redeploy.
- [ ] Storage rules did not need redeploy.
