import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  CalendarDays,
  Camera,
  CheckCircle,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Database,
  DollarSign,
  Download,
  Flame,
  HardDrive,
  HelpCircle,
  LineChart,
  Lock,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Package,
  Percent,
  PieChart,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Star,
  Target,
  Timer,
  TrendingUp,
  Truck,
  Upload,
  Users,
  UserCheck,
  Utensils,
  Wallet,
  Wrench,
  Zap
} from 'lucide-react';
import { CURRENT_VERSION, formatDate, getToday, useLiveCollection } from '../core/appCore';

const safeArray = (value) => Array.isArray(value) ? value : [];
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(Number(n)) ? Number(n) : 0));
const money = (value) => Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const dollars = (value) => Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = (dateString) => {
  try { return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }); }
  catch (_) { return dateString || 'Today'; }
};
const clock = (date = new Date()) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const normalizeRole = (role = '') => String(role || 'Team').trim() || 'Team';
const itemName = (item = {}, fallback = 'Item') => item.name || item.itemName || item.title || item.recipeName || fallback;
const createdStamp = (item = {}) => item.createdAt || item.timestamp || item.updatedAt || item.date || '';
const byDate = (row = {}, date) => String(row.date || row.saleDate || row.businessDate || row.shiftDate || row.createdAt || '').slice(0, 10) === date;
const sumNumbers = (items, picker) => safeArray(items).reduce((total, item) => total + Number(picker(item) || 0), 0);
const sample = (arr, fallback) => safeArray(arr).length ? arr : fallback;

const Panel = ({ title, action = 'View all', icon: Icon, children, className = '', onAction }) => {
  const actionNode = React.isValidElement(action)
    ? action
    : action
      ? <button type="button" className="ref-panel-action" onClick={onAction}>{action} <ChevronRight size={13} /></button>
      : null;
  return (
    <section className={`ref-panel ${className}`}>
      <header className="ref-panel-head">
        <div>{Icon && <Icon size={16} />}<h3>{title}</h3></div>
        {actionNode}
      </header>
      <div className="ref-panel-body">{children}</div>
    </section>
  );
};

const Metric = ({ icon: Icon = Activity, label, value, sub, tone = 'copper', trend = 'up' }) => (
  <div className={`ref-metric tone-${tone}`}>
    <span className="ref-metric-icon"><Icon size={26} /></span>
    <div className="ref-metric-copy">
      <small>{label}</small>
      <strong>{value}</strong>
      {sub && <span className={trend === 'down' ? 'down' : 'up'}>{sub}</span>}
    </div>
    <MiniSpark tone={tone} />
  </div>
);

const MiniSpark = ({ tone = 'green' }) => {
  const points = [12, 18, 22, 20, 31, 28, 44, 40, 51, 46, 64];
  return <div className={`ref-spark tone-${tone}`}>{points.map((p, idx) => <i key={idx} style={{ height: `${18 + p / 2}px` }} />)}</div>;
};

const Donut = ({ value = 50, label, tone = 'green', size = 'md' }) => (
  <div className={`ref-donut ref-donut-${size} tone-${tone}`} style={{ '--value': `${clamp(value)}%` }}>
    <strong>{Math.round(clamp(value))}{String(value).includes('.') ? '' : '%'}</strong>
    <span>{label}</span>
  </div>
);

const Progress = ({ value = 0, tone = 'green' }) => <div className="ref-progress"><i className={`tone-${tone}`} style={{ width: `${clamp(value)}%` }} /></div>;
const Status = ({ children, tone = 'green' }) => <span className={`ref-status tone-${tone}`}>{children}</span>;
const Dot = ({ tone = 'green' }) => <i className={`ref-dot tone-${tone}`} />;

const Page = ({ eyebrow, title, subtitle, right, metrics, children, className = '' }) => (
  <div className={`ref-screen ${className}`}>
    <div className="ref-page-title">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right && <div className="ref-page-actions">{right}</div>}
    </div>
    {metrics && <div className="ref-metric-grid">{metrics}</div>}
    {children}
  </div>
);

const rolesFromUsers = (users = [], clientData = {}) => {
  const configured = clientData?.systemSettings?.rosterRoles || clientData?.rosterRoles || clientData?.roles;
  const names = safeArray(configured).map(role => typeof role === 'string' ? role : role?.name).filter(Boolean);
  const fallback = safeArray(users).map(u => normalizeRole(u.role)).filter(Boolean);
  return Array.from(new Set([...names, ...fallback])).slice(0, 8).length ? Array.from(new Set([...names, ...fallback])).slice(0, 8) : ['Manager', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Dishwasher', 'Server'];
};

const weeklyDates = (currentDate) => {
  const base = new Date(`${currentDate || getToday()}T12:00:00`);
  const dow = base.getDay();
  base.setDate(base.getDate() - dow);
  return Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(base);
    d.setDate(base.getDate() + idx);
    return formatDate(d);
  });
};

const getShiftFor = (shifts, user, date, idx) => {
  const ids = [user.id, user.userId, user.uid, user.authUid].filter(Boolean).map(String);
  const hit = safeArray(shifts).find(s => String(s.date || s.shiftDate || s.scheduleDateKey || '').slice(0, 10) === date && ids.includes(String(s.employeeId || s.userId || s.uid || '')));
  if (hit) return hit.startTime && hit.endTime ? `${hit.startTime} – ${hit.endTime}` : hit.label || hit.time || 'Scheduled';
  const presets = ['9a – 5p', '10a – 6p', '11a – 7p', '4p – 12a', '5p – 11p', 'OFF'];
  return presets[(idx + new Date(`${date}T12:00:00`).getDay()) % presets.length];
};

const totalHoursForUser = (shifts, user, week) => {
  const ids = [user.id, user.userId, user.uid, user.authUid].filter(Boolean).map(String);
  const real = safeArray(shifts).filter(s => week.includes(String(s.date || s.shiftDate || s.scheduleDateKey || '').slice(0, 10)) && ids.includes(String(s.employeeId || s.userId || s.uid || '')));
  if (real.length) return sumNumbers(real, s => s.totalHours || s.hours || s.durationHours || 8).toFixed(2);
  return (24 + (String(user.name || '').length % 5) * 4 + (String(user.role || '').length % 3) * 2).toFixed(2);
};

const tableUsers = (users = []) => sample(safeArray(users).filter(u => u?.isActive !== false), [
  { id: 'u1', name: 'Maria Gomez', role: 'Manager' },
  { id: 'u2', name: 'James Peterson', role: 'Sous Chef' },
  { id: 'u3', name: 'Jessica Lee', role: 'Line Cook' },
  { id: 'u4', name: 'Chris Barnes', role: 'Prep Cook' },
  { id: 'u5', name: 'Amanda Kim', role: 'Bartender' },
  { id: 'u6', name: 'Tyler R.', role: 'Server' },
  { id: 'u7', name: 'Sofia Martinez', role: 'Server' },
  { id: 'u8', name: 'Daniel Wright', role: 'Host' }
]).slice(0, 8);

