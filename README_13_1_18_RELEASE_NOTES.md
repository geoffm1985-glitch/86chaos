# 86 Chaos 13.1.18 Release Notes

## Focus
Live user presence and administrator instructions.

## Changes
- Fixed the live user heartbeat by allowing safe presence-only profile updates in Firestore rules.
- Heartbeat now runs about every 25 seconds and updates lastActive, lastSeen, lastHeartbeatAt, onlineState, active tab, device, host, notification permission, GPS permission, and browser diagnostics.
- Live Users now parses both ISO date strings and Firestore timestamp values.
- Live Users shows last-seen context on each active user row.
- Administrator Manual now includes a full System Administrator tab map.
- Administrator Manual now explains Dashboard, Live Users, Clients, Users, Grant Access, Support, Forensics, Operations, and Admin Manual.

## Help Center policy
User-facing Help Center release notes remain generic: fixed stability issues, cleaned up internal tools, and improved reliability.
