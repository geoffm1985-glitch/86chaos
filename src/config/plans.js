export const PLAN_IDS = {
  SHIFT: 'shift',
  OPERATIONS: 'operations',
  SMART_KITCHEN: 'smart_kitchen',
  OWNER_PRO: 'owner_pro',
  MASTER_ADMIN: 'master_admin'
};

export const BILLING_STATUSES = ['beta', 'active', 'past_due', 'canceled', 'trial_expired', 'internal'];
export const FOUNDER_BETA_DAYS = 60;
export const FOUNDER_BETA_EXTENSION_DAYS = 30;
export const FOUNDER_BETA_MAX_DAYS = 90;
export const FOUNDER_DISCOUNT_PERCENT = 50;
export const FOUNDER_DISCOUNT_MONTHS = 12;

export const FEATURE_KEYS = {
  BASIC_DASHBOARD: 'basic_dashboard',
  STAFF_ROSTER_BASIC: 'staff_roster_basic',
  TEAM_MESSAGES: 'team_messages',
  PREP_LISTS: 'prep_lists',
  BASIC_86_ALERTS: 'basic_86_alerts',
  RECIPES_BASIC: 'recipes_basic',
  PERSONAL_REMINDERS: 'personal_reminders',
  SHARED_REMINDERS_BASIC: 'shared_reminders_basic',
  HELP_CENTER: 'help_center',
  BASIC_SCHEDULE_VIEW: 'basic_schedule_view',
  BASIC_PERMISSIONS: 'basic_permissions',
  MOBILE_ACCESS: 'mobile_access',

  SCHEDULE_BUILDER: 'schedule_builder',
  TIME_CLOCK: 'time_clock',
  TIMESHEETS: 'timesheets',
  LABOR_COMMAND: 'labor_command',
  MISSED_PUNCHES: 'missed_punches',
  LONG_SHIFTS: 'long_shifts',
  OVERTIME_RISK: 'overtime_risk',
  GEOFENCE_REVIEW: 'geofence_review',
  PAYROLL_READINESS: 'payroll_readiness',
  TIP_CENTER: 'tip_center',
  DAILY_CLOSE: 'daily_close',
  SALES_BREAKDOWN: 'sales_breakdown',
  MANAGER_BRIEF: 'manager_brief',
  KITCHEN_COMMAND: 'kitchen_command',
  CLEANING_ROUTINES: 'cleaning_routines',
  SHARED_REMINDERS: 'shared_reminders',
  BASIC_INVENTORY: 'basic_inventory',
  BURN_LOG: 'burn_log',
  BASIC_REPORTS: 'basic_reports',
  BASIC_AUDIT: 'basic_audit',

  FINANCIAL_OVERVIEW: 'financial_overview',
  PRIME_COST: 'prime_cost',
  COGS_CENTER: 'cogs_center',
  INVOICE_TOTALS: 'invoice_totals',
  VENDOR_SPEND: 'vendor_spend',
  FOOD_PURCHASES: 'food_purchases',
  BEVERAGE_PURCHASES: 'beverage_purchases',
  SUPPLIES_PURCHASES: 'supplies_purchases',
  WASTE_COST: 'waste_cost',
  INVENTORY_VALUE: 'inventory_value',
  TOP_COST_INCREASES: 'top_cost_increases',
  UNREVIEWED_INVOICES: 'unreviewed_invoices',
  MISSING_INVOICE_CATEGORIES: 'missing_invoice_categories',
  INVOICE_SCANNING: 'invoice_scanning',
  MENU_SCANNING: 'menu_scanning',
  MENU_INTELLIGENCE: 'menu_intelligence',
  SMART_86_ALERTS: 'smart_86_alerts',
  DEPENDENCY_TOOLS: 'dependency_tools',
  BUDGET_TARGETS: 'budget_targets',
  PNL_SNAPSHOT: 'pnl_snapshot',
  MONTHLY_OWNER_REPORT: 'monthly_owner_report',
  ADVANCED_REPORTS: 'advanced_reports',
  ADVANCED_FINANCIAL_AUDIT: 'advanced_financial_audit',
  ADVANCED_FINANCIAL_PERMISSIONS: 'advanced_financial_permissions',
  BACKUP_CENTER: 'backup_center',
  SECURITY_CENTER: 'security_center',
  EXPENSES: 'expenses',

  MULTI_LOCATION_DASHBOARD: 'multi_location_dashboard',
  CROSS_LOCATION_REPORTING: 'cross_location_reporting',
  ADVANCED_OWNER_TOOLS: 'advanced_owner_tools',
  HIGHER_SCAN_LIMITS: 'higher_scan_limits',
  MORE_BACKUP_HISTORY: 'more_backup_history',
  PRIORITY_SUPPORT: 'priority_support',
  ADVANCED_AUDIT_EXPORTS: 'advanced_audit_exports',
  CUSTOM_ONBOARDING: 'custom_onboarding',
  EARLY_ACCESS: 'early_access',

  INTEGRATIONS: 'integrations'
};