export function ReferenceToday({ currentDate = getToday(), appUser = {}, users = [], shifts = [], sales = [], timePunches = [], inventoryItems = [], prepItems = [], tasks = [], restaurantAdminAlerts = [], clientData = {}, setActiveTab }) {
  const todaySales = sumNumbers(sales.filter(s => byDate(s, currentDate)), s => s.netSales || s.total || s.amount || s.sales || s.grossSales) || 18642;
  const todayLabor = sumNumbers(timePunches.filter(p => byDate(p, currentDate)), p => p.laborCost || p.cost || (Number(p.hours || 0) * Number(p.wage || 16))) || Math.round(todaySales * .247);
  const laborPct = todaySales ? (todayLabor / todaySales) * 100 : 24.7;
  const lowStock = safeArray(inventoryItems).filter(i => Number(i.parLevel || 0) > 0 && Number(i.currentStock ?? i.onHand ?? 0) < Number(i.parLevel || 0));
  const activeAlerts = sample([...safeArray(restaurantAdminAlerts), ...lowStock.map(i => ({ title: itemName(i), severity: Number(i.currentStock || 0) <= 0 ? 'Out of Stock' : 'Low Stock' }))], [
    { title: 'Sirloin Steak', severity: 'Out of Stock' }, { title: 'Sea Bass', severity: 'Low Stock' }, { title: 'Rye Bread', severity: 'Out of Stock' }, { title: 'Lemons', severity: 'Low Stock' }
  ]).slice(0, 5);
  const prepDone = safeArray(prepItems).filter(p => ['done','complete','completed'].includes(String(p.status || '').toLowerCase())).length;
  const prepTotal = Math.max(safeArray(prepItems).length, 47);
  const prepPct = prepTotal ? Math.round((prepDone || 32) / prepTotal * 100) : 68;
  const staff = tableUsers(users).slice(0, 5);
  return <Page title="Today" subtitle={`Here's what's happening at ${appUser?.restaurantName || clientData?.name || 'your kitchen'}`} right={<button type="button" className="ref-top-date"><CalendarDays size={15}/> {shortDate(currentDate)}</button>} metrics={[
    <Metric key="sales" icon={DollarSign} label="Sales Today" value={money(todaySales)} sub="↑ 12.4% vs yesterday" tone="copper" />,
    <Metric key="labor" icon={Users} label="Labor % (Today)" value={`${laborPct.toFixed(1)}%`} sub="↓ 1.3 pp" tone="green" />,
    <Metric key="forecast" icon={BarChart3} label="Forecast Sales" value={money(todaySales * 1.17)} sub="AI forecast • 8.7%" tone="copper" />,
    <Metric key="covers" icon={UserCheck} label="Covers (Lunch / Dinner)" value="86 / 152" sub="↑ 9% / ↑ 14%" tone="green" />,
    <Metric key="food" icon={PieChart} label="Food Cost % (MTD)" value="29.6%" sub="vs last month ↓ 1.8 pp" tone="copper" />,
    <Metric key="alerts" icon={AlertTriangle} label="Active 86 Alerts" value={String(activeAlerts.length)} sub="Needs attention" tone="red" trend="down" />
  ]}>
    <div className="ref-today-grid">
      <Panel title="Today's Shift Coverage" icon={Users} action="View Schedule" onAction={() => setActiveTab?.('published')}>
        <div className="ref-coverage-chart">
          {['BOH','FOH'].map((label, idx) => <div key={label} className="ref-coverage-row"><b>{label}</b><div><i style={{ width: idx ? '76%' : '82%' }} /><em style={{ left: idx ? '44%' : '62%' }} /></div><span>{idx ? '76%' : '82%'}</span></div>)}
          <div className="ref-legend"><span><Dot/>Scheduled</span><span><Dot tone="yellow"/>Gap</span><span><Dot tone="red"/>Overtime</span><span><Dot tone="slate"/>Open Shift</span></div>
        </div>
      </Panel>
      <Panel title="Kitchen Command Center" icon={ShieldCheck} action="Live Snapshot">
        {[['Ticket Time','4:32','Good'], ['Average Prep Time','6:15','Good'], ['Order Accuracy','97.5%','Good'], ['Voids','2.1%','Caution'], ['Rush Status','Moderate','Moderate'], ['Kitchen Health','Good','Good']].map(([a,b,c]) => <div className="ref-kv" key={a}><span>{a}</span><b>{b}</b><Status tone={c === 'Good' ? 'green' : 'yellow'}>{c}</Status></div>)}
      </Panel>
      <Panel title="Active 86 Alerts" icon={AlertTriangle} action={`View All (${activeAlerts.length})`}>
        <div className="ref-list tight">{activeAlerts.map((alert, idx) => <div className="ref-alert-row" key={`${alert.title}-${idx}`}><Dot tone={idx < 3 ? 'red' : 'yellow'} /><span>{alert.title || alert.itemName || alert.type || 'Alert'}</span><small>{alert.severity || alert.status || 'Low Stock'}</small><b>{idx + 1}</b></div>)}</div>
      </Panel>
      <Panel title="Prep Progress" icon={ClipboardCheck} action="View Prep List">
        <div className="ref-side-stat"><Donut value={prepPct} label="Completed" /><div>{['Chicken Breasts','Burger Patties','Sliced Veggies','Sauce Prep'].map((n,idx)=><div className="ref-prep-mini" key={n}><span>{n}</span><Progress value={[100,80,60,20][idx]} tone={idx < 2 ? 'green' : idx === 2 ? 'yellow' : 'red'} /><b>{[10,8,6,2][idx]} / {idx===0 ? 10 : idx===1 ? 10 : idx===2 ? 8 : 6}</b></div>)}</div></div>
      </Panel>
      <Panel title="Low Stock Inventory" icon={Package} action="View Inventory" onAction={() => setActiveTab?.('inventory')}>
        <div className="ref-table compact"><div className="head"><span>Item</span><span>On Hand</span><span>Par</span><span>Need</span><span>Unit</span></div>{sample(lowStock, [{name:'Ribeye 12 oz', currentStock:3, parLevel:20, unit:'each'}, {name:'Chicken Breast', currentStock:6, parLevel:20, unit:'lb'}, {name:'Heavy Cream', currentStock:1, parLevel:6, unit:'qt'}, {name:'Parmesan', currentStock:.4, parLevel:2, unit:'lb'}]).slice(0,5).map(i => <div className="tr" key={itemName(i)}><span>{itemName(i)}</span><b>{i.currentStock ?? i.onHand ?? 0}</b><span>{i.parLevel || i.par || 0}</span><b className="bad">{Math.max(0, Number(i.parLevel || i.par || 0) - Number(i.currentStock ?? i.onHand ?? 0)).toFixed(Number(i.currentStock) % 1 ? 1 : 0)}</b><span>{i.unit || 'ea'}</span></div>)}</div>
      </Panel>
      <Panel title="Labor Snapshot" icon={Percent} action="View Labor"><div className="ref-side-stat"><Donut value={laborPct} label="Labor %" tone="copper" /><div><div className="ref-kv"><span>Total Labor</span><b>{money(todayLabor)}</b></div><div className="ref-kv"><span>Sales</span><b>{money(todaySales)}</b></div><div className="ref-kv"><span>Labor Goal</span><b>25.0%</b></div><div className="ref-kv"><span>Variance</span><b className="good">-0.3 pp</b></div></div></div></Panel>
      <Panel title="Sales Snapshot" icon={LineChart} action="View Sales"><div className="ref-chart-line"><svg viewBox="0 0 320 130" preserveAspectRatio="none"><polyline points="0,118 35,106 70,88 105,64 140,42 175,49 210,34 245,55 280,25 320,18"/><polyline className="ghost" points="0,120 35,112 70,102 105,84 140,70 175,66 210,58 245,48 280,44 320,36"/></svg><div className="ref-sales-aside"><b>{money(todaySales * 6.9)}</b><span>MTD</span><b>{money(todaySales * 20.2)}</b><span>LY MTD</span><b>96%</b><span>Goal</span></div></div></Panel>
      <Panel title="Reminders" icon={Bell} action="View all reminders" onAction={() => setActiveTab?.('reminders')}><div className="ref-list">{['Monthly Food Inventory','Manager Meeting','Vendor Delivery','Clean Fryer #2'].map((r,idx)=><div className="ref-row" key={r}><b>{['10:00 AM','11:00 AM','2:00 PM','5:00 PM'][idx]}</b><span>{r}</span><small>{['Due Today','Back Office','Sysco','Maintenance'][idx]}</small></div>)}</div></Panel>
      <Panel title="Manager Brief" icon={Rocket} action="View full manager brief" onAction={() => setActiveTab?.('ops')}><div className="ref-list">{['AI forecast: Sales trending above yesterday.','Prep behind on sauce prep and sliced veggies.','Chicken breast usage is above forecast.','Labor is optimal. Great job staying under target.'].map(t => <div className="ref-check" key={t}><CheckCircle size={15}/><span>{t}</span></div>)}</div></Panel>
      <Panel title="86Voice Command" icon={Mic} action="Open Voice Command" onAction={() => setActiveTab?.('ai-tools')}><div className="ref-voice-quick"><div className="ref-mic-orb"><Mic size={28}/></div><p>What would you like to do?</p><div>{['86 Sirloin Steak','Check Inventory','How we doing?','Order Status','Prep Check','Labor Report'].map(q=><button type="button" key={q}>{q}</button>)}</div></div></Panel>
      <Panel title="Staff on Shift" icon={Users} action="View Roster" onAction={() => setActiveTab?.('team')}><div className="ref-table compact"><div className="head"><span>Name</span><span>Role</span><span>Clock In</span><span>Status</span></div>{staff.map((u,idx)=><div className="tr" key={u.id || u.name}><span>{u.name}</span><span>{u.role || 'Staff'}</span><span>{['8:00 AM','9:00 AM','9:30 AM','10:00 AM','10:00 AM'][idx] || '10:00 AM'}</span><Status>In</Status></div>)}</div></Panel>
      <Panel title="Message Board" icon={MessageSquare} action="View All" onAction={() => setActiveTab?.('messages')}><div className="ref-message-preview"><b>New Summer Menu Launch</b><p>Our new summer menu goes live next week. Please review the new items in Recipes.</p></div><div className="ref-message-preview"><b>Memorial Day Hours</b><p>We will be open 10am – 8pm on Memorial Day. Thanks everyone!</p></div></Panel>
    </div>
  </Page>;
}

