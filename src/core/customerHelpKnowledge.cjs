'use strict';

const CUSTOMER_HELP_VERSION = '16.0.150';

const AUDIENCE = Object.freeze({ EVERYONE: 'Everyone', EMPLOYEE: 'Employee', MANAGER_OWNER: 'Manager / Owner' });

const HELP_SUBJECTS = [
  { id: 'getting-started', label: 'Getting Started', summary: 'Login, tours, installs, password help, and basic navigation.' },
  { id: 'today-kitchen', label: 'Today & Kitchen', summary: 'Today Home, Manager Brief, Kitchen Command, Need Attention, and 86 alerts.' },
  { id: 'schedule-time-clock', label: 'Schedule & Time Clock', summary: 'Schedules, clocking in, Request Off, availability, templates, publishing, and pay-period hours.' },
  { id: 'inventory-purchasing', label: 'Inventory & Purchasing', summary: 'Counts, vendors, orders, invoice scanning, Menu Intelligence, price changes, and burn log.' },
  { id: 'recipes-prep-tasks', label: 'Recipes, Prep & Tasks', summary: 'Recipe Book, prep lists, tasks, checks, and labels.' },
  { id: 'financials', label: 'Financials', summary: 'Daily Close, sales, labor, tips, COGS, prime cost, expenses, reports, and exports.' },
  { id: 'staff-training', label: 'Staff & Training', summary: 'Staff Roster, roles, permissions, HR, training, and certifications.' },
  { id: 'messages-notifications', label: 'Messages & Notifications', summary: 'Message Board, reminders, push notifications, important messages, and notification fixes.' },
  { id: 'maintenance-events', label: 'Maintenance & Events', summary: 'Maintenance records, preventive work, events, staffing notes, and reminders.' },
  { id: 'voice-smart-tools', label: '86Voice & Smart Tools', summary: 'Voice navigation, prep commands, task commands, reminders, recipe lookup, and voice troubleshooting.' },
  { id: 'back-office', label: 'Back Office', summary: 'Owner and manager office tools for reviewing the restaurant without using internal platform tools.' },
  { id: 'settings-personalization', label: 'Settings & Personalization', summary: 'Personal settings, workspace settings, time format, schedule display, notifications, and feature availability.' },
  { id: 'troubleshooting', label: 'Troubleshooting', summary: 'Common problems with schedules, clocking in, Request Off, invoices, installs, icons, voice, offline recovery, and browsers.' },
];

const HELP_SUBTOPICS = [
  ['first-login', 'First login', 'getting-started'], ['navigation', 'Navigation', 'getting-started'], ['guided-tours', 'Guided tours', 'getting-started'], ['installing', 'Installing 86 Chaos', 'getting-started'], ['passwords', 'Password reset', 'getting-started'], ['preferences', 'Personal preferences', 'getting-started'], ['notification-basics', 'Notifications basics', 'getting-started'],
  ['today-home', 'Today Home', 'today-kitchen'], ['manager-brief', 'Manager Brief', 'today-kitchen'], ['kitchen-command', 'Kitchen Command Center', 'today-kitchen'], ['need-attention', 'Need Attention', 'today-kitchen'], ['restaurant-86-alerts', 'Restaurant 86 alerts', 'today-kitchen'],
  ['my-schedule', 'My Schedule', 'schedule-time-clock'], ['full-schedule', 'Full Schedule', 'schedule-time-clock'], ['month-view', 'Month View', 'schedule-time-clock'], ['time-clock', 'Clock In / Clock Out', 'schedule-time-clock'], ['missed-punches', 'Missed punches', 'schedule-time-clock'], ['request-off', 'Request Off', 'schedule-time-clock'], ['availability', 'Availability', 'schedule-time-clock'], ['schedule-builder', 'Schedule Builder', 'schedule-time-clock'], ['schedule-templates', 'Schedule Templates', 'schedule-time-clock'], ['schedule-publishing', 'Publishing', 'schedule-time-clock'], ['schedule-visibility', 'Schedule visibility', 'schedule-time-clock'], ['pay-period-hours', 'Pay-period hours', 'schedule-time-clock'],
  ['inventory-counts', 'Inventory counts', 'inventory-purchasing'], ['items-vendors', 'Items and Vendors', 'inventory-purchasing'], ['orders', 'Orders', 'inventory-purchasing'], ['invoice-scanning', 'Invoice scanning', 'inventory-purchasing'], ['invoice-review', 'Invoice review', 'inventory-purchasing'], ['price-changes', 'Price changes', 'inventory-purchasing'], ['menu-intelligence', 'Menu Intelligence', 'inventory-purchasing'], ['burn-log', 'Burn Log', 'inventory-purchasing'],
  ['recipes', 'Recipe Book', 'recipes-prep-tasks'], ['prep', 'Prep', 'recipes-prep-tasks'], ['tasks', 'Tasks', 'recipes-prep-tasks'], ['line-checks', 'Line checks', 'recipes-prep-tasks'], ['labels', 'Labels', 'recipes-prep-tasks'],
  ['daily-close', 'Daily Close', 'financials'], ['sales', 'Sales', 'financials'], ['labor', 'Labor and Timesheets', 'financials'], ['tips', 'Tips', 'financials'], ['cogs', 'COGS and Prime Cost', 'financials'], ['expenses', 'Expenses', 'financials'], ['financial-reports', 'Reports and Exports', 'financials'],
  ['staff-roster', 'Staff Roster', 'staff-training'], ['adding-employees', 'Adding employees', 'staff-training'], ['roles-permissions', 'Roles and restaurant permissions', 'staff-training'], ['hr-training', 'HR & Training', 'staff-training'], ['certifications', 'Certifications', 'staff-training'],
  ['message-board', 'Message Board', 'messages-notifications'], ['personal-reminders', 'Personal Reminders', 'messages-notifications'], ['shared-reminders', 'Shared reminders', 'messages-notifications'], ['push-notifications', 'Push notifications', 'messages-notifications'],
  ['maintenance', 'Maintenance', 'maintenance-events'], ['preventive-maintenance', 'Preventive maintenance', 'maintenance-events'], ['events', 'Event Calendar', 'maintenance-events'], ['event-reminders', 'Event reminders', 'maintenance-events'],
  ['voice-open-close', 'Opening 86Voice', 'voice-smart-tools'], ['voice-commands', 'Voice commands', 'voice-smart-tools'], ['voice-troubleshooting', 'Voice troubleshooting', 'voice-smart-tools'], ['smart-tools', 'Smart tools', 'voice-smart-tools'],
  ['back-office-overview', 'Back Office overview', 'back-office'], ['owner-review', 'Owner review', 'back-office'], ['billing-plan-language', 'Plans and feature availability', 'back-office'],
  ['workspace-settings', 'Workspace settings', 'settings-personalization'], ['personal-settings', 'Personal settings', 'settings-personalization'], ['time-format', 'Time format', 'settings-personalization'], ['schedule-display', 'Schedule display', 'settings-personalization'], ['clock-rules', 'Clock and location settings', 'settings-personalization'],
  ['app-out-of-date', 'App seems out of date', 'troubleshooting'], ['wrong-icon', 'Wrong installed app icon', 'troubleshooting'], ['reinstall-pwa', 'Reinstalling the app', 'troubleshooting'], ['cannot-clock-in', 'Cannot clock in', 'troubleshooting'], ['cannot-request-off', 'Cannot request off', 'troubleshooting'], ['invoice-failed', 'Invoice scan failed', 'troubleshooting'], ['offline-recovery', 'Offline and recovery', 'troubleshooting'], ['browser-compatibility', 'Browser compatibility', 'troubleshooting'],
].map(([id, label, subjectId]) => ({ id, label, subjectId }));