const SHIFT_FEATURES = [
  FEATURE_KEYS.BASIC_DASHBOARD, FEATURE_KEYS.STAFF_ROSTER_BASIC, FEATURE_KEYS.TEAM_MESSAGES,
  FEATURE_KEYS.PREP_LISTS, FEATURE_KEYS.BASIC_86_ALERTS, FEATURE_KEYS.RECIPES_BASIC,
  FEATURE_KEYS.PERSONAL_REMINDERS, FEATURE_KEYS.SHARED_REMINDERS_BASIC, FEATURE_KEYS.HELP_CENTER,
  FEATURE_KEYS.BASIC_SCHEDULE_VIEW, FEATURE_KEYS.BASIC_PERMISSIONS, FEATURE_KEYS.MOBILE_ACCESS
];

const OPERATIONS_ADDS = [
  FEATURE_KEYS.SCHEDULE_BUILDER, FEATURE_KEYS.TIME_CLOCK, FEATURE_KEYS.TIMESHEETS, FEATURE_KEYS.LABOR_COMMAND,
  FEATURE_KEYS.MISSED_PUNCHES, FEATURE_KEYS.LONG_SHIFTS, FEATURE_KEYS.OVERTIME_RISK, FEATURE_KEYS.GEOFENCE_REVIEW,
  FEATURE_KEYS.PAYROLL_READINESS, FEATURE_KEYS.TIP_CENTER, FEATURE_KEYS.DAILY_CLOSE, FEATURE_KEYS.SALES_BREAKDOWN,
  FEATURE_KEYS.MANAGER_BRIEF, FEATURE_KEYS.KITCHEN_COMMAND, FEATURE_KEYS.CLEANING_ROUTINES, FEATURE_KEYS.SHARED_REMINDERS,
  FEATURE_KEYS.BASIC_INVENTORY, FEATURE_KEYS.BURN_LOG, FEATURE_KEYS.INVOICE_SCANNING, FEATURE_KEYS.MENU_SCANNING, FEATURE_KEYS.BASIC_REPORTS, FEATURE_KEYS.BASIC_AUDIT
];

const SMART_KITCHEN_ADDS = [
  FEATURE_KEYS.FINANCIAL_OVERVIEW, FEATURE_KEYS.PRIME_COST, FEATURE_KEYS.COGS_CENTER, FEATURE_KEYS.INVOICE_TOTALS,
  FEATURE_KEYS.VENDOR_SPEND, FEATURE_KEYS.FOOD_PURCHASES, FEATURE_KEYS.BEVERAGE_PURCHASES, FEATURE_KEYS.SUPPLIES_PURCHASES,
  FEATURE_KEYS.WASTE_COST, FEATURE_KEYS.INVENTORY_VALUE, FEATURE_KEYS.TOP_COST_INCREASES, FEATURE_KEYS.UNREVIEWED_INVOICES,
  FEATURE_KEYS.MISSING_INVOICE_CATEGORIES, FEATURE_KEYS.INVOICE_SCANNING, FEATURE_KEYS.MENU_SCANNING,
  FEATURE_KEYS.MENU_INTELLIGENCE, FEATURE_KEYS.SMART_86_ALERTS, FEATURE_KEYS.DEPENDENCY_TOOLS,
  FEATURE_KEYS.BUDGET_TARGETS, FEATURE_KEYS.PNL_SNAPSHOT, FEATURE_KEYS.MONTHLY_OWNER_REPORT, FEATURE_KEYS.ADVANCED_REPORTS,
  FEATURE_KEYS.ADVANCED_FINANCIAL_AUDIT, FEATURE_KEYS.ADVANCED_FINANCIAL_PERMISSIONS, FEATURE_KEYS.BACKUP_CENTER,
  FEATURE_KEYS.SECURITY_CENTER, FEATURE_KEYS.EXPENSES
];

