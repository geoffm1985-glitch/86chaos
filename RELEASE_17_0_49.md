# 86 Chaos 17.0.49

## ARG_MAX-Safe Testing Deployment Identity Wait

17.0.49 is a surgical testing/release-gate repair based on the restored 17.0.46 testing feature line. It does not include the unrelated emergency 17.0.48 Schedule Publish branch or the portable 17.0.47 experiment.

The failed testing run never reached Playwright. Its targeted Node delta passed, then the GitHub Actions deployment-wait step attempted to pass the complete `build-identity.json` response as a Node command-line argument. The response exceeded Linux's argument-size limit and the step exited 126 with `Argument list too long`.

The repair preserves the exact deployment identity guard. The workflow now downloads `build-identity.json` and `version.json` to temporary files and passes only the small file paths to a dedicated parser. No identity comparison is relaxed or bypassed.

Coverage added:
- Node regression reproducing an identity payload larger than 1 MiB and verifying file-based parsing.
- Play Store / release-gate contract verifying the workflow remains file-based and ARG_MAX-safe.

Production is unchanged.
