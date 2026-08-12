# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 86chaos-full-audit\02-permission-role-security.spec.cjs >> 02 role permissions and direct-route security >> staff account cannot see or use owner/system-admin-only surfaces
- Location: tests\86chaos-full-audit\02-permission-role-security.spec.cjs:23:3

# Error details

```
Test timeout of 90000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e6]:
  - img "86 Chaos OS Logo" [ref=e7]
  - generic [ref=e8]:
    - generic [ref=e9]: Your password was accepted, but 86 Chaos could not load your account profile. Try the email in all lowercase once. If it still happens, ask a System Administrator to check that your profile email is lowercase and linked to your Firebase user.
    - group [ref=e10]:
      - generic "Login check details" [ref=e11] [cursor=pointer]
    - textbox "Email Address" [ref=e13]: 86chaos.qa.staff.20260729-1302@example.test
    - textbox "Password" [ref=e15]: Qa!2ybIrXPdI1MzvCLkXw
    - generic [ref=e16] [cursor=pointer]:
      - checkbox "Remember Me" [checked] [ref=e17]
      - generic [ref=e18]: Remember Me
    - button "Unlock System" [ref=e19] [cursor=pointer]
    - generic [ref=e20]:
      - button "Forgot Password or Username?" [ref=e21] [cursor=pointer]
      - button "Privacy Policy & Terms of Service" [ref=e22] [cursor=pointer]
      - generic [ref=e23]: Version 16.0.197
```