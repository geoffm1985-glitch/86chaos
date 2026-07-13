# 86 Chaos Privacy Policy Notes

Last updated: July 12, 2026

The in-app privacy policy was updated for 15.0.55 to document plan, subscription, Founder Beta, billing-support, scan-limit usage, integration-lock, and plan-change audit data.

86 Chaos does not enable live payment processing or customer-facing POS/accounting integrations in this release. If future billing or integrations are enabled, the privacy policy and customer setup guidance should be reviewed again before rollout.

Plan and billing-support records may include workspace plan, selected future tier, Founder Beta dates, beta extension state, discount status, manual billing notes, scan page usage, integration lock state, feature access overrides, and plan-change audit records. These records are used for account administration, support, fraud prevention, disputes, legal obligations, cost-control enforcement, and future billing readiness.

AI scan usage may be tracked by workspace, month, scan type, pages used, user where available, provider/model metadata, and whether an internal testing bypass was used. This is used to block expensive scans before they run and to support customer troubleshooting.

Integration provider choices may be saved as planning notes for internal testing, but live OAuth tokens, POS API keys, accounting API keys, and payroll API keys should not be stored in Firestore from customer-facing screens. Future live integration secrets should use a server-side encrypted vault design.