export function ReferenceSchedule({ currentDate = getToday(), users = [], shifts = [], timePunches = [], clientData = {}, appUser = {}, setCurrentDate }) {
  const week = weeklyDates(currentDate);
  const rows = tableUsers(users);
  const roles = rolesFromUsers(users, clientData);
  const scheduledHours = rows.reduce((sum, u) => sum + Number(totalHoursForUser(shifts, u, week)), 0);
  const weeklySales = 21800;
  return <Page className="ref-schedule-screen" title="Schedule" subtitle="Weekly schedule builder, coverage targets, time clock, and labor control." right={<div className="ref-actions"><button type="button"><Zap size={15}/> Auto Schedule</button><button type="button">Quick Actions</button><button type="button" className="primary">Publish Week</button></div>} metrics={[
    <Metric key="forecast" icon={TrendingUp} label="Weekly Sales Forecast" value={money(weeklySales)} sub="+12.4% vs last week" tone="green" />,
    <Metric key="target" icon={Target} label="Weekly Labor Target" value="24.7%" sub={money(weeklySales * .247)} tone="copper" />,
    <Metric key="labor" icon={DollarSign} label="Weekly Scheduled Labor" value={money(scheduledHours * 16.3)} sub="23.4% of sales" tone="copper" />,
    <Metric key="variance" icon={UserCheck} label="Weekly Labor Variance" value="-0.3%" sub="-$64 vs target" tone="green" />,
    <Metric key="hours" icon={Clock} label="Total Scheduled Hours" value={scheduledHours.toFixed(2)} sub="+18.5 vs last week" tone="green" />,
    <Metric key="open" icon={Users} label="Open Shifts" value="12" sub="$1,024 est. labor" tone="copper" />
  ]}>
    <div className="ref-schedule-layout">
      <div className="ref-schedule-main">
        <div className="ref-tabs"><button className="active">Schedule Builder</button><button>Coverage</button><button>Availability</button><button>Open Shifts (12)</button><span/><button>Day</button><button className="active">Week</button><button>2 Weeks</button><button>Copy Week</button></div>
        <div className="ref-filter-row"><label>Filter by Role<select><option>All Roles</option>{roles.map(r => <option key={r}>{r}</option>)}</select></label><label><input type="checkbox" defaultChecked/> Show Hours</label><span><Dot/>Published</span><span><Dot tone="yellow"/>Unpublished</span><span><Dot tone="blue"/>Open Shift</span><span><Dot tone="red"/>Unavailable</span></div>
        <div className="ref-schedule-table">
          <div className="schedule-head"><span>Team Member</span><small>78.25 hrs</small>{week.map(d => <b key={d}>{shortDate(d)}<em>Sales ${(2500 + new Date(`${d}T12:00:00`).getDay()*420).toLocaleString()}</em></b>)}<span>Total Hrs</span></div>
          {rows.map((u,idx)=><div className="schedule-row" key={u.id || u.name}><div className="person"><i>{String(u.name || 'U').slice(0,1)}</i><strong>{u.name || 'Staff'}</strong><small>{u.role || 'Staff'}</small></div><small>{totalHoursForUser(shifts,u,week)}</small>{week.map((d,j)=>{ const shift = getShiftFor(shifts,u,d,idx); const off = shift === 'OFF'; const open = shift.includes('12a') || shift.includes('1a'); return <button type="button" className={off ? 'off' : open ? 'late' : j===2 && idx===6 ? 'open' : ''} key={d}>{shift}</button>; })}<b>{totalHoursForUser(shifts,u,week)}</b></div>)}
          <div className="schedule-foot"><span>Daily Totals</span><small>Hours</small>{week.map((d,idx)=><b key={d}>{(56 + idx*1.65).toFixed(2)}<em>{(23.5 + idx*.15).toFixed(1)}%</em></b>)}<span>{scheduledHours.toFixed(2)}</span></div>
        </div>
        <div className="ref-schedule-bottom">
          <Panel title="Coverage Targets" action="View Details"><div className="ref-table compact"><div className="head"><span>Role</span><span>Target</span><span>Scheduled</span><span>Status</span></div>{roles.slice(0,7).map((r,idx)=><div className="tr" key={r}><span>{r}</span><span>{[8,38,120,80,60,72,140][idx] || 32}</span><span>{[8,38,116.5,76,60,72.25,144][idx] || 24}</span><Dot tone={idx > 1 && idx < 4 ? 'yellow' : idx === 6 ? 'red' : 'green'} /></div>)}</div></Panel>
          <Panel title="Publish Status"><div className="ref-side-stat"><Donut value={78} label="Published" /><div><div className="ref-kv"><span>Published</span><b>312.75 hrs</b></div><div className="ref-kv"><span>Unpublished</span><b>62.25 hrs</b></div><div className="ref-kv"><span>Open Shifts</span><b>12</b></div><button type="button" className="ref-wide-action">Publish Week</button></div></div></Panel>
          <Panel title="Open Shifts (12)" action="View All"><div className="ref-list tight">{['Tue 5/20 • 4p – 10p • Host','Wed 5/21 • 4p – 10p • Host','Thu 5/22 • 4p – 10p • Host','Fri 5/23 • 4p – 1a • Bartender'].map(s=><div className="ref-row" key={s}><span>{s}</span><small>$16/hr</small></div>)}</div><button type="button" className="ref-wide-action">Fill Open Shifts</button></Panel>
          <Panel title="Availability Alerts" action="View All"><div className="ref-list tight">{rows.slice(1,5).map((u,idx)=><div className="ref-row" key={u.id || u.name}><span>{u.name}</span><small className={idx < 2 ? 'bad' : 'warn'}>{idx < 2 ? 'Unavailable' : 'Partial'}</small></div>)}</div></Panel>
        </div>
      </div>
      <aside className="ref-right-rail">
        <Panel title="Next Shift" action="View My Schedule"><div className="ref-next-shift"><div className="avatar">{String(rows[0]?.name || 'M').slice(0,1)}</div><div><b>{rows[0]?.name || 'Maria Gomez'}</b><span>Manager</span></div><strong>9:00 AM – 5:00 PM</strong><small>8.00 hrs</small><button type="button" className="success">Clock In</button></div></Panel>
        <Panel title="Time Clock" action={null}><div className="ref-clock"><strong>{clock()}</strong><span><Dot/> You are clocked out</span><button className="success">Clock In</button><button>Start Break</button><button className="danger">Clock Out</button></div></Panel>
        <Panel title="Timesheet Summary"><div className="ref-kv"><span>Scheduled</span><b>38.00</b></div><div className="ref-kv"><span>Worked</span><b>33.75</b></div><div className="ref-kv"><span>OT</span><b>2.50</b></div><div className="ref-kv"><span>Variance</span><b className="good">-4.25</b></div></Panel>
      </aside>
    </div>
  </Page>;
}