const HELP_DEEP_LINKS = Object.freeze({
  'today-home': { id: 'today-home', label: 'Today Home', tab: 'today', audience: 'Everyone' },
  'manager-brief': { id: 'manager-brief', label: 'Manager Brief', tab: 'today', audience: 'Manager / Owner' },
  'kitchen-command': { id: 'kitchen-command', label: 'Kitchen Command Center', tab: 'ops', audience: 'Manager / Owner' },
  'schedule-builder': { id: 'schedule-builder', label: 'Schedule Builder', tab: 'schedule', scheduleSubtab: 'schedule-builder', audience: 'Manager / Owner', fallbackArticleId: 'schedule-builder-find' },
  'request-off': { id: 'request-off', label: 'Request Off', tab: 'published', scheduleSubtab: 'time-off', audience: 'Everyone', fallbackArticleId: 'request-off-how' },
  'availability': { id: 'availability', label: 'Availability', tab: 'published', scheduleSubtab: 'availability', audience: 'Everyone' },
  'my-schedule': { id: 'my-schedule', label: 'My Schedule', tab: 'published', scheduleSubtab: 'my-schedule', audience: 'Everyone' },
  'full-schedule': { id: 'full-schedule', label: 'Full Schedule', tab: 'published', scheduleSubtab: 'full-schedule', audience: 'Everyone' },
  'month-view': { id: 'month-view', label: 'Month View', tab: 'published', scheduleSubtab: 'month', audience: 'Everyone' },
  'time-clock': { id: 'time-clock', label: 'Time Clock', tab: 'published', scheduleSubtab: 'time-clock', audience: 'Everyone' },
  'inventory': { id: 'inventory', label: 'Inventory', tab: 'inventory', audience: 'Manager / Owner' },
  'invoices': { id: 'invoices', label: 'Invoices', tab: 'inventory', inventorySubtab: 'invoices', audience: 'Manager / Owner' },
  'orders': { id: 'orders', label: 'Orders', tab: 'inventory', inventorySubtab: 'orders', audience: 'Manager / Owner' },
  'vendors': { id: 'vendors', label: 'Vendors', tab: 'inventory', inventorySubtab: 'vendors', audience: 'Manager / Owner' },
  'menu-intelligence': { id: 'menu-intelligence', label: 'Menu Intelligence', tab: 'menu-intelligence', audience: 'Manager / Owner' },
  'recipes': { id: 'recipes', label: 'Recipes', tab: 'recipes', audience: 'Everyone' },
  'prep': { id: 'prep', label: 'Prep', tab: 'prep', audience: 'Everyone' },
  'tasks': { id: 'tasks', label: 'Tasks', tab: 'prep', audience: 'Everyone' },
  'messages': { id: 'messages', label: 'Messages', tab: 'messages', audience: 'Everyone' },
  'reminders': { id: 'reminders', label: 'Personal Reminders', tab: 'reminders', audience: 'Everyone' },
  'staff-roster': { id: 'staff-roster', label: 'Staff Roster', tab: 'team', audience: 'Manager / Owner' },
  'hr-training': { id: 'hr-training', label: 'HR & Training', tab: 'hr-training', audience: 'Manager / Owner' },
  'maintenance': { id: 'maintenance', label: 'Maintenance', tab: 'maintenance', audience: 'Manager / Owner' },
  'events': { id: 'events', label: 'Events', tab: 'events', audience: 'Everyone' },
  'financials': { id: 'financials', label: 'Financials', tab: 'financials', audience: 'Manager / Owner' },
  'daily-close': { id: 'daily-close', label: 'Daily Close', tab: 'financials', financeSubtab: 'daily-close', audience: 'Manager / Owner' },
  'labor': { id: 'labor', label: 'Labor', tab: 'labor', audience: 'Manager / Owner' },
  'settings': { id: 'settings', label: 'Settings', tab: 'settings', audience: 'Everyone' },
  'back-office': { id: 'back-office', label: 'Back Office', tab: 'back-office', audience: 'Manager / Owner' },
  '86voice': { id: '86voice', label: '86Voice', tab: 'help', audience: 'Everyone', fallbackArticleId: 'voice-open-close' },
});

const CUSTOMER_FEATURES = [
  ['getting-started', 'Getting Started', 'help', 'Everyone', ['first-login', 'navigation-basics', 'install-app']],
  ['today-home', 'Today Home', 'today', 'Everyone', ['today-home-use', 'need-attention']],
  ['manager-brief', 'Manager Brief', 'today', 'Manager / Owner', ['manager-brief-use']],
  ['kitchen-command', 'Kitchen Command Center', 'ops', 'Manager / Owner', ['kitchen-command-use']],
  ['schedule', 'Time Clock & Schedule', 'published', 'Everyone', ['my-schedule-view', 'full-schedule-view', 'request-off-how', 'clock-in-help']],
  ['schedule-builder', 'Schedule Builder', 'schedule', 'Manager / Owner', ['schedule-builder-find', 'schedule-publish', 'custom-shifts-overview', 'custom-shift-save', 'custom-shift-edit-delete', 'custom-shifts-on-phone']],
  ['inventory', 'Inventory', 'inventory', 'Manager / Owner', ['inventory-counts', 'invoice-scan-review', 'orders-vendors']],
  ['menu-intelligence', 'Menu Intelligence', 'menu-intelligence', 'Manager / Owner', ['menu-intelligence-guide']],
  ['recipes', 'Recipes', 'recipes', 'Everyone', ['recipes-use']],
  ['prep-tasks', 'Prep & Tasks', 'prep', 'Everyone', ['prep-use', 'tasks-use', 'labels-use']],
  ['financials', 'Financials', 'financials', 'Manager / Owner', ['financial-center-use', 'daily-close-use', 'labor-timesheets']],
  ['staff-roster', 'Staff Roster', 'team', 'Manager / Owner', ['staff-roster-use', 'roles-permissions']],
  ['hr-training', 'HR & Training', 'hr-training', 'Manager / Owner', ['hr-training-use']],
  ['messages', 'Messages', 'messages', 'Everyone', ['message-board-use', 'personal-reminders-use']],
  ['maintenance', 'Maintenance', 'maintenance', 'Manager / Owner', ['maintenance-use']],
  ['events', 'Events', 'events', 'Everyone', ['events-use']],
  ['voice', '86Voice', 'help', 'Everyone', ['voice-open-close', 'voice-not-hearing']],
  ['back-office', 'Back Office', 'back-office', 'Manager / Owner', ['back-office-use']],
  ['settings', 'Settings', 'settings', 'Everyone', ['settings-use', 'personal-preferences']],
  ['troubleshooting', 'Troubleshooting', 'help', 'Everyone', ['schedule-publish', 'schedule-visibility', 'app-icon-gray', 'invoice-scan-failed', 'clock-in-help', 'cannot-request-off']],
].map(([featureId, label, primaryRoute, audience, mappedArticleIds]) => ({ featureId, label, primaryRoute, audience, mappedArticleIds, troubleshootingCoverage: mappedArticleIds.filter(id => /cannot|failed|wrong|not|trouble|icon|scan|publish|see/.test(id)), deepLinkCoverage: Object.keys(HELP_DEEP_LINKS).filter(id => id === featureId || mappedArticleIds.join(' ').includes(id)), lastVerifiedVersion: CUSTOMER_HELP_VERSION, coverageStatus: mappedArticleIds.length ? 'fully_documented' : 'missing' }));

function article(id, title, subjectId, subtopicId, audience, summary, commonQuestions, keywords, sections, troubleshooting = [], relatedArticleIds = [], deepLinkIds = [], externalLinks = []) {
  return { id, title, subjectId, subtopicId, audience, summary, commonQuestions, keywords, synonyms: keywords, sections, troubleshooting, relatedArticleIds, deepLinkIds, externalLinks, lastVerifiedVersion: CUSTOMER_HELP_VERSION };
}

