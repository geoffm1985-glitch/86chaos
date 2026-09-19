# 86 Chaos 17.0.10

Release: Repository Safety Manifest Repair

Status: release candidate; full Play Store certification still required.

## Repair

17.0.9 intentionally requires `release-source-manifest.json` to be committed because Vercel build identity uses it as deterministic source evidence. The repository safety validator reused `excludedFile()` from source hashing and therefore incorrectly classified that required tracked manifest as generated/unsafe. This stopped the release workflow before dependency installation.

17.0.10 separates those concepts: the manifest remains excluded from hashing itself, but it is explicitly allowed and required as a tracked repository file. All other generated files, local environment files, release ZIPs, caches, reports, build outputs, and secret-like JSON files remain rejected. No application workflow, Firebase configuration, security rules, tenant behavior, or production data behavior is changed.

The 17.0.9 Request Off runtime hardening, Vercel protected-config identity repair, and mobile microphone placement remain unchanged.
