// This manual is intentionally static and deterministic. It never sends its
// searches, selected chapters, or printed content to an AI service.
export const SYSTEM_TRAINING_MANUAL_CHAPTERS = [
  {
    id: "getting-started-navigation",
    group: "Getting Started",
    title: "Getting Around 86 Chaos",
    tab: "Whole app",
    audience: "Everyone",
    summary: "Learn the menu, search, date controls, workspace switcher, alerts, permissions, and safe ways to move around the app.",
    keywords: "start navigation hamburger menu search voice workspace switch restaurant date alerts permissions install phone mobile demo",
    sections: [
      { title: "Open the right area", steps: [
        "Tap the menu button in the top-right corner. Tabs are grouped into Account, Operations, Manager Tools, Management, and System.",
        "Use the menu search when you know what you want to do but not where it lives. Searching for words such as punch, schedule, inventory, or help also shows useful shortcuts.",
        "The app only shows tabs your role is allowed to use. A missing tab usually means the workspace module is turned off or your permissions do not include it.",
        "If you belong to more than one restaurant, use the workspace switcher in the menu. Always confirm the restaurant name before saving, publishing, or deleting anything."
      ]},
      { title: "Shared controls", steps: [
        "The date or month control near the top changes the working period for schedule, prep, events, and financial screens. Check it before entering data.",
        "Red dots and warning cards mean something needs review, such as a message, schedule change, low-stock item, overdue task, or request.",
        "Global Search finds live records across the areas you can access. Search results still follow your normal permissions.",
        "The microphone is marked Preview. It can navigate, search Help, create supported reminders or prep entries, and stage important commands. High-risk actions require confirmation."
      ]},
      { title: "Phone and safety basics", steps: [
        "On Android, open the app in Chrome and choose Install App or Add to Home screen. On iPhone, open it in Safari, tap Share, then Add to Home Screen.",
        "Use the browser back button carefully while a form or review window is open. Save or cancel first so unfinished edits are not lost.",
        "Demo mode masks private details and blocks writes. Use it for demonstrations, not for live restaurant work.",
        "Never share passwords, recovery codes, employee records, signed file links, API keys, or authentication screenshots in messages or support notes."
      ]}
    ],
    notes: ["When in doubt, open Help Center first. System Administrators can use this full manual for deeper tab-by-tab instructions."]
  },
  {
    id: "voice-assistant-preview",
    group: "Getting Started",
    title: "86 Voice Assistant (Preview)",
    tab: "Microphone button / typed command panel",
    audience: "Everyone; actions still follow each user's permissions",
    summary: "Use speech or a typed command to navigate, search, find recipes, update prep, create reminders, and stage other supported work with safety checks.",
    keywords: "86 voice assistant preview microphone typed command local parser optional ai navigation help recipe prep reminder schedule 86 alert ambiguous confirmation permission troubleshooting",
    sections: [
      { title: "Start with speech or typing", steps: [
        "Tap the floating microphone marked Preview. Allow microphone access when the browser asks, speak one short command, and wait for the app to show what it heard.",
        "If microphone access is denied, unsupported, inaccurate, or uncomfortable to use in a loud kitchen, open the same panel and type the command. Typed commands use the same parser, permissions, previews, and confirmations.",
        "Read the proposed action before continuing. Safe navigation may happen immediately; messages, maintenance reports, 86 alerts, and other data-changing actions show a preview or confirmation.",
        "The assistant never bypasses a hidden tab. Workspace modules, role permissions, demo-mode read-only rules, and current restaurant scope are checked again before an action runs."
      ]},
      { title: "What the local parser understands", steps: [
        "Navigation: say open Manager Brief, Kitchen Command Center, Inventory, Staff Roster, Financials, Settings, System Administrator, or another visible tab.",
        "Schedule: say open My Schedule, Full Schedule, Month View, Trade Board, Time Off, or Schedule Builder. Date phrases can move the working date when the command provides one.",
        "Help: say search Help Center for missed punch or another plain-English topic. The useful search words are placed in Help Center.",
        "Recipes: say open beer cheese recipe or show chicken marsala recipe. The assistant searches the live Recipe Book instead of relying on a fixed recipe list.",
        "Prep: say prep 2 pans ranch tomorrow, slice three tomatoes Friday, or include several prep items. The parser separates item, amount, unit, station, and target date, then updates a confident matching prep row or creates a new row.",
        "Reminders: say remind me to call the vendor tomorrow at 9 AM. A clear date and time creates a private reminder; an incomplete time opens My Reminders so you can finish it manually.",
        "Recurring tasks: managers can say add weekly task clean fryer Friday or add monthly task inspect first aid kit on the 1st. Other users are blocked from creating manager tasks.",
        "The local parser also recognizes supported message, maintenance, and burn wording. Read any confirmation carefully; a burn/waste command is different from an 86 alert and may affect stock after confirmation."
      ]},
      { title: "Strict 86 safety", steps: [
        "Say 86 salmon, eighty six burger, or we're out of ranch. The app refreshes current Inventory and approved Menu Intelligence context before choosing a match.",
        "A strong exact or approved dependency match opens a final confirmation showing the requested phrase, real inventory item, and affected menu items when known.",
        "If more than one item could match, the ambiguous-item chooser requires you to select the exact Inventory row and confirm again. If there is no safe match, nothing is sent.",
        "Immediately before posting, the app refreshes Inventory again. If the matched item changed or disappeared, the alert is blocked and must be reviewed again.",
        "A confirmed 86 command posts one important alert to Message Board and surfaces it in Manager Brief and Kitchen Command. The 86-alert workflow never edits the inventory quantity; update Inventory separately when the physical count changed.",
        "The optional AI fallback is never allowed to choose or send a risky 86 alert. At most, it can recognize that the wording may be an 86 request and return it to the safe review flow."
      ]},
      { title: "Intelligent command examples", steps: [
        "Prep examples: Prep 2 pans onions, Add two containers ranch, Chop 2 pans of onion, Need 3 containers ranch, or prep onions and tomatoes for tomorrow.",
        "Done examples: Mark tomatoes done, Finish onions, Check off burgers, Done with ranch bottles, or Mark fryer wall done.",
        "Task examples: Add clean wall behind fryers to tasks, Add dump hood oil pan to tonight, Add deep clean ovens monthly, or Put check nacho cheese machine on daily tasks.",
        "Question examples: What needs done?, What prep is left?, What are we out of?, What does chicken breast affect?, or What menu items use ribeye?",
        "Search/navigation examples: Open prep, Open daily close, Show beer cheese recipe, Search Help for invoice scanning, or Open time clock."
      ]},
      { title: "Marking work done and avoiding duplicates", steps: [
        "86Voice searches current prep rows or task rows before creating another item. A confident match updates or completes the existing row instead of duplicating it.",
        "Fuzzy matching handles plural words, partial phrases, and common kitchen wording such as onions matching dice onion, ranch matching fill ranch bottles, and fryer wall matching clean wall and floor behind fryers.",
        "When two matches are close, the panel asks you to choose the right row. Do not confirm an item unless the preview names the correct prep item or task.",
        "Completed prep and task commands add completion metadata showing who marked the work done and that the source was 86Voice."
      ]},
      { title: "86 alerts and menu impact questions", steps: [
        "Out-of-stock speech such as 86 chicken breast, we're out of ribeye, no more brioche buns, or kill ribeye for tonight creates an 86 alert path, not an inventory count edit.",
        "When approved Menu Intelligence dependency links exist, 86Voice can show affected menu items. If those links are missing, the app explains that menu impact needs approved ingredient links first.",
        "Ask What does chicken breast affect? or If we're out of brioche buns, what can’t we make? to review approved dependency impact without posting a new alert.",
        "Inventory counts still need to be updated through Inventory or another explicit, permissioned workflow."
      ]},
      { title: "Reminders, shared reminders, and recurring reminders", steps: [
        "Personal examples include Remind me tomorrow at 10 to call Performance or Remind me Friday to order fryer oil. Personal reminders remain private to the creator and assigned user.",
        "Shared examples include Remind Sarah to check hood filters Wednesday. Shared reminders require permission and the teammate must be selected from real workspace staff records.",
        "Recurring examples include Create weekly reminder to clean oven vents. Recurring reminders are scheduled through the existing reminder dispatch system and move to the next due date after successful delivery.",
        "If a teammate name or time is unclear, 86Voice asks you to choose or opens My Reminders so you can finish safely."
      ]},
      { title: "Undo, confirmation, and safety limits", steps: [
        "Say Undo that, Cancel last command, Never mind, or Take that back to roll back a recent safe voice-created or voice-updated action when rollback is possible.",
        "Undo is limited to safe work such as newly created prep, task, reminder, or recent prep/task update and completion metadata. The panel shows when an undo is available.",
        "86Voice never auto-approves invoice scans, menu scans, payroll readiness, Daily Close signoff, financial reports, plan/billing changes, Firebase/security/admin settings, or integrations.",
        "If a command is blocked by plan or permission, the result explains the block and should not leak restricted financial, wage, admin, or owner-only data."
      ]},
      { title: "Local first, optional AI last", steps: [
        "Known commands are parsed on the device first. Navigation, schedule views, Help searches, recipe lookup, reminders, prep, recurring tasks, 86 matching, messages, maintenance, and burn wording do not need AI interpretation when the local parser understands them.",
        "Only an unrecognized phrase may reach the optional server parser. That route requires a verified account and App Check, has a strict rate limit, accepts at most 1,200 characters, permits one low-cost Flash-Lite call, and limits the answer to 512 tokens.",
        "The server model allowlist blocks expensive or unknown models. If the optional parser is unavailable or uncertain, the app safely opens Help instead of guessing.",
        "Even an optional AI interpretation returns to the same permission and confirmation checks. It cannot silently perform a high-risk action."
      ]},
      { title: "Troubleshooting", steps: [
        "If the mic does nothing, check the browser site permission, operating-system microphone permission, secure HTTPS connection, and whether another app is using the microphone.",
        "If recognition heard the wrong words, close the preview and type the command. Use the exact Inventory or Recipe name for the safest match.",
        "If Access Blocked appears, the account lacks the tab permission or the workspace module is disabled. Voice cannot override that restriction.",
        "If an action preview is wrong, cancel it. Use the normal tab to complete the work and report the exact phrase through Help Center > Report Problem.",
        "If an 86 item is not found, correct or clarify the Inventory name and approved Menu Intelligence links. Do not choose a close-looking item merely to clear the warning."
      ]}
    ],
    notes: ["Preview means the feature is still being refined. Treat every spoken result as a draft until the screen confirms exactly what will happen."]
  },
  {
    id: "manager-brief",
    group: "Manager Tools",
    title: "Manager Brief",
    tab: "Manager Brief",
    audience: "Managers and permitted leads",
    summary: "Use one daily snapshot to see what needs attention before service and throughout the shift.",
    keywords: "today manager brief priorities alerts low stock prep maintenance labor shift messages 86 events sales",
    sections: [
      { title: "Start-of-day review", steps: [
        "Open Manager Brief and confirm the displayed date and restaurant.",
        "Read the priority cards first. They combine schedule coverage, staff requests, important messages, 86 alerts, low inventory, prep work, maintenance issues, and events.",
        "Open a source tab from a card when something needs action. The brief summarizes records; the source tab is where you edit or complete them.",
        "Check the shift and event sections before assigning work so you understand expected volume and special conditions."
      ]},
      { title: "During and after service", steps: [
        "Reopen the brief when managers change shifts so the incoming manager sees unresolved work.",
        "Treat 86 alerts and urgent maintenance as live operational issues. Confirm the source record rather than assuming an old card is still current.",
        "Use financial and labor summaries as signals, then open Financials for the detailed ledger or timesheet record.",
        "A quiet brief means no matching alerts were found; it does not replace a physical walk-through or manager handoff."
      ]}
    ],
    notes: ["Manager Brief does not silently change restaurant data. It gathers the most useful signals and links you to the correct tool."]
  },
  {
    id: "time-clock-and-my-schedule",
    group: "Operations",
    title: "Time Clock & Schedule: Employee Use",
    tab: "Time Clock & Schedule",
    audience: "Everyone",
    summary: "Clock in and out, review your shifts, view the full schedule, request time off, and handle shift trades.",
    keywords: "clock in out punch geofence my schedule full schedule month trade swap shift time off request availability",
    sections: [
      { title: "Clock in and out", steps: [
        "Open Time Clock & Schedule and check the current status before tapping Clock In or Clock Out.",
        "Allow location access when the restaurant uses a work-area rule. The app records the result for manager review; it does not make an incorrect punch disappear.",
        "After clocking, wait for the success message and confirm the displayed time. Do not tap repeatedly.",
        "If you forgot a punch or the wrong time was saved, tell a manager. Managers correct the official punch in Financials and record a reason."
      ]},
      { title: "Schedule views", steps: [
        "My Schedule shows your upcoming shifts and the fastest links to trades and time-off requests.",
        "Full Schedule shows the published restaurant schedule you are allowed to see. Month View is useful for planning farther ahead.",
        "Past shifts are dimmed after their real end time so they are not mistaken for active work.",
        "Only a published schedule is official. Drafts in Schedule Builder are manager work in progress."
      ]},
      { title: "Trades and time off", steps: [
        "Use Trade Board to offer or claim a shift according to restaurant policy. A claimed trade may still require manager approval.",
        "Use Time Off to enter the exact dates, reason, and any partial-day details. Submit early and check the status later.",
        "Pending means the request has not been approved. Do not treat it as guaranteed time off.",
        "If requests after schedule publication are disabled, contact a manager instead of creating a conflicting request."
      ]}
    ],
    notes: ["Never share another employee's login to clock them in or out. Each punch must belong to the person who worked it."]
  },
  {
    id: "schedule-builder",
    group: "Operations",
    title: "Schedule Builder and Schedule Copilot",
    tab: "Time Clock & Schedule > Schedule Builder",
    audience: "Owners, managers, and schedule editors",
    summary: "Build, check, publish, copy, and repair schedules without confusing drafts with the employee-facing schedule.",
    keywords: "schedule builder copilot draft publish copy week template smart fill coverage labor availability conflict time off",
    sections: [
      { title: "Build a schedule", steps: [
        "Choose the correct week before adding shifts. Add the employee, role, date, start time, and end time; verify overnight shifts carefully.",
        "Use templates or copy a previous week only as a starting point. Review every copied shift for availability, approved time off, staffing needs, and changed hours.",
        "Schedule Copilot is a compact checklist of gaps, conflicts, and warnings. It suggests where to look; it does not publish or approve decisions for you.",
        "Use coverage and labor indicators to spot weak periods, overtime risk, overlapping shifts, or an employee scheduled outside their availability."
      ]},
      { title: "Publish safely", steps: [
        "Resolve important warnings and confirm events before publishing.",
        "Publishing makes the schedule visible to staff and may trigger notifications. Confirm the week and restaurant one final time.",
        "If you edit a published shift, explain the change and confirm the affected employee receives the update.",
        "Use emergency schedule repair tools only when the normal builder cannot correct corrupted or duplicate records, and make a backup first."
      ]}
    ],
    notes: ["Accepted and approved trade states should be reviewed before the original shift is changed. Keep a manager note for unusual corrections."]
  },
  {
    id: "kitchen-command-center",
    group: "Manager Tools",
    title: "Kitchen Command Center",
    tab: "Kitchen Command Center",
    audience: "Owners, managers, kitchen managers, and trusted leads",
    summary: "Run service from one focused command view: priorities, labor, prep, 86 items, inventory, maintenance, events, and today's specials.",
    keywords: "kitchen command center ops specials today special 86 low stock prep labor maintenance events smart order review health",
    sections: [
      { title: "Service command view", steps: [
        "Confirm the date and read the health or priority summary before service.",
        "Review staffing, active punches, prep gaps, low-stock items, urgent maintenance, and event notes. Open the source record to make changes.",
        "Use smart order suggestions for below-par items, then review quantities and vendors in Inventory before placing an order.",
        "Post an 86 alert only after confirming the exact item. An 86 alert informs the team; it does not automatically change the inventory quantity."
      ]},
      { title: "Service Specials: current, upcoming, and history", steps: [
        "Open Service Specials inside Kitchen Command. Current shows what runs on the selected service date. The Upcoming count and future cards show scheduled items. Managers can open All & History to review drafts, future items, sold-out items, and archived records.",
        "Owners, administrators, managers, leads, supervisors, or people with Prep, Ops, or Team permission can create, edit, change status, archive, or restore a special. Other permitted Kitchen Command viewers can read the current and upcoming service details without changing them.",
        "Create a special with a clear name, start and end date, short guest-facing description, price when applicable, verified allergens, dietary notes, and prep, pickup, or 86 instructions.",
        "Record allergens and dietary tags carefully, such as contains dairy, gluten, nuts, shellfish, vegetarian, or vegan. These notes help communication but never replace the restaurant's verified allergen procedure.",
        "Add ingredient, low-stock, or 86 notes when a component is limited. Check Inventory and approved Menu Intelligence links before setting a special Live.",
        "Use Draft while planning, Scheduled for an approved date range, Active when staff should sell it, Sold Out the moment it is unavailable, and Archived when it should leave the service list but remain in history. Restore an archived record only when it is deliberately returning.",
        "Keep the Current list accurate during service. Update prep, pickup, or 86 notes and mark the item Sold Out promptly rather than leaving stale information for the next shift.",
        "Use Event Calendar for parties, holidays, and volume-driving events. Use Service Specials for the food or drinks being planned, sold, and closed out for a service."
      ]},
      { title: "Manager handoff", steps: [
        "Mark the command review after checking the real restaurant conditions. The audit stamp proves a review happened; it does not prove every issue was fixed.",
        "At shift change, call out unresolved 86 items, specials quantities, urgent repairs, prep shortages, and staffing gaps.",
        "Use Message Board for information the wider team should retain after the live command view changes."
      ]}
    ],
    notes: ["Kitchen Command is permission-controlled because it combines sensitive labor and operational information."]
  },
  {
    id: "event-calendar",
    group: "Operations",
    title: "Event Calendar",
    tab: "Event Calendar",
    audience: "Managers and permitted event, schedule, or team users",
    summary: "Record special events that affect staffing, prep, service, or purchasing.",
    keywords: "event calendar party catering live music holiday notes staffing volume schedule prep",
    sections: [
      { title: "Create and maintain events", steps: [
        "Choose the correct date and create a specific title such as Private Party - 50 Guests instead of a vague name.",
        "Add the event time and useful operating notes: guest count, room, service style, set menu, bar needs, load-in, and expected rush window.",
        "Update the event when details change and remove canceled events so they stop affecting manager planning.",
        "Review the month view before building schedules and orders. Events can appear in time-off, schedule, Manager Brief, and Kitchen Command context."
      ]}
    ],
    notes: ["Do not store payment-card data, medical information, or unnecessary guest personal details in event notes."]
  },
  {
    id: "financials",
    group: "Management",
    title: "Financial Center: Daily Close, Labor, Tips, COGS, Expenses, P&L, Targets, and Reports",
    tab: "Financial Center",
    audience: "Owners, administrators, and users with sales or labor permission",
    summary: "Run a professional restaurant financial workflow from one readable center: daily close, sales mix, payroll readiness, tips, vendor costs, expenses, targets, and owner reports.",
    keywords: "financial center overview daily close sales labor payroll tips cogs vendors expenses profit loss pnl targets reports cash deposit variance custom roster roles",
    sections: [
      { title: "Overview", steps: [
        "Open Financial Center and choose the correct month. The Overview summarizes net sales, prime cost, estimated profit, cash variance, deposits pending, missing daily closes, and payroll issues.",
        "Use the health cards as a management signal, not as final accounting. The numbers depend on saved Daily Close records, time punches, invoices, expenses, and target settings.",
        "Labor by role always uses the account owner's custom Roster Roles from Preferences, plus active staff roles already assigned. Do not create separate hardcoded finance-only roles.",
        "A red or orange card means review the source area: Daily Close for sales/cash, Labor & Payroll for punches, Inventory for invoice spend, or Expenses for operating costs."
      ]},
      { title: "Daily Close", steps: [
        "Use Daily Close at the end of every business day. Enter gross sales, net sales, discounts, comps, refunds, sales tax, sales categories, cash sales, card sales, gift cards, and useful notes.",
        "Enter the starting bank, cash paid out, tips paid out, cash counted, deposit amount, deposit status, close status, and manager sign-off. The app calculates expected cash, over/short variance, category total, and estimated profit.",
        "Use Manager Reviewed only after a manager has compared POS totals, drawer count, deposits, and unusual activity. Use Locked only when the restaurant treats the close as final.",
        "Explain any cash variance, unusual discounts, refunds, bad weather, large event, or staffing issue in the close notes. Future reviews are much easier when the story is written down."
      ]},
      { title: "Sales and sales mix", steps: [
        "Sales reads the saved Daily Close records for the selected month and shows the mix of food, liquor, beer, wine, NA beverage, specials, catering, and other sales.",
        "Use category sales consistently. If the POS category names differ, decide how they map before entering data so month-to-month comparisons stay useful.",
        "Deposit status shows whether a day is Not Prepared, Prepared, Deposited, or Verified. Pending deposits should be cleared according to restaurant policy.",
        "Sales totals should be reconciled against the POS before owner reports are treated as final."
      ]},
      { title: "Labor & Payroll", steps: [
        "Open Labor & Payroll to fix missed punches, open punches, long shifts, unscheduled punches, and geofence review items before exporting payroll.",
        "When adding or editing a punch, choose the employee, correct date and times, break minutes, correction reason, and a clear manager note. The correction is written with audit context.",
        "Filter payroll by Whole Restaurant or any custom Roster Role created in Preferences. Role choices must match the restaurant's real roster roles rather than a generic list.",
        "Export detail when payroll needs each clock event. Export summary when payroll needs total hours by employee. Spot-check dates, hours, wages, and tips before sending files outside the app."
      ]},
      { title: "Tips", steps: [
        "Tips summarizes cash tips and credit tips recorded on time punches. Review them by employee and roster role before payroll handoff.",
        "Tip totals depend on punch records. If tips look wrong, open the employee's punches for that date range and correct the source punch with a reason.",
        "Download the tip report for payroll review and keep it in approved secure storage because it contains employee pay information.",
        "The app can organize tip data, but the restaurant is still responsible for its tip-pooling, tip-out, tax, and payroll policies."
      ]},
      { title: "COGS & Vendors", steps: [
        "COGS & Vendors summarizes invoice spend from Inventory invoice history and groups spend by vendor when invoice records include vendor names.",
        "Use it to spot large vendor changes, missing invoice review, or unusual purchasing spikes. Then open Inventory to inspect the original invoice and stock changes.",
        "Food and beverage cost percentages come from Daily Close entries. Invoice spend is purchase activity and may not match true cost of goods sold until inventory counts are reconciled.",
        "Finish invoice reconciliation in Inventory before relying on vendor spend for owner reporting."
      ]},
      { title: "Expenses", steps: [
        "Use Expenses for non-invoice operating costs such as rent, utilities, repairs, supplies, marketing, fees, insurance, technology, and other bills.",
        "Enter the date, vendor or payee, category, amount, payment method, due date, paid/unpaid state, and notes. Do not store card numbers, bank login information, or private personal data.",
        "Mark unpaid expenses clearly so the Overview can show what still needs attention.",
        "Delete expenses only when they were entered by mistake. Use notes for context rather than deleting legitimate records that changed status."
      ]},
      { title: "P&L, targets, and reports", steps: [
        "P&L is an operational snapshot: gross sales, discounts/comps/refunds, net sales, food and beverage cost, gross profit, labor, operating expenses, and estimated net profit.",
        "Targets sets the restaurant's warning thresholds for labor percent, food percent, beverage percent, prime cost, weekly and monthly sales goals, cash variance, and overtime risk.",
        "Reports creates owner-ready print and CSV summaries. Use the Daily Close, Payroll, Tip, COGS, and Financial Center reports together when reviewing a week or month.",
        "Financial access is sensitive. Give sales, labor, wage view, wage edit, and report access only to people with a real business need."
      ]}
    ],
    notes: ["Financial Center is a management tool, not a replacement for an accountant, payroll provider, bank reconciliation, POS settlement, or tax filing system."]
  },
  {
    id: "message-board",
    group: "Management",
    title: "Message Board and 86 Alerts",
    tab: "Message Board",
    audience: "Everyone; posting controls depend on role",
    summary: "Share operational updates, recognize important messages, and keep 86 information visible to the team.",
    keywords: "message board post announcement important 86 out unavailable acknowledge read notifications pin",
    sections: [
      { title: "Post useful messages", steps: [
        "Write a short title or opening line that tells staff what changed and what they need to do.",
        "Use Important only for messages that truly need attention. Too many important posts make the signal meaningless.",
        "For an 86 item, use the supported 86 workflow and confirm the exact product. Menu Intelligence links may show affected menu items.",
        "Read dates and author names before acting on a message. Old posts may describe a problem that has already been resolved."
      ]},
      { title: "Privacy and follow-through", steps: [
        "Do not put wages, discipline, medical details, passwords, recovery codes, or private HR matters on the Message Board.",
        "Use acknowledgments or reactions only when they accurately show the message was read.",
        "Remove or replace outdated operational posts according to restaurant policy so active information stays easy to find."
      ]}
    ],
    notes: ["An 86 alert does not deduct inventory. Update the actual quantity in Inventory when the on-hand count also changed."]
  },
  {
    id: "prep-and-tasks",
    group: "Operations",
    title: "Prep & Tasks, Line Checks, and Labels",
    tab: "Prep & Tasks",
    audience: "Kitchen staff, managers, and permitted prep users",
    summary: "Create and complete prep, run recurring checklists, perform line checks, and print one accurate label for each selected prep item.",
    keywords: "prep tasks today daily weekly monthly line check temperature checklist labels print use by quantity station complete",
    sections: [
      { title: "Prep list", steps: [
        "Choose the correct prep date before adding or selecting items. Changing the date clears the previous day's selection so the wrong labels are not printed.",
        "Enter a clear item name, required quantity and unit, station, assignee, due time, and notes when needed.",
        "Complete an item only when the physical work is finished. Use Smart Prep or voice carefully and review the matched item so duplicates are not created.",
        "Use recurring Daily, Weekly, or Monthly tasks for standard work that should reappear on a predictable schedule."
      ]},
      { title: "Line checks", steps: [
        "Use Line Check for opening, shift-change, or closing verification. Record actual temperatures or results instead of simply clicking through.",
        "Investigate failed ranges immediately and follow food-safety policy. The app records the check; it does not make an unsafe product safe.",
        "Add a useful note when a result is outside the expected range or a corrective action was taken."
      ]},
      { title: "Print prep labels", steps: [
        "Select the finished prep items that need labels, then open Print Labels.",
        "Each selected prep item produces one label. The prep amount appears as label information; a quantity of 5 lb does not create five separate labels.",
        "Verify the item, amount, station, prepared date, use-by date, and employee before printing.",
        "In the browser print dialog, choose the label printer and correct paper size. Reprint only the labels that are actually missing or damaged."
      ]}
    ],
    notes: ["Printed labels support your food-safety process; they do not replace local labeling, date-marking, or allergen requirements."]
  },
  {
    id: "recipe-book",
    group: "Operations",
    title: "Recipe Book",
    tab: "Recipe Book",
    audience: "Kitchen staff can read; recipe editors can create and change",
    summary: "Maintain consistent recipes, scale yields, search quickly, and review any scanned recipe before saving it.",
    keywords: "recipe book ingredient instruction yield scale portion allergen search photo scan recipe edit publish",
    sections: [
      { title: "Find and use a recipe", steps: [
        "Search by recipe name or a familiar ingredient. Voice can open a recipe by name when it finds a clear match.",
        "Read the yield, portion size, ingredients, method, station notes, and allergens before starting.",
        "Use scaling only after confirming the base yield. Check units and rounding on high-cost, baking, curing, or food-safety-critical ingredients.",
        "Follow the current published recipe rather than an old screenshot or handwritten copy."
      ]},
      { title: "Create or update", steps: [
        "Use a specific name and enter ingredients with quantity and unit on separate rows.",
        "Write instructions in service order. Include temperatures, hold times, cooling steps, garnish, yield, storage, and allergen warnings when relevant.",
        "A recipe scan only converts an image into a draft. Review every ingredient, unit, amount, and instruction before saving.",
        "When changing a live recipe, tell affected staff and update prep or menu links that depend on it."
      ]}
    ],
    notes: ["The low-cost recipe text-conversion tool is capped and permission-controlled, but a human must approve all extracted content."]
  },
  {
    id: "inventory-and-orders",
    group: "Operations",
    title: "Inventory & Orders: Every Subtab",
    tab: "Inventory & Orders",
    audience: "Managers and permitted inventory users",
    summary: "Track stock, pars, vendors, purchase orders, receiving, counts, burn, invoice history, and scanner review.",
    keywords: "inventory items par count stock vendors orders purchase receive invoice scanner history burn log preview waste low stock csv import",
    sections: [
      { title: "Inventory items and counts", steps: [
        "Create one clear inventory row for each product you actually count. Use consistent names, categories, units, pack sizes, costs, par levels, and vendor links.",
        "Enter the physical on-hand quantity after counting. Never guess a count merely to clear a warning.",
        "Par is the target level, not the quantity to buy. Suggested order quantity is based on the gap between current stock and par and still requires review.",
        "Use search and categories to find duplicates before adding a new item. Merge or correct duplicates carefully so history stays understandable."
      ]},
      { title: "Vendors and orders", steps: [
        "Create vendor records with company, representative, phone, email, and notes. Link inventory items to the correct supplier.",
        "Build an order from low-stock suggestions or add items manually. Check pack size, price, order unit, and requested quantity.",
        "Review each vendor group before sending or exporting. The app prepares order information; confirm the actual vendor submission succeeded.",
        "When receiving, compare delivered quantities and prices with the order and invoice before updating stock. Record shortages or substitutions."
      ]},
      { title: "Burn Log Preview", steps: [
        "Use Burn Log Preview for spoilage, mistakes, waste, breakage, or another approved loss reason.",
        "Enter the real amount and unit, cost basis, reason, and note. Confirm the deduction preview before saving.",
        "Burn may reduce stock and record cost lost. Do not use it to correct an ordinary count error; perform a count adjustment with an explanation instead.",
        "Review burn history for patterns, but investigate context before drawing conclusions about an employee or shift."
      ]},
      { title: "Invoice Scanner and history", steps: [
        "Upload a readable supported PDF or photo within the displayed file and page limits. The scanner is capped, uses an approved low-cost model, and blocks duplicate or oversized requests.",
        "Wait for upload and extraction to finish, then review Stock Matcher. Match each real product to an existing item or deliberately add a new one.",
        "Move genuine product lines from Needs Review when the scanner could not classify them. Ignore taxes, totals, addresses, fees, and document noise.",
        "Verify quantity, unit, pack size, unit cost, extended cost, vendor, invoice number, and date before Approve & Update Stock.",
        "Use Invoice History for audit and lookup. A scanned suggestion is never an approved inventory transaction until a permitted person completes reconciliation."
      ]}
    ],
    notes: ["Use the same counting and purchasing units across items, orders, receiving, burn, and invoices. Unit mismatches are the most common source of bad stock numbers."]
  },
  {
    id: "ai-tools",
    group: "Operations",
    title: "AI Tools: Safe, Capped Use",
    tab: "AI Tools",
    audience: "Permitted managers and inventory or prep users",
    summary: "Open supported scanners from one place while understanding limits, review requirements, and cost controls.",
    keywords: "ai tools invoice recipe scanner limits cheapest model pages output tokens idempotency review privacy",
    sections: [
      { title: "What this tab does", steps: [
        "AI Tools is a launcher for supported extraction workflows such as invoice or recipe scanning. It does not replace the normal Inventory or Recipe Book approval screens.",
        "Each scanner accepts only approved file types and sizes. Page caps, an approved low-cost model list, output limits, rate limits, call budgets, and duplicate-request protection are enforced on the server.",
        "A failed or blocked scan should show a reason. Do not keep clicking; correct the file, permissions, or limit problem first.",
        "Always review extracted data. AI can misread text, rows, prices, quantities, units, ingredients, or instructions."
      ]},
      { title: "Version 15.0.52 hard cost controls in plain English", steps: [
        "The server accepts only the approved Gemini Flash-Lite or vetted Flash allowlist and defaults to Flash-Lite. A typo, a broad environment setting, or a changed browser request cannot silently select an expensive model; an unapproved model is blocked instead.",
        "Every route has a hard maximum output size. An environment setting may lower that maximum, but it cannot raise it. This stops a text conversion from asking the model for an enormous answer.",
        "Invoice scanning is limited to 20 MB, 40 pages, and no more than two provider calls for the entire request, including any compact retry or repair attempt. Menu scanning is limited to 20 MB, 10 pages, and one provider call.",
        "Recipe text conversion is limited to one image up to 3 MB, one low-cost Flash-Lite call, and a small 2,048-token output. Voice commands are limited to 1,200 input characters, one call, and a 512-token output.",
        "Rate limits slow repeated requests. A provider-call budget prevents retry loops, and a durable request lock prevents the same operation from being charged twice when a user double-clicks or a browser repeats a request.",
        "The server checks the real file signature and PDF page count instead of trusting the filename. Usage logs record safe counts, model, attempts, and failures without storing secrets in the manual.",
        "Image scans also have server-verified pixel and edge limits, so a visually ordinary but extremely high-resolution image is rejected before any provider call.",
        "HR training-manual uploads use no AI at all. The employer uploads the original file and enters the title, version, summary, requirement, and acknowledgment details directly."
      ]},
      { title: "Privacy and cost", steps: [
        "Upload only the business document needed for the task. Remove unrelated personal, payment, medical, or confidential pages first.",
        "Use the smallest clear file and fewest necessary pages. Larger input consumes more processing even when the monthly page cap has room.",
        "System Administrator > AI Usage / Scan Limits shows workspace usage, failures, blocks, page counts, and model information.",
        "The training manual you are reading never uses AI. Its search and PDF selection happen entirely in the browser."
      ]}
    ],
    notes: ["No AI result should directly make a high-risk staffing, payroll, safety, inventory, or security decision without human review."]
  },
  {
    id: "menu-intelligence",
    group: "Operations",
    title: "Menu Intelligence",
    tab: "Menu Intelligence",
    audience: "Account owner and specifically permitted users",
    summary: "Scan a menu, review ingredient-to-inventory links, and show which menu items are affected by unavailable products.",
    keywords: "menu intelligence scan menu pdf image menu item ingredient inventory dependency approve edit delete recent scans 86 impact",
    sections: [
      { title: "Scan and review", steps: [
        "Upload a clear menu PDF or image within the displayed page and file limits.",
        "Review every detected menu item and ingredient. Rename unclear items and remove document noise.",
        "Match ingredients to the real Inventory rows the kitchen uses. Common staff words such as burger may need a link to a product named beef patty.",
        "Approve Reviewed Menu Links only after the matches are correct. The scanner produces suggestions; approval creates the live dependency records."
      ]},
      { title: "Maintain live menu impact", steps: [
        "Use Current Menu Impacts to see menu items affected by zero or unavailable ingredients.",
        "Use Recent Menu Scans to edit a wrong match or delete an outdated scan. Deleting a scan removes its linked dependencies but may retain the original secure source file according to retention policy.",
        "Test an 86 alert after approving important links. The Message Board, Manager Brief, and Kitchen Command can then show affected menu items.",
        "Rescan when the menu changes significantly, and remove old links so discontinued dishes do not appear."
      ]}
    ],
    notes: ["Menu Intelligence access is owner-controlled. It should not be granted broadly because it can change the dependency map used by 86 alerts."]
  },
  {
    id: "my-reminders",
    group: "Account",
    title: "My Reminders",
    tab: "My Reminders",
    audience: "Each signed-in user",
    summary: "Create private personal reminders with due times and notifications without placing them on the shared Message Board.",
    keywords: "my reminders private create due date time recurring notification voice complete snooze",
    sections: [
      { title: "Create and manage", steps: [
        "Add a short action-focused title and choose the correct due date and time.",
        "Use recurrence only when the task truly repeats. Check the next due date after saving.",
        "Complete, edit, snooze, or delete your own reminder as the situation changes.",
        "Voice can create supported reminders, but read the confirmation before saving."
      ]},
      { title: "Notifications", steps: [
        "Allow browser notifications and keep the device registered if you want alerts when the app is not open.",
        "A reminder can still exist when a push notification fails. Check My Reminders directly for the official list.",
        "Reminders are private to the user. Use shared tasks, prep, maintenance, messages, or HR assignments when work must be visible to managers or teammates."
      ]}
    ],
    notes: ["Do not use a personal reminder as the only record for food safety, payroll, maintenance, or another required business log."]
  },
  {
    id: "hr-and-training",
    group: "Account",
    title: "HR & Training",
    tab: "HR & Training",
    audience: "Employees see published manuals and their own records; employers and HR managers administer",
    summary: "Publish controlled training documents, record acknowledgments, assign onboarding, track certifications, and keep confidential performance notes separated.",
    keywords: "hr training manual upload employee acknowledgment onboarding checklist certification expiration performance confidential document pdf docx",
    sections: [
      { title: "Training manuals", steps: [
        "Managers choose Publish Manual and upload the original PDF, DOC, DOCX, or text file up to 15 MB with a clear title, version, category, effective date, plain-language summary, and Required setting.",
        "This upload workflow does not use paid AI. The original document and the employer-entered details remain the source of truth.",
        "Publish a new version with the same title when the policy changes. The new file becomes Published and the prior published version is automatically moved to Archived instead of being silently overwritten.",
        "Employees can download published manuals, read the real file, and acknowledge the displayed version. The record stores the exact version and attestation; acknowledgment records receipt and review, not proven skill.",
        "Managers can see acknowledgment counts and delete a manual when policy allows. Check that the correct replacement is published before removing a controlled document."
      ]},
      { title: "Onboarding and certifications", steps: [
        "Managers assign the standard onboarding checklist to an employee with a due date. Employees see and complete only their own tasks; managers can review all workspace assignments.",
        "Use certifications for food safety, alcohol service, equipment, or other credentials. Enter issuer, issue date, expiration date, and status from the real document.",
        "The dashboard marks credentials Current, Expiring within 60 days, or Expired. Review upcoming expirations early and follow local requirements; the app is a tracking tool, not legal advice."
      ]},
      { title: "Performance records and privacy", steps: [
        "Private performance notes are manager-only. Use factual dates, observed behavior, prior discussion, agreed next steps, and follow-up dates.",
        "Do not put confidential HR notes on the Message Board, public Help Center, or shared training description.",
        "Give HR permissions only to people with a real business need and review access when roles change."
      ]}
    ],
    notes: ["Employment laws and record-retention duties vary. Have qualified HR or legal counsel review your policies and required records."]
  },
  {
    id: "staff-roster",
    group: "Account",
    title: "Staff Roster, Logins, Roles, and Permissions",
    tab: "Staff Roster",
    audience: "Owners, managers, and permitted team administrators",
    summary: "Add employees, deliver first-login information safely, edit profiles, control permissions, and deactivate access.",
    keywords: "staff roster employee add login temporary password role permissions wage deactivate reset access workspace member",
    sections: [
      { title: "Add an employee", steps: [
        "Enter the legal or preferred working name, unique email or login identifier, role, phone when needed, wage only when authorized, and the correct restaurant.",
        "Choose the smallest permission set that lets the employee do their job. A role label and a permission toggle are not the same thing.",
        "Save once and copy, print, email, or text the one-time login information from the handoff window before closing it.",
        "Ask the employee to sign in, change the temporary password, verify contact information, and enroll in required two-step login."
      ]},
      { title: "Maintain access", steps: [
        "Use Edit User for job role, permissions, notification preferences, wage access, or active status changes.",
        "Deactivate people who no longer work at the restaurant. Do not reuse their account for a replacement employee.",
        "Use password reset for a verified user. Never ask them to tell you their password.",
        "System Administrator access is separate from restaurant permissions and must be granted only through the platform Access Control area."
      ]}
    ],
    notes: ["Review manager, HR, wage, inventory, financial, Settings, and Menu Intelligence permissions regularly."]
  },
  {
    id: "maintenance-log",
    group: "Management",
    title: "Maintenance Log and Preventative Maintenance",
    tab: "Maintenance Log",
    audience: "Managers and permitted team users",
    summary: "Report equipment issues, attach useful evidence, track repairs, and schedule recurring preventative work.",
    keywords: "maintenance repair issue equipment photo urgency vendor status preventative pm overdue recurring fryer cooler",
    sections: [
      { title: "Repair Board", steps: [
        "Create a specific title such as Fryer 2 will not hold temperature. Select urgency, location or equipment, and status.",
        "Describe what happened, when it started, safety impact, troubleshooting already tried, and any vendor or work-order information.",
        "Add a relevant photo when it helps diagnosis and does not expose private information.",
        "Update the status from Open to In Progress to Resolved. Record the repair and verify the equipment before closing the issue."
      ]},
      { title: "Preventative Maintenance", steps: [
        "Create recurring maintenance with an owner, frequency, due date, procedure, and vendor or document reference.",
        "Work overdue items by safety and business impact, not only by age.",
        "Complete a task only after the physical work and required verification are done. Schedule the next date correctly."
      ]}
    ],
    notes: ["Immediately follow restaurant safety procedures for gas, fire, electrical, refrigeration, or food-temperature hazards. Logging an issue is not enough."]
  },
  {
    id: "settings-profile-security",
    group: "System",
    title: "Settings: Profile and Account Security",
    tab: "Settings > Profile / Account Security",
    audience: "Each user for personal settings; elevated recovery is Master Admin only",
    summary: "Keep personal profile editing separate from password, MFA, recovery codes, and protected account-repair tools.",
    keywords: "settings profile account security password reset mfa two step sms recovery code master admin photo phone email",
    sections: [
      { title: "Profile", steps: [
        "Use Profile for your name, phone, profile photo upload or URL, and other permitted personal details.",
        "Your sign-in email is displayed but cannot be casually changed from the profile form.",
        "Save and confirm the updated name or photo appears. Profile is not where MFA or recovery tools live."
      ]},
      { title: "Account Security", steps: [
        "Open Account Security to send a password-reset email, enroll SMS two-step login, refresh enrollment status, and generate or review recovery codes.",
        "Store recovery codes offline in a secure place. Each code should be treated like a temporary password and used only once.",
        "Do not enable organization-wide MFA enforcement until owners, managers, admins, and System Administrators have enrolled and recovery has been tested.",
        "Master Admin MFA Recovery is visible and usable only by the configured Master Admin. A written reason and audit trail are required."
      ]}
    ],
    notes: ["Support should never reveal whether an unverified email exists. Verify identity before any account-recovery action."]
  },
  {
    id: "settings-preferences-alerts",
    group: "System",
    title: "Settings: Preferences and Alerts",
    tab: "Settings > Preferences / Alerts",
    audience: "Each signed-in user",
    summary: "Choose readable display behavior, landing areas, notification preferences, and device alert setup.",
    keywords: "settings preferences alerts notification push density theme landing tab motion recipe display email sms",
    sections: [
      { title: "Preferences", steps: [
        "Choose your permitted landing tab, display density, recipe layout, theme or motion options, and other personal defaults.",
        "Keep readability first. Compact does not mean tiny; test the setting on the phone or tablet you actually use.",
        "If a selected landing tab is later disabled or permission-controlled, the app opens the safest available tab instead."
      ]},
      { title: "Alerts", steps: [
        "Choose which operational alerts you want and save the preference.",
        "Use the device notification setup to grant browser permission and register the push token.",
        "If alerts stop, confirm browser permission, operating-system notification settings, network access, and the saved device token before changing restaurant-wide settings.",
        "Dismissed app banners stay hidden for that exact message but reappear when the underlying content changes."
      ]}
    ],
    notes: ["Critical restaurant communication should have a backup process; push delivery can be affected by browser, device, network, or operating-system settings."]
  },
  {
    id: "settings-workspace-branding-integrations",
    group: "System",
    title: "Settings: Workspace, Branding, and Integrations",
    tab: "Settings > Workspace / Branding / Integrations",
    audience: "Owners and specifically permitted administrators",
    summary: "Control restaurant rules, display identity, geofence, enabled behavior, and external connections without weakening the 86 Chaos brand or security boundary.",
    keywords: "settings workspace branding integrations restaurant logo accent timezone date format geofence permissions menu intelligence enterprise",
    sections: [
      { title: "Workspace", steps: [
        "Set restaurant name, contact details, timezone, week start, clock rules, work-area location, and other operating defaults.",
        "For the geofence, confirm the map pin and radius at the physical restaurant. Test with a manager account before enforcing it.",
        "Review schedule, time-off, labor, and enabled-module options with the owner. A disabled module disappears for users.",
        "Save one group of related changes at a time and confirm the success message."
      ]},
      { title: "Branding and access", steps: [
        "Upload or paste a restaurant logo, choose an accessible accent color, and set help contact and display formats.",
        "The 86 Chaos name and logo stay visible. Restaurant branding may sit beside it but never replace it.",
        "Use Settings Access to grant trusted people access to Workspace, Branding, Integrations, or Menu Intelligence. Review the names before saving."
      ]},
      { title: "Integrations", steps: [
        "Integrations may depend on plan, provider credentials, or external setup. Read the status and required fields before connecting.",
        "Use testing credentials first when available. Never paste secrets into Message Board, Help, manual search, or screenshots.",
        "After connecting, run the smallest safe test and verify the correct workspace received the result."
      ]}
    ],
    notes: ["Owner-only settings are intentionally unavailable to ordinary managers unless the owner has explicitly granted access."]
  },
  {
    id: "system-audit",
    group: "System",
    title: "System Audit",
    tab: "System Audit",
    audience: "Restaurant administrators and System Administrators",
    summary: "Review who changed important records, when it happened, and whether a support or demo context was involved.",
    keywords: "system audit audit log action user timestamp before after ghost destructive support edit filter",
    sections: [
      { title: "Read the audit trail", steps: [
        "Filter by date, user, action, or target when available. Start narrow, then widen the search if needed.",
        "Open a row to compare the action, actor, time, workspace, target, and safe before/after details.",
        "Ghost, demo, support, security, and destructive markers provide context. They do not by themselves prove an action was incorrect.",
        "Preserve relevant records and notes before making a corrective change."
      ]}
    ],
    notes: ["Audit data can be sensitive. Share the minimum necessary excerpt and redact personal or security information."]
  },
  {
    id: "help-center",
    group: "System",
    title: "Help Center, Guided Tours, and Problem Reports",
    tab: "Help Center",
    audience: "Everyone",
    summary: "Search public-safe instructions, restart guided tours, and submit a useful problem report.",
    keywords: "help center search guide tour release notes report problem bug support screenshot diagnostics",
    sections: [
      { title: "Self-service help", steps: [
        "Search with plain words that describe the job or symptom, such as missed punch, geofence, inventory count, or schedule trade.",
        "Open the closest article and follow it in order. Help Center is public-safe and intentionally does not expose backend secrets or private admin procedures.",
        "Restart the Employee or Manager guided tour when someone skipped onboarding or needs a refresher.",
        "Read release notes after an update to learn about staff-facing behavior changes."
      ]},
      { title: "Report a problem", steps: [
        "Describe the screen, what you were trying to do, what you expected, what happened, and whether it repeats.",
        "Include the exact error message, date and time, device or browser, and safe steps to reproduce.",
        "Attach a screenshot only after checking that it contains no passwords, recovery codes, employee records, private customer information, or signed file links.",
        "For emergencies involving safety, payroll deadlines, or account compromise, follow the restaurant's urgent escalation process in addition to filing the report."
      ]}
    ],
    notes: ["The full operational manual is under System Administrator and is visible only to the configured platform administrator."]
  },
  {
    id: "system-admin-start-health-deploy",
    group: "System Administrator",
    title: "System Administrator: Command Center, Health, and Deployment",
    tab: "System Administrator > Start Here",
    audience: "Configured System Administrators only",
    summary: "Use the platform cockpit to understand current risk, test routes, and verify a release before changing production.",
    keywords: "system administrator command center health dashboard deployment readiness api route firebase version environment diagnostics",
    sections: [
      { title: "Command Center", steps: [
        "Start with the priority list and core counts. Open the named source tool for each warning instead of acting from the summary alone.",
        "Confirm which Firebase project, Vercel environment, host, and app version you are viewing before any platform change.",
        "Use the tool search to find a platform screen or this manual. The manual search is local and does not send questions to AI."
      ]},
      { title: "Health Dashboard", steps: [
        "Run Full System Diagnostics and wait for every route check to finish.",
        "Review API readiness, Firebase connectivity, storage, auth, backup integrity, and environment separation. A green browser card does not prove a background job is running.",
        "Copy a redacted diagnostic report when support evidence is needed. Never expose secrets or signed URLs."
      ]},
      { title: "Deployment Readiness", steps: [
        "Verify the app version, required environment variables, route manifest, Firestore rules, Storage rules, indexes, Functions, and release documents against the exact target environment.",
        "Test in the testing project first. Repeat the approved checklist in production; testing success does not publish production rules or secrets.",
        "Do not release while required security, backup, authentication, upload, or core operational checks are failing."
      ]},
      { title: "Training Manual and optional Gemini Knowledge Desk", steps: [
        "The Complete App Training Manual is the first section on the Manuals screen. Search by plain words, filter a chapter group, open any chapter, and use its checkbox to include or exclude it from printing.",
        "Select all, Select matching, and Clear all control the printable set. Print selected opens a clean new document containing only those chapters; choose Save as PDF in the browser print dialog for a PDF copy.",
        "Training-manual search, chapter selection, and printing are static browser features and make no AI calls.",
        "The existing Administrator Knowledge Desk remains below it as a separate optional troubleshooting tool. Its local playbook and articles can be used without generating a response; Generate plan sends the entered problem and redacted context to Gemini.",
        "If a generated repair plan stops at an output limit, read the finish reason and use Continue answer. Never paste passwords, keys, tokens, signed URLs, or employee files into the Gemini question."
      ]}
    ],
    notes: ["The complete training manual is deterministic and free to search. It is separate from, and does not remove, the optional Gemini Administrator Knowledge Desk."]
  },
  {
    id: "system-admin-backup-data",
    group: "System Administrator",
    title: "System Administrator: Backups, Restore, Forensics, and Data Tools",
    tab: "System Administrator > Backup & Recovery",
    audience: "Configured System Administrators only",
    summary: "Protect data before risky work, prove backups can be read, restore deliberately, and use import or export tools safely.",
    keywords: "system administrator backup restore forensics audit download integrity watchdog drill import export data csv retention",
    sections: [
      { title: "Backup Center", steps: [
        "Check the last successful backup, age, document count, storage path, integrity result, and watchdog status.",
        "Run Backup Now before risky migrations, repairs, broad settings changes, or restore work. Confirm the new file appears and passes integrity checks.",
        "Preview or download the selected backup before restore. Confirm its date, environment, workspace scope, and expected collections.",
        "Type the required confirmation exactly. Restore is merge-based unless the tool explicitly says otherwise. Record a restore drill after a verified test."
      ]},
      { title: "Forensics and data movement", steps: [
        "Use audit filters and forensic bundles to understand a sequence of changes. Keep evidence read-only while investigating.",
        "Use Import / Export Center templates and previews. Validate headers, dates, units, identifiers, and restaurant scope before writing.",
        "Make a backup before import. Start with a small sample and confirm the target records before importing the full file.",
        "Follow retention rules for archived punches, uploads, prep records, alerts, and scheduled workspace deletion."
      ]}
    ],
    notes: ["Never restore a production backup into the wrong project. Environment and workspace identity must be verified twice."]
  },
  {
    id: "system-admin-security-access",
    group: "System Administrator",
    title: "System Administrator: Security, Access, MFA, and Roles",
    tab: "System Administrator > Security & Access",
    audience: "Configured System Administrators only",
    summary: "Review security posture, manage platform administrators, recover MFA safely, and design least-privilege restaurant roles.",
    keywords: "system administrator security center app check mfa master admin recovery firestore storage rules super admin access role permission",
    sections: [
      { title: "Security Center", steps: [
        "Review App Check, MFA enrollment and enforcement, Firestore and Storage rule status, risky elevated users, environment separation, suspicious activity, and required secrets.",
        "Complete external steps in the matching Firebase or Vercel console, then rerun diagnostics. The app cannot safely pretend an external control is enabled.",
        "Enable MFA enforcement only after elevated users are enrolled and recovery has been tested."
      ]},
      { title: "Platform access and recovery", steps: [
        "Grant System Administrator access only through Access Control, using the exact verified email. Ask the person to sign out and in so claims refresh.",
        "Revoke access immediately when it is no longer required and review the audit trail.",
        "Master Admin MFA Recovery is restricted to the configured Master Admin, bound to the current verified account, requires a reason, and must be audited.",
        "Never move a user to another restaurant or elevate their role from untrusted form input during account repair."
      ]},
      { title: "Role Manager", steps: [
        "Start from least privilege. Separate staff editing, schedule editing, financials, inventory, recipes, admin tools, wage visibility, and forensics.",
        "Preview a role against real tabs and actions before saving.",
        "Review high-risk roles after staffing changes, support engagements, and releases."
      ]}
    ],
    notes: ["Only the configured Master Admin should see or use Master Admin MFA Recovery. Restaurant super-admin flags are not enough."]
  },
  {
    id: "system-admin-workspaces-people",
    group: "System Administrator",
    title: "System Administrator: Workspaces, People, Setup, and Branding",
    tab: "System Administrator > Workspaces & People",
    audience: "Configured System Administrators only",
    summary: "Onboard and support restaurants while keeping tenant data, user identity, modules, billing state, and branding correctly scoped.",
    keywords: "system administrator workspace client people directory setup wizard branding user move restaurant billing modules demo possess ghost",
    sections: [
      { title: "Workspaces and setup", steps: [
        "Search for the restaurant and confirm ID, owner, environment, billing state, maintenance status, modules, and user count.",
        "Use Setup Wizard for a new workspace. Save the owner login handoff once and verify the owner can sign in before wider onboarding.",
        "Workspace deletion starts a recovery window. Confirm the correct restaurant, backup it, record the reason, and understand what the later hard-delete job removes.",
        "Use Demo Manager or Demo Employee for customer demonstrations. Demo mode masks private details and blocks writes."
      ]},
      { title: "People Directory", steps: [
        "Search by name, email, ID, role, or restaurant. Confirm both Firebase Auth identity and Firestore profile before repair.",
        "Support Edit can correct safe profile fields, active status, workspace routing, or force password change. Add a support note and verify the target restaurant.",
        "Use possession or ghost tools only for authorized support, keep the banner visible, do not change client data unnecessarily, and exit promptly.",
        "Platform administrator access is never granted from the workspace user editor."
      ]},
      { title: "Branding", steps: [
        "Preview logo, colors, help contact, timezone, date and time formats, and landing behavior for the selected workspace.",
        "Keep the permanent 86 Chaos brand lock. A client logo complements it rather than replacing it."
      ]}
    ],
    notes: ["Tenant boundaries are a security control. Never trust a restaurantId supplied by an unverified browser request when performing repair or admin work."]
  },
  {
    id: "system-admin-support-monitoring",
    group: "System Administrator",
    title: "System Administrator: Support, AI Usage, Push, and Presence",
    tab: "System Administrator > Support & Monitoring",
    audience: "Configured System Administrators only",
    summary: "Diagnose customer problems with minimum data exposure and monitor capped AI, push delivery, and on-demand presence.",
    keywords: "system administrator support diagnostics crash logs ai usage scan limits push control tokens presence snapshot customer problem",
    sections: [
      { title: "Support Diagnostics", steps: [
        "Start with the customer's exact time, workspace, user, device, screen, action, and error.",
        "Review crash logs, permission errors, route status, authentication clues, and recent audit actions. Correlate evidence before changing data.",
        "Use Raw JSON only when normal screens cannot explain the problem, and redact private fields from anything shared."
      ]},
      { title: "AI Usage / Scan Limits", steps: [
        "Choose the month and review invoice and menu pages charged versus processed, scan count, failures, blocked requests, bypasses, provider, and model.",
        "Workspace overrides may lower or set business limits, but server hard caps, allowed low-cost models, output limits, call budgets, rate limits, and duplicate locks remain authoritative.",
        "Investigate repeated failures before allowing retries. Do not raise limits merely to hide a file-quality or workflow problem."
      ]},
      { title: "Push and presence", steps: [
        "Use Push Control Center to inspect token age, permission state, stale devices, and targeted test results. A token does not guarantee the operating system will display a notification.",
        "Use Manual Presence Snapshot only when needed. It performs an on-demand read instead of keeping an expensive platform-wide live listener open.",
        "Presence is an operational clue, not proof that a person is actively reading the app."
      ]}
    ],
    notes: ["Do not paste customer secrets or employee files into diagnostic assistants. Use redacted operational facts only."]
  },
  {
    id: "system-admin-maintenance-platform",
    group: "System Administrator",
    title: "System Administrator: Maintenance, Releases, Platform Operations, and Danger Zone",
    tab: "System Administrator > Maintenance & Releases / Platform Tools",
    audience: "Configured System Administrators only",
    summary: "Control maintenance notices, run hardening checks, review release history, broadcast carefully, and use guarded destructive tools last.",
    keywords: "system administrator maintenance mode release history robustness suite platform operations broadcast danger zone delete reset force logout",
    sections: [
      { title: "Maintenance and releases", steps: [
        "Choose global or workspace scope, audience, message, start, and end time. Preview the wording before enabling Maintenance Mode.",
        "Keep System Administrator access available during maintenance so recovery is possible.",
        "Use Robustness Suite for storage, schema, permission, backup-preview, import, offline-queue, and release-guardrail checks.",
        "Use Version History to connect a visible behavior with the release that introduced or changed it."
      ]},
      { title: "Platform Operations", steps: [
        "Use broadcasts only for important platform-wide or workspace-specific information. Confirm scope, audience, dates, and wording.",
        "Test in a demo or testing workspace when possible and verify the alert can be dismissed or expires correctly.",
        "Record an operations review after checking real health, backup, security, and customer signals."
      ]},
      { title: "Danger Zone", steps: [
        "Make and verify a fresh backup first. Read the named target, scope, effect, recovery path, and confirmation phrase out loud before continuing.",
        "Prefer the guarded source tool linked by the Danger Zone card. Do not use a broader action when a user-level or workspace-level fix is enough.",
        "After the action, verify the result from a second screen or account and preserve the audit evidence."
      ]}
    ],
    notes: ["Danger Zone is the last stop, not a shortcut. If scope or recovery is unclear, stop and investigate."]
  }
,
  {
    id: "complete-app-feature-map",
    group: "Coverage Index",
    title: "Complete App Feature Map",
    tab: "Whole app",
    audience: "Owners, managers, trainers, and System Administrators",
    summary: "A plain-language map of every major 86 Chaos area so training does not miss hidden or restricted tools.",
    keywords: "complete app feature map all tabs prep inventory invoices ai scans menu intelligence alerts recipes reminders message board schedule time clock labor financials daily close tips cogs pnl reports settings plan billing system administrator security backup push help manual training",
    sections: [
      { title: "Core daily operation areas", steps: [
        "Manager Brief is the daily command snapshot for permitted managers. Shift users may see Today Home instead so they are not stranded on a locked Manager Brief screen.",
        "Kitchen Command Center collects kitchen priorities such as prep status, 86 alerts, low-stock signals, menu impact alerts, specials, and service readiness for users whose plan and role allow it.",
        "Prep & Tasks covers food prep plus recurring daily, weekly, and monthly task routines. Inventory & Orders covers counts, par levels, vendors, invoice history, and burn/waste logging. Recipe Book stores recipe cards and kitchen reference information.",
        "Message Board is the team communication hub for announcements, important notices, 86 alerts, read receipts, and staff-facing updates. My Reminders stores private reminders and supported shared reminders/tasks.",
        "Never put confidential HR notes, wage details, passwords, provider secrets, recovery codes, signed links, or private customer data in team-facing tools."
      ]},
      { title: "Scheduling, labor, and financial areas", steps: [
        "Time Clock & Schedule includes My Schedule, Full Schedule, Month View, Trade Board, Time Off, and Schedule Builder where allowed.",
        "Labor Command and timesheets cover open punches, missed punches, long shifts, overtime risk, geofence review, payroll readiness, tip summaries, punch correction, and labor exports.",
        "Financial Center covers Overview, Daily Close, Sales Breakdown, Labor & Payroll, Tip Center, Cost Center / COGS, Expenses, P&L Snapshot, Targets, and Reports.",
        "Daily Close feeds Financial Center with sales, cash, card, gift card, tax, tips paid out, deposits, close status, variance, manager sign-off, and notes.",
        "Prime Cost, Cost Center, P&L, and owner snapshots are operational visibility tools, not full accounting or tax filing replacements."
      ]},
      { title: "AI-assisted and smart kitchen areas", steps: [
        "AI Tools include approved scanning workflows such as invoice scanning and recipe/file extraction where available.",
        "Invoice scanning is AI-assisted and review-first. Scanned rows do not affect inventory, vendor spend, reports, or Cost Center until a manager reviews and approves the result.",
        "Menu Intelligence is AI-assisted and review-first. Menu scan results and inferred dependencies should be reviewed before they power menu impact alerts.",
        "86 alerts can show affected menu items when approved dependencies exist. When dependencies are missing, the app should guide managers to complete menu/inventory setup.",
        "Voice Assistant Preview can navigate, search Help, find recipes, create prep/reminders, and stage 86 alerts without bypassing plan gates or permissions."
      ]},
      { title: "Account, admin, and support areas", steps: [
        "Staff Roster manages employees, custom Roster Roles, permissions, wages where allowed, generated logins, active status, and staff records.",
        "Any feature that uses roles must use owner-created Roster Roles as the source of truth, with generic labels only as fallback when no roles exist.",
        "HR & Training manages training-manual uploads, acknowledgments, onboarding tasks, certifications, and confidential performance notes. Training uploads do not use AI and are size-limited.",
        "Settings contains profile, account security, preferences, alerts, Plan & Billing, workspace configuration, branding, integrations-coming-soon, ownership transfer, and security/workspace controls according to permission.",
        "System Audit gives permitted owners/admins a restaurant-level change trail. System Administrator gives internal platform operators the deeper platform tools, diagnostics, backups, plan controls, push center, access control, and repair utilities."
      ]}
    ],
    notes: ["Use this chapter as the first checklist when training a new owner or checking whether Help Center and the Administrator Manual mention every major feature."]
  },
  {
    id: "security-ip-whitelisting-access-controls",
    group: "Security & Access",
    title: "IP Whitelisting, Geofencing, MFA, and Access Controls",
    tab: "Settings > Workspace / System Administrator > Security Center",
    audience: "Owners, managers with workspace permission, and System Administrators",
    summary: "Explains strict IP whitelisting and the surrounding security controls so restaurants do not accidentally lock themselves out.",
    keywords: "ip whitelist whitelisting whistling allowed ip address strict ip security center geofence mfa app check account security access locked out wifi static dynamic mobile data vpn",
    sections: [
      { title: "What IP whitelisting does", steps: [
        "Strict IP Whitelisting allows access only from configured public IP addresses, such as a restaurant's secure Wi-Fi connection.",
        "It is different from geofencing. Geofencing reviews GPS location for time-clock behavior; IP whitelisting limits network access to the app itself when enabled.",
        "The control is plan-gated and should appear only where Security Center or internal access allows it.",
        "Use comma-separated public IP addresses only. Local router addresses such as 192.168.x.x are usually not the public address that the app sees."
      ]},
      { title: "Before turning it on", steps: [
        "Confirm the restaurant has a stable public IP from the internet provider.",
        "Test from the restaurant Wi-Fi, from the owner's normal device, and from a manager account before relying on the setting during service.",
        "Keep a verified owner/System Administrator recovery path available.",
        "Phones on mobile data, employees at home, VPN users, and traveling owners may be blocked if their current public IP is not listed."
      ]},
      { title: "How to recover or troubleshoot", steps: [
        "If users suddenly cannot load the app after IP controls are enabled, confirm whether they are on the approved network or a different network/mobile data.",
        "Have a permitted owner or System Administrator review Settings > Workspace security controls or System Administrator support tools from an approved location.",
        "If the restaurant's public IP changed, update the authorized IP list before asking staff to retry.",
        "Do not use IP whitelisting as the only security control. Keep role permissions, plan gates, Firebase rules, App Check, MFA for elevated users, and audit logging active."
      ]},
      { title: "Related controls", steps: [
        "Account Security covers password reset, email verification, MFA status, recovery-code behavior, and sign-in hygiene.",
        "Security Center tracks App Check, MFA, rules status, suspicious activity, elevated access, environment readiness, and required secrets.",
        "Geofence review helps managers understand off-site clock activity without replacing payroll review.",
        "System Audit and admin audit logs should record sensitive changes such as access changes, subscription changes, restore actions, punch edits, and security setting changes."
      ]}
    ],
    notes: ["If someone calls this IP whistling, search Help Center for whistling or whitelist; both should lead here."]
  },
  {
    id: "plans-founder-beta-billing-integrations",
    group: "Plans & Billing",
    title: "Plans, Founder Beta, Scan Limits, Billing, and Integrations",
    tab: "Settings > Plan & Billing / Settings > Integrations",
    audience: "Owners and managers who are allowed to view billing; System Administrators for manual changes",
    summary: "Explains the tier system, beta access, scan usage, coming-soon billing, and why integrations are locked for customers.",
    keywords: "plan billing founder beta shift operations smart kitchen owner pro scan limits invoice pages menu pages integrations coming soon pricing selected future tier discount payments stripe locked",
    sections: [
      { title: "Customer tiers", steps: [
        "Shift includes basic dashboard/home, roster view, messages, prep, basic 86 alerts, recipes, reminders, Help Center, schedule viewing, basic permissions, and mobile access.",
        "Operations adds Schedule Builder, Time Clock, Timesheets, Labor Command, geofence review, payroll readiness, Tip Center, Daily Close, Sales Breakdown, Manager Brief, Kitchen Command Center, routines, basic inventory, Burn Log, basic reports, and basic audit.",
        "Smart Kitchen adds Financial Overview, Prime Cost, Cost Center / COGS, invoice totals, vendor spend, scan tools, Menu Intelligence, smart 86 alerts, Budget & Targets, P&L Snapshot, monthly owner report, advanced reports, backups, and security visibility where appropriate.",
        "Owner Pro adds Smart Kitchen plus multi-location/cross-location placeholders, higher scan limits, more backup history, priority support placeholders, advanced audit exports, custom onboarding placeholders, and tier-eligible early access. Master Admin/System Admin is internal only."
      ]},
      { title: "Founder Beta lifecycle", steps: [
        "Founder Beta restaurants use the app free during active beta. Intended beta is 60 days, with one 30-day extension controlled by Master Admin/System Administrator.",
        "Founder Beta workspaces should default to Smart Kitchen access unless a selected future tier is set.",
        "After beta, Founder Beta accounts receive 50% off the selected future tier for 12 months.",
        "While live billing is not implemented, beta restaurants should not suddenly be locked out merely because beta ended. Internal admins should manually convert status after confirming with the customer."
      ]},
      { title: "Scan limits and integrations", steps: [
        "Invoice and menu scan limits are tracked monthly by workspace, scan type, pages used, and user when possible and must be checked before an expensive AI/API call starts.",
        "Plan & Billing shows current plan, beta status, normal launch price, founder price, discount end date, scan usage, included features, integration lock status, and Payments coming soon.",
        "Staff should not see billing controls or upgrade clutter.",
        "Integrations are locked for all customer tiers, including Founder Beta. Do not store future live POS, payroll, or accounting secrets in normal customer Firestore fields."
      ]}
    ],
    notes: ["Plan access and user permissions are separate. A user needs both before the feature is usable."]
  },
  {
    id: "push-notifications-restaurant-groups",
    group: "Communication",
    title: "Push Notifications and Restaurant Group Broadcasts",
    tab: "System Administrator > Push Control Center / Message Board",
    audience: "Owners for normal push behavior; System Administrators for group broadcasts",
    summary: "Explains device opt-in, token health, individual tests, workspace messages, and internal restaurant-group push sends.",
    keywords: "push notifications restaurant group broadcast selected workspace all workspaces tokens permission quiet hours stale token message board alert test critical system administrator",
    sections: [
      { title: "Normal push behavior", steps: [
        "Users must allow notifications on the browser/device. If they deny permission, the app cannot force the operating system to show notifications.",
        "Push tokens can become stale when a user changes device, clears browser data, disables notifications, or reinstalls/adds the app again.",
        "Message Board, 86 alerts, reminders, schedule alerts, and important workspace notices can surface through push where supported and user preferences allow it.",
        "A successful server send means the message was handed to Firebase Cloud Messaging; it does not guarantee the phone or desktop displayed it."
      ]},
      { title: "Push Control Center", steps: [
        "System Administrator can inspect token age, permission state, stale/missing tokens, repair hints, and test sends from Push Control Center.",
        "Targeted Push Broadcast can send to one selected workspace, one selected restaurant group, or all workspaces. Group/platform sends are internal-only.",
        "Restaurant groups are detected from workspace group fields such as restaurantGroupName, groupName, restaurantGroupId, branding/system settings group labels, or owner email fallback.",
        "Before sending, preview the matching workspace, user, and token counts."
      ]},
      { title: "Safe sending rules", steps: [
        "Use clear titles and short messages. Do not include passwords, recovery codes, employee private details, wages, provider keys, or signed file links.",
        "Respect quiet hours unless the message is genuinely critical and the workflow supports a critical flag.",
        "Audit logs should capture meaningful push send details.",
        "If a customer says they did not receive a push, check in-app notification, token health, device permission, and the last send result."
      ]}
    ],
    notes: ["Restaurant-group push is an internal platform tool, not a normal staff feature."]
  },
  {
    id: "owner-snapshots-reports-exports",
    group: "Reports & Snapshots",
    title: "Owner Snapshots, Reports, and Exports",
    tab: "Financial Center > Reports / System Audit / Inventory / Labor",
    audience: "Owners and permitted managers",
    summary: "Explains which reports are operational snapshots, how exports are used, and where numbers come from.",
    keywords: "owner snapshot report export csv pdf print daily close labor tips cogs vendor spend pnl prime cost inventory sales audit role filters roster roles",
    sections: [
      { title: "Operational snapshot rule", steps: [
        "86 Chaos reports are owner-ready operational snapshots. They are not a full accounting ledger or tax-ready bookkeeping system.",
        "Daily Close reports use saved close records. Labor and tip reports use time punches, staff records, and wage/tip permissions.",
        "COGS and vendor visibility use approved invoice history, burn/waste data, and item cost information where available.",
        "If setup data is missing, the report should say what is missing instead of showing a blank or pretending the data is complete."
      ]},
      { title: "Exports and role filters", steps: [
        "Labor exports can show detailed time-punch rows or total-hours summaries.",
        "Reports, exports, schedule coverage, dashboards, and filters that group by role must use the account owner's custom Roster Roles from Preferences / Roster Roles.",
        "Financial exports and owner reports should be restricted to users with a real business need.",
        "Use System Audit or admin audit logs when you need to understand who edited sensitive records."
      ]}
    ],
    notes: ["If a report cannot explain the source of a number, treat it as incomplete until the source wiring is confirmed."]
  },
  {
    id: "system-admin-feature-access-resolver-plan-tools",
    group: "System Administrator",
    title: "System Administrator: Plan Tools, Feature Resolver, and Beta Controls",
    tab: "System Administrator > Workspaces / Plans / Feature Access Resolver",
    audience: "Configured System Administrators only",
    summary: "Use internal tools to answer why a feature is available or locked without exposing internal controls to customers.",
    keywords: "system administrator feature access resolver plan allowed role allowed manual enabled final allowed reason founder beta extension selected future tier scan usage reset audit subscription",
    sections: [
      { title: "Feature access resolver", steps: [
        "Select the workspace, user, and feature key. Review current plan, selected future tier, beta status, planAllowed, roleAllowed, manualEnabled, final allowed/locked result, and reason.",
        "Use the resolver before changing permissions. If planAllowed is false, a role edit will not unlock the feature. If roleAllowed is false, a plan upgrade alone will not give the user access.",
        "Master Admin/System Administrator may bypass plan locks for testing, but customer owners and staff should still see the normal plan/permission result.",
        "Document the reason in the support note or audit log when you change plan, permission, beta, or manual feature settings."
      ]},
      { title: "Founder Beta and scan tools", steps: [
        "Existing workspaces with no subscription data should be backfilled safely rather than falling into Shift and losing access.",
        "For a new beta workspace, set status beta, isFounderBeta true, planId smart_kitchen, selectedFutureTier smart_kitchen unless changed, beta dates, founderDiscountPercent 50, billingProvider none/manual, integrationsLocked true, and timestamps.",
        "Use the manual flow to extend beta by 30 days, end beta, cancel, or convert beta ended to active manual with founder discount.",
        "Every plan, beta, discount, scan reset, or integration-lock change must write an audit log."
      ]}
    ],
    notes: ["Feature resolver output is an internal diagnostic aid. Help Center should explain plan/permission concepts without exposing internal bypass behavior."]
  },
  {
    id: "system-admin-integrations-ip-secret-safety",
    group: "System Administrator",
    title: "System Administrator: Integrations, IP Controls, and Secret Safety",
    tab: "System Administrator > Security / Settings > Integrations",
    audience: "Configured System Administrators only",
    summary: "Keep customer integration screens locked, prevent accidental secret storage, and use IP controls carefully.",
    keywords: "system administrator integrations locked oauth api keys pos accounting payroll secrets firestore encrypted server side ip whitelist strict ip lockout recovery provider setup placeholder",
    sections: [
      { title: "Integration lock and secret safety", steps: [
        "All customer tiers, including Founder Beta, Shift, Operations, Smart Kitchen, and Owner Pro, should see Integrations are coming soon rather than unfinished provider setup.",
        "Only Master Admin/System Administrator testing accounts should access internal integration test screens.",
        "Do not expose unfinished OAuth flows, provider credentials, API-key fields, accounting setup, payroll setup, or POS tools to customers until the full server-side security design is complete.",
        "Never store future live POS, payroll, or accounting secrets in customer-readable Firestore documents or normal workspace settings."
      ]},
      { title: "IP whitelist operations", steps: [
        "Before enabling strict IP whitelisting, verify the public IP from the restaurant network and confirm the owner has a tested recovery path.",
        "Do not test strict IP controls for the first time during peak service.",
        "When investigating lockouts, compare the user's current public IP and network type against the saved whitelist, then update or disable the control from an approved admin path if necessary.",
        "IP whitelisting complements, but does not replace, authentication, MFA, App Check, plan gates, Firestore rules, and role permissions."
      ]}
    ],
    notes: ["Secrets and lockout controls are two of the easiest ways to turn a normal support ticket into a kitchen fire. Slow down and verify scope."]
  }
];
