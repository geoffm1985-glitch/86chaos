'use strict';

// Source-derived from 86 Chaos 16.0.191. These are real application surfaces, not invented QA pages.
const ROUTE_STATES = {
  today: [],
  ops: [],
  schedule: [
    ['Schedule Builder'],
    ['Schedule Builder', 'Open Copilot Tools'],
    ['Schedule Builder', 'Coverage'],
    ['Schedule Builder', 'Templates'],
    ['Schedule Builder', /Create Template|Edit Template/i],
    ['Schedule Builder', 'Drag Board'],
    ['Schedule Builder', 'Warnings'],
    ['Schedule Builder', 'Edit Presets'],
    ['Schedule Builder', 'Auto-Fill'],
    ['Schedule Builder', /^Event$/i],
  ],
  published: [
    ['My Schedule'],
    ['Full Schedule'],
    ['Month View'],
    ['Request Off'],
    ['Request Off', 'Needs Review'],
    ['Request Off', 'Upcoming Approved'],
    ['Request Off', 'Published/Archived'],
    ['Request Off', 'All'],
    ['Request Off', 'All Dates'],
    ['Request Off', 'This Week'],
    ['Request Off', 'Next Week'],
    ['Request Off', 'This Month'],
    ['Request Off', 'Next Month'],
    ['Request Off', 'Custom Range'],
    ['Availability'],
    ['Trade Board'],
    ['Schedule Builder'],
  ],
  events: [],
  financials: [
    ['Overview'], ['Daily Close'], ['Sales'], ['Labor & Payroll'], ['Tips'],
    ['COGS & Vendors'], ['Expenses'], ['P&L'], ['Targets'], ['Reports'],
  ],
  sales: [],
  labor: [],
  'back-office': [
    ['Dashboard'], ['Deposit Log'], ['Approval Queue'], ['Document Vault'],
    ['Owner Reports'], ['QuickBooks'], ['Accountant Packet'], ['Owner Rollup'],
  ],
  inventory: [
    [/^count$/i], [/^order$/i], [/AI Order/i], [/^manage$/i], [/^vendors$/i], [/Invoices/i], [/Burn Log/i],
  ],
  'menu-intelligence': [],
  'ai-tools': [],
  prep: [[/^prep$/i], [/line.?check/i], [/daily/i], [/weekly/i], [/monthly/i]],
  recipes: [],
  messages: [],
  reminders: [],
  team: [],
  maintenance: [['Repair Board'], [/Preventative Maintenance/i]],
  'hr-training': [
    ['Overview'], ['Training Manuals'], ['Training Manuals', 'Publish Manual'],
    ['Onboarding'], ['Onboarding', 'Assign Checklist'],
    ['Certifications'], ['Certifications', 'Add Certification'],
    ['Performance Notes'], ['Performance Notes', 'Add Confidential Note'],
  ],
  settings: [['profile'], ['Account Security'], ['preferences'], ['alerts'], ['Plan & Billing'], ['workspace'], ['Branding'], [/Integrations/i]],
  help: [],
  audit: [],
  godmode: [
    ['Command Center'], ['Health Dashboard'], ['Deployment Readiness'], ['Training & Administrator Manuals'],
    ['Backup Center & Audit Trail'], ['Legal Data Retention Setup'], ['Import / Export Center'],
    ['Security Center'], ['Super Admin Access'], ['Permission & Role Manager'],
    ['Workspaces / Clients'], ['People Directory'], ['Workspace Setup Wizard'],
    ['Support Diagnostics'], ['AI Usage / Scan Limits'], ['Python Automation Center'],
    ['Push Control Center'], ['Online / Last Seen'], ['Maintenance Mode'], ['Robustness Suite'],
    ['Settings Version History'], ['Platform Operations'], ['Danger Zone'],
  ],
};


const CONDITIONAL_ROUTE_STATES = Object.freeze({
  inventory: [
    { path: [/Invoices/i, 'Stock Matcher'], prerequisite: 'invoice-reconciliation' },
    { path: [/Invoices/i, /Needs Review/i], prerequisite: 'invoice-reconciliation' },
    { path: [/Invoices/i, 'Raw Audit'], prerequisite: 'invoice-reconciliation' },
  ],
});

const MUTATION_LABEL_RE = /\b(save|add|create|delete|remove|deactivate|activate|transfer|publish|send|submit|approve|deny|resolve|reopen|clock in|clock out|start break|end break|upload|replace|scan|import|sync|connect|repair|restore|backup|reset|run|generate|apply|accept|receive|update|edit|deduct|log waste|assign|offer|claim|cancel|archive|acknowledge|dismiss|mark reviewed|mark complete|complete|revoke|grant|enable|disable|enroll|verify|post|reply|seed demo|test push|force refresh|lockdown)\b|^[+-]$/i;
const SESSION_OR_GLOBAL_DANGER_RE = /log out|sign out|delete account|log out everyone|global lockdown|force logout|delete workspace|disable workspace|obliterate|nuke/i;
const SAFE_ACTION_RE = /\b(open|close|view|details|back|next|previous|today|tomorrow|week|month|filter|search|clear|show|hide|expand|collapse|menu|settings|help|refresh|retry|print|copy|download|export|jump|calendar|schedule|inventory|recipe|message|maintenance|team|financial|event|reminder|tab|active workspace|report a problem|86 voice|need attention|explain|review|labor|preferences|setup checklist|account security|profile|dashboard|home|go to|switch workspace)\b|^[<>×✕✖]$/i;
const AUTO_CHANGE_BLOCK_RE = /permission|role|wage|pay rate|mfa|two.?step|security|lockdown|maintenance mode|admin access|workspace|billing|plan|delete|remove|archive|restore|reset|password|email|phone|push|notification|integration|quickbooks/i;

module.exports = { ROUTE_STATES, CONDITIONAL_ROUTE_STATES, MUTATION_LABEL_RE, SESSION_OR_GLOBAL_DANGER_RE, SAFE_ACTION_RE, AUTO_CHANGE_BLOCK_RE };
