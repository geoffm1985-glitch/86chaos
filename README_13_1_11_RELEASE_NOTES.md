# 86 Chaos 13.1.11 Release Notes

## Employee Quick Start completion fix

This update fixes the employee onboarding tour behavior.

### Changed
- Employee Quick Start only saves as complete after the employee reaches the final step and clicks **Finish**.
- Closing the tour or clicking **Skip for now** only hides it for the current browser session.
- The tour will come back later until the employee actually finishes it.
- Completion is saved to the employee user record as `onboardingComplete: true`.
- A local backup flag is also saved so the tour stays gone immediately after finishing, even before the live user record refreshes.

### Why
Employees should not be permanently marked trained just because they closed or skipped the tour once. The tour should only stay gone after the employee actually clicks through it and finishes.