export function ReferencePrep({ currentDate = getToday(), appUser = {}, setActiveTab }) {
  const restaurantId = appUser?.restaurantId;
  const prepItems = useLiveCollection('prepItems', restaurantId, { enabled: !!restaurantId, limitCount: 80, fallbackLimitCount: 30 });
  const tasks = useLiveCollection('tasks', restaurantId, { enabled: !!restaurantId, limitCount: 80, fallbackLimitCount: 30 });
  const prep = sample(prepItems, [
    { name:'Ground Beef Patties', station:'Grill Station', needed:80, prepared:60, due:'10:00 AM', status:'on-track' },
    { name:'Grilled Chicken Breast', station:'Grill Station', needed:40, prepared:40, due:'9:30 AM', status:'done' },
    { name:'Steak Cuts (8oz)', station:'Grill Station', needed:24, prepared:18, due:'11:00 AM', status:'at-risk' },
    { name:'Romaine Lettuce', station:'Salad Station', needed:8, prepared:8, due:'9:00 AM', status:'done' },
    { name:'Spring Mix', station:'Salad Station', needed:6, prepared:5, due:'10:00 AM', status:'at-risk' },
    { name:'Sliced Onions', station:'Prep Station', needed:8, prepared:2, due:'9:00 AM', status:'overdue' },
    { name:'Sliced Peppers', station:'Prep Station', needed:6, prepared:3, due:'9:30 AM', status:'at-risk' },
    { name:'Ranch Dressing', station:'Sauce Station', needed:8, prepared:8, due:'10:00 AM', status:'done' }
  ]);
  const grouped = ['Grill Station','Salad Station','Prep Station','Sauce Station'].map(station => ({ station, items: prep.filter(p => String(p.station || p.category || 'Prep Station') === station).slice(0, 5) })).filter(g => g.items.length);
  const done = prep.filter(p => ['done','complete','completed'].includes(String(p.status || '').toLowerCase())).length || 32;
  const total = Math.max(prep.length, 47);
  const alerts = ['Romaine Lettuce','Ground Beef (80/20)','Bacon','Tomatoes','Mushrooms','Shredded Cheese','Burger Buns'];
  return <Page title="Prep & Tasks" subtitle="Smart prep board, task management, and 86 integration" right={<button type="button" className="ref-top-date"><CalendarDays size={15}/> {shortDate(currentDate)}</button>} metrics={[
    <Metric key="completion" icon={CheckCircle} label="Prep Completion" value={`${Math.round(done/total*100)}%`} sub="On Track" tone="green" />,
    <Metric key="tasks" icon={ClipboardList} label="Tasks Completed" value={`${done} / ${total}`} sub="Today" tone="copper" />,
    <Metric key="impact" icon={DollarSign} label="86 Impact" value="$2,148" sub="Potential impact" tone="copper" />,
    <Metric key="due" icon={Clock} label="Due Soon" value="14" sub="Next 60 min" tone="yellow" />,
    <Metric key="alerts" icon={AlertTriangle} label="Active 86 Alerts" value="7" sub="Needs attention" tone="red" />
  ]}>
    <div className="ref-prep-layout">
      <div className="ref-prep-main">
        <Panel title="Smart Prep Board" icon={ClipboardCheck} action={<span/>}>
          <div className="ref-panel-toolbar"><select><option>Group by: Station</option></select><select><option>View: Board</option></select><span><Dot/> On Track</span><span><Dot tone="yellow"/> At Risk</span><span><Dot tone="red"/> Overdue</span><span><Dot tone="slate"/> Done</span></div>
          <div className="ref-station-grid">{grouped.map((g,idx)=><div className="ref-station-card" key={g.station}><h4>{g.station}<span>{[68,82,54,91][idx] || 72}%</span></h4><div className="head"><span>Item</span><span>Needed</span><span>Prepared</span><span>Due</span></div>{g.items.map(item => { const needed = item.needed || item.qty || item.required || 0; const prepared = item.prepared || item.doneQty || item.completed || 0; const tone = prepared >= needed ? 'green' : prepared < needed / 2 ? 'red' : 'yellow'; return <div className="prep-item" key={itemName(item)}><span><Dot tone={tone}/>{itemName(item)}</span><b>{needed}</b><b className={tone === 'red' ? 'bad' : tone === 'yellow' ? 'warn' : 'good'}>{prepared}</b><small className={tone === 'red' ? 'bad' : ''}>{item.due || '10:00 AM'}</small></div>; })}<button type="button">+ Add Prep Item</button></div>)}</div>
        </Panel>
        <Panel title="Task Lanes" action={null}><div className="ref-task-lanes">{['Overdue','Due Soon','Today','Completed'].map((lane,idx)=><div className="ref-task-lane" key={lane}><h4>{lane}<b>{[3,6,11,17][idx]}</b></h4>{['Walk-in Temp Log','Cooler Deep Clean','Grill Maintenance','Prep Veggies','Stock Dry Storage','Sanitize Slicers','Change Fryer Oil','Take Inventory','Clean Ice Machine','Opening Checklist','Coffee Setup','Trash Run'].slice(idx*3, idx*3+3).map((task,j)=><div className="task-card" key={task}><span>{task}</span><small>Due {['8:30 AM','9:00 AM','9:15 AM','10:00 AM','10:30 AM','12:00 PM'][j+idx] || 'Today'}</small><Status tone={idx === 0 ? 'red' : idx === 1 ? 'yellow' : idx === 3 ? 'green' : 'slate'}>{idx === 0 ? 'High' : idx === 1 ? 'Medium' : idx === 3 ? 'Done' : 'Low'}</Status></div>)}</div>)}</div></Panel>
        <div className="ref-three-cards"><Panel title="Reminders" icon={Bell} action="View All"><div className="ref-list tight">{['Monthly Food Inventory','Manager Meeting','Vendor Delivery','Clean Fryer #2'].map((r,idx)=><div className="ref-row" key={r}><b>{['10:00 AM','11:00 AM','2:00 PM','5:00 PM'][idx]}</b><span>{r}</span><small>{idx===0?'Due Today':''}</small></div>)}</div></Panel><Panel title="Substitute Suggestions" icon={RefreshCw}><div className="ref-table compact"><div className="tr"><span>Romaine Lettuce</span><span>Iceberg Lettuce</span><b className="good">In Stock</b></div><div className="tr"><span>Ground Beef</span><span>Ground Turkey</span><b className="good">In Stock</b></div><div className="tr"><span>Bacon</span><span>Turkey Bacon</span><b className="good">In Stock</b></div></div></Panel><Panel title="Prep Insights" icon={Bot}><div className="ref-list tight"><div className="ref-check bad"><AlertTriangle size={15}/><span>You're behind on 3 critical items</span></div><div className="ref-check"><CheckCircle size={15}/><span>Grill station prep ahead by 22%</span></div><div className="ref-check bad"><AlertTriangle size={15}/><span>High 86 risk on 2 items</span></div></div></Panel></div>
      </div>
      <aside className="ref-prep-alerts"><Panel title="86 Alerts & Prep Needs" icon={AlertTriangle} action="View All (7)"><div className="ref-alert-stack">{alerts.map((a,idx)=><div className="ref-alert-card" key={a}><AlertTriangle size={18}/><div><b>{a}</b><span>{idx < 2 ? 'Out of Stock' : 'Low Stock'}</span><small className={idx < 2 ? 'bad' : idx < 4 ? 'warn' : 'good'}>{idx < 2 ? 'High Impact' : idx < 4 ? 'Medium Impact' : 'Low Impact'}</small></div><em>{idx*3+2} min ago</em></div>)}</div></Panel></aside>
      <aside className="ref-voice-panel"><Panel title="86 Voice Command Center" icon={Mic} action={null}><div className="ref-big-voice"><div className="ref-mic-orb large"><Mic size={42}/></div><p>Listening...</p><small>Try: “What prep items are low?”</small><h4>Recent Commands</h4>{['Why’re prep items low?','Show me 86 alerts','What’s due in the next hour?','Substitute for ground beef'].map((c,idx)=><div className="ref-row" key={c}><span>{c}</span><small>{idx*3+2} min ago</small></div>)}<h4>Suggested Actions</h4>{['Show 86 Alerts','What’s Due Soon','Prep Station Items','Substitute Suggestions'].map(a=><button type="button" key={a}>{a}</button>)}</div></Panel></aside>
      <aside className="ref-manager-panel"><Panel title="Manager Overview" action={null}><Donut value={68} label="Prep"/><div className="ref-kv"><span>Tasks Completed</span><b>32 / 47</b></div><div className="ref-kv"><span>Active 86 Alerts</span><b className="bad">7</b></div><div className="ref-kv"><span>Team Performance</span><b className="good">92%</b></div><h4>Team Activity</h4>{tableUsers([]).slice(0,5).map(u=><div className="ref-row" key={u.name}><span>{u.name}</span><Status>Active</Status></div>)}<div className="ref-note-card"><b>Team is doing great!</b><p>Focus on prep station items this morning.</p></div></Panel></aside>
    </div>
  </Page>;
}

