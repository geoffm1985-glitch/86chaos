# QA Checklist - 86 Chaos 15.0.22

## Account Security / MFA email verification

- Open Settings > Account Security as an elevated user whose Firebase Auth email is not verified.
- Confirm the panel shows Email verification required.
- Click Send Verification Email and confirm a Firebase verification email arrives.
- Click the email verification link.
- Return to 86 Chaos and click Refresh Email Status.
- Confirm Send Setup Code becomes available only after email verification is true.
- Enter current password and a phone number in +1XXXXXXXXXX format.
- Confirm SMS MFA enrollment can send a setup code after Firebase SMS MFA is enabled.

## Regression checks

- Password reset still works.
- Profile save still works.
- Settings tabs still load on mobile.
- /api/account-security returns ok:true for a signed-in user.
- Keep MFA enforcement off until enrollment and fresh MFA login are tested.
