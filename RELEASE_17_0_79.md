# 86 Chaos 17.0.79 — Managed Emulator Baseline Lineage Repair

This build repairs the exact failed+new baseline rejection exposed after 17.0.78 without weakening live certification.

The completed 17.0.77 full Yardmaster run produced 509 Playwright results, but its managed-emulator preflight recorded source version 17.0.77 and loopback deployed version 17.0.76. Release 17.0.77 explicitly changed certification assertions only and states that runtime behavior was unchanged, so that one predecessor pair is valid failure-lineage evidence for the managed `demo-86chaos` loopback emulator.

The repair is deliberately narrow:

- Only the explicit `17.0.77|17.0.76` source/runtime pair is recognized.
- The saved baseline must prove Firebase target `EMULATOR`, project `demo-86chaos`, HTTP loopback application URL, clean source identity, and completed Playwright evidence.
- Live targets, remote hosts, dirty source, unrelated version mismatches, and future unapproved pairs remain blocked.
- Exact-version baseline behavior is unchanged.
- Adds targeted Node regression coverage, Play Store/release-gate Playwright coverage, and independent Playwright regression coverage.

No production push is authorized by this build.
