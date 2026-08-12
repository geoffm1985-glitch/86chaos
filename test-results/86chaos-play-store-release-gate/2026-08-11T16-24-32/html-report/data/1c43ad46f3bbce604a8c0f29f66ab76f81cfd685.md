# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 86chaos-release-gate\16-accessibility-release-gate.spec.cjs >> 16 WCAG accessibility release gate >> forms expose labels, errors, keyboard focus, and no keyboard traps
- Location: tests\86chaos-release-gate\16-accessibility-release-gate.spec.cjs:134:3

# Error details

```
Test timeout of 600000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e6]:
  - img "86 Chaos OS Logo" [ref=e7]
  - generic [ref=e8]:
    - generic [ref=e9]:
      - heading "Choose Workspace" [level=2] [ref=e10]
      - paragraph [ref=e11]: Pick which restaurant you are working in right now.
    - generic [ref=e12]:
      - button "Open 86 Chaos Release Gate QA 2026-08-04T15-57-57Owner • 88S1pJabUtDBbunECxXE" [ref=e13] [cursor=pointer]:
        - paragraph [ref=e14]: 86 Chaos Release Gate QA 2026-08-04T15-57-57
        - paragraph [ref=e15]: Owner • 88S1pJabUtDBbunECxXE
      - button "Open 86 Chaos Release Gate QA 2026-08-08T20-23-04Owner • qa_2026-08-08T20-23-04" [ref=e16] [cursor=pointer]:
        - paragraph [ref=e17]: 86 Chaos Release Gate QA 2026-08-08T20-23-04
        - paragraph [ref=e18]: Owner • qa_2026-08-08T20-23-04
      - button "Open 86 Chaos Release Gate QA 2026-08-11T16-24-32Owner • qa_2026-08-11T16-24-32" [active] [ref=e19] [cursor=pointer]:
        - paragraph [ref=e20]: 86 Chaos Release Gate QA 2026-08-11T16-24-32
        - paragraph [ref=e21]: Owner • qa_2026-08-11T16-24-32
    - button "Back to Login" [ref=e22] [cursor=pointer]
```