export function ReferenceInventory({ appUser = {}, clientData = {} }) {
  const restaurantId = appUser?.restaurantId;
  const inventory = useLiveCollection('inventoryItems', restaurantId, { enabled: !!restaurantId, limitCount: 120, fallbackLimitCount: 40 });
  const invoices = useLiveCollection('invoices', restaurantId, { enabled: !!restaurantId, limitCount: 20, fallbackLimitCount: 10 });
  const items = sample(inventory, [
    { name:'Ribeye 12 oz', category:'Beef', currentStock:32, parLevel:40, unit:'each', unitCost:10.20, vendor:'Sysco' },
    { name:'Chicken Breast 8oz', category:'Poultry', currentStock:48, parLevel:60, unit:'each', unitCost:2.80, vendor:'US Foods' },
    { name:'Heavy Cream', category:'Dairy', currentStock:6, parLevel:12, unit:'qt', unitCost:15.00, vendor:'Sysco' },
    { name:'Roma Tomatoes', category:'Produce', currentStock:28, parLevel:40, unit:'lb', unitCost:1.45, vendor:'FreshPoint' },
    { name:'Lemons', category:'Produce', currentStock:20, parLevel:30, unit:'lb', unitCost:1.99, vendor:'FreshPoint' },
    { name:'Pasta Spaghetti', category:'Dry Goods', currentStock:12, parLevel:20, unit:'lb', unitCost:1.10, vendor:'Sysco' },
    { name:'Parmesan Cheese', category:'Dairy', currentStock:4, parLevel:8, unit:'lb', unitCost:23.04, vendor:'US Foods' },
    { name:'Olive Oil Extra Virgin', category:'Oils', currentStock:8, parLevel:12, unit:'lt', unitCost:18.62, vendor:'Sysco' },
    { name:'Sprite 2L', category:'Beverage', currentStock:6, parLevel:12, unit:'btl', unitCost:1.75, vendor:'Coca-Cola' },
    { name:'Garlic Fresh', category:'Produce', currentStock:2, parLevel:10, unit:'lb', unitCost:2.85, vendor:'FreshPoint' }
  ]);
  const low = items.filter(i => Number(i.currentStock ?? i.onHand ?? 0) < Number(i.parLevel || i.par || 0));
  const totalValue = sumNumbers(items, i => Number(i.currentStock ?? i.onHand ?? 0) * Number(i.unitCost || i.cost || 0)) || 21800;
  return <Page className="ref-inventory-screen" title="Inventory" subtitle="Inventory control, invoice scan, menu scan, burn log, and ordering." right={<button type="button" className="ref-top-date"><CalendarDays size={15}/> {shortDate(getToday())}</button>} metrics={[
    <Metric key="value" icon={DollarSign} label="Total Inventory Value" value={money(totalValue)} sub="↗ 1.8% yesterday" tone="copper" />,
    <Metric key="par" icon={DollarSign} label="Inventory Par Value" value={money(totalValue * .856)} sub="↗ 2.4% yesterday" tone="green" />,
    <Metric key="sku" icon={Package} label="Total SKUs" value={String(Math.max(items.length, 1152))} sub="↗ 3 new this week" tone="copper" />,
    <Metric key="low" icon={AlertTriangle} label="Low Stock Items" value={`${low.length || 86} / ${items.length || 152}`} sub="5 since yesterday" tone="yellow" />,
    <Metric key="out" icon={Flame} label="Out Of Stock" value="29 (2.6%)" sub="↓ 3 since yesterday" tone="red" />
  ]}>
    <div className="ref-tabs top"><button className="active">Inventory</button><button>Invoice Scan</button><button>Menu Scan</button><button>Burn Log</button><button>Ordering</button></div>
    <div className="ref-inventory-layout">
      <div className="ref-inventory-main">
        <Panel title="Inventory" icon={Package} action={null}>
          <div className="ref-panel-toolbar"><div className="search"><Search size={15}/><input placeholder="Search inventory..." /></div><button><FilterIcon/> Filters</button><select><option>Category</option></select><button><Plus size={14}/> Add Item</button></div>
          <div className="ref-table inventory"><div className="head"><span>Item Name</span><span>Category</span><span>On Hand</span><span>Par</span><span>Unit</span><span>Unit Cost</span><span>Total Value</span><span>Status</span><span>Vendor</span></div>{items.slice(0,10).map(i => { const on = Number(i.currentStock ?? i.onHand ?? 0); const par = Number(i.parLevel || i.par || 0); const tone = par && on <= par*.3 ? 'red' : par && on < par ? 'yellow' : 'green'; return <div className="tr" key={itemName(i)}><span>{itemName(i)}</span><span>{i.category || 'General'}</span><b>{on}</b><span>{par}</span><span>{i.unit || 'ea'}</span><span>{dollars(i.unitCost || i.cost || 0)}</span><span>{dollars(on * Number(i.unitCost || i.cost || 0))}</span><Status tone={tone}>{tone === 'green' ? 'Good' : tone === 'yellow' ? 'Low Stock' : 'Critical'}</Status><span>{i.vendor || 'Sysco'}</span></div>; })}</div>
        </Panel>
        <div className="ref-inventory-mid"><Panel title="Vendor Summary" icon={Truck} action="View all"><div className="ref-table compact"><div className="head"><span>Vendor</span><span>On Order</span><span>YTD Spend</span><span>Lead Time</span></div>{['Sysco','US Foods','FreshPoint','Performance Foodservice','Coca-Cola'].map((v,idx)=><div className="tr" key={v}><span>{v}</span><span>{money([2184,1026,456,120,84][idx])}</span><span>{money([142531,98712,34218,12405,8312][idx])}</span><span>{[2.1,2.4,1.2,3.6,1.0][idx]} days</span></div>)}</div></Panel><Panel title="Low Stock Items" icon={AlertTriangle} action="View all"><div className="ref-list tight">{sample(low, items).slice(0,5).map(i=><div className="ref-row" key={itemName(i)}><span>{itemName(i)}</span><small>{i.currentStock ?? i.onHand ?? 0} {i.unit || 'ea'}</small><b>Par: {i.parLevel || i.par || 0}</b></div>)}</div></Panel><Panel title="Par Level Alerts" icon={Bell} action="View all"><div className="ref-list tight">{sample(low, items).slice(0,5).map((i,idx)=><div className="ref-row" key={itemName(i)}><span>{itemName(i)}</span><small className="bad">Below par by {[50,80,50,40,20][idx] || 30}%</small></div>)}</div></Panel><Panel title="Recent Price Changes" icon={TrendingUp} action="View all"><div className="ref-table compact two"><div className="tr"><span>Ribeye 12 oz</span><b className="good">↗ 5.2%</b><span>$10.20</span></div><div className="tr"><span>Olive Oil Extra Virgin</span><b className="good">↗ 7.8%</b><span>$18.62</span></div><div className="tr"><span>Chicken Breast</span><b className="good">↗ 3.1%</b><span>$2.80</span></div><div className="tr"><span>Parmesan Cheese</span><b className="good">↗ 4.6%</b><span>$23.04</span></div></div></Panel></div>
        <Panel title="Ordering Recommendations" icon={ShoppingCart} action="12 items recommended"><div className="ref-ordering"><div className="ref-table compact"><div className="head"><span>Item</span><span>On Hand</span><span>Par</span><span>Recommended</span><span>Unit</span><span>Est. Cost</span><span>Vendor</span><span>ETA</span><span>Action</span></div>{sample(low, items).slice(0,5).map(i=><div className="tr" key={itemName(i)}><span>{itemName(i)}</span><span>{i.currentStock ?? i.onHand ?? 0}</span><span>{i.parLevel || i.par || 0}</span><b>{Math.max(1, Number(i.parLevel || 0)-Number(i.currentStock || 0))}</b><span>{i.unit || 'ea'}</span><span>{dollars((Number(i.parLevel || 0)-Number(i.currentStock || 0))*Number(i.unitCost || 1))}</span><span>{i.vendor || 'Sysco'}</span><span>May 26</span><button>Add to Order</button></div>)}</div><div className="ref-order-total"><b>{dollars(247.36)}</b><span>Estimated Order Total</span><button>Create Purchase Order</button></div></div></Panel>
      </div>
      <aside className="ref-right-rail inventory">
        <Panel title="Invoice Scan" icon={Upload} action="View all"><div className="ref-upload-zone"><Upload size={24}/><span>Drag & drop invoice or click to upload</span><small>PDF, JPG, PNG • Max 20MB</small></div><h4>Recent Scans</h4>{sample(invoices, [{filename:'Sysco_Invoice_052425.pdf', status:'Uploading 80%'},{filename:'USFoods_052325.pdf', status:'Processed'},{filename:'FreshPoint_052325.pdf', status:'Processed'},{filename:'CocaCola_051825.pdf', status:'Failed'}]).slice(0,5).map((i,idx)=><div className="ref-row" key={i.id || i.filename}><span>{i.filename || i.name || 'Invoice.pdf'}</span><Status tone={idx===0?'blue':idx===3?'red':'green'}>{i.status || 'Processed'}</Status></div>)}</Panel>
        <Panel title="Menu Scan Intelligence" icon={Camera} action="View all"><div className="ref-kpi-trip"><div><b>142</b><span>Items Scanned</span></div><div><b>8</b><span>New Items</span></div><div><b>19</b><span>Changes</span></div></div><button type="button" className="ref-wide-action">View Detected Changes</button><h4>Top Cost Impact Items</h4>{['Ribeye 12 oz','Salmon Fillet','Truffle Oil'].map((n,idx)=><div className="ref-row" key={n}><span>{n}</span><b className="bad">+${[1.12,.85,.72][idx]}</b></div>)}</Panel>
        <Panel title="Burn Log Insights" icon={Flame} action="View all"><div className="ref-side-stat"><div><b className="big">$186.42</b><span>Today’s burn</span><MiniSpark/></div><Donut value={42} label="Meat" tone="copper" /></div><h4>Top Waste Items</h4>{['Lemons','Ribeye Trimmings','Tomatoes'].map((n,idx)=><div className="ref-row" key={n}><span>{n}</span><b>{dollars([12.4,9.85,7.12][idx])}</b></div>)}</Panel>
      </aside>
    </div>
  </Page>;
}

const FilterIcon = () => <Search size={14} />;

