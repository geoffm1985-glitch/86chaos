# 86 Chaos 17.0.42 — Emergency Schedule Header Touch-Scroll Stability Repair

## Emergency repair

Real-device video from 17.0.41 showed one remaining mobile interaction defect: the day/date strip stayed sticky during normal scrolling, but a vertical drag that began directly on the day/date strip could temporarily move the strip behind the sticky assignment/control card until the gesture ended.

17.0.42 gives the day/date horizontal scroller an explicit touch-axis contract. Horizontal swipes remain native to the day strip. Predominantly vertical drags are handed to the owning Schedule Builder content scroller with a non-passive touch listener, so the outer schedule moves while the sticky day/date strip remains pinned below the control deck throughout the gesture. The strip is also compositor-promoted to avoid transient Android repaint drift.

## Test coverage added (not executed in this build-only push)

- `api/emergency-sticky-touch-17-0-42.test.cjs`
- `tests/86chaos-release-gate/57-sticky-header-touch-handoff.spec.cjs`
- `scripts/validate-17-0-42.js`

This push remains build-only. Automated Release Gate / Play Store / targeted / delta execution is suppressed until further instruction.