const OWNER_PRO_ADDS = [
  FEATURE_KEYS.MULTI_LOCATION_DASHBOARD, FEATURE_KEYS.CROSS_LOCATION_REPORTING, FEATURE_KEYS.ADVANCED_OWNER_TOOLS,
  FEATURE_KEYS.HIGHER_SCAN_LIMITS, FEATURE_KEYS.MORE_BACKUP_HISTORY, FEATURE_KEYS.PRIORITY_SUPPORT,
  FEATURE_KEYS.ADVANCED_AUDIT_EXPORTS, FEATURE_KEYS.CUSTOM_ONBOARDING, FEATURE_KEYS.EARLY_ACCESS
];

export const PLAN_FEATURES = {
  [PLAN_IDS.SHIFT]: SHIFT_FEATURES,
  [PLAN_IDS.OPERATIONS]: [...SHIFT_FEATURES, ...OPERATIONS_ADDS],
  [PLAN_IDS.SMART_KITCHEN]: [...SHIFT_FEATURES, ...OPERATIONS_ADDS, ...SMART_KITCHEN_ADDS],
  [PLAN_IDS.OWNER_PRO]: [...SHIFT_FEATURES, ...OPERATIONS_ADDS, ...SMART_KITCHEN_ADDS, ...OWNER_PRO_ADDS],
  [PLAN_IDS.MASTER_ADMIN]: Array.from(new Set([...SHIFT_FEATURES, ...OPERATIONS_ADDS, ...SMART_KITCHEN_ADDS, ...OWNER_PRO_ADDS, FEATURE_KEYS.INTEGRATIONS]))
};

export const PLAN_DEFINITIONS = {
  [PLAN_IDS.SHIFT]: {
    id: PLAN_IDS.SHIFT,
    label: 'Shift',
    public: true,
    monthlyPrice: 49,
    launchPriceText: '$49/month/location',
    founderPrice: 24.50,
    invoicePagesLimit: 0,
    menuPagesLimit: 0,
    summary: 'Core staff communication, prep, recipes, reminders, basic alerts, schedule viewing, and help content.',
    features: PLAN_FEATURES[PLAN_IDS.SHIFT]
  },
  [PLAN_IDS.OPERATIONS]: {
    id: PLAN_IDS.OPERATIONS,
    label: 'Operations',
    public: true,
    monthlyPrice: 99,
    launchPriceText: '$99/month/location',
    founderPrice: 49.50,
    invoicePagesLimit: 20,
    menuPagesLimit: 3,
    summary: 'Shift plus scheduling, time clock, labor tools, tips, daily close, sales breakdown, manager tools, basic inventory, and basic reports.',
    features: PLAN_FEATURES[PLAN_IDS.OPERATIONS]
  },
  [PLAN_IDS.SMART_KITCHEN]: {
    id: PLAN_IDS.SMART_KITCHEN,
    label: 'Smart Kitchen',
    public: true,
    monthlyPrice: 179,
    launchPriceText: '$179/month/location',
    founderPrice: 89.50,
    invoicePagesLimit: 75,
    menuPagesLimit: 10,
    summary: 'Operations plus full Financial Center, COGS, scan tools, Menu Intelligence, P&L, budgets, advanced reports, security, and backups.',
    features: PLAN_FEATURES[PLAN_IDS.SMART_KITCHEN]
  },
  [PLAN_IDS.OWNER_PRO]: {
    id: PLAN_IDS.OWNER_PRO,
    label: 'Owner Pro',
    public: true,
    monthlyPrice: 299,
    launchPriceText: '$299/month/location',
    founderPrice: 149.50,
    invoicePagesLimit: 200,
    menuPagesLimit: 25,
    summary: 'Smart Kitchen plus multi-location placeholders, cross-location reporting, advanced owner tools, higher scan limits, and priority/onboarding placeholders.',
    features: PLAN_FEATURES[PLAN_IDS.OWNER_PRO]
  },
  [PLAN_IDS.MASTER_ADMIN]: {
    id: PLAN_IDS.MASTER_ADMIN,
    label: 'Master Admin',
    public: false,
    monthlyPrice: 0,
    launchPriceText: 'Internal only',
    founderPrice: 0,
    invoicePagesLimit: Number.POSITIVE_INFINITY,
    menuPagesLimit: Number.POSITIVE_INFINITY,
    summary: 'Internal testing and support access. Not customer-facing.',
    features: PLAN_FEATURES[PLAN_IDS.MASTER_ADMIN]
  }
};