export function ReferenceRecipes({ appUser = {} }) {
  const restaurantId = appUser?.restaurantId;
  const recipesLive = useLiveCollection('recipes', restaurantId, { enabled: !!restaurantId, limitCount: 80, fallbackLimitCount: 25 });
  const recipes = sample(recipesLive, [
    { name:'Truffle Fries', category:'Apps & Shareables', foodCost:1.32, margin:68.9 }, { name:'Firecracker Shrimp', category:'Apps & Shareables', foodCost:2.48, margin:61.3 }, { name:'86 Prime Burger', category:'Burgers', foodCost:3.21, margin:52.4 }, { name:'Fish Tacos', category:'Tacos', foodCost:2.16, margin:57.8 }, { name:'Lobster Ravioli', category:'Entrees', foodCost:7.12, margin:-8.3 }, { name:'Grilled Salmon', category:'Entrees', foodCost:4.37, margin:34.2 }, { name:'Chicken Pesto Pasta', category:'Pastas', foodCost:2.91, margin:48.7 }, { name:'Classic Caesar', category:'Salads', foodCost:1.08, margin:71.5 }
  ]).slice(0, 8);
  const selected = recipes[0] || {};
  const recipeName = itemName(selected, 'Truffle Fries');
  return <Page className="ref-recipes-screen" title="Recipes & Menu Cost" subtitle="Manage recipes, build smarter menus, and protect your margins." right={<div className="ref-actions"><button><Upload size={15}/> Import Recipe</button><button><Download size={15}/> Export</button><button className="primary"><Plus size={15}/> New Recipe</button></div>} metrics={[
    <Metric key="total" icon={Utensils} label="Total Recipes" value={String(Math.max(recipes.length, 128))} sub="↑ 5 yesterday" tone="copper" />,
    <Metric key="cost" icon={DollarSign} label="Avg Food Cost %" value="28.6%" sub="↓ 1.4% vs yesterday" tone="green" />,
    <Metric key="period" icon={Wallet} label="Period Food Cost" value="$24,812" sub="↓ 2.3% vs yesterday" tone="copper" />,
    <Metric key="best" icon={Star} label="Best Margin" value="Truffle Fries" sub="68.9% margin" tone="green" />,
    <Metric key="worst" icon={AlertTriangle} label="Worst Margin" value="Lobster Ravioli" sub="-8.3% margin" tone="red" />,
    <Metric key="alerts" icon={Bell} label="Item Alerts" value="12" sub="3 critical • 9 warning" tone="yellow" />
  ]}>
    <div className="ref-recipes-layout">
      <Panel title="Recipe Catalog" icon={BookOpen} action="128 Recipes"><div className="ref-panel-toolbar"><div className="search"><Search size={15}/><input placeholder="Search recipes..." /></div><select><option>Category</option></select><select><option>Status</option></select></div><div className="ref-recipe-list">{recipes.map((r,idx)=><button type="button" key={itemName(r)} className={idx===0?'active':''}><span className={`thumb thumb-${idx}`}></span><div><b>{itemName(r)}</b><small>{r.category || 'Menu'}</small></div><em>{dollars(r.foodCost || r.cost || 1.32)}<small>Food Cost</small></em><strong className={Number(r.margin) < 0 ? 'bad' : 'good'}>{Number(r.margin || 52).toFixed(1)}%</strong><Star size={16}/></button>)}</div></Panel>
      <main className="ref-recipe-detail"><section className="ref-recipe-hero"><div className="photo recipe-photo-hero"></div><div><h2>{recipeName}</h2><p>Apps & Shareables</p><Status>Active</Status><span>Menu: Dinner</span><p>Crispy hand-cut fries tossed in truffle oil, parmesan, parsley, and sea salt. Served with garlic aioli.</p></div><div className="ref-cost-strip"><div><span>Food Cost</span><b>$1.32</b></div><div><span>Cost %</span><b className="good">31.1%</b></div><div><span>Margin</span><b className="good">68.9%</b></div></div></section><div className="ref-tabs"><button className="active">Ingredients & Build</button><button>Yield & Portions</button><button>Cost & Margin</button><button>Allergens</button><button>Prep & Procedures</button><button>History</button></div><Panel title="Ingredients & Build" action={null}><div className="ref-table compact"><div className="head"><span>Ingredient</span><span>Qty</span><span>Unit</span><span>Unit Cost</span><span>Total Cost</span></div>{[['Russet Potatoes','3.50','ea','$0.28 / ea','$0.98'],['Truffle Oil','0.25','fl oz','$1.24 / fl oz','$0.31'],['Parmesan Cheese','0.50','oz','$0.22 / oz','$0.11'],['Parsley, Fresh','0.10','oz','$0.05 / oz','$0.01'],['Sea Salt','0.05','oz','$0.01 / oz','$0.00'],['Garlic Aioli','1.00','fl oz','$0.29 / fl oz','$0.29']].map(row=><div className="tr" key={row[0]}>{row.map(cell=><span key={cell}>{cell}</span>)}</div>)}<div className="tr total"><b>Total Food Cost</b><span/><span/><span/><b>$1.70</b></div></div></Panel><Panel title="Yield & Portion Cost" action={null}><div className="ref-kpi-trip big"><div><b>6</b><span>Baskets</span><small>@ 1 Basket per portion</small></div><div><b>$10.20</b><span>Cost per Batch</span></div><div><b>$1.70</b><span>Per Serving</span></div><div><b>1 Basket</b><span>Portion Size</span><small>Target Cost % 30.0%</small></div></div></Panel></main>
      <aside className="ref-right-rail recipes"><Panel title="Margin Insights" action="View Full Report"><div className="ref-side-stat"><Donut value={37.2} label="Avg Margin" tone="yellow"/><div><div className="ref-row"><span>High Margin</span><b>24</b></div><div className="ref-row"><span>Good Margin</span><b>38</b></div><div className="ref-row"><span>Low Margin</span><b>45</b></div><div className="ref-row"><span>Loss</span><b>21</b></div></div></div><h4>Top Performers</h4>{['Truffle Fries','Classic Caesar','Firecracker Shrimp'].map((n,idx)=><div className="ref-row" key={n}><span>{idx+1}. {n}</span><b className="good">{[68.9,71.5,61.3][idx]}%</b></div>)}</Panel><Panel title="Menu Dependencies" action="View All"><div className="ref-dependency"><div className="left">{['Russet Potatoes','Truffle Oil','Parmesan Cheese','Garlic Aioli'].map(n=><span key={n}>{n}</span>)}</div><b>{recipeName}<small>Used in 6 items</small></b><div className="right">{['Truffle Fries','Loaded Truffle Fries','Burger & Fries Combo','Late Night Fries','Family Feast Platter'].map(n=><span key={n}>{n}</span>)}</div></div></Panel><Panel title="Smart Kitchen AI" icon={Bot} action="View All"><div className="ref-ai-card good"><b>Optimize Recipe Food Cost</b><p>Truffle Fries food cost is above target. Potential savings: $0.09 per portion.</p><button>Optimize</button></div><div className="ref-ai-card warn"><b>Seasonal Suggestion</b><p>Russet potatoes prices expected to rise 8% in June.</p><button>View Vendors</button></div><div className="ref-ai-card blue"><b>Menu Engineering Tip</b><p>Add Truffle Fries to Lunch Menu. Could increase weekly sales by $482.</p><button>Add to Menu</button></div></Panel></aside>
    </div>
    <Panel title="Item Alerts" action="View All Alerts"><div className="ref-alert-strip"><div className="critical"><AlertTriangle size={18}/><b>Lobster Ravioli</b><span>Negative margin detected</span><small>Food cost: 108.3%</small></div><div><AlertTriangle size={18}/><b>Chicken Alfredo</b><span>Low margin</span><small>Margin: 5.2%</small></div><div><AlertTriangle size={18}/><b>Truffle Oil</b><span>Price increase detected</span><small>+12.4% from last week</small></div><div className="info"><Bell size={18}/><b>Parmesan Cheese</b><span>Inventory low</span><small>2.1 lbs remaining</small></div></div></Panel>
  </Page>;
}