const ARTICLES = [
  article('first-login', 'How do I log in the first time?', 'getting-started', 'first-login', AUDIENCE.EVERYONE, 'Use the email or username your manager gave you, then unlock the app with your password.', ['How do I log in?', 'What do I do on first login?'], ['login','first login','unlock system','email','username','password'], [
    { title: 'Short answer', body: ['Open 86 Chaos, type your Email Address, type your Password, then choose Unlock System.'] },
    { title: 'Who can use this', body: ['Everyone with an active restaurant account can log in.'] },
    { title: 'How to do it', steps: ['Open the 86 Chaos app or website.', 'Type your Email Address.', 'Type your Password.', 'Choose Unlock System.', 'Pick your workspace if you are asked.'] },
    { title: 'If it does not work', body: ['Check spelling first. If you still cannot get in, use Forgot Password or Username or ask a manager to check your staff account.'] },
  ], ['Check your email spelling.', 'Ask a manager to confirm your account is active.'], ['password-reset'], ['settings']),
  article('navigation-basics', 'Where do I find things in 86 Chaos?', 'getting-started', 'navigation', AUDIENCE.EVERYONE, 'Use the main menu and search. Common work is grouped by the job you are trying to do.', ['Where is Schedule Builder?', 'Where is Inventory?', 'Where is Request Off?'], ['navigation','menu','find','where is','tab','search'], [
    { title: 'Short answer', body: ['Open the menu, then choose the area that matches your work.'] },
    { title: 'Common places', steps: ['Use Today for daily notes and Need Attention.', 'Use Time Clock & Schedule for shifts, clocking in, Request Off, and Availability.', 'Use Inventory for counts, invoices, vendors, and orders.', 'Use Prep & Tasks for prep lists and checklists.', 'Use Help when you are not sure where to start.'] },
  ], [], ['schedule-builder-find','inventory-counts','request-off-how'], ['today-home','schedule-builder','inventory','prep']),
  article('install-app', 'How do I install 86 Chaos on my device?', 'getting-started', 'installing', AUDIENCE.EVERYONE, 'Install the app from your browser menu so it opens like a normal app.', ['How do I install the app?', 'How do I add 86 Chaos to my home screen?'], ['install','pwa','home screen','edge','chrome','safari','samsung internet','app icon'], [
    { title: 'Short answer', body: ['Open 86 Chaos in a supported browser and use the browser install or Add to Home Screen option.'] },
    { title: 'Windows Edge or Chrome', steps: ['Open 86 Chaos.', 'Open the browser menu.', 'Choose Install app when it appears.', 'Pin it to the taskbar if you want quick access.'] },
    { title: 'Android', steps: ['Open 86 Chaos in Chrome or Samsung Internet.', 'Open the browser menu.', 'Choose Install app or Add page to Home screen.', 'Open it from the new app icon.'] },
    { title: 'iPhone or iPad', steps: ['Open 86 Chaos in Safari.', 'Tap Share.', 'Tap Add to Home Screen.', 'Tap Add.'] },
    { title: 'Wrong icon after reinstall', body: ['Your device may keep an old cached icon. Remove the installed app, close the browser, then install it again after the new icon update is live.'] },
  ], ['If the icon looks gray, remove the installed app and install it again after the update.', 'Firefox support can vary by device. Use Chrome, Edge, Samsung Internet, or Safari if installation is not offered.'], ['app-icon-gray','reinstall-pwa'], [] , [{ id:'microsoft-edge-install', label:'Microsoft Edge install help', url:'https://support.microsoft.com/' }, { id:'apple-add-home-screen', label:'Apple Add to Home Screen help', url:'https://support.apple.com/' }]),
  article('password-reset', 'How do I reset my password?', 'getting-started', 'passwords', AUDIENCE.EVERYONE, 'Use Forgot Password or Username from the login screen.', ['I forgot my password', 'How do I reset my username?'], ['forgot password','reset','username','email','login'], [
    { title: 'Short answer', body: ['On the login screen, choose Forgot Password or Username.'] },
    { title: 'How to do it', steps: ['Type your Email Address if you know it.', 'Choose Forgot Password or Username.', 'Check your email for reset instructions.', 'Ask a manager if you no longer have access to that email.'] },
  ], ['Check spam or junk mail.', 'Ask a manager to confirm your email address.'], ['first-login']),
  article('personal-preferences', 'How do I change my personal settings?', 'getting-started', 'preferences', AUDIENCE.EVERYONE, 'Use Settings for display, time, and personal preferences that are available to your role.', ['How do I change time format?', 'How do I change my theme?'], ['preferences','settings','time format','accent','schedule style'], [
    { title: 'Short answer', body: ['Open [[Settings|settings]] and look for Personal Settings.'] },
    { title: 'What you can change', steps: ['Choose the time format that is easiest to read.', 'Choose schedule display options when your role allows it.', 'Adjust personal display preferences.'] },
  ], [], ['settings-use'], ['settings']),
  article('today-home-use', 'What is Today Home?', 'today-kitchen', 'today-home', AUDIENCE.EVERYONE, 'Today Home shows the most important things for the current day.', ['What is Today?', 'What is Manager Brief?'], ['today','home','manager brief','daily','need attention'], [
    { title: 'Short answer', body: ['Today Home is your daily starting point. It shows reminders, shifts, messages, and work that needs attention.'] },
    { title: 'What you should see', steps: ['Open [[Today Home|today-home]].', 'Review Need Attention first.', 'Check messages, tasks, and today’s schedule.'] },
  ], [], ['need-attention'], ['today-home']),
  article('manager-brief-use', 'How do managers use Manager Brief?', 'today-kitchen', 'manager-brief', AUDIENCE.MANAGER_OWNER, 'Manager Brief gives managers the short list of what needs attention today.', ['What should managers check first?', 'What is Manager Brief?'], ['manager brief','need attention','manager','owner','daily brief'], [
    { title: 'Short answer', body: ['Open Today and start with the cards that say Need Attention.'] },
    { title: 'How to use it', steps: ['Open [[Today Home|today-home]].', 'Read each Need Attention card.', 'Open the linked area if the card needs action.', 'Handle schedule, inventory, maintenance, and message issues before service.'] },
  ], [], ['today-home-use'], ['today-home']),
  article('kitchen-command-use', 'What is Kitchen Command Center?', 'today-kitchen', 'kitchen-command', AUDIENCE.MANAGER_OWNER, 'Kitchen Command Center helps the shift see kitchen priorities fast.', ['What is Kitchen Command?', 'Where do I see kitchen issues?'], ['kitchen command','need attention','prep','86 alerts','service'], [
    { title: 'Short answer', body: ['Kitchen Command Center is a live view of kitchen work, alerts, and items needing attention.'] },
    { title: 'How to use it', steps: ['Open [[Kitchen Command Center|kitchen-command]].', 'Check 86 alerts.', 'Check prep and tasks.', 'Handle urgent maintenance or event notes.'] },
  ], [], ['restaurant-86-alerts-use','prep-use'], ['kitchen-command']),
  article('need-attention', 'What does Need Attention mean?', 'today-kitchen', 'need-attention', AUDIENCE.EVERYONE, 'Need Attention means the app found something worth checking.', ['What is Need Attention?', 'Why is there a warning?'], ['need attention','warning','card','issue','problem'], [
    { title: 'Short answer', body: ['It is a review card, not always an emergency. Open it and check what changed.'] },
    { title: 'What to do', steps: ['Read the card title.', 'Open the related page.', 'Fix the issue if you have permission.', 'Ask a manager if the action is locked.'] },
  ], [], [], []),
  article('restaurant-86-alerts-use', 'How do 86 alerts work?', 'today-kitchen', 'restaurant-86-alerts', AUDIENCE.EVERYONE, '86 alerts tell the team that something is out, limited, or important for service.', ['How do I 86 an item?', 'What are 86 alerts?'], ['86 alert','out of','limited','service','message'], [
    { title: 'Short answer', body: ['Use an 86 alert when the team needs to know something is out or limited.'] },
    { title: 'How to use it', steps: ['Open the kitchen or alert area your role can use.', 'Add the item name.', 'Add a short note if needed.', 'Clear the alert when the item is available again.'] },
  ], [], ['voice-commands-use'], ['86voice']),
  article('my-schedule-view', 'How do I see my schedule?', 'schedule-time-clock', 'my-schedule', AUDIENCE.EVERYONE, 'My Schedule shows your published shifts.', ['How do I see my schedule?', 'Where are my shifts?'], ['my schedule','shift','published','see my shifts'], [
    { title: 'Short answer', body: ['Open [[My Schedule|my-schedule]] to see your published shifts.'] },
    { title: 'What you should see', steps: ['Open Time Clock & Schedule.', 'Choose My Schedule.', 'Look for your shifts by date.', 'Use Full Schedule if your manager allows you to see more.'] },
  ], ['If a shift is missing, ask a manager to confirm the schedule was published and that the shift is assigned to the right employee.'], ['schedule-visibility'], ['my-schedule','full-schedule']),
  article('full-schedule-view', 'How do I use Full Schedule?', 'schedule-time-clock', 'full-schedule', AUDIENCE.EVERYONE, 'Full Schedule shows the restaurant schedule when your role allows it.', ['Where is Full Schedule?', 'Can I see everyone’s schedule?'], ['full schedule','all shifts','restaurant schedule'], [
    { title: 'Short answer', body: ['Open [[Full Schedule|full-schedule]] to see the shared schedule your role can view.'] },
    { title: 'If it does not show everything', body: ['Your role may only allow your own shifts. Ask a manager if you need more visibility.'] },
  ], [], ['my-schedule-view'], ['full-schedule']),
  article('month-view-use', 'How do I use Month View?', 'schedule-time-clock', 'month-view', AUDIENCE.EVERYONE, 'Month View shows shifts and events across the month.', ['Where is Month View?', 'How do I print a monthly schedule?'], ['month view','calendar','print schedule','monthly'], [
    { title: 'Short answer', body: ['Open [[Month View|month-view]] to scan a full month.'] },
    { title: 'Tips', steps: ['Use it for big-picture schedule checks.', 'Print only after the manager publishes the schedule.', 'Check crowded days carefully.'] },
  ], [], ['schedule-publish'], ['month-view']),
  article('clock-in-help', 'Why can’t I clock in?', 'schedule-time-clock', 'time-clock', AUDIENCE.EVERYONE, 'Clock-in problems usually mean the schedule, account, browser, or location setting needs review.', ['Why can’t I clock in?', 'Clock in button missing'], ['clock in','clock out','time clock','cannot clock in','geofence','location'], [
    { title: 'Short answer', body: ['Open [[Time Clock|time-clock]]. If the button is missing or disabled, check the message shown on the screen.'] },
    { title: 'Try this', steps: ['Make sure you are signed into the right workspace.', 'Refresh the app once.', 'Check that your account is active.', 'Allow location if your restaurant requires it.', 'Ask a manager to check your scheduled shift or time-clock settings.'] },
  ], ['A manager may need to fix a missed punch.', 'Do not create a second account to clock in.'], ['missed-punch-help'], ['time-clock']),
  article('missed-punch-help', 'How do missed punches get fixed?', 'schedule-time-clock', 'missed-punches', AUDIENCE.EVERYONE, 'A manager can correct missed punches when a clock-in or clock-out was missed.', ['I forgot to clock out', 'I missed a punch'], ['missed punch','forgot clock out','forgot clock in','manager correction'], [
    { title: 'Short answer', body: ['Tell a manager the date, time, and reason.'] },
    { title: 'What the manager does', steps: ['Open Labor or Time Clock review.', 'Find the employee and date.', 'Add or correct the punch.', 'Save the note for review.'] },
  ], [], ['clock-in-help'], ['labor']),
  article('request-off-how', 'How do I request a day off?', 'schedule-time-clock', 'request-off', AUDIENCE.EVERYONE, 'Request Off lets you ask for a day off before the schedule is finalized.', ['How do I request off?', 'How do I ask for a day off?'], ['request off','day off','time off','availability','vacation'], [
    { title: 'Short answer', body: ['Open [[Request Off|request-off]], choose the date, then submit your request.'] },
    { title: 'How to do it', steps: ['Open Time Clock & Schedule.', 'Choose Request Off.', 'Tap the date you need off.', 'Read any warning that appears.', 'Choose Continue only if you still want to request that day.', 'Submit the request.'] },
    { title: 'What you should see', body: ['Your request should show as pending until a manager reviews it.'] },
  ], ['If someone else already requested the same date, the app warns you before adding the date.', 'A request is not the same as an approved day off until a manager approves it.'], ['request-off-conflicts','cannot-request-off'], ['request-off']),
  article('request-off-conflicts', 'Why did I get a Request Off warning?', 'schedule-time-clock', 'request-off', AUDIENCE.EVERYONE, 'The warning means another employee already has an active request for that date.', ['Why does Request Off warn me?', 'Someone else requested this date'], ['request off warning','conflict','already requested','day may not be available'], [
    { title: 'Short answer', body: ['The day may not be available because someone else has already requested it.'] },
    { title: 'What to do', steps: ['Read the warning.', 'Choose Cancel if you do not want to request that day.', 'Choose Continue if you still want to ask.', 'Wait for a manager to approve or deny the request.'] },
    { title: 'Manager workflow', body: ['Managers can filter Request Off by employee, then approve or archive only the visible filtered requests in bulk. Hidden requests are not included.'] },
  ], ['The warning does not mean your request is blocked. It helps you avoid surprises.'], ['request-off-how'], ['request-off']),
  article('availability-use', 'How do I set my availability?', 'schedule-time-clock', 'availability', AUDIENCE.EVERYONE, 'Availability tells managers when you usually can or cannot work.', ['How do I set availability?', 'Why can’t I work that day?'], ['availability','cannot work','preferred time','schedule'], [
    { title: 'Short answer', body: ['Open [[Availability|availability]] and save the days or times you can usually work.'] },
    { title: 'Important', body: ['Availability helps managers build the schedule. It is not the same as an approved day off. Use Request Off for specific dates.'] },
  ], [], ['request-off-how'], ['availability']),
  article('schedule-builder-find', 'Where is Schedule Builder?', 'schedule-time-clock', 'schedule-builder', AUDIENCE.MANAGER_OWNER, 'Schedule Builder lives inside Time Clock & Schedule for managers and owners.', ['Where is Schedule Builder?', 'How do I build a schedule?'], ['schedule builder','build schedule','smart fill','coverage target','templates'], [
    { title: 'Short answer', body: ['Managers and owners can open [[Schedule Builder|schedule-builder]] from Time Clock & Schedule.'] },
    { title: 'How to open it', steps: ['Open Time Clock & Schedule.', 'Choose Schedule Builder.', 'Pick the week or month you are working on.', 'Add, copy, or edit shifts.'] },
    { title: 'Staff note', body: ['If you are staff, you may not have access to Schedule Builder. Ask a manager to check it.'] },
    { title: 'Warnings', body: ['Schedule Builder warnings can flag requested-off conflicts, missing coverage, or over-coverage against targets. Dismissing a warning only hides that warning for your view; it does not delete shifts, requests, or targets.'] },
  ], ['If an employee is missing, check that the staff record is active and assigned to the right workspace.'], ['employee-missing-schedule-builder','schedule-publish'], ['schedule-builder']),
  article('schedule-publish', 'Why aren’t my schedules publishing?', 'schedule-time-clock', 'schedule-publishing', AUDIENCE.MANAGER_OWNER, 'Schedules usually stay unpublished when the week has not been selected, changes were made after the last publish, or the wrong schedule period is open.', ['Why aren\'t my schedules publishing?', 'Schedule not publishing', 'How do I publish selected weeks?'], ['schedule publish','publishing','selected weeks','draft shifts','live shifts','employee cannot see'], [
    { title: 'Short answer', body: ['Schedules usually stay unpublished when the correct week is not selected, the shifts are still drafts, or you are looking at a different schedule period.'] },
    { title: 'Try this', steps: ['Open [[Schedule Builder|schedule-builder]].', 'Check that you are on the right week or month.', 'Choose Publish.', 'Select the week or weeks you want.', 'Confirm the publish action.', 'Open My Schedule or Full Schedule to verify the shifts appear.'] },
    { title: 'What staff should see', body: ['Employees see published shifts that are assigned to their correct employee account.'] },
  ], ['If one employee cannot see a shift, check the employee identity on the shift.', 'If a whole week is missing, check selected-week publishing.'], ['schedule-visibility','schedule-visibility'], ['schedule-builder','my-schedule','full-schedule']),
  article('schedule-visibility', 'Why can’t an employee see a shift?', 'schedule-time-clock', 'schedule-visibility', AUDIENCE.MANAGER_OWNER, 'A missing shift is usually unpublished, assigned to the wrong employee, or outside the view being checked.', ['Why can\'t Allen see his schedule?', 'Employee can\'t see schedule'], ['employee cannot see schedule','shift missing','published','wrong employee','visibility'], [
    { title: 'Short answer', body: ['Check publish status, date range, and the employee assigned to the shift.'] },
    { title: 'Try this', steps: ['Open [[Schedule Builder|schedule-builder]].', 'Find the shift.', 'Confirm the shift is published.', 'Confirm the employee name and account match the real staff member.', 'Open [[My Schedule|my-schedule]] or [[Full Schedule|full-schedule]] to verify.'] },
  ], ['Deleted or old shifts should not reappear. Report a problem if they do.'], ['schedule-publish'], ['schedule-builder','my-schedule','full-schedule']),
  article('pay-period-hours-use', 'Why do Week 1 hours include last month?', 'schedule-time-clock', 'pay-period-hours', AUDIENCE.MANAGER_OWNER, 'Week 1 can include days from the previous month when the pay-period week crosses a month line.', ['Why are week one hours wrong?', 'Why does August count July hours?'], ['week 1','hours','pay period','previous month','scheduled hours'], [
    { title: 'Short answer', body: ['Scheduled hours follow the full pay-period week, not only the visible calendar month.'] },
    { title: 'Example', body: ['If Week 1 runs from July 27 to August 2, the tracker may count both July and August days for that week.'] },
  ], [], ['schedule-publish'], ['schedule-builder']),
  article('employee-missing-schedule-builder', 'Why is an employee missing from Schedule Builder?', 'schedule-time-clock', 'schedule-builder', AUDIENCE.MANAGER_OWNER, 'An employee may be inactive, in the wrong workspace, or not saved as a staff member.', ['Employee missing from Schedule Builder', 'Allen missing from schedule builder'], ['employee missing','schedule builder','staff roster','active employee'], [
    { title: 'Short answer', body: ['Check Staff Roster first.'] },
    { title: 'Try this', steps: ['Open [[Staff Roster|staff-roster]].', 'Find the employee.', 'Make sure the employee is active.', 'Make sure the employee belongs to the correct workspace.', 'Return to [[Schedule Builder|schedule-builder]] and refresh.'] },
  ], [], ['staff-roster-use'], ['staff-roster','schedule-builder']),
  article('inventory-counts', 'How do inventory counts work?', 'inventory-purchasing', 'inventory-counts', AUDIENCE.MANAGER_OWNER, 'Inventory counts help you see what is on hand and what may need ordering.', ['How do I count inventory?', 'How do I update stock?'], ['inventory count','stock','on hand','par'], [
    { title: 'Short answer', body: ['Open [[Inventory|inventory]] and update counts for the items you track.'] },
    { title: 'How to use it', steps: ['Open Inventory.', 'Find the item.', 'Enter the count.', 'Save the change.', 'Review low items against par levels.'] },
  ], [], ['orders-vendors'], ['inventory']),
  article('orders-vendors', 'How do I use vendors and orders?', 'inventory-purchasing', 'orders', AUDIENCE.MANAGER_OWNER, 'Vendors and orders help managers organize purchasing.', ['How do I make an order?', 'Where are vendors?'], ['orders','vendors','purchasing','par'], [
    { title: 'Short answer', body: ['Open [[Orders|orders]] or [[Vendors|vendors]] from Inventory.'] },
    { title: 'How to use it', steps: ['Review low-stock items.', 'Choose or create the vendor.', 'Build the order.', 'Review it before sending or printing.'] },
  ], [], ['inventory-counts'], ['orders','vendors']),
  article('invoice-scan-review', 'How do I scan and review an invoice?', 'inventory-purchasing', 'invoice-scanning', AUDIENCE.MANAGER_OWNER, 'Invoice scanning reads a picture or PDF, but a manager still reviews the results before saving.', ['Why did my invoice scan fail?', 'How do I scan invoices?'], ['invoice scan','invoice review','vendor','price change','failed scan'], [
    { title: 'Short answer', body: ['Open [[Invoices|invoices]], upload the invoice, then review every row before approval.'] },
    { title: 'How to do it', steps: ['Open Inventory.', 'Choose Invoices.', 'Upload a clear image or PDF.', 'Wait for the scan to finish.', 'Review vendor, date, item names, quantities, pack sizes, and prices.', 'Approve only after the rows look right.'] },
  ], ['If the scan fails, try a clearer photo or smaller file.', 'Do not approve rows you have not checked.'], ['invoice-scan-failed'], ['invoices']),
  article('invoice-scan-failed', 'Why didn’t my invoice scan?', 'troubleshooting', 'invoice-failed', AUDIENCE.MANAGER_OWNER, 'Invoice scans fail most often because the image is blurry, the file is too large, or the scanner cannot read the layout.', ['Invoice didn\'t scan', 'Why did my invoice scan fail?'], ['invoice didnt scan','invoice didn\'t scan','invoice failed','scan failed','blurry','large file','timeout'], [
    { title: 'Short answer', body: ['Try one clear page first.'] },
    { title: 'Try this', steps: ['Use a flat, well-lit photo.', 'Crop out the table or counter.', 'Upload fewer pages.', 'Check that the file is not too large.', 'Try again once before reporting the problem.'] },
  ], ['If it still fails, use Report a Problem and include what type of file you uploaded.'], ['invoice-scan-review'], ['invoices']),
  article('price-changes-use', 'How do price change warnings work?', 'inventory-purchasing', 'price-changes', AUDIENCE.MANAGER_OWNER, 'Price change warnings help you spot vendor cost jumps before they surprise you.', ['What is a price jump?', 'Why did a price warning show?'], ['price change','price jump','vendor cost','invoice'], [
    { title: 'Short answer', body: ['The app compares recent invoice prices and flags items that changed enough to review.'] },
    { title: 'What to do', steps: ['Open the price warning.', 'Compare old and new prices.', 'Check pack size and unit first.', 'Update menu or order decisions if needed.'] },
  ], [], ['invoice-scan-review'], ['invoices']),
  article('menu-intelligence-guide', 'How does Menu Intelligence work?', 'inventory-purchasing', 'menu-intelligence', AUDIENCE.MANAGER_OWNER, 'Menu Intelligence links menu items to inventory so 86 alerts and cost checks make more sense.', ['What is Menu Intelligence?', 'How do I link menu items?'], ['menu intelligence','menu scan','menu impact','ingredient linking','86 menu impact'], [
    { title: 'Short answer', body: ['Upload or review menu items, then approve ingredient links to real inventory items.'] },
    { title: 'How to use it', steps: ['Open [[Menu Intelligence|menu-intelligence]].', 'Review scanned menu items.', 'Match ingredients to inventory items.', 'Approve only confident links.', 'Use the links to understand 86 impact and food cost.'] },
  ], ['If 86 impact is blank, menu ingredient links may not be set up yet.'], ['restaurant-86-alerts-use'], ['menu-intelligence']),
  article('burn-log-use', 'How do I use the Burn Log?', 'inventory-purchasing', 'burn-log', AUDIENCE.MANAGER_OWNER, 'The Burn Log records waste, spills, over-prep, or unusable product.', ['What is Burn Log?', 'How do I track waste?'], ['burn log','waste','spoilage','throw away'], [
    { title: 'Short answer', body: ['Use Burn Log when product is wasted or removed from use.'] },
    { title: 'How to use it', steps: ['Open Inventory.', 'Choose Burn Log if available.', 'Pick the item.', 'Enter the amount.', 'Add a short reason.', 'Save it for review.'] },
  ], [], ['inventory-counts'], ['inventory']),
  article('recipes-use', 'How do I use the Recipe Book?', 'recipes-prep-tasks', 'recipes', AUDIENCE.EVERYONE, 'The Recipe Book keeps restaurant recipes easy to find during prep or service.', ['Where are recipes?', 'How do I find a recipe?'], ['recipes','recipe book','search recipe','cook'], [
    { title: 'Short answer', body: ['Open [[Recipes|recipes]] and search the recipe name.'] },
    { title: 'Tips', steps: ['Use search for the item name.', 'Check portion, prep, and notes.', 'Ask a manager before changing a recipe.'] },
  ], [], ['voice-commands-use'], ['recipes']),
  article('prep-use', 'How do I use Prep?', 'recipes-prep-tasks', 'prep', AUDIENCE.EVERYONE, 'Prep shows what needs to be made before or during service.', ['How do I use prep?', 'How do I mark prep done?'], ['prep','prep list','mark done','kitchen'], [
    { title: 'Short answer', body: ['Open [[Prep|prep]], make the item, then mark it done when finished.'] },
    { title: 'How to use it', steps: ['Open Prep & Tasks.', 'Find your prep item.', 'Make the needed amount.', 'Mark it done when complete.'] },
  ], [], ['tasks-use','voice-commands-use'], ['prep']),
  article('tasks-use', 'How do I use tasks and checklists?', 'recipes-prep-tasks', 'tasks', AUDIENCE.EVERYONE, 'Tasks and checklists help the team remember daily, weekly, and monthly work.', ['Where are tasks?', 'How do I mark a task done?'], ['tasks','checklists','daily weekly monthly','mark done'], [
    { title: 'Short answer', body: ['Open [[Tasks|tasks]], do the task, then mark it done.'] },
    { title: 'Manager note', body: ['Managers can add or adjust task lists when the restaurant changes routines.'] },
  ], [], ['prep-use'], ['tasks']),
  article('labels-use', 'How do labels work?', 'recipes-prep-tasks', 'labels', AUDIENCE.EVERYONE, 'Labels help prep items show dates clearly.', ['How do prep labels work?', 'Where do I print labels?'], ['labels','prep labels','date label','print'], [
    { title: 'Short answer', body: ['Use labels when your restaurant wants printed prep dates or item names.'] },
    { title: 'How to use it', steps: ['Open the prep or label area.', 'Choose the items.', 'Print the labels.', 'Place labels according to restaurant rules.'] },
  ], [], ['prep-use'], ['prep']),
  article('financial-center-use', 'What is Financial Center?', 'financials', 'daily-close', AUDIENCE.MANAGER_OWNER, 'Financial Center gives operational snapshots for sales, labor, tips, costs, and reports.', ['What is Financial Center?', 'Is this accounting advice?'], ['financial center','sales','labor','tips','cogs','prime cost','reports'], [
    { title: 'Short answer', body: ['Financial Center helps managers and owners review restaurant operations. It is not tax or accounting advice.'] },
    { title: 'What it includes', steps: ['Daily Close.', 'Sales review.', 'Labor and timesheets.', 'Tips.', 'COGS and prime cost.', 'Expenses.', 'Reports and exports.'] },
  ], ['Ask your accountant for tax, payroll, or legal accounting decisions.'], ['daily-close-use','labor-timesheets'], ['financials']),
  article('daily-close-use', 'How do I complete Daily Close?', 'financials', 'daily-close', AUDIENCE.MANAGER_OWNER, 'Daily Close records sales, cash, card totals, deposits, and manager notes.', ['How do I close the day?', 'What is Daily Close?'], ['daily close','sales','deposit','cash variance'], [
    { title: 'Short answer', body: ['Open [[Daily Close|daily-close]], enter the day’s totals, review the numbers, then save.'] },
    { title: 'How to do it', steps: ['Choose the business date.', 'Enter sales and payment totals.', 'Enter deposit or cash notes.', 'Review differences.', 'Save the close.'] },
  ], [], ['financial-center-use'], ['daily-close']),
  article('labor-timesheets', 'How do labor and timesheets work?', 'financials', 'labor', AUDIENCE.MANAGER_OWNER, 'Labor tools help managers review time punches, hours, tips, and payroll-ready issues.', ['Where are timesheets?', 'How do I review labor?'], ['labor','timesheets','payroll','tips','missed punches'], [
    { title: 'Short answer', body: ['Open [[Labor|labor]] to review punches, hours, tips, and exceptions.'] },
    { title: 'Important', body: ['Use this for operational review. Follow your payroll provider and local rules for final payroll decisions.'] },
  ], ['Fix missed punches before exporting.'], ['missed-punch-help'], ['labor']),
  article('staff-roster-use', 'How do I use Staff Roster?', 'staff-training', 'staff-roster', AUDIENCE.MANAGER_OWNER, 'Staff Roster is where managers maintain active employees for the restaurant.', ['How do I add employees?', 'Where is Staff Roster?'], ['staff roster','employees','add staff','active employee'], [
    { title: 'Short answer', body: ['Open [[Staff Roster|staff-roster]] to add or edit restaurant staff.'] },
    { title: 'How to use it', steps: ['Open Staff Roster.', 'Add the employee or open their record.', 'Check name, role, status, and contact details.', 'Save changes.'] },
  ], [], ['roles-permissions'], ['staff-roster']),
  article('roles-permissions', 'What do roles and permissions mean?', 'staff-training', 'roles-permissions', AUDIENCE.MANAGER_OWNER, 'Restaurant roles decide what each employee can see or do inside the customer app.', ['What can staff see?', 'How do permissions work?'], ['roles','permissions','staff','manager','owner'], [
    { title: 'Short answer', body: ['Give each person only the access they need for restaurant work.'] },
    { title: 'Examples', steps: ['Staff usually see their own schedule, tasks, recipes, messages, and Request Off.', 'Managers may build schedules, review punches, manage inventory, and approve requests.', 'Owners may see financial and workspace settings.'] },
  ], ['This Help Center does not include internal platform administrator instructions.'], ['staff-roster-use'], ['staff-roster']),
  article('hr-training-use', 'How do HR & Training tools work?', 'staff-training', 'hr-training', AUDIENCE.MANAGER_OWNER, 'HR & Training helps organize training records and certifications.', ['Where are training records?', 'How do I track certifications?'], ['hr training','training','certifications','manuals'], [
    { title: 'Short answer', body: ['Open [[HR & Training|hr-training]] to review employee training items and certifications.'] },
    { title: 'Important', body: ['Follow your restaurant policy and local employment requirements. 86 Chaos helps organize records; it does not replace legal advice.'] },
  ], [], ['certifications-use'], ['hr-training']),
  article('certifications-use', 'How do certifications work?', 'staff-training', 'certifications', AUDIENCE.MANAGER_OWNER, 'Certification tracking helps managers remember training dates and renewals.', ['How do I track ServSafe?', 'How do I track certifications?'], ['certifications','training','renewal','food safety'], [
    { title: 'Short answer', body: ['Save certification details in HR & Training if your restaurant uses that feature.'] },
    { title: 'What to track', steps: ['Employee name.', 'Certification type.', 'Issue date.', 'Expiration date.', 'Notes or attachments if supported.'] },
  ], [], ['hr-training-use'], ['hr-training']),
  article('message-board-use', 'How do I use the Message Board?', 'messages-notifications', 'message-board', AUDIENCE.EVERYONE, 'The Message Board keeps team messages in one place.', ['Where are messages?', 'How do I post a message?'], ['message board','messages','team message'], [
    { title: 'Short answer', body: ['Open [[Messages|messages]] to read team messages.'] },
    { title: 'Posting', body: ['If your role allows posting, write a clear message and save it. Do not include private HR or password information.'] },
  ], [], ['push-notifications-help'], ['messages']),
  article('personal-reminders-use', 'How do Personal Reminders work?', 'messages-notifications', 'personal-reminders', AUDIENCE.EVERYONE, 'Personal Reminders help you remember your own work. Shared reminders show only to people included in the reminder.', ['Where are reminders?', 'How do shared reminders work?'], ['personal reminders','shared reminders','remind me'], [
    { title: 'Short answer', body: ['Open [[Personal Reminders|reminders]] to see reminders that include you.'] },
    { title: 'Shared reminders', body: ['A shared reminder appears only for the people selected on the reminder.'] },
  ], ['If a reminder is missing, check the date and whether you were included.'], ['push-notifications-help'], ['reminders']),
  article('push-notifications-help', 'Why are notifications not arriving?', 'messages-notifications', 'push-notifications', AUDIENCE.EVERYONE, 'Notifications depend on app settings, browser permission, device settings, and your restaurant settings.', ['Why am I not getting notifications?', 'Push not working'], ['notifications','push','browser permission','device'], [
    { title: 'Short answer', body: ['Make sure notifications are allowed in both the browser and device settings.'] },
    { title: 'Try this', steps: ['Open Settings in 86 Chaos.', 'Check notification preferences.', 'Check your browser site permissions.', 'Check your phone or computer notification settings.', 'Ask a manager to send a test if available.'] },
  ], [], ['settings-use'], ['settings']),
  article('maintenance-use', 'How do I use Maintenance?', 'maintenance-events', 'maintenance', AUDIENCE.MANAGER_OWNER, 'Maintenance tracks repairs, equipment problems, and preventive work.', ['Where do I track repairs?', 'How do I add maintenance?'], ['maintenance','repair','equipment','preventive'], [
    { title: 'Short answer', body: ['Open [[Maintenance|maintenance]] and add a record for the equipment or task.'] },
    { title: 'How to use it', steps: ['Open Maintenance.', 'Add the issue or task.', 'Set priority if needed.', 'Save updates when work is done.'] },
  ], [], ['events-use'], ['maintenance']),
  article('events-use', 'How do I use the Event Calendar?', 'maintenance-events', 'events', AUDIENCE.EVERYONE, 'Events help the team see catering, parties, staffing notes, and other date-based work.', ['Where are events?', 'How do I add an event?'], ['event calendar','events','staffing','party','catering'], [
    { title: 'Short answer', body: ['Open [[Events|events]] to view restaurant events.'] },
    { title: 'Manager note', body: ['Managers can add event details and staffing notes when their role allows it.'] },
  ], [], ['event-reminders-use'], ['events']),
  article('event-reminders-use', 'How do event reminders work?', 'maintenance-events', 'event-reminders', AUDIENCE.EVERYONE, 'Event reminders help the team prepare before important dates.', ['Can events remind me?', 'How do event reminders work?'], ['event reminders','events','notifications'], [
    { title: 'Short answer', body: ['When event reminders are enabled, the app can show reminders before the event.'] },
  ], [], ['events-use'], ['events']),

  article('custom-shifts-overview', 'What are Custom Shifts?', 'schedule-time-clock', 'schedule-builder', AUDIENCE.MANAGER_OWNER, 'Custom Shifts are saved shift presets for one restaurant. They help managers add the same kind of shift without typing the times every time.', ['What are Custom Shifts?', 'Are custom shifts shared?', 'Where did my saved shifts go?'], ['custom shifts','saved shifts','shift preset','schedule builder','shared shifts','preset'], [
    { title: 'Short answer', body: ['Custom Shifts are reusable shift buttons inside [[Schedule Builder|schedule-builder]]. They are shared for that restaurant with people who can use Schedule Builder.'] },
    { title: 'Who can use this', body: ['Managers, owners, and other people with Schedule Builder permission can use shared Custom Shifts. Staff who only view their own schedule cannot edit them.'] },
    { title: 'What you should see', body: ['When a Custom Shift is saved for the restaurant, it should appear on desktop, phone, tablet, and any fresh browser session for the same workspace.'] },
  ], ['Make sure you are in the right restaurant workspace.', 'Ask a manager or owner to confirm you have Schedule Builder access.'], ['custom-shift-save','custom-shifts-on-phone'], ['schedule-builder']),
  article('custom-shift-save', 'How do I save a Custom Shift?', 'schedule-time-clock', 'schedule-builder', AUDIENCE.MANAGER_OWNER, 'Save a Custom Shift from Schedule Builder when you want to reuse the same shift name and times.', ['How do I save a shift preset?', 'How do I create a Custom Shift?', 'How do I save Dinner 4p to 10p?'], ['save custom shift','create custom shift','dinner shift','shift preset','schedule builder'], [
    { title: 'Short answer', body: ['Open [[Schedule Builder|schedule-builder]], choose Custom, enter the shift name and times, then save it.'] },
    { title: 'How to do it', steps: ['Open [[Schedule Builder|schedule-builder]].', 'Open the Custom Shift option.', 'Type a clear name like Dinner 4p-10p.', 'Choose the start and end time.', 'Save the Custom Shift.', 'Use the returned list before you leave the page.'] },
    { title: 'What you should see', body: ['After it saves, the shift preset appears in the Custom Shift list for that restaurant.'] },
  ], ['If it says the shift was not saved, wait a moment and try again. Do not assume it synced until the app shows it was saved.'], ['custom-shifts-overview','custom-shift-edit-delete'], ['schedule-builder']),
  article('custom-shift-edit-delete', 'How do I edit or delete a Custom Shift?', 'schedule-time-clock', 'schedule-builder', AUDIENCE.MANAGER_OWNER, 'Editing a Custom Shift changes the reusable preset. It does not change shifts already placed on the schedule.', ['How do I edit a Custom Shift?', 'How do I delete a saved shift?', 'Will deleting a preset delete scheduled shifts?'], ['edit custom shift','delete custom shift','saved shift','preset','schedule builder'], [
    { title: 'Short answer', body: ['Open [[Schedule Builder|schedule-builder]], find the saved Custom Shift, then use Edit or Delete for that exact preset.'] },
    { title: 'How to do it', steps: ['Open [[Schedule Builder|schedule-builder]].', 'Find the exact Custom Shift name.', 'Choose Edit to change the name or times.', 'Choose Delete only when you no longer want the preset.', 'Confirm when the app asks.'] },
    { title: 'What changes', body: ['Only the reusable Custom Shift preset changes. Shifts that were already added to the schedule stay where they are.'] },
  ], ['If you do not see Edit or Delete, you may not have Schedule Builder permission.'], ['custom-shifts-overview','custom-shifts-on-phone'], ['schedule-builder']),
  article('custom-shifts-on-phone', 'Why aren’t my saved Custom Shifts on my phone?', 'schedule-time-clock', 'schedule-builder', AUDIENCE.MANAGER_OWNER, 'Custom Shifts should sync through the restaurant workspace so authorized managers can see them on other devices.', ['Why are saved shifts missing on my phone?', 'Why are custom shifts not on mobile?', 'Are custom shifts shared?', 'Where did my custom shifts go?'], ['custom shifts phone','saved shifts on phone','mobile custom shifts','shared shifts','sync custom shifts','another device'], [
    { title: 'Short answer', body: ['Custom Shifts are shared for the restaurant. Open the same workspace on your phone and refresh [[Schedule Builder|schedule-builder]].'] },
    { title: 'Try this', steps: ['Make sure the phone is signed into the same restaurant workspace.', 'Open [[Schedule Builder|schedule-builder]].', 'Wait for the Custom Shift list to finish loading.', 'Refresh once if the list still looks old.', 'Ask a manager or owner to confirm the shift was saved successfully.'] },
    { title: 'If it still does not show', body: ['The app may be using a last-known list while it reconnects. Do not create duplicates until the shared list loads.'] },
  ], ['A saved Custom Shift is shared only inside the restaurant where it was created.'], ['custom-shifts-overview','custom-shift-save'], ['schedule-builder']),

  article('voice-open-close', 'How do I open and close 86Voice?', 'voice-smart-tools', 'voice-open-close', AUDIENCE.EVERYONE, '86Voice opens from the microphone button and can help with navigation, prep, tasks, reminders, and searches.', ['How do I open 86Voice?', 'How do I close 86Voice?'], ['86voice','voice','microphone','open voice','close voice'], [
    { title: 'Short answer', body: ['Use the microphone button to open 86Voice. Use Close 86Voice panel or Hide 86Voice assistant to close it.'] },
    { title: 'What it can do', steps: ['Open pages.', 'Search Help.', 'Add prep or tasks when allowed.', 'Create reminders when allowed.', 'Look up recipes.'] },
  ], [], ['voice-commands-use','voice-not-hearing'], ['86voice']),
  article('voice-commands-use', 'What can I say to 86Voice?', 'voice-smart-tools', 'voice-commands', AUDIENCE.EVERYONE, 'Use plain restaurant phrases. 86Voice follows the same permissions as the app.', ['What voice commands work?', 'Can I say 86 eggs?'], ['86voice commands','prep commands','task commands','86 alerts','recipe lookup','undo'], [
    { title: 'Short answer', body: ['Say what you want in normal kitchen words.'] },
    { title: 'Examples', steps: ['Open prep.', 'Mark onions done.', 'Add clean fryer wall to tasks.', 'Remind me tomorrow to call the vendor.', 'Show the ranch recipe.', 'Search Help for invoice scanning.'] },
  ], ['If 86Voice is not sure, it should ask you to choose before saving.'], ['voice-not-hearing'], ['86voice','prep','tasks','reminders','recipes']),
  article('voice-not-hearing', 'Why isn’t 86Voice hearing me?', 'troubleshooting', 'voice-troubleshooting', AUDIENCE.EVERYONE, 'Voice problems usually come from microphone permission, browser support, or background noise.', ['Why isn\'t 86Voice hearing me?', 'Voice unavailable'], ['86voice not hearing','microphone','voice unavailable','speech'], [
    { title: 'Short answer', body: ['Check microphone permission first.'] },
    { title: 'Try this', steps: ['Close 86Voice.', 'Check the browser microphone permission.', 'Move away from loud equipment if possible.', 'Open 86Voice again.', 'Type the command if speech is not available on that device.'] },
  ], ['Some browsers do not support speech recognition. You can still type commands when available.'], ['voice-open-close'], ['86voice']),
  article('back-office-use', 'What is Back Office?', 'back-office', 'back-office-overview', AUDIENCE.MANAGER_OWNER, 'Back Office groups owner and manager review tools that are safe for restaurant users.', ['Where is Back Office?', 'What is in Back Office?'], ['back office','owner review','manager tools','reports'], [
    { title: 'Short answer', body: ['Open [[Back Office|back-office]] for restaurant-level review tools.'] },
    { title: 'What it is not', body: ['Back Office is not the internal platform administrator area. Customer Help does not include internal platform instructions.'] },
  ], [], ['financial-center-use','staff-roster-use'], ['back-office','financials','staff-roster']),
  article('settings-use', 'How do Settings work?', 'settings-personalization', 'workspace-settings', AUDIENCE.EVERYONE, 'Settings contains personal options and, for managers or owners, restaurant workspace settings.', ['Where are settings?', 'How do I change settings?'], ['settings','workspace settings','personal settings','time format','schedule display'], [
    { title: 'Short answer', body: ['Open [[Settings|settings]] to change settings available to your role.'] },
    { title: 'Who can change what', body: ['Staff can usually change personal preferences. Managers or owners may change restaurant settings when allowed.'] },
  ], [], ['personal-preferences'], ['settings']),
  article('cannot-request-off', 'Why can’t I request off?', 'troubleshooting', 'cannot-request-off', AUDIENCE.EVERYONE, 'Request Off may be unavailable if your account, date, schedule window, or network needs attention.', ['Cannot request off', 'Request Off unavailable'], ['cannot request off','request off unavailable','time off error'], [
    { title: 'Short answer', body: ['Refresh once, then try Request Off again.'] },
    { title: 'Try this', steps: ['Make sure you are in the right workspace.', 'Open [[Request Off|request-off]].', 'Pick one valid future date.', 'Read any warning.', 'Submit again.', 'Ask a manager if the page still says unavailable.'] },
  ], ['A manager may need to check your staff account.'], ['request-off-how'], ['request-off']),
  article('app-icon-gray', 'Why does my installed app show the wrong icon?', 'troubleshooting', 'wrong-icon', AUDIENCE.EVERYONE, 'Installed apps can hold on to an old cached icon after an update.', ['Why is my app icon gray?', 'Wrong app icon'], ['app icon gray','wrong icon','generic icon','installed app','pwa icon'], [
    { title: 'Short answer', body: ['Remove the installed app, then install it again after the icon update is live.'] },
    { title: 'Try this', steps: ['Open the installed app once and confirm it is 86 Chaos.', 'Remove or uninstall the installed app from your device.', 'Open 86 Chaos in the browser.', 'Install it again from the browser menu.', 'Check the new icon.'] },
  ], ['This does not delete restaurant data. Your data is saved in the app, not in the home-screen icon.'], ['install-app','reinstall-pwa']),
  article('reinstall-pwa', 'How do I safely reinstall the app?', 'troubleshooting', 'reinstall-pwa', AUDIENCE.EVERYONE, 'Removing the installed app shortcut and installing it again is safe for normal users.', ['How do I reinstall 86 Chaos?', 'Can I remove the app icon safely?'], ['reinstall','remove app','install again','home screen'], [
    { title: 'Short answer', body: ['You can remove the installed shortcut and install it again. This does not delete the restaurant workspace.'] },
    { title: 'How to do it', steps: ['Sign out if you can.', 'Remove the installed app from the device.', 'Open the browser version.', 'Install the app again.', 'Sign in.'] },
  ], [], ['install-app','app-icon-gray']),
  article('app-out-of-date', 'Why does the app seem out of date?', 'troubleshooting', 'app-out-of-date', AUDIENCE.EVERYONE, 'A browser can sometimes keep old app files for a little while after an update.', ['App seems old', 'Wrong version'], ['out of date','old app','version','refresh'], [
    { title: 'Short answer', body: ['Refresh the app, then check the version shown on the login or app footer.'] },
    { title: 'Try this', steps: ['Close the app.', 'Open it again.', 'Refresh the browser page if you are using a browser.', 'If the installed app still looks old, reinstall the installed app.'] },
  ], [], ['reinstall-pwa']),
  article('offline-recovery-help', 'What should I do if the app goes blank or offline?', 'troubleshooting', 'offline-recovery', AUDIENCE.EVERYONE, 'The app should show a recovery screen instead of staying blank.', ['App went blank', 'Offline recovery'], ['blank screen','offline','recovery','reload'], [
    { title: 'Short answer', body: ['Wait for the recovery message. Use the manual recovery button if it appears.'] },
    { title: 'Try this', steps: ['Check your internet connection.', 'Wait a few seconds for recovery.', 'Use the recovery button if shown.', 'Reload once if the screen does not recover.', 'Report a problem if it happens again.'] },
  ], [], ['app-out-of-date']),
  article('browser-compatibility-help', 'Which browsers work best?', 'troubleshooting', 'browser-compatibility', AUDIENCE.EVERYONE, '86 Chaos works best in current Chrome, Edge, Safari, or Samsung Internet for normal restaurant use.', ['What browser should I use?', 'Does Firefox install app?'], ['browser','chrome','edge','safari','samsung internet','firefox'], [
    { title: 'Short answer', body: ['Use a current browser and keep it updated.'] },
    { title: 'Install notes', body: ['Edge and Chrome usually work well for installed apps on Windows. Chrome and Samsung Internet work well on Android. Safari is the correct choice for Add to Home Screen on iPhone and iPad. Firefox support may vary by device.'] },
  ], [], ['install-app']),
];

