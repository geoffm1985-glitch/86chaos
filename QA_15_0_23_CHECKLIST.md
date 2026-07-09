# QA Checklist - 86 Chaos 15.0.23

## Firebase email action fix

- Confirm `/version.json` reports `15.0.23`.
- Open Settings > Account Security as an elevated user whose Firebase Auth email is not verified.
- Click Send Verification Email and confirm a Firebase verification email arrives.
- Click the email verification link.
- Return to 86 Chaos and click Refresh Email Status.
- Confirm Send Setup Code becomes available only after email verification is true.
- In Settings > Profile, click Reset Password and confirm the reset goes to the active Firebase Auth email.

## MFA enrollment follow-up

- Keep MFA enforcement off while testing.
- Enter current password and a phone number in +1XXXXXXXXXX format.
- Confirm SMS MFA enrollment can send a setup code after Firebase SMS MFA is enabled.
- Log out and confirm a fresh login asks for the second-factor code after enrollment.

## Regression checks

- Profile save still works.
- Settings tabs still load on mobile.
- /api/account-security still returns ok:true for a signed-in user.
