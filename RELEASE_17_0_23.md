# 86 Chaos 17.0.23

## Request Off Cutoff and Blackout Policy

17.0.23 adds only the requested Request Off policy controls. Account owners and workspace administrators can configure how many days before the planned schedule release normal Request Off submissions close, and can add/remove blackout date ranges with optional reasons.

For monthly schedule workspaces, the policy uses a configurable normal release day in the previous month to calculate the cutoff. Weekly, biweekly, and custom-week workspaces use a configurable release lead time before the schedule period starts. These settings calculate Request Off deadlines only and do not publish schedules automatically.

Policy configuration authority is intentionally narrower than general schedule management: schedule, team, or settings permission alone does not grant access. Owners/admins can explicitly override a cutoff/blackout when submitting their own Request Off; other employees cannot. Existing Request Off approval/review workflow permissions remain unchanged.

No POS Bridge, inventory, financials, recipes, Time Clock, schedule publishing, or unrelated application behavior was changed.