const CUSTOMER_HELP_ARTICLES = ARTICLES;

const INTERNAL_CONTENT_PATTERNS = [
  /System Administrator tools/i, /Root administrator protection/i, /Firestore rules/i, /Storage rules/i, /Release gate/i, /Vercel deployment/i, /emulator/i, /service account/i, /custom claims/i, /Ghost Mode/i, /Possess/i, /Danger Zone/i, /Firebase/i, /QA tooling/i, /Admin Manual/i, /forensics/i,
];
const FORBIDDEN_CUSTOMER_ARTICLE_IDS = ['protected-root-admin-account','ultimate-release-gate-runner','admin-command-deck','admin-edit-users','admin-client-users'];

function tokenize(value = '') {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(Boolean);
}
const SYNONYMS = {
  publish: ['publishing','published','live','post'], schedule: ['shifts','shift','roster'], invoice: ['bill','vendor bill','scan'], clock: ['punch','timeclock','clockin','clock-in'], request: ['time off','day off','vacation'], voice: ['86voice','mic','microphone','speech'], icon: ['pwa','home screen','installed app','gray icon'], custom: ['custom shifts','saved shifts','shift preset','shift presets'], inventory: ['stock','items','count'], back: ['office','owner tools'],
};
function expandTerms(tokens) {
  const set = new Set(tokens);
  for (const [key, vals] of Object.entries(SYNONYMS)) {
    if (set.has(key) || vals.some(v => tokens.join(' ').includes(v))) { set.add(key); vals.flatMap(tokenize).forEach(v => set.add(v)); }
  }
  return [...set];
}
function articleSearchText(article = {}) {
  return [article.id, article.title, article.summary, article.subjectId, article.subtopicId, ...(article.keywords || []), ...(article.synonyms || []), ...(article.commonQuestions || []), ...(article.troubleshooting || []), ...(article.sections || []).flatMap(s => [s.title, ...(s.body || []), ...(s.steps || [])])].join(' ');
}
function typoClose(a, b) {
  a = String(a); b = String(b);
  if (!a || !b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a[0] !== b[0]) return false;
  let i=0,j=0,edits=0;
  while (i<a.length && j<b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    edits++; if (edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return true;
}
function searchCustomerHelp(question = '', { limit = 6 } = {}) {
  const raw = String(question || '').trim();
  if (!raw) return [];
  const qTokens = expandTerms(tokenize(raw));
  const qPhrase = raw.toLowerCase();
  const scored = CUSTOMER_HELP_ARTICLES.map(article => {
    const text = articleSearchText(article).toLowerCase();
    const textTokens = new Set(tokenize(text));
    let score = 0;
    if (text.includes(qPhrase)) score += 80;
    if ((article.title || '').toLowerCase().includes(qPhrase)) score += 100;
    for (const cq of article.commonQuestions || []) if (cq.toLowerCase().includes(qPhrase) || qPhrase.includes(cq.toLowerCase().replace(/[?]/g,''))) score += 60;
    for (const term of qTokens) {
      if (textTokens.has(term)) score += 8;
      else if ([...textTokens].some(t => typoClose(term, t))) score += 3;
    }
    for (const kw of article.keywords || []) if (qPhrase.includes(String(kw).toLowerCase())) score += 20;
    if (article.id === 'app-icon-gray' && /app icon|wrong icon|gray icon|grey icon|generic icon/.test(qPhrase)) score += 120;
    if (article.id === 'invoice-scan-failed' && /invoice.*(scan|fail|didnt|didn)/.test(qPhrase)) score += 80;
    if (article.id === 'custom-shifts-on-phone' && /(custom|saved).*(shift|preset).*(phone|mobile|device|where|go|gone|missing|shared)/.test(qPhrase)) score += 120;
    if (article.id === 'custom-shifts-overview' && /(custom|saved).*(shift|preset).*(shared|what|where)/.test(qPhrase)) score += 90;
    if (article.id === 'voice-not-hearing' && /(86voice|voice).*(hear|hearing|listen|mic|microphone|cant|can.t)/.test(qPhrase)) score += 100;
    return { article, score };
  }).filter(row => row.score > 0).sort((a,b) => b.score - a.score || a.article.title.localeCompare(b.article.title));
  return scored.slice(0, limit).map(row => ({ ...row.article, score: Math.min(100, Math.round(row.score)) }));
}
function makeDeterministicHelpAnswer(question = '') {
  const matches = searchCustomerHelp(question, { limit: 5 });
  const top = matches[0];
  if (!top) return { ok: true, answer: 'I could not find a close Help article for that. Try simpler words, or use Report a Problem with what you were trying to do.', sourceArticleIds: [], suggestedDeepLinkIds: [], confidence: 0.2, insufficientInformation: true, matches: [] };
  const short = top.sections?.find(s => /short answer/i.test(s.title || ''));
  const tryIt = top.sections?.find(s => /try this|how to/i.test(s.title || ''));
  const answer = [top.summary, ...(short?.body || []), ...(tryIt?.steps ? ['Try this: ' + tryIt.steps.slice(0,3).join(' ') ] : [])].filter(Boolean).join(' ');
  return { ok: true, answer, sourceArticleIds: matches.slice(0,3).map(a => a.id), suggestedDeepLinkIds: [...new Set(matches.flatMap(a => a.deepLinkIds || []))].slice(0,4), confidence: top.score >= 45 ? 0.82 : 0.55, insufficientInformation: top.score < 25, matches };
}
function buildCustomerHelpCoverage() {
  const articleIds = new Set(CUSTOMER_HELP_ARTICLES.map(a => a.id));
  return CUSTOMER_FEATURES.map(feature => ({ ...feature, mappedArticleIds: feature.mappedArticleIds.filter(id => articleIds.has(id)), coverageStatus: feature.mappedArticleIds.every(id => articleIds.has(id)) ? 'fully_documented' : 'partially_documented' }));
}
function validateCustomerHelpCorpus() {
  const errors = [];
  const warnings = [];
  const subjectIds = new Set(HELP_SUBJECTS.map(s => s.id));
  const subtopicIds = new Set(HELP_SUBTOPICS.map(s => s.id));
  const articleIds = new Set();
  const allowedAudience = new Set(Object.values(AUDIENCE));
  for (const a of CUSTOMER_HELP_ARTICLES) {
    if (!a.id || articleIds.has(a.id)) errors.push(`Duplicate or missing article id: ${a.id}`); else articleIds.add(a.id);
    if (!subjectIds.has(a.subjectId)) errors.push(`${a.id} has invalid subject ${a.subjectId}`);
    if (!subtopicIds.has(a.subtopicId)) errors.push(`${a.id} has invalid subtopic ${a.subtopicId}`);
    if (!allowedAudience.has(a.audience)) errors.push(`${a.id} has invalid audience ${a.audience}`);
    if (!a.lastVerifiedVersion) errors.push(`${a.id} missing lastVerifiedVersion`);
    for (const r of a.relatedArticleIds || []) if (!CUSTOMER_HELP_ARTICLES.some(x => x.id === r)) errors.push(`${a.id} relates to missing article ${r}`);
    for (const d of a.deepLinkIds || []) if (!HELP_DEEP_LINKS[d]) errors.push(`${a.id} references missing deep link ${d}`);
    for (const l of a.externalLinks || []) if (!/^https:\/\//i.test(l.url || '')) errors.push(`${a.id} has non-HTTPS external link ${l.url}`);
    const text = articleSearchText(a);
    for (const re of INTERNAL_CONTENT_PATTERNS) if (re.test(text)) errors.push(`${a.id} contains forbidden internal concept: ${re}`);
    if (FORBIDDEN_CUSTOMER_ARTICLE_IDS.includes(a.id)) errors.push(`${a.id} is forbidden from customer corpus`);
  }
  const coverage = buildCustomerHelpCoverage();
  for (const f of coverage) if (!f.mappedArticleIds.length && !String(f.coverageStatus).startsWith('not_applicable')) errors.push(`Feature has no customer Help coverage: ${f.featureId}`);
  const missing = coverage.filter(f => f.coverageStatus === 'missing').length;
  const fully = coverage.filter(f => f.coverageStatus === 'fully_documented').length;
  const partially = coverage.filter(f => f.coverageStatus === 'partially_documented').length;
  return { ok: errors.length === 0, generatedAt: new Date().toISOString(), version: CUSTOMER_HELP_VERSION, errors, warnings, counts: { subjects: HELP_SUBJECTS.length, subtopics: HELP_SUBTOPICS.length, articles: CUSTOMER_HELP_ARTICLES.length, features: coverage.length, fullyDocumented: fully, partiallyDocumented: partially, missing, coveragePercent: Math.round((fully + partially * 0.5) / Math.max(1, coverage.length) * 1000) / 10 }, coverage };
}
function validateDeepLinks() {
  const errors = [];
  const ids = new Set(Object.keys(HELP_DEEP_LINKS));
  for (const a of CUSTOMER_HELP_ARTICLES) for (const id of a.deepLinkIds || []) if (!ids.has(id)) errors.push(`${a.id} has unknown deep link ${id}`);
  return { ok: errors.length === 0, total: ids.size, errors };
}
function serializeArticleForOldHelp(article) {
  return { id: article.id, title: article.title, group: HELP_SUBJECTS.find(s => s.id === article.subjectId)?.label || article.subjectId, keywords: [...(article.keywords || []), ...(article.commonQuestions || [])].join(' '), body: [article.summary, ...(article.sections || []).flatMap(s => [...(s.body || []), ...(s.steps || [])])] };
}
module.exports = { CUSTOMER_HELP_VERSION, AUDIENCE, HELP_SUBJECTS, HELP_SUBTOPICS, HELP_DEEP_LINKS, CUSTOMER_FEATURES, CUSTOMER_HELP_ARTICLES, CUSTOMER_HELP_ARTICLES_LEGACY: CUSTOMER_HELP_ARTICLES.map(serializeArticleForOldHelp), INTERNAL_CONTENT_PATTERNS, FORBIDDEN_CUSTOMER_ARTICLE_IDS, tokenize, searchCustomerHelp, makeDeterministicHelpAnswer, buildCustomerHelpCoverage, validateCustomerHelpCorpus, validateDeepLinks, articleSearchText };
