'use strict';

// Operational QA workspaces are already configured. Tour-specific tests can
// explicitly restart onboarding instead of interrupting unrelated workflows.
module.exports = Object.freeze({
  onboardingComplete: true,
  onboardingTourSeen: true,
  managerOnboardingSeen: true,
});