export const PLAN_ORDER = [PLAN_IDS.SHIFT, PLAN_IDS.OPERATIONS, PLAN_IDS.SMART_KITCHEN, PLAN_IDS.OWNER_PRO, PLAN_IDS.MASTER_ADMIN];
export const CUSTOMER_PLAN_ORDER = [PLAN_IDS.SHIFT, PLAN_IDS.OPERATIONS, PLAN_IDS.SMART_KITCHEN, PLAN_IDS.OWNER_PRO];

export const FEATURE_MIN_PLAN = Object.values(FEATURE_KEYS).reduce((acc, featureKey) => {
  const planId = CUSTOMER_PLAN_ORDER.find(id => PLAN_FEATURES[id].includes(featureKey));
  acc[featureKey] = planId || PLAN_IDS.MASTER_ADMIN;
  return acc;
}, {});

export const FINANCIAL_SUBTAB_FEATURES = {
  overview: FEATURE_KEYS.FINANCIAL_OVERVIEW,
  'daily-close': FEATURE_KEYS.DAILY_CLOSE,
  ledger: FEATURE_KEYS.SALES_BREAKDOWN,
  labor: FEATURE_KEYS.LABOR_COMMAND,
  tips: FEATURE_KEYS.TIP_CENTER,
  cogs: FEATURE_KEYS.COGS_CENTER,
  expenses: FEATURE_KEYS.EXPENSES,
  pnl: FEATURE_KEYS.PNL_SNAPSHOT,
  targets: FEATURE_KEYS.BUDGET_TARGETS,
  reports: FEATURE_KEYS.BASIC_REPORTS
};

export const ROUTE_FEATURES = {
  today: FEATURE_KEYS.MANAGER_BRIEF,
  published: FEATURE_KEYS.BASIC_SCHEDULE_VIEW,
  schedule: FEATURE_KEYS.SCHEDULE_BUILDER,
  events: FEATURE_KEYS.KITCHEN_COMMAND,
  ops: FEATURE_KEYS.KITCHEN_COMMAND,
  financials: FEATURE_KEYS.DAILY_CLOSE,
  sales: FEATURE_KEYS.SALES_BREAKDOWN,
  labor: FEATURE_KEYS.LABOR_COMMAND,
  messages: FEATURE_KEYS.TEAM_MESSAGES,
  prep: FEATURE_KEYS.PREP_LISTS,
  recipes: FEATURE_KEYS.RECIPES_BASIC,
  inventory: FEATURE_KEYS.BASIC_INVENTORY,
  'ai-tools': FEATURE_KEYS.INVOICE_SCANNING,
  'menu-intelligence': FEATURE_KEYS.MENU_INTELLIGENCE,
  reminders: FEATURE_KEYS.PERSONAL_REMINDERS,
  team: FEATURE_KEYS.STAFF_ROSTER_BASIC,
  'hr-training': FEATURE_KEYS.HELP_CENTER,
  maintenance: FEATURE_KEYS.CLEANING_ROUTINES,
  settings: FEATURE_KEYS.BASIC_PERMISSIONS,
  help: FEATURE_KEYS.HELP_CENTER,
  audit: FEATURE_KEYS.BASIC_AUDIT,
  godmode: FEATURE_KEYS.ADVANCED_OWNER_TOOLS
};

export const FEATURE_LABELS = {
  [FEATURE_KEYS.FINANCIAL_OVERVIEW]: 'Financial Overview',
  [FEATURE_KEYS.DAILY_CLOSE]: 'Daily Close',
  [FEATURE_KEYS.SALES_BREAKDOWN]: 'Sales Breakdown',
  [FEATURE_KEYS.LABOR_COMMAND]: 'Labor Command',
  [FEATURE_KEYS.TIP_CENTER]: 'Tip Center',
  [FEATURE_KEYS.PRIME_COST]: 'Prime Cost Dashboard',
  [FEATURE_KEYS.COGS_CENTER]: 'Cost Center / COGS Center',
  [FEATURE_KEYS.EXPENSES]: 'Expenses & Bills',
  [FEATURE_KEYS.PNL_SNAPSHOT]: 'P&L Snapshot',
  [FEATURE_KEYS.BUDGET_TARGETS]: 'Budget & Targets',
  [FEATURE_KEYS.INVOICE_SCANNING]: 'Invoice Scanning',
  [FEATURE_KEYS.MENU_SCANNING]: 'Menu Scanning',
  [FEATURE_KEYS.MENU_INTELLIGENCE]: 'Menu Intelligence',
  [FEATURE_KEYS.INTEGRATIONS]: 'Integrations'
};
