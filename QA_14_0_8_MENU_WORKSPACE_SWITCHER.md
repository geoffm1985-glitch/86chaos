# QA Checklist: 86 Chaos 14.0.8 Menu Workspace Switcher

## Multi-workspace employee

- Log in as an employee/account that belongs to two active restaurants.
- Open the side menu.
- Confirm the user card shows name, role, and the active restaurant under the role.
- Tap the restaurant line.
- Confirm the side menu closes and the Switch Workspace picker opens.
- Select the other restaurant.
- Confirm the header and side menu both show the newly selected restaurant.
- Confirm the user role shown is the role for the selected restaurant.

## Single-workspace employee

- Log in as an employee with only one restaurant.
- Open the side menu.
- Confirm the restaurant name is visible under the role.
- Confirm tapping it does not open a switcher.

## Permissions and safety

- Confirm regular employees can change only between restaurants where they have active membership.
- Confirm demo mode does not open the workspace switcher from the menu.
- Confirm System Administrator / Ghost Mode still uses the existing header/admin controls.