export function ReferenceFinancials({ currentDate = getToday(), users = [], sales = [], timePunches = [], clientData = {} }) {
  const netSales = sumNumbers(sales.filter(s => byDate(s, currentDate)), s => s.netSales || s.total || s.amount || s.sales || s.grossSales) || 21842;
  const labor = sumNumbers(timePunches.filter(p => byDate(p, currentDate)), p => p.laborCost || p.cost || Number(p.hours || 0) * Number(p.wage || 16)) || 4876;
  const roles = rolesFromUsers(users, clientData).slice(0, 6);
  const staff = tableUsers(users).slice(0, 5);
  return <Page className="ref-financials-screen" title="Financials + Timesheets + Daily Ledger" subtitle="Real-time financial overview, labor tracking, and operational ledger." right={<button type="button" className="ref-top-date"><CalendarDays size={15}/> {shortDate(currentDate)}</button>} metrics={[
    <Metric key="net" icon={DollarSign} label="Net Sales (Today)" value={money(netSales)} sub="↑ 12.4% vs yesterday" tone="copper" />,
    <Metric key="gross" icon={Target} label="Gross Profit" value={money(netSales * .604)} sub="60.4% of sales" tone="copper" />,
    <Metric key="labor" icon={Users} label="Labor Cost" value={money(labor)} sub={`${(labor/netSales*100).toFixed(1)}% of sales`} tone="copper" />,
    <Metric key="prime" icon={Briefcase} label="Prime Cost" value={money(netSales * .41)} sub="41.0% of sales" tone="copper" />,
    <Metric key="opex" icon={Wallet} label="Operating Expenses" value={money(netSales * .098)} sub="9.8% of sales" tone="copper" />,
    <Metric key="income" icon={TrendingUp} label="Net Income" value={money(netSales * .103)} sub="10.3% of sales" tone="green" />
  ]}>
    <div className="ref-finance-layout">
      <main className="ref-finance-main"><div className="ref-finance-top"><Panel title="Sales vs Labor Trends" icon={LineChart} action={<select><option>Today</option></select>}><div className="ref-bar-chart"><svg viewBox="0 0 500 190" preserveAspectRatio="none"><polyline points="0,180 40,150 80,120 120,130 160,160 200,110 240,105 280,80 320,55 360,64 400,70 440,44 500,25"/><polyline className="green" points="0,184 40,175 80,160 120,148 160,176 200,152 240,144 280,130 320,120 360,116 400,120 440,128 500,136"/></svg></div></Panel><Panel title="Labor Percentage" icon={PieChart} action={null}><div className="ref-side-stat"><Donut value={labor/netSales*100} label="Labor %" tone="copper"/><div><div className="ref-kv"><span>Labor Cost</span><b>{money(labor)}</b></div><div className="ref-kv"><span>Sales</span><b>{money(netSales)}</b></div><div className="ref-kv"><span>Labor Goal</span><b>25.0%</b></div><div className="ref-kv"><span>Variance</span><b className="good">-2.7 pp</b></div></div></div></Panel><Panel title="Sales Summary" action={<select><option>Today</option></select>}><div className="ref-kv"><span>Net Sales</span><b>{money(netSales)}</b></div><div className="ref-kv"><span>Tax</span><b>{money(netSales*.069)}</b></div><div className="ref-kv"><span>Discounts</span><b className="bad">($342)</b></div><div className="ref-kv"><span>Voids</span><b className="bad">($271)</b></div><div className="ref-kv total"><span>Total Sales</span><b className="good">{money(netSales+900)}</b></div></Panel></div>
      <Panel title="Daily Ledger" action="View Full Ledger"><div className="ref-table ledger"><div className="head"><span>Time</span><span>Type</span><span>Description</span><span>Category</span><span>Amount</span><span>Payment Type</span><span>Reference</span><span>Status</span></div>{[['10:21 AM','Sale','Table 12','Food',86.42,'Visa','#1041','Completed'],['10:34 AM','Sale','Table 15','Beverage',54.31,'Mastercard','#1042','Completed'],['10:41 AM','Discount','Manager Comp','Discounts',-18,'Manual','#1043','Flagged'],['10:58 AM','Sale','Bar Tab','Beverage',112.75,'Amex','#1044','Completed'],['11:07 AM','Void','Table 8','Food',-24.5,'Manual','#1045','Flagged']].map(row=><div className="tr" key={row[0]}>{row.map((cell,idx)=><span key={idx} className={Number(cell)<0?'bad':''}>{idx===4?dollars(cell):cell}</span>)}</div>)}</div><div className="ref-total-line"><span>Total Net Sales</span><b>{dollars(netSales)}</b></div></Panel>
      <Panel title="Timesheets" action={<div className="ref-actions"><button>Approve All</button><button>Export</button><button>View All Timesheets</button></div>}><div className="ref-table timesheets"><div className="head"><span>Employee</span><span>Role</span><span>Shift</span><span>Clock In</span><span>Clock Out</span><span>Break</span><span>Reg Hrs</span><span>OT Hrs</span><span>Total Hrs</span><span>Labor $</span><span>Labor %</span><span>Status</span></div>{staff.map((u,idx)=><div className="tr" key={u.id || u.name}><span>{u.name}</span><span>{u.role}</span><span>{idx<4?'AM':'PM'}</span><span>{idx===1?'6:30 AM':'7:00 AM'}</span><span>{idx===4?'11:00 PM':'3:00 PM'}</span><span>0:30</span><span>7.50</span><span>0.00</span><span>7.50</span><span>{dollars(198-idx*21)}</span><span>{(3.1-idx*.25).toFixed(1)}%</span><Status tone={idx%2?'yellow':'green'}>{idx%2?'Pending':'Approved'}</Status></div>)}</div></Panel></main>
      <aside className="ref-right-rail finance"><Panel title="Notes & Exceptions" action="View All (7)"><h4>Discrepancies</h4>{['Voided Check','Manual Discounts','Sales Over/Short'].map((n,idx)=><div className="ref-alert-card small" key={n}><AlertTriangle size={16}/><div><b>{n}</b><span>{idx===0?'Check #1045 • $86.42':idx===1?'Total $48.31':'+ $32.54'}</span></div><em>{['9:41 AM','10:12 AM','10:35 AM'][idx]}</em></div>)}<h4>Notes</h4><div className="ref-note-card"><b>Manager Note</b><p>Strawberry Fest prep impacting prep labor.</p></div><div className="ref-note-card"><b>Shift Note</b><p>Short server 5–8pm. Adjusted floor coverage.</p></div><h4>Open Actions</h4>{['Reconcile Discrepancies','Review Discounts','Approve Timesheets'].map((a,idx)=><button type="button" className="ref-action-row" key={a}>{a}<b>{3-idx}</b></button>)}</Panel><Panel title="Export Controls" icon={Download} action={null}><button type="button" className="ref-wide-action"><Download size={15}/> Export Daily Ledger</button><button type="button" className="ref-wide-action"><Download size={15}/> Export Sales Summary</button><select><option>Date Range: Today</option></select><select><option>Location / Dept: All Locations</option></select></Panel><Panel title="Role-Based Hour Totals" action={<select><option>Today</option></select>}><div className="ref-list tight">{roles.map((r,idx)=><div className="ref-hours-row" key={r}><span>{r}</span><Progress value={[13.5,13.5,33.6,20.1,13.5,40.3][idx] || 10}/><b>{[15,15,37.5,22.5,15,45][idx] || 10}.00</b></div>)}<div className="ref-kv total"><span>Total Hours</span><b>150.00</b></div></div></Panel></aside>
    </div>
  </Page>;
}

export function ReferenceSettings({ appUser = {}, clientData = {}, users = [], addToast }) {
  const [accent, setAccent] = useState(clientData?.systemSettings?.accentColor || '#B87333');
  const categories = ['Branding','Roster Roles','Notifications','Schedule Style','Time Format','Workspace Options','Integrations','Billing & Plan','Demo Mode','Owner Controls'];
  const roles = rolesFromUsers(users, clientData);
  return <Page className="ref-settings-screen" title="Settings" subtitle="Manage your workspace preferences and system configuration" right={<button type="button" className="primary" onClick={() => addToast?.('Settings Saved', 'Visual preferences saved.')}>Save Changes <ChevronRight size={15}/></button>}>
    <div className="ref-settings-layout"><aside className="ref-settings-menu">{categories.map((c,idx)=><button type="button" className={idx===0?'active':''} key={c}>{[<BookOpen/>,<Users/>,<Bell/>,<CalendarDays/>,<Clock/>,<Settings/>,<Zap/>,<Wallet/>,<RefreshCw/>,<Lock/>][idx]}<span>{c}</span></button>)}</aside><main className="ref-settings-main"><section className="ref-setting-row tall"><div><h3>Branding</h3><p>Customize your workspace identity and visual branding.</p></div><div className="ref-upload-zone small"><Upload size={22}/><b>Upload Logo</b><small>PNG, JPG or SVG. 512×512px recommended</small></div><label>Primary Accent<input type="color" value={accent} onChange={e=>setAccent(e.target.value)} /><span>{accent}</span></label><label>Workspace Name<input value={appUser?.restaurantName || clientData?.name || 'Cheers • Chilton'} readOnly /></label><label>Tagline (Optional)<input value={clientData?.tagline || 'Great food. Every time.'} readOnly /></label></section>{[
      ['Roster Roles','Manage custom roles and permissions.', <><span>Enable Custom Roles</span><Status>On</Status><small>{roles.join(', ')}</small></>, 'Manage Roles'],
      ['Notification Preferences','Configure when and how you get alerts.', <><span>Browser Notifications</span><Status>On</Status><span>Email Notifications</span><Status>On</Status><span>Mobile Push</span><Status>On</Status></>, 'Configure Alerts'],
      ['Schedule Style','Choose how schedules are displayed.', <><label>Default View<select><option>Week View</option></select></label><label>Start Day<select><option>Sunday</option></select></label><span>Show Costing</span><Status>On</Status></>, 'Preview'],
      ['Time Format','Set your preferred time and date formats.', <><label>Time Format<select><option>12-Hour (1:30 PM)</option></select></label><label>Date Format<select><option>May 23, 2025</option></select></label><label>First Day of Week<select><option>Sunday</option></select></label></>, 'Open'],
      ['Workspace Options','Configure general workspace behavior.', <><span>Auto Log Out</span><Status>On</Status><span>Confirm Actions</span><Status>On</Status><span>Compact Mode</span><Status tone="slate">Off</Status></>, 'Open'],
      ['Integrations','Connect 86 Chaos with your favorite tools.', <><Status>QuickBooks Connected</Status><Status>7shifts Connected</Status><Status>Slack Connected</Status><Status tone="yellow">Google Calendar Connect</Status></>, 'Manage Integrations'],
      ['Billing & Plan','View your plan details and billing information.', <><span>Current Plan</span><b>Professional</b><span>Next Billing Date</span><b>Jun 23, 2025</b><span>Seats</span><b>23 / 30</b></>, 'Manage Billing'],
      ['Demo Mode','Test features in a safe demo environment.', <><span>Demo Mode</span><Status tone="slate">Off</Status></>, 'Reset Demo Data'],
      ['Owner Controls','Advanced settings for workspace owners only.', <><b className="bad">Owner Controls</b><span>Restricted settings and data management</span></>, 'Open Owner Controls']
    ].map(([title, desc, content, action])=><section className={`ref-setting-row ${title==='Owner Controls'?'danger':''}`} key={title}><div><h3>{title}</h3><p>{desc}</p></div><div className="ref-setting-content">{content}</div><button type="button">{action}<ChevronRight size={15}/></button></section>)}</main></div>
  </Page>;
}

export function ReferenceTeam({ users = [], appUser = {}, clientData = {} }) {
  const staff = tableUsers(users);
  return <Page className="ref-team-screen" title="Staff Roster" subtitle="Team directory, role tags, permissions, and staff status." metrics={[<Metric key="team" icon={Users} label="Active Staff" value={String(staff.length)} sub="All locations" tone="green" />, <Metric key="roles" icon={Shield} label="Roster Roles" value={String(rolesFromUsers(users, clientData).length)} sub="Preferences source" tone="copper" />, <Metric key="clock" icon={Clock} label="Clocked In" value="5" sub="Right now" tone="green" />]}><Panel title="Staff Roster" icon={Users} action="Add Staff"><div className="ref-table roster"><div className="head"><span>Name</span><span>Role</span><span>Status</span><span>Permissions</span><span>Contact</span><span>Last Active</span></div>{staff.map((u,idx)=><div className="tr" key={u.id || u.name}><span>{u.name}</span><span>{u.role || 'Staff'}</span><Status tone={idx%5===0?'yellow':'green'}>{idx%5===0?'On Break':'Active'}</Status><span>{u.isAdmin?'Admin':'Staff'}</span><span>{u.email || 'Hidden'}</span><span>{idx+2}m ago</span></div>)}</div></Panel></Page>;
}

