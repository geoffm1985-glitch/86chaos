const EXPECTED_FIREBASE_PROJECT = 'chaos-test-d1601';

const ROLE_DEFINITIONS = Object.freeze([
  {
    key: 'systemAdmin',
    label: 'System Administrator',
    emailEnv: 'SYSTEM_ADMIN_EMAIL',
    passwordEnv: 'SYSTEM_ADMIN_PASSWORD',
    expectedSuperAdmin: true,
    expectedPlatformAuthority: true,
    name: 'QA System Administrator',
    role: 'Kitchen',
    restaurantRole: 'Kitchen',
    isAdmin: false,
    isOwner: false,
    accountOwner: false,
    workspaceOwner: false,
    permissions: { help: true },
  },
  {
    key: 'owner',
    label: 'Owner',
    emailEnv: 'OWNER_EMAIL',
    passwordEnv: 'OWNER_PASSWORD',
    expectedSuperAdmin: false,
    expectedPlatformAuthority: false,
    name: 'QA Owner Login',
    role: 'Owner',
    restaurantRole: 'Owner',
    isAdmin: true,
    isOwner: true,
    accountOwner: true,
    workspaceOwner: true,
    permissions: { schedule: true, inventory: true, inventoryEdit: true, financialRead: true, financialEdit: true, sales: true, salesRead: true, labor: true, laborRead: true, backOffice: true, ownerTools: true, team: true, events: true, settings: true, ops: true, maintenance: true, prep: true, recipes: true, menuIntelligence: true },
  },
  {
    key: 'manager',
    label: 'Manager',
    emailEnv: 'MANAGER_EMAIL',
    passwordEnv: 'MANAGER_PASSWORD',
    expectedSuperAdmin: false,
    expectedPlatformAuthority: false,
    name: 'QA Manager Login',
    role: 'Manager',
    restaurantRole: 'Manager',
    isAdmin: true,
    isOwner: false,
    accountOwner: false,
    workspaceOwner: false,
    permissions: { schedule: true, inventory: true, inventoryEdit: true, financialRead: true, salesRead: true, laborRead: true, backOffice: true, team: true, events: true, ops: true, maintenance: true, prep: true, recipes: true, menuIntelligence: true },
  },
  {
    key: 'staff',
    label: 'Staff',
    emailEnv: 'STAFF_EMAIL',
    passwordEnv: 'STAFF_PASSWORD',
    expectedSuperAdmin: false,
    expectedPlatformAuthority: false,
    name: 'QA Staff Login',
    role: 'Line Cook',
    restaurantRole: 'Line Cook',
    isAdmin: false,
    isOwner: false,
    accountOwner: false,
    workspaceOwner: false,
    permissions: { help: true },
  },
]);

function roleForKey(key) {
  return ROLE_DEFINITIONS.find((def) => def.key === key) || ROLE_DEFINITIONS.find((def) => def.key === 'staff');
}

function safeAccountDefinition(def) {
  return {
    key: def.key,
    label: def.label,
    emailEnv: def.emailEnv,
    passwordEnv: def.passwordEnv,
    expectedSuperAdmin: def.expectedSuperAdmin === true,
    expectedPlatformAuthority: def.expectedPlatformAuthority === true,
    name: def.name,
    role: def.role,
    restaurantRole: def.restaurantRole || def.role,
    isAdmin: def.isAdmin === true,
    isOwner: def.isOwner === true,
    accountOwner: def.accountOwner === true,
    workspaceOwner: def.workspaceOwner === true,
    permissions: def.permissions || {},
  };
}

module.exports = {
  EXPECTED_FIREBASE_PROJECT,
  ROLE_DEFINITIONS,
  roleForKey,
  safeAccountDefinition,
};
