# 86 Chaos 17.1.6

## Microphone and Delta Gate Interaction Repair

17.1.6 is a precision repair on top of 17.1.5. It keeps the completed Concept 1 redesign and mobile toolbar work intact while fixing the two remaining failed+new release-gate blockers and the reported non-working microphone.

### Repairs

- Starts 86Voice speech recognition synchronously from the actual microphone tap so Android/installed-PWA transient user activation is not lost to a timer.
- Keeps the 86Voice panel and typed-command fallback unchanged.
- Changes the Spanish mobile regression to validate the visible translated Today route/navigation instead of the hidden desktop-sidebar duplicate.
- Keeps the Schedule Builder control deck in normal flow and uses a single-column command layout at standard desktop widths so the action row cannot cover Assign.
- Adds scroll clearance for Schedule Builder command controls below the sticky app header.
- Makes the shift-assignment regression find its future empty cell in one DOM pass, avoiding repeated scroll/hit-test churn.
- Preserves Time Clock first, all 86 Chaos branding, Message Board repairs, System Administrator design, Spanish support, and the no Orders & Tickets requirement.

### Certification status

This package is not certified until it is deployed to `testing.86chaos.com` and the release gate passes against the deployed 17.1.6 build.