export function ReferenceMessages() {
  return <Page className="ref-messages-screen" title="Message Board" subtitle="Pinned announcements, shift notes, read receipts, and quick posts."><div className="ref-message-layout"><Panel title="Pinned & Announcements" icon={MessageSquare} action="New Post"><div className="ref-message-preview pinned"><b>New Summer Menu Launch</b><p>Our new summer menu goes live next week. Please review the new items in Recipes.</p><small>Read by 18 / 23</small></div><div className="ref-message-preview"><b>Memorial Day Hours</b><p>We will be open 10am – 8pm on Memorial Day.</p><small>Read by 21 / 23</small></div></Panel><Panel title="Shift Notes" icon={ClipboardList}><div className="ref-note-card"><b>Manager Note</b><p>Prep station needs extra support before lunch rush.</p></div><div className="ref-note-card"><b>Kitchen Note</b><p>Use substitute list if romaine is still short.</p></div></Panel><Panel title="Quick Post" icon={Send} action={null}><textarea placeholder="Post an update to the team..."/><button type="button" className="primary">Post Message</button></Panel></div></Page>;
}

export function ReferenceSystemAdmin({ appUser = {}, setActiveTab }) {
  const restaurants = useLiveCollection('restaurants', null, { enabled: true, limitCount: 80, fallbackLimitCount: 30 });
  const allUsers = useLiveCollection('users', null, { enabled: true, limitCount: 120, fallbackLimitCount: 40 });
  const activeWorkspaces = sample(restaurants, [{ name:'Bella Vista Bistro', ownerName:'Maria Gomez', planId:'Pro' }, { name:'Oak & Fire Grill', ownerName:'James Peterson', planId:'Pro' }, { name:'Slice House', ownerName:'Tony Nguyen', planId:'Essential' }, { name:'Harborview Café', ownerName:'Lisa Chang', planId:'Pro' }, { name:'The Copper Pot', ownerName:'Daniel Wright', planId:'Enterprise' }]).slice(0,5);
  return <Page className="ref-admin-screen" title="System Administrator" subtitle="Platform operations, security, and system health" right={<button type="button" className="ref-top-date"><CalendarDays size={15}/> Friday, May 23, 2025</button>} metrics={[
    <Metric key="health" icon={Activity} label="Platform Health" value="99.6%" sub="All systems operational" tone="green" />,
    <Metric key="active" icon={Users} label="Active Workspaces" value={String(Math.max(restaurants.length,128))} sub="↑ 16 vs yesterday" tone="copper" />,
    <Metric key="global" icon={Users} label="Global Users" value={String(Math.max(allUsers.length,1842))} sub="↑ 72 vs yesterday" tone="green" />,
    <Metric key="deploy" icon={ShieldCheck} label="Deployment Readiness" value="98.7%" sub="All systems ready" tone="green" />,
    <Metric key="backup" icon={Database} label="Backup Integrity" value="100%" sub="All backups healthy" tone="copper" />,
    <Metric key="push" icon={Send} label="Push Delivery Health" value="99.6%" sub="↑ 0.3% vs yesterday" tone="green" />
  ]}>
    <div className="ref-admin-layout"><main><div className="ref-admin-top"><Panel title="Active Workspaces" icon={Settings} action="View all"><div className="ref-table compact"><div className="head"><span>Workspace</span><span>Plan</span><span>Owner</span><span>Users</span><span>Status</span><span>Activity</span></div>{activeWorkspaces.map((r,idx)=><div className="tr" key={r.id || r.name}><span>{r.name || r.restaurantName || r.id}</span><span>{r.planId || r.subscription?.planId || 'Pro'}</span><span>{r.ownerName || r.ownerEmail || 'Owner'}</span><span>{[18,24,10,16,32][idx] || 8}</span><Status tone={idx===4?'yellow':'green'}>{idx===4?'Idle':'Active'}</Status><Progress value={[78,82,66,81,74][idx]}/></div>)}</div></Panel><Panel title="Deployment Readiness" icon={ShieldCheck} action="View details"><div className="ref-list tight">{['Build & Tests','Security Scans','Environment Config','Database Migrations','Backup Verification','Feature Flags'].map((n,idx)=><div className="ref-row" key={n}><span>{n}</span><Status tone={idx===3?'yellow':'green'}>{idx===3?'Warning':'Pass'}</Status></div>)}</div></Panel><Panel title="Backup Center" icon={HardDrive} action="Open"><div className="ref-kv"><span>Latest Backup</span><b>May 23, 2025 03:14 AM</b></div><div className="ref-kv"><span>Integrity Check</span><b className="good">100%</b></div><div className="ref-kv"><span>Restore Readiness</span><b className="good">Ready</b></div><div className="ref-kv"><span>Next Backup</span><b>May 23, 2025 06:00 PM</b></div><button type="button" className="ref-wide-action">Open Backup Center</button></Panel></div><div className="ref-admin-mid"><Panel title="Security Center" icon={Shield}><div className="ref-kv"><span>App Check Enforcement</span><b className="good">100%</b></div><div className="ref-kv"><span>MFA Coverage</span><b className="good">96%</b></div><div className="ref-kv"><span>Rules Status</span><b className="good">Valid</b></div><div className="ref-kv"><span>Suspicious Activity</span><b className="warn">2</b></div></Panel><Panel title="Push Health" icon={Send}><div className="ref-kv"><span>Vercel API</span><b className="good">Healthy</b><small>42ms</small></div><div className="ref-kv"><span>Storage</span><b className="good">Healthy</b><small>26ms</small></div><div className="ref-kv"><span>Auth</span><b className="good">Healthy</b><small>36ms</small></div></Panel><Panel title="Automation / Ops Intelligence" icon={Bot} action="Open"><div className="ref-side-stat"><Donut value={32} label="Runs Today" tone="copper"/><div><div className="ref-row"><span>Config Drift</span><b>12</b></div><div className="ref-row"><span>Permission Issues</span><b>6</b></div><div className="ref-row"><span>Data Integrity</span><b>8</b></div><div className="ref-row"><span>Performance</span><b>4</b></div></div></div></Panel><Panel title="Forensics Timeline" icon={Activity} action="View all"><div className="ref-timeline">{['Admin Login','Workspace Updated','Checks System Terminated','Suspicious Login Blocked','Role Change'].map((e,idx)=><div key={e}><i/><b>{e}</b><span>{['system.admin@86chaos.com','Bella Vista Bistro','user: james@...','IP: 192.168.100.33','user: chef-karen@cafe86.com'][idx]}</span><small>10:{21-idx*3} AM</small></div>)}</div></Panel></div><div className="ref-admin-bottom"><Panel title="Client Roster" icon={Users} action="View all clients"><div className="ref-table compact"><div className="head"><span>Workspace</span><span>Plan</span><span>Owner</span><span>Users</span><span>Last Active</span><span>Status</span></div>{activeWorkspaces.map((r,idx)=><div className="tr" key={r.id || r.name}><span>{r.name || r.id}</span><span>{r.planId || 'Pro'}</span><span>{r.ownerName || 'Owner'}</span><span>{[18,24,10,16,32][idx]}</span><span>{[2,5,12,19,41][idx]}m ago</span><Status tone={idx===4?'yellow':'green'}>{idx===4?'Idle':'Active'}</Status></div>)}</div></Panel><Panel title="Support / Diagnostics" icon={Wrench} action="View all"><div className="ref-list tight">{['Crash Report: 06:23:14','Push Failure Spike','Slow Sync on Orders','Auth Timeout Errors','UI Freeze on KDS'].map((n,idx)=><div className="ref-row" key={n}><span>{n}</span><small>{idx===0?'Oak & Fire Grill':'3 Workspaces'}</small><Status tone={idx===0?'red':idx<3?'yellow':'blue'}>{idx===0?'High':idx<3?'Medium':'Low'}</Status></div>)}</div></Panel><Panel title="System Summary" icon={Database}><div className="ref-kv"><span>Uptime (30d)</span><b className="good">99.87%</b></div><div className="ref-kv"><span>Avg Response Time</span><b className="good">48ms</b></div><div className="ref-kv"><span>Total Workspaces</span><b>{Math.max(restaurants.length,128)}</b></div><div className="ref-kv"><span>Total Users</span><b>{Math.max(allUsers.length,1842)}</b></div></Panel></div></main><aside className="ref-right-rail admin"><Panel title="Live Issues" action={null}><div className="ref-alert-card small"><AlertTriangle size={16}/><div><b>High Memory Usage</b><span>Vercel API</span></div><em>2m ago</em></div><div className="ref-alert-card small"><AlertTriangle size={16}/><div><b>Failed Push Delivery</b><span>3 Workspaces</span></div><em>7m ago</em></div><div className="ref-alert-card small"><Bell size={16}/><div><b>Backup Delay Warning</b><span>1 Workspace</span></div><em>18m ago</em></div></Panel><Panel title="Quick Actions" action={null}>{['Deploy Workspace','Broadcast Alert','Global Refresh','Pause Automation','Emergency Read-Only','Open Audit Log'].map((a,idx)=><button key={a} type="button" className={`ref-wide-action ${idx===4?'danger':''}`} onClick={()=>idx===5 && setActiveTab?.('audit')}>{a}</button>)}</Panel></aside></div>
  </Page>;
}
