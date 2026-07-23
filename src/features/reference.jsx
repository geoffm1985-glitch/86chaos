import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Bell, BookOpen, Bot, Briefcase, CalendarDays,
  Camera, CheckCircle, ChevronRight, ClipboardCheck, ClipboardList, Clock, Database,
  DollarSign, Download, Flame, HardDrive, LineChart, Lock, MessageSquare, Mic,
  Package, Percent, PieChart, Plus, RefreshCw, Rocket, Search, Send, Settings,
  Shield, ShieldCheck, ShoppingCart, Target, TrendingUp, Truck, Upload, Users,
  UserCheck, Wallet, Wrench, Zap, Star, Bug
} from 'lucide-react';
import { CURRENT_VERSION, formatDate, getToday, useLiveCollection } from '../core/appCore';

const safeArray = (value) => Array.isArray(value) ? value : [];
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(Number(n)) ? Number(n) : 0));
const money = (value) => Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const dollars = (value) => Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = (value, digits = 1) => `${number(value).toFixed(digits)}%`;
const itemName = (item = {}, fallback = 'Item') => item.name || item.itemName || item.title || item.recipeName || item.displayName || fallback;
const normalizeRole = (role = '') => String(role || 'Team').trim() || 'Team';
const compact = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const firstText = (...values) => values.find(v => String(v || '').trim()) || '';
const firstNumber = (...values) => values.map(number).find(v => Number.isFinite(v) && v !== 0) || 0;
const todayKey = getToday();
const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const raw = typeof value === 'number' ? value : String(value);
  const d = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dateKey = (row = {}) => {
  const value = row.date || row.businessDate || row.saleDate || row.shiftDate || row.createdAt || row.updatedAt || row.timestamp || row.completedAt || row.scannedAt || row.invoiceDate;
  const parsed = parseDate(value);
  return parsed ? formatDate(parsed) : String(value || '').slice(0, 10);
};
const byDate = (row = {}, date) => dateKey(row) === date;
const daysBack = (endDate = todayKey, count = 14) => {
  const end = parseDate(endDate) || new Date();
  return Array.from({ length: count }, (_, idx) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (count - 1 - idx));
    return formatDate(d);
  });
};
const sumNumbers = (items, picker) => safeArray(items).reduce((total, item) => total + number(picker(item)), 0);
const groupSum = (items, keyPicker, valuePicker) => safeArray(items).reduce((map, item) => {
  const key = String(keyPicker(item) || 'Other');
  map[key] = (map[key] || 0) + number(valuePicker(item));
  return map;
}, {});
const previousDate = (date) => {
  const d = parseDate(date) || new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
};
const trendText = (current, previous, suffix = '') => {
  const c = number(current);
  const p = number(previous);
  if (!p && !c) return 'No prior live data';
  if (!p) return `New live data${suffix}`;
  const diff = ((c - p) / Math.abs(p)) * 100;
  return `${diff >= 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}%${suffix || ' vs prior'}`;
};
const safePct = (part, total) => total ? (number(part) / number(total)) * 100 : 0;
const salesAmount = (row = {}) => firstNumber(row.netSales, row.totalSales, row.total, row.amount, row.sales, row.grossSales, row.revenue, row.net);
const taxAmount = (row = {}) => firstNumber(row.tax, row.salesTax, row.taxAmount);
const discountAmount = (row = {}) => Math.abs(firstNumber(row.discounts, row.discount, row.discountAmount));
const voidAmount = (row = {}) => Math.abs(firstNumber(row.voids, row.voidAmount, row.voidTotal));
const cogsAmount = (row = {}) => firstNumber(row.cogs, row.foodCost, row.costOfGoods, row.foodCostAmount);
const expenseAmount = (row = {}) => firstNumber(row.expense, row.expenses, row.operatingExpenses, row.amount);
const punchHours = (p = {}) => firstNumber(p.totalHours, p.hours, p.regularHours + p.overtimeHours, p.durationHours, p.paidHours);
const punchRate = (p = {}) => firstNumber(p.hourlyRate, p.wage, p.payRate, p.rate, 0);
const laborAmount = (p = {}) => firstNumber(p.laborCost, p.cost, p.totalCost, p.payAmount, punchHours(p) * punchRate(p));
const invOnHand = (i = {}) => firstNumber(i.currentStock, i.onHand, i.qty, i.quantity, i.count);
const invPar = (i = {}) => firstNumber(i.parLevel, i.par, i.targetStock, i.minimumStock);
const invUnitCost = (i = {}) => firstNumber(i.unitCost, i.cost, i.price, i.lastCost, i.averageCost);
const itemUnit = (i = {}) => i.unit || i.uom || i.measure || 'ea';
const recipeCost = (r = {}) => firstNumber(r.foodCost, r.foodCostAmount, r.unitCost, r.totalFoodCost, r.cost, r.portionCost);
const recipePrice = (r = {}) => firstNumber(r.price, r.menuPrice, r.salePrice, r.sellingPrice);
const recipeMargin = (r = {}) => {
  const direct = firstNumber(r.margin, r.marginPct, r.grossMarginPct);
  if (direct) return direct;
  const price = recipePrice(r);
  const cost = recipeCost(r);
  return price ? ((price - cost) / price) * 100 : 0;
};
const rowStatus = (on, par) => !par ? 'No Par' : on <= 0 ? 'Out' : on <= par * .3 ? 'Critical' : on < par ? 'Low Stock' : 'Good';
const statusTone = (label) => /out|critical|fail|overdue|void/i.test(label) ? 'red' : /low|warn|pending|partial|unavailable|idle/i.test(label) ? 'yellow' : /blue|info/i.test(label) ? 'blue' : /no par|none|muted/i.test(label) ? 'slate' : 'green';
const tableUsers = (users = []) => safeArray(users).filter(u => u?.isActive !== false).slice(0, 8);
const rolesFromUsers = (users = [], clientData = {}) => {
  const configured = clientData?.systemSettings?.rosterRoles || clientData?.rosterRoles || clientData?.roles || [];
  const names = safeArray(configured).map(role => typeof role === 'string' ? role : role?.name).filter(Boolean);
  const fallback = safeArray(users).map(u => normalizeRole(u.role)).filter(Boolean);
  return Array.from(new Set([...names, ...fallback])).slice(0, 8);
};
const dailySeries = (items, dates, picker) => dates.map(date => ({ date, value: sumNumbers(safeArray(items).filter(row => byDate(row, date)), picker) }));
const normalizePoints = (series, width = 320, height = 130) => {
  const values = safeArray(series).map(s => number(s.value));
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values.map((v, idx) => `${(idx * step).toFixed(1)},${(height - (v / max) * (height - 14) - 7).toFixed(1)}`).join(' ');
};
const hasSeriesData = (series) => safeArray(series).some(s => number(s.value) > 0);
const weeklyDates = (currentDate) => {
  const base = parseDate(currentDate) || new Date();
  const dow = base.getDay();
  base.setDate(base.getDate() - dow);
  return Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(base);
    d.setDate(base.getDate() + idx);
    return formatDate(d);
  });
};
const shortDate = (dateString) => {
  const d = parseDate(dateString);
  return d ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }) : dateString || 'Today';
};
const clock = (date = new Date()) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const timeAgo = (row = {}) => {
  const d = parseDate(row.updatedAt || row.createdAt || row.timestamp || row.lastActive || row.scannedAt);
  if (!d) return 'Live';
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};
const realRowsOrMessage = (rows, message) => safeArray(rows).length ? rows : [{ __empty: true, name: message }];
const scheduledShiftHours = (s = {}) => {
  const direct = firstNumber(s.totalHours, s.hours, s.durationHours);
  if (direct) return direct;
  const start = String(s.startTime || s.start || '').replace(/[ap]m$/i, '');
  const end = String(s.endTime || s.end || '').replace(/[ap]m$/i, '');
  const [sh, sm = 0] = start.split(':').map(Number);
  const [eh, em = 0] = end.split(':').map(Number);
  if (!Number.isFinite(sh) || !Number.isFinite(eh)) return 0;
  let hours = (eh + em / 60) - (sh + sm / 60);
  if (hours < 0) hours += 24;
  return Math.max(0, hours - number(s.breakHours || s.break || 0));
};
const shiftLabel = (s = {}) => {
  if (!s || s.__empty) return 'Open';
  if (s.label) return s.label;
  if (s.startTime && s.endTime) return `${s.startTime} – ${s.endTime}`;
  if (s.start && s.end) return `${s.start} – ${s.end}`;
  return s.status || 'Scheduled';
};
const getShiftFor = (shifts, user, date) => {
  const ids = [user.id, user.userId, user.uid, user.authUid, user.email].filter(Boolean).map(String);
  return safeArray(shifts).find(s => dateKey(s) === date && ids.includes(String(s.employeeId || s.userId || s.uid || s.email || '')));
};
const totalHoursForUser = (shifts, user, week) => {
  const ids = [user.id, user.userId, user.uid, user.authUid, user.email].filter(Boolean).map(String);
  return sumNumbers(safeArray(shifts).filter(s => week.includes(dateKey(s)) && ids.includes(String(s.employeeId || s.userId || s.uid || s.email || ''))), scheduledShiftHours);
};

const Panel = ({ title, action = 'View all', icon: Icon, children, className = '', onAction }) => {
  const handleAction = onAction || (() => {
    try {
      window.dispatchEvent(new CustomEvent('chaos-ref-panel-action', { detail: { title, action: String(action || '') } }));
    } catch (_) {}
  });
  const actionNode = React.isValidElement(action)
    ? action
    : action
      ? <button type="button" className="ref-panel-action" onClick={handleAction}>{action} <ChevronRight size={13} /></button>
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

const MiniSpark = ({ tone = 'green', points = [] }) => {
  const values = safeArray(points).map(p => number(p.value ?? p)).filter(v => Number.isFinite(v));
  const live = values.length ? values : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...live, 1);
  return <div className={`ref-spark tone-${tone}`} title={values.length ? 'Live trend' : 'No live trend data yet'}>{live.map((p, idx) => <i key={idx} style={{ height: `${8 + (p / max) * 32}px` }} />)}</div>;
};

const Metric = ({ icon: Icon = Activity, label, value, sub, tone = 'copper', trend = 'up', points = [] }) => (
  <div className={`ref-metric tone-${tone}`}>
    <span className="ref-metric-icon"><Icon size={26} /></span>
    <div className="ref-metric-copy">
      <small>{label}</small>
      <strong title={String(value ?? '')}>{value}</strong>
      {sub && <span className={trend === 'down' ? 'down' : 'up'}>{sub}</span>}
    </div>
    <MiniSpark tone={tone} points={points} />
  </div>
);

const Donut = ({ value = 0, label, tone = 'green', size = 'md' }) => (
  <div className={`ref-donut ref-donut-${size} tone-${tone}`} style={{ '--value': `${clamp(value)}%` }}>
    <strong>{Math.round(clamp(value))}%</strong>
    <span>{label}</span>
  </div>
);
const Progress = ({ value = 0, tone = 'green' }) => <div className="ref-progress"><i className={`tone-${tone}`} style={{ width: `${clamp(value)}%` }} /></div>;
const Status = ({ children, tone = 'green' }) => <span className={`ref-status tone-${tone}`}>{children}</span>;
const Dot = ({ tone = 'green' }) => <i className={`ref-dot tone-${tone}`} />;
const EmptyLive = ({ label = 'No live records yet' }) => <div className="ref-empty-live"><Database size={15}/><span>{label}</span></div>;
const LiveLineChart = ({ primary = [], secondary = [], primaryLabel = 'Primary', secondaryLabel = 'Secondary' }) => {
  const hasPrimary = hasSeriesData(primary);
  const hasSecondary = hasSeriesData(secondary);
  return <div className="ref-chart-line live"><svg viewBox="0 0 320 130" preserveAspectRatio="none" role="img" aria-label={`${primaryLabel} live chart`}>
    <polyline points={normalizePoints(primary)} />
    <polyline className="ghost" points={normalizePoints(secondary)} />
  </svg><div className="ref-chart-legend"><span><Dot tone="yellow"/>{primaryLabel}</span><span><Dot/>{secondaryLabel}</span>{(!hasPrimary && !hasSecondary) && <small>No live graph data yet</small>}</div></div>;
};
const LiveBarChart = ({ salesSeries = [], laborSeries = [] }) => {
  const max = Math.max(...salesSeries.map(s => number(s.value)), ...laborSeries.map(s => number(s.value)), 1);
  return <div className="ref-live-bars">{salesSeries.map((s, idx) => <div key={s.date} title={`${shortDate(s.date)} sales ${money(s.value)} / labor ${money(laborSeries[idx]?.value || 0)}`}><i className="sales" style={{ height: `${Math.max(2, (number(s.value) / max) * 100)}%` }} /><i className="labor" style={{ height: `${Math.max(2, (number(laborSeries[idx]?.value) / max) * 100)}%` }} /><small>{String(shortDate(s.date)).split(' ')[0]}</small></div>)}</div>;
};

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

const InventoryStatusTable = ({ items = [], limit = 10 }) => <div className="ref-table inventory"><div className="head"><span>Item Name</span><span>Category</span><span>On Hand</span><span>Par</span><span>Unit</span><span>Unit Cost</span><span>Total Value</span><span>Status</span><span>Vendor</span></div>{realRowsOrMessage(items.slice(0, limit), 'No live inventory records yet').map((i, idx) => {
  if (i.__empty) return <div className="tr" key="empty"><span>{i.name}</span><span/><span/><span/><span/><span/><span/><Status tone="slate">Empty</Status><span/></div>;
  const on = invOnHand(i); const par = invPar(i); const unitCost = invUnitCost(i); const label = rowStatus(on, par);
  return <div className="tr" key={i.id || itemName(i) || idx}><span>{itemName(i)}</span><span>{i.category || i.type || 'General'}</span><b>{compact(on)}</b><span>{compact(par)}</span><span>{itemUnit(i)}</span><span>{dollars(unitCost)}</span><span>{dollars(on * unitCost)}</span><Status tone={statusTone(label)}>{label}</Status><span>{i.vendor || i.vendorName || 'Unassigned'}</span></div>;
})}</div>;

export function ReferenceToday({ currentDate = getToday(), appUser = {}, users = [], shifts = [], sales = [], timePunches = [], inventoryItems = [], prepItems = [], tasks = [], recipes = [], menuDependencies = [], restaurantAdminAlerts = [], clientData = {}, setActiveTab }) {
  const dates = daysBack(currentDate, 14);
  const salesSeries = dailySeries(sales, dates, salesAmount);
  const laborSeries = dailySeries(timePunches, dates, laborAmount);
  const todaySales = sumNumbers(sales.filter(s => byDate(s, currentDate)), salesAmount);
  const yesterdaySales = sumNumbers(sales.filter(s => byDate(s, previousDate(currentDate))), salesAmount);
  const todayLabor = sumNumbers(timePunches.filter(p => byDate(p, currentDate)), laborAmount);
  const laborPct = safePct(todayLabor, todaySales);
  const rollingForecast = salesSeries.slice(-7).reduce((n, s) => n + number(s.value), 0) / Math.max(1, salesSeries.slice(-7).filter(s => number(s.value) > 0).length || 1);
  const todayCogs = sumNumbers(sales.filter(s => byDate(s, currentDate)), cogsAmount);
  const foodCostPct = safePct(todayCogs, todaySales);
  const coversLunch = sumNumbers(sales.filter(s => byDate(s, currentDate)), s => firstNumber(s.lunchCovers, s.lunchGuests));
  const coversDinner = sumNumbers(sales.filter(s => byDate(s, currentDate)), s => firstNumber(s.dinnerCovers, s.dinnerGuests));
  const coversTotal = coversLunch + coversDinner || sumNumbers(sales.filter(s => byDate(s, currentDate)), s => firstNumber(s.covers, s.guests, s.guestCount));
  const lowStock = inventoryItems.filter(i => invPar(i) > 0 && invOnHand(i) < invPar(i));
  const activeAlerts = [...restaurantAdminAlerts, ...lowStock.map(i => ({ id: `stock-${i.id || itemName(i)}`, title: itemName(i), severity: rowStatus(invOnHand(i), invPar(i)) }))].slice(0, 6);
  const prepDone = prepItems.filter(p => ['done','complete','completed'].includes(String(p.status || '').toLowerCase())).length;
  const prepTotal = prepItems.length;
  const prepPct = prepTotal ? (prepDone / prepTotal) * 100 : 0;
  const liveStaff = tableUsers(users).slice(0, 5);
  const roles = rolesFromUsers(users, clientData);
  const coverageByRole = roles.slice(0, 4).map(role => {
    const roleUsers = users.filter(u => normalizeRole(u.role) === role);
    const roleUserIds = roleUsers.map(u => String(u.id || u.uid || u.userId || u.email));
    const roleShifts = shifts.filter(s => byDate(s, currentDate) && roleUserIds.includes(String(s.employeeId || s.userId || s.uid || s.email || '')));
    const scheduled = sumNumbers(roleShifts, scheduledShiftHours);
    const target = firstNumber(clientData?.coverageTargets?.[role], clientData?.systemSettings?.coverageTargets?.[role], roleUsers.length * 8);
    return { role, scheduled, target, pct: safePct(scheduled, target) };
  });

  return <Page title="Today" subtitle={`Here's what's happening at ${appUser?.restaurantName || clientData?.name || 'your kitchen'}`} right={<button type="button" className="ref-top-date"><CalendarDays size={15}/> {shortDate(currentDate)}</button>} metrics={[
    <Metric key="sales" icon={DollarSign} label="Sales Today" value={money(todaySales)} sub={trendText(todaySales, yesterdaySales, ' vs yesterday')} tone="copper" points={salesSeries} />,
    <Metric key="labor" icon={Users} label="Labor % (Today)" value={pct(laborPct)} sub={todaySales ? `${money(todayLabor)} live labor` : 'No sales yet'} tone={laborPct > 25 ? 'yellow' : 'green'} points={laborSeries} />,
    <Metric key="forecast" icon={BarChart3} label="Forecast Sales" value={money(rollingForecast)} sub="Rolling 7-day live average" tone="copper" points={salesSeries.slice(-7)} />,
    <Metric key="covers" icon={UserCheck} label="Covers" value={coversLunch || coversDinner ? `${compact(coversLunch)} / ${compact(coversDinner)}` : compact(coversTotal)} sub="Live POS/sales cover fields" tone="green" />,
    <Metric key="food" icon={PieChart} label="Food Cost %" value={pct(foodCostPct)} sub={todayCogs ? `${money(todayCogs)} live COGS` : 'No COGS posted'} tone={foodCostPct > 33 ? 'yellow' : 'copper'} />,
    <Metric key="alerts" icon={AlertTriangle} label="Active 86 Alerts" value={String(activeAlerts.length)} sub="Live alerts + low stock" tone={activeAlerts.length ? 'red' : 'green'} trend={activeAlerts.length ? 'down' : 'up'} />
  ]}>
    <div className="ref-today-grid">
      <Panel title="Today's Shift Coverage" icon={Users} action="View Schedule" onAction={() => setActiveTab?.('published')}>
        <div className="ref-coverage-chart">{coverageByRole.length ? coverageByRole.map(({ role, scheduled, target, pct: value }) => <div key={role} className="ref-coverage-row"><b>{role}</b><div><i style={{ width: `${clamp(value)}%` }} /><em style={{ left: `${clamp(value, 0, 92)}%` }} /></div><span>{Math.round(value)}%</span></div>) : <EmptyLive label="No live shifts or roster roles yet"/>}<div className="ref-legend"><span><Dot/>Scheduled</span><span><Dot tone="yellow"/>Target Marker</span></div></div>
      </Panel>
      <Panel title="Kitchen Command Center" icon={ShieldCheck} action="Live Snapshot"><div className="ref-kv"><span>Sales Posted</span><b>{sales.filter(s => byDate(s, currentDate)).length}</b><Status>Live</Status></div><div className="ref-kv"><span>Labor Records</span><b>{timePunches.filter(p => byDate(p, currentDate)).length}</b><Status>Live</Status></div><div className="ref-kv"><span>Low Stock</span><b>{lowStock.length}</b><Status tone={lowStock.length ? 'yellow' : 'green'}>{lowStock.length ? 'Watch' : 'Good'}</Status></div><div className="ref-kv"><span>Prep Complete</span><b>{prepTotal ? pct(prepPct) : '0%'}</b><Status tone={prepPct < 65 ? 'yellow' : 'green'}>{prepTotal ? 'Live' : 'No Data'}</Status></div></Panel>
      <Panel title="Active 86 Alerts" icon={AlertTriangle} action={`View All (${activeAlerts.length})`}><div className="ref-list tight">{realRowsOrMessage(activeAlerts, 'No live 86 alerts right now').map((alert, idx) => alert.__empty ? <div className="ref-row" key="empty"><span>{alert.name}</span><Status tone="green">Clear</Status></div> : <div className="ref-alert-row" key={alert.id || alert.title || idx}><Dot tone={statusTone(alert.severity || alert.status)} /><span>{alert.title || alert.itemName || alert.type || 'Alert'}</span><small>{alert.severity || alert.status || 'Open'}</small><b>{idx + 1}</b></div>)}</div></Panel>
      <Panel title="Prep Progress" icon={ClipboardCheck} action="View Prep List" onAction={() => setActiveTab?.('prep')}><div className="ref-side-stat"><Donut value={prepPct} label="Completed" /><div>{realRowsOrMessage(prepItems.slice(0, 4), 'No live prep items yet').map((p, idx) => p.__empty ? <div className="ref-row" key="empty"><span>{p.name}</span><Status tone="slate">Empty</Status></div> : <div className="ref-prep-mini" key={p.id || itemName(p)}><span>{itemName(p)}</span><Progress value={safePct(firstNumber(p.prepared, p.doneQty, p.completed), firstNumber(p.needed, p.qty, p.required) || 1)} tone={statusTone(p.status)} /><b>{firstNumber(p.prepared, p.doneQty, p.completed)} / {firstNumber(p.needed, p.qty, p.required)}</b></div>)}</div></div></Panel>
      <Panel title="Low Stock Inventory" icon={Package} action="View Inventory" onAction={() => setActiveTab?.('inventory')}><div className="ref-table compact"><div className="head"><span>Item</span><span>On Hand</span><span>Par</span><span>Need</span><span>Unit</span></div>{realRowsOrMessage(lowStock.slice(0,5), 'No live low stock items').map(i => i.__empty ? <div className="tr" key="empty"><span>{i.name}</span><span/><span/><span/><Status tone="green">Good</Status></div> : <div className="tr" key={i.id || itemName(i)}><span>{itemName(i)}</span><b>{compact(invOnHand(i))}</b><span>{compact(invPar(i))}</span><b className="bad">{compact(Math.max(0, invPar(i) - invOnHand(i)))}</b><span>{itemUnit(i)}</span></div>)}</div></Panel>
      <Panel title="Labor Snapshot" icon={Percent} action="View Labor" onAction={() => setActiveTab?.('labor')}><div className="ref-side-stat"><Donut value={laborPct} label="Labor %" tone="copper" /><div><div className="ref-kv"><span>Total Labor</span><b>{money(todayLabor)}</b></div><div className="ref-kv"><span>Sales</span><b>{money(todaySales)}</b></div><div className="ref-kv"><span>Labor Records</span><b>{timePunches.filter(p => byDate(p, currentDate)).length}</b></div><div className="ref-kv"><span>Variance vs 25%</span><b className={laborPct <= 25 ? 'good' : 'warn'}>{(laborPct - 25).toFixed(1)} pp</b></div></div></div></Panel>
      <Panel title="Sales Snapshot" icon={LineChart} action="View Sales" onAction={() => setActiveTab?.('financials')}><LiveLineChart primary={salesSeries} secondary={laborSeries} primaryLabel="Sales" secondaryLabel="Labor"/><div className="ref-sales-aside"><b>{money(sumNumbers(salesSeries, s => s.value))}</b><span>14-day sales</span><b>{money(sumNumbers(laborSeries, s => s.value))}</b><span>14-day labor</span></div></Panel>
      <Panel title="Reminders" icon={Bell} action="View all reminders" onAction={() => setActiveTab?.('reminders')}><div className="ref-list"><div className="ref-row"><span>Open reminders</span><b>{tasks.filter(t => !/done|complete/i.test(String(t.status || ''))).length}</b><Status>Live</Status></div></div></Panel>
      <Panel title="Manager Brief" icon={Rocket} action="View full manager brief" onAction={() => setActiveTab?.('ops')}><div className="ref-list"><div className="ref-check"><CheckCircle size={15}/><span>Sales trend is {todaySales >= yesterdaySales ? 'above' : 'below'} yesterday based on live sales.</span></div><div className="ref-check"><CheckCircle size={15}/><span>{lowStock.length} live inventory items are below par.</span></div><div className="ref-check"><CheckCircle size={15}/><span>{prepTotal ? pct(prepPct) : '0%'} prep completion from live prep records.</span></div></div></Panel>
      <Panel title="86Voice Command" icon={Mic} action="Open Voice Command" onAction={() => setActiveTab?.('ai-tools')}><div className="ref-voice-quick"><div className="ref-mic-orb"><Mic size={28}/></div><p>Live commands use current prep, inventory, schedule, and reminders.</p><div>{['Check Inventory','Prep Check','Labor Report','Show 86 Alerts'].map(q=><button type="button" key={q}>{q}</button>)}</div></div></Panel>
      <Panel title="Staff on Shift" icon={Users} action="View Roster" onAction={() => setActiveTab?.('team')}><div className="ref-table compact"><div className="head"><span>Name</span><span>Role</span><span>Today</span><span>Status</span></div>{realRowsOrMessage(liveStaff, 'No live staff records yet').map((u,idx)=> u.__empty ? <div className="tr" key="empty"><span>{u.name}</span><span/><span/><Status tone="slate">Empty</Status></div> : <div className="tr" key={u.id || u.name}><span>{u.name || u.email}</span><span>{u.role || 'Staff'}</span><span>{shiftLabel(getShiftFor(shifts, u, currentDate))}</span><Status tone="green">Live</Status></div>)}</div></Panel>
      <Panel title="Message Board" icon={MessageSquare} action="View All" onAction={() => setActiveTab?.('messages')}><div className="ref-message-preview"><b>Live data connected</b><p>This panel now avoids fake announcements and routes to the real Message Board.</p></div></Panel>
    </div>
  </Page>;
}

export function ReferenceSchedule({ currentDate = getToday(), users = [], shifts = [], timePunches = [], timeOffRequests = [], sales = [], clientData = {}, appUser = {}, setCurrentDate }) {
  const week = weeklyDates(currentDate);
  const rows = tableUsers(users);
  const roles = rolesFromUsers(users, clientData);
  const weekShifts = shifts.filter(s => week.includes(dateKey(s)));
  const scheduledHours = sumNumbers(weekShifts, scheduledShiftHours);
  const weekSales = sumNumbers(sales.filter(s => week.includes(dateKey(s))), salesAmount);
  const weekLabor = sumNumbers(timePunches.filter(p => week.includes(dateKey(p))), laborAmount);
  const openShifts = weekShifts.filter(s => !firstText(s.employeeId, s.userId, s.uid, s.email) || /open/i.test(String(s.status || s.type || '')));
  const published = weekShifts.filter(s => /published/i.test(String(s.status || s.publishStatus || ''))).length;
  const publishPct = safePct(published, weekShifts.length);
  return <Page className="ref-schedule-screen" title="Schedule" subtitle="Weekly schedule builder, coverage targets, time clock, and labor control." right={<div className="ref-actions"><button type="button"><Zap size={15}/> Auto Schedule</button><button type="button">Quick Actions</button><button type="button" className="primary">Publish Week</button></div>} metrics={[
    <Metric key="forecast" icon={TrendingUp} label="Weekly Sales" value={money(weekSales)} sub="Live sales in selected week" tone="green" points={dailySeries(sales, week, salesAmount)} />,
    <Metric key="target" icon={Target} label="Weekly Labor %" value={pct(safePct(weekLabor, weekSales))} sub={weekLabor ? money(weekLabor) : 'No live labor cost'} tone="copper" points={dailySeries(timePunches, week, laborAmount)} />,
    <Metric key="labor" icon={DollarSign} label="Scheduled Hours" value={scheduledHours.toFixed(2)} sub={`${weekShifts.length} live shifts`} tone="copper" />,
    <Metric key="variance" icon={UserCheck} label="Labor Variance" value={`${(safePct(weekLabor, weekSales) - 25).toFixed(1)} pp`} sub="vs 25% target" tone={safePct(weekLabor, weekSales) > 25 ? 'yellow' : 'green'} />,
    <Metric key="hours" icon={Clock} label="Total Scheduled Hours" value={scheduledHours.toFixed(2)} sub="From live shifts" tone="green" />,
    <Metric key="open" icon={Users} label="Open Shifts" value={String(openShifts.length)} sub="Live unassigned/open shifts" tone={openShifts.length ? 'yellow' : 'green'} />
  ]}>
    <div className="ref-schedule-layout"><div className="ref-schedule-main"><div className="ref-tabs"><button className="active">Schedule Builder</button><button>Coverage</button><button>Availability</button><button>Open Shifts ({openShifts.length})</button><span/><button>Day</button><button className="active">Week</button><button>2 Weeks</button><button>Copy Week</button></div>
    <div className="ref-filter-row"><label>Filter by Role<select><option>All Roles</option>{roles.map(r => <option key={r}>{r}</option>)}</select></label><label><input type="checkbox" defaultChecked/> Show Hours</label><span><Dot/>Published</span><span><Dot tone="yellow"/>Unpublished</span><span><Dot tone="blue"/>Open Shift</span><span><Dot tone="red"/>Unavailable</span></div>
    <div className="ref-schedule-table"><div className="schedule-head"><span>Team Member</span><small>{scheduledHours.toFixed(2)} hrs</small>{week.map(d => <b key={d}>{shortDate(d)}<em>{money(sumNumbers(sales.filter(s => byDate(s, d)), salesAmount))}</em></b>)}<span>Total Hrs</span></div>{realRowsOrMessage(rows, 'No live staff records yet').map((u,idx)=> u.__empty ? <div className="schedule-row" key="empty"><div className="person"><i>?</i><strong>{u.name}</strong><small>Empty</small></div><small>0</small>{week.map(d=><button type="button" className="open" key={d}>Open</button>)}<b>0</b></div> : <div className="schedule-row" key={u.id || u.name}><div className="person"><i>{String(u.name || u.email || 'U').slice(0,1)}</i><strong>{u.name || u.email}</strong><small>{u.role || 'Staff'}</small></div><small>{totalHoursForUser(shifts,u,week).toFixed(2)}</small>{week.map(d=>{ const s = getShiftFor(shifts,u,d); const unavailable = timeOffRequests.some(r => String(r.userId || r.employeeId || '') === String(u.id || u.uid || '') && byDate(r, d)); const label = unavailable ? 'OFF' : s ? shiftLabel(s) : 'Open'; return <button type="button" className={unavailable ? 'off' : !s ? 'open' : /unpublished/i.test(String(s.status || s.publishStatus || '')) ? 'late' : ''} key={d}>{label}</button>; })}<b>{totalHoursForUser(shifts,u,week).toFixed(2)}</b></div>)}<div className="schedule-foot"><span>Daily Totals</span><small>Hours</small>{week.map(d=><b key={d}>{sumNumbers(weekShifts.filter(s => byDate(s, d)), scheduledShiftHours).toFixed(2)}<em>{pct(safePct(sumNumbers(timePunches.filter(p => byDate(p, d)), laborAmount), sumNumbers(sales.filter(s => byDate(s, d)), salesAmount)))}</em></b>)}<span>{scheduledHours.toFixed(2)}</span></div></div>
    <div className="ref-schedule-bottom"><Panel title="Coverage Targets" action="View Details"><div className="ref-table compact"><div className="head"><span>Role</span><span>Target</span><span>Scheduled</span><span>Status</span></div>{realRowsOrMessage(roles, 'No roster roles configured').map((r,idx)=> typeof r === 'object' && r.__empty ? <div className="tr" key="empty"><span>{r.name}</span><span/><span/><Status tone="slate">Empty</Status></div> : <div className="tr" key={r}><span>{r}</span><span>{firstNumber(clientData?.coverageTargets?.[r], clientData?.systemSettings?.coverageTargets?.[r])}</span><span>{sumNumbers(weekShifts.filter(s => normalizeRole(s.role) === r), scheduledShiftHours).toFixed(1)}</span><Status tone="green">Live</Status></div>)}</div></Panel><Panel title="Publish Status"><div className="ref-side-stat"><Donut value={publishPct} label="Published" /><div><div className="ref-kv"><span>Published</span><b>{published}</b></div><div className="ref-kv"><span>Total Shifts</span><b>{weekShifts.length}</b></div><div className="ref-kv"><span>Open Shifts</span><b>{openShifts.length}</b></div><button type="button" className="ref-wide-action">Publish Week</button></div></div></Panel><Panel title={`Open Shifts (${openShifts.length})`} action="View All"><div className="ref-list tight">{realRowsOrMessage(openShifts.slice(0,4), 'No open shifts right now').map(s => s.__empty ? <div className="ref-row" key="empty"><span>{s.name}</span><Status tone="green">Clear</Status></div> : <div className="ref-row" key={s.id}><span>{shortDate(dateKey(s))} • {shiftLabel(s)} • {s.role || 'Role'}</span><small>{dollars(firstNumber(s.hourlyRate, s.wage))}/hr</small></div>)}</div><button type="button" className="ref-wide-action">Fill Open Shifts</button></Panel><Panel title="Availability Alerts" action="View All"><div className="ref-list tight">{realRowsOrMessage(timeOffRequests.slice(0,4), 'No time-off conflicts').map((r,idx)=> r.__empty ? <div className="ref-row" key="empty"><span>{r.name}</span><Status>Clear</Status></div> : <div className="ref-row" key={r.id || idx}><span>{r.name || r.employeeName || r.userName || 'Employee'}</span><small className="warn">{r.status || 'Requested'}</small></div>)}</div></Panel></div>
    </div><aside className="ref-right-rail"><Panel title="Next Shift" action="View My Schedule"><div className="ref-next-shift"><div className="avatar">{String(appUser?.name || 'U').slice(0,1)}</div><div><b>{appUser?.name || appUser?.email || 'Current User'}</b><span>{appUser?.role || 'Staff'}</span></div><strong>{shiftLabel(getShiftFor(shifts, appUser, currentDate))}</strong><small>{totalHoursForUser(shifts, appUser, week).toFixed(2)} hrs this week</small><button type="button" className="success">Clock In</button></div></Panel><Panel title="Time Clock" action={null}><div className="ref-clock"><strong>{clock()}</strong><span><Dot/> Live time clock surface</span><button className="success">Clock In</button><button>Start Break</button><button className="danger">Clock Out</button></div></Panel><Panel title="Timesheet Summary"><div className="ref-kv"><span>Scheduled</span><b>{scheduledHours.toFixed(2)}</b></div><div className="ref-kv"><span>Worked</span><b>{sumNumbers(timePunches.filter(p => week.includes(dateKey(p))), punchHours).toFixed(2)}</b></div><div className="ref-kv"><span>Labor $</span><b>{money(weekLabor)}</b></div><div className="ref-kv"><span>Labor %</span><b>{pct(safePct(weekLabor, weekSales))}</b></div></Panel></aside></div>
  </Page>;
}

export function ReferencePrep({ currentDate = getToday(), appUser = {}, prepItems: propPrep = [], tasks: propTasks = [], inventoryItems: propInventory = [], setActiveTab }) {
  const restaurantId = appUser?.restaurantId;
  const livePrep = useLiveCollection('prepItems', restaurantId, { enabled: !!restaurantId && !propPrep.length, limitCount: 100, fallbackLimitCount: 30 });
  const liveTasks = useLiveCollection('tasks', restaurantId, { enabled: !!restaurantId && !propTasks.length, limitCount: 120, fallbackLimitCount: 30 });
  const liveInventory = useLiveCollection('inventoryItems', restaurantId, { enabled: !!restaurantId && !propInventory.length, limitCount: 120, fallbackLimitCount: 30 });
  const prep = propPrep.length ? propPrep : livePrep;
  const tasks = propTasks.length ? propTasks : liveTasks;
  const inventory = propInventory.length ? propInventory : liveInventory;
  const done = prep.filter(p => /done|complete/i.test(String(p.status || ''))).length;
  const total = prep.length;
  const openTasks = tasks.filter(t => !/done|complete/i.test(String(t.status || '')));
  const lowStock = inventory.filter(i => invPar(i) && invOnHand(i) < invPar(i));
  const groupedMap = safeArray(prep).reduce((map, p) => { const st = p.station || p.category || p.area || 'Prep Station'; (map[st] ||= []).push(p); return map; }, {});
  const groups = Object.entries(groupedMap).slice(0, 4);
  return <Page title="Prep & Tasks" subtitle="Smart prep board, task management, and 86 integration" right={<button type="button" className="ref-top-date"><CalendarDays size={15}/> {shortDate(currentDate)}</button>} metrics={[
    <Metric key="completion" icon={CheckCircle} label="Prep Completion" value={pct(safePct(done,total),0)} sub={`${done} / ${total} live items`} tone={safePct(done,total) < 70 ? 'yellow' : 'green'} />,
    <Metric key="tasks" icon={ClipboardList} label="Open Tasks" value={String(openTasks.length)} sub={`${tasks.length} live tasks`} tone="copper" />,
    <Metric key="impact" icon={DollarSign} label="86 Risk Items" value={String(lowStock.length)} sub="Live low stock impact" tone={lowStock.length ? 'red' : 'green'} />,
    <Metric key="due" icon={Clock} label="Due Today" value={String(openTasks.filter(t => byDate(t, currentDate)).length)} sub="Live due dates" tone="yellow" />,
    <Metric key="alerts" icon={AlertTriangle} label="Active 86 Alerts" value={String(lowStock.length)} sub="Inventory below par" tone={lowStock.length ? 'red' : 'green'} />
  ]}><div className="ref-prep-layout"><div className="ref-prep-main"><Panel title="Smart Prep Board" icon={ClipboardCheck} action={<span/>}><div className="ref-panel-toolbar"><select><option>Group by: Station</option></select><select><option>View: Board</option></select><span><Dot/> On Track</span><span><Dot tone="yellow"/> At Risk</span><span><Dot tone="red"/> Overdue</span><span><Dot tone="slate"/> Done</span></div><div className="ref-station-grid">{groups.length ? groups.map(([station, items]) => { const complete = items.filter(p => /done|complete/i.test(String(p.status || ''))).length; return <div className="ref-station-card" key={station}><h4>{station}<span>{pct(safePct(complete, items.length),0)}</span></h4><div className="head"><span>Item</span><span>Needed</span><span>Prepared</span><span>Due</span></div>{items.slice(0,5).map(item => { const needed = firstNumber(item.needed, item.qty, item.required); const prepared = firstNumber(item.prepared, item.doneQty, item.completed); const tone = needed && prepared >= needed ? 'green' : prepared < needed / 2 ? 'red' : 'yellow'; return <div className="prep-item" key={item.id || itemName(item)}><span><Dot tone={tone}/>{itemName(item)}</span><b>{needed}</b><b className={tone === 'red' ? 'bad' : tone === 'yellow' ? 'warn' : 'good'}>{prepared}</b><small>{item.due || item.dueTime || shortDate(dateKey(item))}</small></div>; })}<button type="button">+ Add Prep Item</button></div>; }) : <EmptyLive label="No live prep station data yet"/>}</div></Panel><Panel title="Task Lanes" action={null}><div className="ref-task-lanes">{['Overdue','Due Soon','Today','Completed'].map((lane)=> { const laneTasks = tasks.filter(t => lane === 'Completed' ? /done|complete/i.test(String(t.status || '')) : lane === 'Overdue' ? /overdue/i.test(String(t.status || '')) : lane === 'Today' ? byDate(t,currentDate) : /due|soon|pending|open/i.test(String(t.status || ''))).slice(0,3); return <div className="ref-task-lane" key={lane}><h4>{lane}<b>{laneTasks.length}</b></h4>{realRowsOrMessage(laneTasks, 'No live tasks').map(task => task.__empty ? <div className="task-card" key="empty"><span>{task.name}</span><small>Live clear</small><Status tone="slate">Empty</Status></div> : <div className="task-card" key={task.id || itemName(task)}><span>{itemName(task)}</span><small>{task.due || task.dueTime || shortDate(dateKey(task))}</small><Status tone={statusTone(task.status)}>{task.status || 'Open'}</Status></div>)}</div>; })}</div></Panel></div><aside className="ref-right-rail"><Panel title="86 Alerts & Prep Needs" icon={AlertTriangle}>{realRowsOrMessage(lowStock.slice(0,7), 'No inventory-driven prep alerts').map(i => i.__empty ? <div className="ref-row" key="empty"><span>{i.name}</span><Status>Clear</Status></div> : <div className="ref-alert-card" key={i.id || itemName(i)}><AlertTriangle size={18}/><div><b>{itemName(i)}</b><span>{rowStatus(invOnHand(i), invPar(i))}</span></div><em>{compact(invOnHand(i))} {itemUnit(i)}</em></div>)}</Panel></aside><aside className="ref-right-rail"><Panel title="86 Voice Command Center" icon={Mic} action={null}><div className="ref-mic-orb large"><Mic size={44}/></div><p>Voice commands use live prep, task, and inventory records.</p><div className="ref-list tight"><div className="ref-row"><span>Prep items loaded</span><b>{prep.length}</b></div><div className="ref-row"><span>Tasks loaded</span><b>{tasks.length}</b></div></div></Panel></aside></div></Page>;
}

export function ReferenceInventory({ appUser = {}, clientData = {}, inventoryItems: propInventory = [] }) {
  const restaurantId = appUser?.restaurantId;
  const inventoryLive = useLiveCollection('inventoryItems', restaurantId, { enabled: !!restaurantId && !propInventory.length, limitCount: 240, fallbackLimitCount: 40 });
  const invoices = useLiveCollection('invoices', restaurantId, { enabled: !!restaurantId, limitCount: 80, fallbackLimitCount: 20 });
  const vendors = useLiveCollection('vendors', restaurantId, { enabled: !!restaurantId, limitCount: 150, fallbackLimitCount: 40 });
  const wasteLogs = useLiveCollection('wasteLogs', restaurantId, { enabled: !!restaurantId, limitCount: 120, fallbackLimitCount: 30 });
  const menuScans = useLiveCollection('menuIntelligenceScans', restaurantId, { enabled: !!restaurantId, limitCount: 60, fallbackLimitCount: 20 });
  const menuDependencies = useLiveCollection('menuDependencies', restaurantId, { enabled: !!restaurantId, limitCount: 160, fallbackLimitCount: 40 });
  const items = propInventory.length ? propInventory : inventoryLive;
  const low = items.filter(i => invPar(i) > 0 && invOnHand(i) < invPar(i));
  const out = items.filter(i => invPar(i) > 0 && invOnHand(i) <= 0);
  const totalValue = sumNumbers(items, i => invOnHand(i) * invUnitCost(i));
  const parValue = sumNumbers(items, i => invPar(i) * invUnitCost(i));
  const wasteToday = sumNumbers(wasteLogs.filter(w => byDate(w, getToday())), w => firstNumber(w.totalCost, w.cost, w.amount, w.value));
  const vendorGroups = Object.entries(groupSum(items, i => i.vendor || i.vendorName || 'Unassigned', i => invOnHand(i) * invUnitCost(i))).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const recentPriceChanges = items.filter(i => firstNumber(i.previousUnitCost, i.lastUnitCost, i.oldCost) && invUnitCost(i) !== firstNumber(i.previousUnitCost, i.lastUnitCost, i.oldCost)).slice(0,6);
  const recommended = low.map(i => ({ ...i, recommended: Math.max(0, invPar(i) - invOnHand(i)), estimatedCost: Math.max(0, invPar(i) - invOnHand(i)) * invUnitCost(i) }));
  const lastScan = menuScans[0] || {};
  return <Page className="ref-inventory-screen" title="Inventory" subtitle="Inventory control, invoice scan, menu scan, burn log, and ordering." right={<button type="button" className="ref-top-date"><CalendarDays size={15}/> {shortDate(getToday())}</button>} metrics={[
    <Metric key="value" icon={DollarSign} label="Total Inventory Value" value={money(totalValue)} sub={`${items.length} live items`} tone="copper" points={items.slice(-12).map(i => invOnHand(i)*invUnitCost(i))} />,
    <Metric key="par" icon={DollarSign} label="Inventory Par Value" value={money(parValue)} sub="Live par × cost" tone="green" />,
    <Metric key="sku" icon={Package} label="Total SKUs" value={String(items.length)} sub="Live inventory records" tone="copper" />,
    <Metric key="low" icon={AlertTriangle} label="Low Stock Items" value={`${low.length} / ${items.length}`} sub="Live par comparison" tone={low.length ? 'yellow' : 'green'} />,
    <Metric key="out" icon={Flame} label="Out Of Stock" value={`${out.length} (${pct(safePct(out.length, items.length))})`} sub="Live on-hand counts" tone={out.length ? 'red' : 'green'} />,
    <Metric key="waste" icon={Flame} label="Today’s Burn" value={money(wasteToday)} sub={`${wasteLogs.filter(w => byDate(w, getToday())).length} live logs`} tone={wasteToday ? 'yellow' : 'green'} />
  ]}><div className="ref-tabs top"><button className="active">Inventory</button><button>Invoice Scan</button><button>Menu Scan</button><button>Burn Log</button><button>Ordering</button></div><div className="ref-inventory-layout"><div className="ref-inventory-main"><Panel title="Inventory" icon={Package} action={null}><div className="ref-panel-toolbar"><div className="search"><Search size={15}/><input placeholder="Search inventory..." /></div><button><FilterIcon/> Filters</button><select><option>Category</option></select><button><Plus size={14}/> Add Item</button></div><InventoryStatusTable items={items}/></Panel><div className="ref-inventory-mid"><Panel title="Vendor Summary" icon={Truck} action="View all"><div className="ref-table compact"><div className="head"><span>Vendor</span><span>Inventory Value</span><span>Records</span><span>Status</span></div>{realRowsOrMessage(vendorGroups, 'No live vendor inventory yet').map(v => v.__empty ? <div className="tr" key="empty"><span>{v.name}</span><span/><span/><Status tone="slate">Empty</Status></div> : <div className="tr" key={v[0]}><span>{v[0]}</span><span>{money(v[1])}</span><span>{items.filter(i => (i.vendor || i.vendorName || 'Unassigned') === v[0]).length}</span><Status>Live</Status></div>)}</div></Panel><Panel title="Low Stock Items" icon={AlertTriangle} action="View all"><div className="ref-list tight">{realRowsOrMessage(low.slice(0,5), 'No live low stock items').map(i=> i.__empty ? <div className="ref-row" key="empty"><span>{i.name}</span><Status>Clear</Status></div> : <div className="ref-row" key={i.id || itemName(i)}><span>{itemName(i)}</span><small>{compact(invOnHand(i))} {itemUnit(i)}</small><b>Par: {compact(invPar(i))}</b></div>)}</div></Panel><Panel title="Par Level Alerts" icon={Bell} action="View all"><div className="ref-list tight">{realRowsOrMessage(low.slice(0,5), 'No live par alerts').map((i)=> i.__empty ? <div className="ref-row" key="empty"><span>{i.name}</span><Status>Clear</Status></div> : <div className="ref-row" key={i.id || itemName(i)}><span>{itemName(i)}</span><small className="bad">Below par by {pct(safePct(invPar(i)-invOnHand(i), invPar(i)),0)}</small></div>)}</div></Panel><Panel title="Recent Price Changes" icon={TrendingUp} action="View all"><div className="ref-table compact two">{realRowsOrMessage(recentPriceChanges, 'No live price changes yet').map(i => i.__empty ? <div className="tr" key="empty"><span>{i.name}</span><Status tone="slate">Empty</Status></div> : <div className="tr" key={i.id || itemName(i)}><span>{itemName(i)}</span><b className={invUnitCost(i) > firstNumber(i.previousUnitCost, i.lastUnitCost, i.oldCost) ? 'bad' : 'good'}>{trendText(invUnitCost(i), firstNumber(i.previousUnitCost, i.lastUnitCost, i.oldCost), '')}</b><span>{dollars(invUnitCost(i))}</span></div>)}</div></Panel></div><Panel title="Ordering Recommendations" icon={ShoppingCart} action={`${recommended.length} live recommended`}><div className="ref-ordering"><div className="ref-table compact"><div className="head"><span>Item</span><span>On Hand</span><span>Par</span><span>Recommended</span><span>Unit</span><span>Est. Cost</span><span>Vendor</span><span>ETA</span><span>Action</span></div>{realRowsOrMessage(recommended.slice(0,5), 'No live ordering recommendations').map(i=> i.__empty ? <div className="tr" key="empty"><span>{i.name}</span><span/><span/><span/><span/><span/><span/><span/><Status>Clear</Status></div> : <div className="tr" key={i.id || itemName(i)}><span>{itemName(i)}</span><span>{compact(invOnHand(i))}</span><span>{compact(invPar(i))}</span><b>{compact(i.recommended)}</b><span>{itemUnit(i)}</span><span>{dollars(i.estimatedCost)}</span><span>{i.vendor || i.vendorName || 'Unassigned'}</span><span>Next order</span><button>Add to Order</button></div>)}</div><div className="ref-order-total"><b>{dollars(sumNumbers(recommended, i => i.estimatedCost))}</b><span>Estimated Order Total</span><button>Create Purchase Order</button></div></div></Panel></div><aside className="ref-right-rail inventory"><Panel title="Invoice Scan" icon={Upload} action="View all"><div className="ref-upload-zone"><Upload size={24}/><span>Drag & drop invoice or click to upload</span><small>PDF, JPG, PNG • Max 20MB</small></div><h4>Recent Scans</h4>{realRowsOrMessage(invoices.slice(0,5), 'No live invoice scans yet').map((i)=> i.__empty ? <div className="ref-row" key="empty"><span>{i.name}</span><Status tone="slate">Empty</Status></div> : <div className="ref-row" key={i.id || i.filename}><span>{i.filename || i.name || i.vendorName || 'Invoice'}</span><Status tone={statusTone(i.status)}>{i.status || 'Processed'}</Status></div>)}</Panel><Panel title="Menu Scan Intelligence" icon={Camera} action="View all"><div className="ref-kpi-trip"><div><b>{compact(firstNumber(lastScan.itemsScanned, lastScan.itemCount, menuDependencies.length))}</b><span>Items Scanned</span></div><div><b>{compact(firstNumber(lastScan.newItems, lastScan.newItemCount))}</b><span>New Items</span></div><div><b>{compact(firstNumber(lastScan.changesDetected, lastScan.changeCount))}</b><span>Changes</span></div></div><button type="button" className="ref-wide-action">View Detected Changes</button><h4>Top Cost Impact Items</h4>{realRowsOrMessage(menuDependencies.slice(0,3), 'No live menu scan impact yet').map((n)=> n.__empty ? <div className="ref-row" key="empty"><span>{n.name}</span><Status tone="slate">Empty</Status></div> : <div className="ref-row" key={n.id || itemName(n)}><span>{itemName(n)}</span><b className={firstNumber(n.costDelta, n.priceChange) >= 0 ? 'bad' : 'good'}>{dollars(firstNumber(n.costDelta, n.priceChange))}</b></div>)}</Panel><Panel title="Burn Log Insights" icon={Flame} action="View all"><div className="ref-side-stat"><div><b className="big">{money(wasteToday)}</b><span>Today’s burn</span><MiniSpark points={dailySeries(wasteLogs, daysBack(getToday(), 10), w => firstNumber(w.totalCost, w.cost, w.amount, w.value))}/></div><Donut value={safePct(wasteToday, totalValue)} label="Waste %" tone="copper" /></div><h4>Top Waste Items</h4>{realRowsOrMessage(wasteLogs.slice(0,3), 'No live burn logs yet').map((w)=> w.__empty ? <div className="ref-row" key="empty"><span>{w.name}</span><Status tone="slate">Empty</Status></div> : <div className="ref-row" key={w.id || itemName(w)}><span>{itemName(w)}</span><b>{dollars(firstNumber(w.totalCost, w.cost, w.amount, w.value))}</b></div>)}</Panel></aside></div></Page>;
}
const FilterIcon = () => <Search size={14} />;

export function ReferenceRecipes({ appUser = {} }) {
  const restaurantId = appUser?.restaurantId;
  const recipesLive = useLiveCollection('recipes', restaurantId, { enabled: !!restaurantId, limitCount: 120, fallbackLimitCount: 25 });
  const dependencies = useLiveCollection('menuDependencies', restaurantId, { enabled: !!restaurantId, limitCount: 200, fallbackLimitCount: 50 });
  const inventory = useLiveCollection('inventoryItems', restaurantId, { enabled: !!restaurantId, limitCount: 200, fallbackLimitCount: 50 });
  const recipes = recipesLive;
  const [selectedId, setSelectedId] = useState(null);
  const selected = recipes.find(r => String(r.id) === String(selectedId)) || recipes[0] || {};
  const margins = recipes.map(recipeMargin).filter(v => Number.isFinite(v));
  const avgMargin = margins.length ? margins.reduce((a,b)=>a+b,0)/margins.length : 0;
  const avgFoodPct = recipes.length ? recipes.reduce((a,r)=>a+(100-recipeMargin(r)),0)/recipes.length : 0;
  const lowMargin = recipes.filter(r => recipeMargin(r) < 20);
  const best = recipes.slice().sort((a,b)=>recipeMargin(b)-recipeMargin(a))[0];
  const worst = recipes.slice().sort((a,b)=>recipeMargin(a)-recipeMargin(b))[0];
  const ingredients = safeArray(selected.ingredients || selected.items || selected.build || selected.components);
  const depRows = dependencies.filter(d => [d.recipeId, d.menuItemId, d.recipeName, d.menuItemName].map(String).includes(String(selected.id)) || String(d.recipeName || d.menuItemName || '').toLowerCase() === String(itemName(selected,'')).toLowerCase()).slice(0, 6);
  return <Page className="ref-recipes-screen" title="Recipes & Menu Cost" subtitle="Manage recipes, build smarter menus, and protect your margins." metrics={[
    <Metric key="total" icon={Package} label="Total Recipes" value={String(recipes.length)} sub="Live recipe records" tone="copper" />,
    <Metric key="avg" icon={Percent} label="Avg Food Cost %" value={pct(avgFoodPct)} sub="Calculated from live recipes" tone={avgFoodPct > 35 ? 'yellow' : 'green'} />,
    <Metric key="period" icon={DollarSign} label="Live Recipe Cost" value={money(sumNumbers(recipes, recipeCost))} sub="Sum of recipe costs" tone="copper" />,
    <Metric key="best" icon={Star} label="Best Margin" value={best ? itemName(best) : 'None'} sub={best ? `${pct(recipeMargin(best))} margin` : 'No live recipes'} tone="green" />,
    <Metric key="worst" icon={AlertTriangle} label="Worst Margin" value={worst ? itemName(worst) : 'None'} sub={worst ? `${pct(recipeMargin(worst))} margin` : 'No live recipes'} tone={worst && recipeMargin(worst) < 20 ? 'red' : 'green'} />,
    <Metric key="alerts" icon={Bell} label="Item Alerts" value={String(lowMargin.length)} sub="Recipes under 20% margin" tone={lowMargin.length ? 'red' : 'green'} />
  ]}><div className="ref-recipes-layout"><Panel title="Recipe Catalog" icon={BookOpen} action={`${recipes.length} Recipes`}><div className="ref-panel-toolbar"><div className="search"><Search size={15}/><input placeholder="Search recipes..." /></div><select><option>Category</option></select><select><option>Status</option></select></div><div className="ref-recipe-list">{realRowsOrMessage(recipes.slice(0,8), 'No live recipes yet').map((r,idx) => r.__empty ? <button type="button" key="empty"><span className="thumb">86</span><b>{r.name}</b><span/><span/><ChevronRight size={14}/></button> : <button type="button" key={r.id || itemName(r)} className={String(selected.id) === String(r.id) ? 'active' : ''} onClick={() => setSelectedId(r.id)}><span className={`thumb thumb-${idx}`}>{String(itemName(r)).slice(0,2)}</span><b>{itemName(r)}<small>{r.category || r.menuCategory || 'Recipe'}</small></b><span>{dollars(recipeCost(r))}<small>Food Cost</small></span><span className={recipeMargin(r) < 20 ? 'bad' : 'good'}>{pct(recipeMargin(r))}<small>Margin</small></span><ChevronRight size={14}/></button>)}</div></Panel><main className="ref-recipe-detail"><Panel title={selected.id ? itemName(selected) : 'Recipe Detail'} icon={BookOpen} action={selected.id ? <button type="button"><Star size={14}/></button> : null}><div className="ref-recipe-hero"><div className="recipe-photo-hero">86</div><div><h2>{selected.id ? itemName(selected) : 'Select a recipe'}</h2><p>{selected.description || selected.notes || 'Live recipe costing will appear here when recipe records exist.'}</p><Status tone={selected.active === false ? 'yellow' : 'green'}>{selected.active === false ? 'Inactive' : selected.id ? 'Live' : 'Empty'}</Status></div><div className="ref-kpi-trip big"><div><b>{dollars(recipeCost(selected))}</b><span>Food Cost</span></div><div><b>{pct(100 - recipeMargin(selected))}</b><span>Cost %</span></div><div><b>{pct(recipeMargin(selected))}</b><span>Margin</span></div></div></div><div className="ref-tabs top"><button className="active">Ingredients & Build</button><button>Yield & Portions</button><button>Cost & Margin</button><button>Allergens</button></div><div className="ref-table compact"><div className="head"><span>Ingredient</span><span>Qty</span><span>Unit</span><span>Unit Cost</span><span>Total Cost</span></div>{realRowsOrMessage(ingredients.slice(0,8), 'No live ingredients saved').map((i,idx)=> i.__empty ? <div className="tr" key="empty"><span>{i.name}</span><span/><span/><span/><Status tone="slate">Empty</Status></div> : <div className="tr" key={i.id || itemName(i) || idx}><span>{itemName(i)}</span><span>{compact(firstNumber(i.qty,i.quantity,i.amount))}</span><span>{i.unit || 'ea'}</span><span>{dollars(firstNumber(i.unitCost,i.cost))}</span><span>{dollars(firstNumber(i.totalCost, firstNumber(i.qty,i.quantity,i.amount) * firstNumber(i.unitCost,i.cost)))}</span></div>)}</div></Panel><Panel title="Yield & Portion Cost"><div className="ref-kpi-trip big"><div><b>{compact(firstNumber(selected.batchYield, selected.yield, selected.servings))}</b><span>Batch Yield</span></div><div><b>{dollars(recipeCost(selected) * Math.max(1, firstNumber(selected.batchYield, selected.yield, 1)))}</b><span>Total Batch Cost</span></div><div><b>{dollars(recipeCost(selected))}</b><span>Per Serving</span></div></div></Panel></main><aside className="ref-right-rail recipes"><Panel title="Margin Insights" icon={PieChart} action="View Full Report"><div className="ref-side-stat"><Donut value={avgMargin} label="Avg Margin" tone="copper"/><div><div className="ref-kv"><span>High Margin</span><b>{recipes.filter(r=>recipeMargin(r)>=60).length}</b></div><div className="ref-kv"><span>Good Margin</span><b>{recipes.filter(r=>recipeMargin(r)>=40&&recipeMargin(r)<60).length}</b></div><div className="ref-kv"><span>Low Margin</span><b>{recipes.filter(r=>recipeMargin(r)>=20&&recipeMargin(r)<40).length}</b></div><div className="ref-kv"><span>Loss</span><b>{recipes.filter(r=>recipeMargin(r)<20).length}</b></div></div></div></Panel><Panel title="Menu Dependencies" icon={Bot} action="View All"><div className="ref-dependency">{realRowsOrMessage(depRows, 'No live dependency graph yet').map(d => d.__empty ? <div className="ref-row" key="empty"><span>{d.name}</span><Status tone="slate">Empty</Status></div> : <div className="ref-row" key={d.id || itemName(d)}><span>{itemName(d)}</span><small>{d.ingredientName || d.inventoryItemName || 'dependency'}</small></div>)}</div></Panel><Panel title="Smart Kitchen AI" icon={Bot} action="View All"><div className="ref-note-card"><b>Live Cost Recommendation</b><p>{lowMargin.length ? `${itemName(lowMargin[0])} is under target margin. Review ingredient costs and menu price.` : 'No low-margin live recipes found.'}</p></div></Panel></aside></div></Page>;
}

export function ReferenceFinancials({ currentDate = getToday(), appUser = {}, users = [], sales = [], timePunches = [], clientData = {} }) {
  const restaurantId = appUser?.restaurantId || clientData?.id || users[0]?.restaurantId || '';
  const expenses = useLiveCollection('financialExpenses', restaurantId, { enabled: !!restaurantId, limitCount: 200, fallbackLimitCount: 50 });
  const dates = daysBack(currentDate, 14);
  const salesSeries = dailySeries(sales, dates, salesAmount);
  const laborSeries = dailySeries(timePunches, dates, laborAmount);
  const currentSales = sumNumbers(sales.filter(s => byDate(s, currentDate)), salesAmount);
  const previousSales = sumNumbers(sales.filter(s => byDate(s, previousDate(currentDate))), salesAmount);
  const labor = sumNumbers(timePunches.filter(p => byDate(p, currentDate)), laborAmount);
  const cogs = sumNumbers(sales.filter(s => byDate(s, currentDate)), cogsAmount);
  const opex = sumNumbers(expenses.filter(e => byDate(e, currentDate)), expenseAmount);
  const grossProfit = currentSales - cogs;
  const primeCost = cogs + labor;
  const netIncome = currentSales - cogs - labor - opex;
  const roles = rolesFromUsers(users, clientData);
  const roleHours = roles.map(role => ({ role, hours: sumNumbers(timePunches.filter(p => normalizeRole(p.role) === role), punchHours) }));
  const totalHours = sumNumbers(roleHours, r => r.hours);
  const ledgerRows = sales.filter(s => byDate(s,currentDate)).slice(0,8);
  const punchRows = timePunches.filter(p => byDate(p,currentDate)).slice(0,8);
  return <Page className="ref-financials-screen" title="Financials + Timesheets + Daily Ledger" subtitle="Real-time financial overview, labor tracking, and operational ledger." right={<button type="button" className="ref-top-date"><CalendarDays size={15}/> {shortDate(currentDate)}</button>} metrics={[
    <Metric key="net" icon={DollarSign} label="Net Sales (Today)" value={money(currentSales)} sub={trendText(currentSales, previousSales, ' vs yesterday')} tone="copper" points={salesSeries} />,
    <Metric key="gross" icon={Target} label="Gross Profit" value={money(grossProfit)} sub={`${pct(safePct(grossProfit,currentSales))} of sales`} tone="copper" />,
    <Metric key="labor" icon={Users} label="Labor Cost" value={money(labor)} sub={`${pct(safePct(labor,currentSales))} of sales`} tone="copper" points={laborSeries} />,
    <Metric key="prime" icon={Briefcase} label="Prime Cost" value={money(primeCost)} sub={`${pct(safePct(primeCost,currentSales))} of sales`} tone="copper" />,
    <Metric key="opex" icon={Wallet} label="Operating Expenses" value={money(opex)} sub={`${expenses.filter(e=>byDate(e,currentDate)).length} live expenses`} tone="copper" />,
    <Metric key="income" icon={TrendingUp} label="Net Income" value={money(netIncome)} sub={`${pct(safePct(netIncome,currentSales))} of sales`} tone={netIncome < 0 ? 'red' : 'green'} />
  ]}><div className="ref-finance-layout"><main className="ref-finance-main"><div className="ref-finance-top"><Panel title="Sales vs Labor Trends" icon={LineChart} action={<select><option>Live 14 Days</option></select>}><LiveBarChart salesSeries={salesSeries} laborSeries={laborSeries}/></Panel><Panel title="Labor Percentage" icon={PieChart} action={null}><div className="ref-side-stat"><Donut value={safePct(labor,currentSales)} label="Labor %" tone="copper"/><div><div className="ref-kv"><span>Labor Cost</span><b>{money(labor)}</b></div><div className="ref-kv"><span>Sales</span><b>{money(currentSales)}</b></div><div className="ref-kv"><span>Labor Goal</span><b>25.0%</b></div><div className="ref-kv"><span>Variance</span><b className={safePct(labor,currentSales) <= 25 ? 'good' : 'warn'}>{(safePct(labor,currentSales)-25).toFixed(1)} pp</b></div></div></div></Panel><Panel title="Sales Summary" action={<select><option>Today</option></select>}><div className="ref-kv"><span>Net Sales</span><b>{money(currentSales)}</b></div><div className="ref-kv"><span>Tax</span><b>{money(sumNumbers(sales.filter(s=>byDate(s,currentDate)), taxAmount))}</b></div><div className="ref-kv"><span>Discounts</span><b className="bad">({money(sumNumbers(sales.filter(s=>byDate(s,currentDate)), discountAmount))})</b></div><div className="ref-kv"><span>Voids</span><b className="bad">({money(sumNumbers(sales.filter(s=>byDate(s,currentDate)), voidAmount))})</b></div><div className="ref-kv total"><span>Total Sales</span><b className="good">{money(currentSales)}</b></div></Panel></div><Panel title="Daily Ledger" action="View Full Ledger"><div className="ref-table ledger"><div className="head"><span>Time</span><span>Type</span><span>Description</span><span>Category</span><span>Amount</span><span>Payment Type</span><span>Reference</span><span>Status</span></div>{realRowsOrMessage(ledgerRows, 'No live sales ledger rows today').map((row,idx)=> row.__empty ? <div className="tr" key="empty"><span/><span>{row.name}</span><span/><span/><span/><span/><span/><Status tone="slate">Empty</Status></div> : <div className="tr" key={row.id || idx}><span>{row.time || row.closeTime || timeAgo(row)}</span><span>{row.type || 'Sale'}</span><span>{row.description || row.checkName || row.name || 'Sales record'}</span><span>{row.category || 'Sales'}</span><span className={salesAmount(row)<0?'bad':''}>{dollars(salesAmount(row))}</span><span>{row.paymentType || row.tender || 'POS'}</span><span>{row.reference || row.checkNumber || row.id}</span><Status tone={statusTone(row.status)}>{row.status || 'Completed'}</Status></div>)}</div><div className="ref-total-line"><span>Total Net Sales</span><b>{dollars(currentSales)}</b></div></Panel><Panel title="Timesheets" action={<div className="ref-actions"><button>Approve All</button><button>Export</button><button>View All Timesheets</button></div>}><div className="ref-table timesheets"><div className="head"><span>Employee</span><span>Role</span><span>Shift</span><span>Clock In</span><span>Clock Out</span><span>Break</span><span>Reg Hrs</span><span>OT Hrs</span><span>Total Hrs</span><span>Labor $</span><span>Labor %</span><span>Status</span></div>{realRowsOrMessage(punchRows, 'No live punches today').map((p,idx)=> p.__empty ? <div className="tr" key="empty"><span>{p.name}</span><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><Status tone="slate">Empty</Status></div> : <div className="tr" key={p.id || idx}><span>{p.employeeName || p.name || p.userName || p.email || 'Staff'}</span><span>{p.role || 'Staff'}</span><span>{p.shiftLabel || 'Live'}</span><span>{p.clockIn || p.startTime || ''}</span><span>{p.clockOut || p.endTime || ''}</span><span>{p.breakMinutes || p.break || 0}</span><span>{number(p.regularHours || punchHours(p)).toFixed(2)}</span><span>{number(p.overtimeHours).toFixed(2)}</span><span>{punchHours(p).toFixed(2)}</span><span>{dollars(laborAmount(p))}</span><span>{pct(safePct(laborAmount(p), currentSales))}</span><Status tone={statusTone(p.status)}>{p.status || 'Live'}</Status></div>)}</div></Panel></main><aside className="ref-right-rail finance"><Panel title="Notes & Exceptions" action="View All"><h4>Discrepancies</h4><div className="ref-alert-card small"><AlertTriangle size={16}/><div><b>Voids</b><span>{dollars(sumNumbers(sales.filter(s=>byDate(s,currentDate)), voidAmount))}</span></div><em>Live</em></div><div className="ref-alert-card small"><AlertTriangle size={16}/><div><b>Discounts</b><span>{dollars(sumNumbers(sales.filter(s=>byDate(s,currentDate)), discountAmount))}</span></div><em>Live</em></div><h4>Open Actions</h4>{['Reconcile Discrepancies','Review Discounts','Approve Timesheets'].map((a,idx)=><button type="button" className="ref-action-row" key={a}>{a}<b>{idx===2 ? punchRows.filter(p=>/pending/i.test(String(p.status||''))).length : idx===1 ? sumNumbers(sales.filter(s=>byDate(s,currentDate)), discountAmount) : sumNumbers(sales.filter(s=>byDate(s,currentDate)), voidAmount)}</b></button>)}</Panel><Panel title="Export Controls" icon={Download} action={null}><button type="button" className="ref-wide-action"><Download size={15}/> Export Daily Ledger</button><button type="button" className="ref-wide-action"><Download size={15}/> Export Sales Summary</button><select><option>Date Range: Today</option></select><select><option>Location / Dept: All Locations</option></select></Panel><Panel title="Role-Based Hour Totals" action={<select><option>Today</option></select>}><div className="ref-list tight">{realRowsOrMessage(roleHours, 'No live role hours yet').map(r=> r.__empty ? <div className="ref-row" key="empty"><span>{r.name}</span><Status tone="slate">Empty</Status></div> : <div className="ref-hours-row" key={r.role}><span>{r.role}</span><Progress value={safePct(r.hours,totalHours)}/><b>{r.hours.toFixed(2)}</b></div>)}<div className="ref-kv total"><span>Total Hours</span><b>{totalHours.toFixed(2)}</b></div></div></Panel></aside></div></Page>;
}

export function ReferenceSettings({ appUser = {}, clientData = {}, users = [], addToast }) {
  const [accent, setAccent] = useState(clientData?.systemSettings?.accentColor || '#B87333');
  const categories = ['Branding','Roster Roles','Notifications','Schedule Style','Time Format','Workspace Options','Integrations','Billing & Plan','Demo Mode','Owner Controls'];
  const roles = rolesFromUsers(users, clientData);
  return <Page className="ref-settings-screen" title="Settings" subtitle="Manage your workspace preferences and system configuration" right={<button type="button" className="primary" onClick={() => addToast?.('Settings Saved', 'Visual preferences saved.')}>Save Changes <ChevronRight size={15}/></button>}><div className="ref-settings-layout"><aside className="ref-settings-menu">{categories.map((c,idx)=><button type="button" className={idx===0?'active':''} key={c}>{[<BookOpen/>,<Users/>,<Bell/>,<CalendarDays/>,<Clock/>,<Settings/>,<Zap/>,<Wallet/>,<RefreshCw/>,<Lock/>][idx]}<span>{c}</span></button>)}</aside><main className="ref-settings-main"><section className="ref-setting-row tall"><div><h3>Branding</h3><p>Customize your workspace identity and visual branding.</p></div><div className="ref-upload-zone small"><Upload size={22}/><b>Upload Logo</b><small>PNG, JPG or SVG. 512×512px recommended</small></div><label>Primary Accent<input type="color" value={accent} onChange={e=>setAccent(e.target.value)} /><span>{accent}</span></label><label>Workspace Name<input value={appUser?.restaurantName || clientData?.name || 'Restaurant'} readOnly /></label><label>Tagline (Optional)<input value={clientData?.tagline || ''} readOnly /></label></section>{[['Roster Roles','Manage custom roles and permissions.', <><span>Enable Custom Roles</span><Status>{roles.length ? 'On' : 'Empty'}</Status><small>{roles.join(', ') || 'No live roster roles configured yet'}</small></>, 'Manage Roles'],['Notification Preferences','Configure when and how you get alerts.', <><span>Browser Notifications</span><Status>On</Status><span>Email Notifications</span><Status>On</Status><span>Mobile Push</span><Status>On</Status></>, 'Configure Alerts'],['Schedule Style','Choose how schedules are displayed.', <><label>Default View<select><option>Week View</option></select></label><label>Start Day<select><option>Sunday</option></select></label><span>Show Costing</span><Status>On</Status></>, 'Preview'],['Time Format','Set your preferred time and date formats.', <><label>Time Format<select><option>12-Hour (1:30 PM)</option></select></label><label>Date Format<select><option>{shortDate(getToday())}</option></select></label><label>First Day of Week<select><option>Sunday</option></select></label></>, 'Open'],['Workspace Options','Configure general workspace behavior.', <><span>Auto Log Out</span><Status>On</Status><span>Confirm Actions</span><Status>On</Status><span>Compact Mode</span><Status tone="slate">Off</Status></>, 'Open'],['Integrations','Connect 86 Chaos with your favorite tools.', <><Status tone={clientData?.quickbooksConnected ? 'green' : 'slate'}>QuickBooks {clientData?.quickbooksConnected ? 'Connected' : 'Not connected'}</Status><Status tone={clientData?.googleCalendarConnected ? 'green' : 'slate'}>Google Calendar {clientData?.googleCalendarConnected ? 'Connected' : 'Connect'}</Status></>, 'Manage Integrations'],['Billing & Plan','View plan details and billing information.', <><span>Current Plan</span><b>{clientData?.subscription?.planId || clientData?.planId || 'Unknown'}</b><span>Seats</span><b>{users.length}</b></>, 'Manage Billing'],['Demo Mode','Test features in a safe demo environment.', <><span>Demo Mode</span><Status tone="slate">Off</Status></>, 'Reset Demo Data'],['Owner Controls','Advanced settings for workspace owners only.', <><span className="bad">Owner Controls</span><small>Restricted settings and data management</small></>, 'Open Owner Controls']].map(([title, desc, content, action])=><section className={`ref-setting-row ${title==='Owner Controls'?'danger':''}`} key={title}><div><h3>{title}</h3><p>{desc}</p></div><div className="ref-setting-content">{content}</div><button type="button">{action}<ChevronRight size={15}/></button></section>)}</main></div></Page>;
}

export function ReferenceTeam({ users = [], appUser = {}, clientData = {} }) {
  const staff = tableUsers(users);
  const clocked = staff.filter(u => u.clockedIn || u.status === 'clocked-in' || u.currentPunchId).length;
  return <Page className="ref-team-screen" title="Staff Roster" subtitle="Team directory, role tags, permissions, and staff status." metrics={[<Metric key="team" icon={Users} label="Active Staff" value={String(staff.length)} sub="Live roster records" tone="green" />, <Metric key="roles" icon={Shield} label="Roster Roles" value={String(rolesFromUsers(users, clientData).length)} sub="Preferences source" tone="copper" />, <Metric key="clock" icon={Clock} label="Clocked In" value={String(clocked)} sub="Live user status fields" tone="green" />]}><Panel title="Staff Roster" icon={Users} action="Add Staff"><div className="ref-table roster"><div className="head"><span>Name</span><span>Role</span><span>Status</span><span>Permissions</span><span>Contact</span><span>Last Active</span></div>{realRowsOrMessage(staff, 'No live staff records yet').map((u,idx)=>u.__empty ? <div className="tr" key="empty"><span>{u.name}</span><span/><span/><span/><span/><Status tone="slate">Empty</Status></div> : <div className="tr" key={u.id || u.name}><span>{u.name || u.email}</span><span>{u.role || 'Staff'}</span><Status tone={statusTone(u.status || (u.isActive !== false ? 'Active' : 'Inactive'))}>{u.status || (u.isActive !== false ? 'Active' : 'Inactive')}</Status><span>{u.isAdmin?'Admin':'Staff'}</span><span>{u.email || 'Hidden'}</span><span>{timeAgo(u)}</span></div>)}</div></Panel></Page>;
}

export function ReferenceMessages({ events = [] }) {
  const messages = safeArray(events).filter(e => /message|announcement|note|post/i.test(String(e.type || e.category || e.title || ''))).slice(0, 8);
  return <Page className="ref-messages-screen" title="Message Board" subtitle="Pinned announcements, shift notes, read receipts, and quick posts."><div className="ref-message-layout"><Panel title="Pinned & Announcements" icon={MessageSquare} action="New Post">{realRowsOrMessage(messages, 'No live message events loaded').map(m => m.__empty ? <div className="ref-message-preview" key="empty"><b>{m.name}</b><p>Post controls still route to the real Message Board workflow.</p></div> : <div className="ref-message-preview pinned" key={m.id || m.title}><b>{m.title || 'Message'}</b><p>{m.message || m.description || m.notes || ''}</p><small>{timeAgo(m)}</small></div>)}</Panel><Panel title="Shift Notes" icon={ClipboardList}><EmptyLive label="Live shift notes appear here when posted"/></Panel><Panel title="Quick Post" icon={Send} action={null}><textarea placeholder="Post an update to the team..."/><button type="button" className="primary">Post Message</button></Panel></div></Page>;
}

export function ReferenceSystemAdmin({ appUser = {}, setActiveTab, activeAdminSection = 'overview', setActiveAdminSection, addToast }) {
  const restaurants = useLiveCollection('restaurants', null, { enabled: true, global: true, limitCount: 120, fallbackLimitCount: 30 });
  const allUsers = useLiveCollection('users', null, { enabled: true, global: true, limitCount: 200, fallbackLimitCount: 40 });
  const auditLogs = useLiveCollection('auditLogs', null, { enabled: true, global: true, limitCount: 120, fallbackLimitCount: 30 });
  const backupLogs = useLiveCollection('backupLogs', null, { enabled: true, global: true, limitCount: 60, fallbackLimitCount: 20 });
  const pushLogs = useLiveCollection('pushLogs', null, { enabled: true, global: true, limitCount: 120, fallbackLimitCount: 20 });
  const issues = useLiveCollection('systemIssues', null, { enabled: true, global: true, limitCount: 80, fallbackLimitCount: 20 });
  const activeWorkspaces = restaurants.slice(0,5);
  const activeUsers = allUsers.filter(u => u.isActive !== false);
  const successfulPush = pushLogs.filter(p => /success|sent|delivered/i.test(String(p.status || p.result || ''))).length;
  const pushHealth = pushLogs.length ? safePct(successfulPush, pushLogs.length) : 0;
  const successfulBackups = backupLogs.filter(b => /success|complete|verified|ready/i.test(String(b.status || b.result || ''))).length;
  const backupHealth = backupLogs.length ? safePct(successfulBackups, backupLogs.length) : 0;
  const criticalIssues = issues.filter(i => /critical|high|failed|error/i.test(String(i.severity || i.status || i.title || '')));
  const readiness = issues.length ? clamp(100 - criticalIssues.length * 12 - (issues.length-criticalIssues.length)*4) : 0;
  const platformHealth = Math.round((readiness + backupHealth + pushHealth) / (issues.length || backupLogs.length || pushLogs.length ? 3 : 1));
  const sectionKey = activeAdminSection || 'overview';
  const sectionMeta = {
    overview: { label: 'Overview', icon: Activity, desc: 'Platform operations, security, and system health.' },
    workspaces: { label: 'Workspaces', icon: Briefcase, desc: 'Live client workspaces, owners, plans, activity, and access state.' },
    users: { label: 'Global Users', icon: Users, desc: 'Platform user visibility, role checks, and account health.' },
    security: { label: 'Security Center', icon: Shield, desc: 'Rules, admin access, App Check/MFA posture, and protected-surface review.' },
    backup: { label: 'Backup Center', icon: Database, desc: 'Backup logs, integrity signals, restore readiness, and retention checks.' },
    push: { label: 'Push Health', icon: Send, desc: 'Push notification delivery, failure counts, and device-token health.' },
    forensics: { label: 'Forensics', icon: Bug, desc: 'Audit timeline, suspicious events, blocked actions, and admin activity.' },
    automation: { label: 'Automation', icon: Bot, desc: 'Ops intelligence, scheduled jobs, scan-and-alert automation, and drift checks.' },
    support: { label: 'Support', icon: Wrench, desc: 'Diagnostics, issues, support queue, and workspace troubleshooting.' },
    retention: { label: 'Retention', icon: ClipboardList, desc: 'Client health, risk indicators, inactive workspaces, and renewal follow-up.' },
    access: { label: 'Access Control', icon: Lock, desc: 'Permission boundaries, protected admin surfaces, and super-admin-only actions.' },
    deployment: { label: 'Deployment', icon: Rocket, desc: 'Build readiness, feature flags, migrations, and release health.' },
    operations: { label: 'Operations', icon: Settings, desc: 'System summary, storage use, logs, uptime, and operating health.' },
  };
  const currentSection = sectionMeta[sectionKey] || sectionMeta.overview;
  const CurrentSectionIcon = currentSection.icon;
  const goAdminSection = (next, label) => { setActiveAdminSection?.(next); addToast?.('System Administrator', `Opened ${label || sectionMeta[next]?.label || next}.`); };
  const sectionRows = sectionKey === 'workspaces' ? activeWorkspaces
    : sectionKey === 'users' ? activeUsers
    : sectionKey === 'backup' ? backupLogs
    : sectionKey === 'push' ? pushLogs
    : sectionKey === 'forensics' ? auditLogs
    : sectionKey === 'support' ? issues
    : sectionKey === 'security' ? criticalIssues
    : sectionKey === 'automation' ? auditLogs.slice(0, 12)
    : sectionKey === 'deployment' ? issues
    : sectionKey === 'operations' ? [...restaurants.slice(0, 4), ...backupLogs.slice(0, 4), ...issues.slice(0, 4)]
    : sectionKey === 'retention' ? restaurants.filter(r => /idle|inactive|trial|past_due|risk/i.test(String(r.status || r.subscription?.status || r.health || '')))
    : sectionKey === 'access' ? allUsers.filter(u => u.isSuperAdmin || u.isAdmin || u.role || u.permissions)
    : [];
  if (sectionKey !== 'overview') return <Page className="ref-admin-screen" title={currentSection.label} subtitle={currentSection.desc} right={<div className="ref-admin-section-actions"><button type="button" className="ref-top-date" onClick={()=>goAdminSection('overview', 'Overview')}><ChevronRight size={14}/> Overview</button><button type="button" className="ref-top-date" onClick={()=>setActiveTab?.('today')}><ChevronRight size={14}/> Exit Admin</button></div>} metrics={[
    <Metric key="section-health" icon={CurrentSectionIcon} label={`${currentSection.label} Health`} value={sectionRows.length ? String(sectionRows.length) : 'Live'} sub={sectionRows.length ? 'Live records loaded' : 'No blocking live records'} tone={sectionRows.length ? 'copper' : 'green'} />,
    <Metric key="section-platform" icon={Activity} label="Platform Health" value={`${platformHealth}%`} sub={issues.length ? `${issues.length} issues` : 'No issue records'} tone={platformHealth >= 95 ? 'green' : platformHealth >= 80 ? 'yellow' : 'red'} />,
    <Metric key="section-backup" icon={Database} label="Backup Integrity" value={`${Math.round(backupHealth)}%`} sub={`${backupLogs.length} backup logs`} tone={backupHealth >= 95 ? 'green' : backupHealth ? 'yellow' : 'slate'} />,
    <Metric key="section-push" icon={Send} label="Push Delivery" value={`${Math.round(pushHealth)}%`} sub={`${pushLogs.length} push logs`} tone={pushHealth >= 95 ? 'green' : pushHealth ? 'yellow' : 'slate'} />
  ]}>
    <div className="ref-admin-section-grid">
      <Panel title={`${currentSection.label} Controls`} icon={CurrentSectionIcon} action={null}>
        <button type="button" className="ref-wide-action" onClick={()=>goAdminSection('overview', 'Overview')}>Back to Overview</button>
        <button type="button" className="ref-wide-action" onClick={()=>addToast?.('System Administrator', `${currentSection.label} live view refreshed.`)}>Refresh This View</button>
        {sectionKey === 'forensics' && <button type="button" className="ref-wide-action" onClick={()=>setActiveTab?.('audit')}>Open Audit Log</button>}
        {sectionKey === 'workspaces' && <button type="button" className="ref-wide-action" onClick={()=>addToast?.('Workspaces', 'Workspace deployment/review queue opened in the System Administrator console.')}>Review Workspace Queue</button>}
        {sectionKey === 'security' && <button type="button" className="ref-wide-action danger" onClick={()=>addToast?.('Security Center', 'Emergency read-only controls are review-only here. Confirm from the protected security workflow before changing live access.')}>Emergency Read-Only Review</button>}
        {sectionKey === 'deployment' && <button type="button" className="ref-wide-action" onClick={()=>addToast?.('Deployment', 'Deployment readiness checklist opened for review.')}>Open Deployment Checklist</button>}
        <button type="button" className="ref-wide-action" onClick={()=>setActiveTab?.('today')}>Exit to Restaurant App</button>
      </Panel>
      <Panel title={`${currentSection.label} Live Records`} icon={Database} action="Open related logs" onAction={()=> sectionKey === 'forensics' ? setActiveTab?.('audit') : goAdminSection(sectionKey, currentSection.label)}>
        <div className="ref-list tight">
          {realRowsOrMessage(sectionRows.slice(0, 10), `No live ${currentSection.label.toLowerCase()} records accessible`).map((row, idx) => row.__empty
            ? <div className="ref-row" key="empty"><span>{row.name}</span><Status tone="slate">Empty</Status></div>
            : <div className="ref-row" key={row.id || idx}><span>{row.name || row.restaurantName || row.email || row.title || row.action || row.type || row.status || `Record ${idx + 1}`}</span><small>{row.ownerEmail || row.userEmail || row.restaurantId || row.workspaceName || row.service || timeAgo(row)}</small><Status tone={statusTone(row.status || row.severity || row.role || 'Live')}>{row.status || row.severity || row.role || 'Live'}</Status></div>)}
        </div>
      </Panel>
      <Panel title="Cross-System Shortcuts" icon={Rocket} action={null}>
        <div className="ref-three-cards">
          <button type="button" className="ref-wide-action" onClick={()=>goAdminSection('workspaces', 'Workspaces')}>Workspaces</button>
          <button type="button" className="ref-wide-action" onClick={()=>goAdminSection('security', 'Security Center')}>Security Center</button>
          <button type="button" className="ref-wide-action" onClick={()=>goAdminSection('backup', 'Backup Center')}>Backup Center</button>
          <button type="button" className="ref-wide-action" onClick={()=>goAdminSection('push', 'Push Health')}>Push Health</button>
          <button type="button" className="ref-wide-action" onClick={()=>goAdminSection('support', 'Support')}>Support</button>
          <button type="button" className="ref-wide-action" onClick={()=>goAdminSection('operations', 'Operations')}>Operations</button>
        </div>
      </Panel>
    </div>
  </Page>;
  return <Page className="ref-admin-screen" title="System Administrator" subtitle="Platform operations, security, and system health" right={<button type="button" className="ref-top-date"><CalendarDays size={15}/> {shortDate(getToday())}</button>} metrics={[
    <Metric key="health" icon={Activity} label="Platform Health" value={`${platformHealth}%`} sub={issues.length ? `${issues.length} live issues` : 'No live issue records'} tone={platformHealth >= 95 ? 'green' : platformHealth >= 80 ? 'yellow' : 'red'} />,
    <Metric key="active" icon={Users} label="Active Workspaces" value={String(restaurants.length)} sub="Live restaurants collection" tone="copper" />,
    <Metric key="global" icon={Users} label="Global Users" value={String(allUsers.length)} sub={`${activeUsers.length} active live users`} tone="green" />,
    <Metric key="deploy" icon={ShieldCheck} label="Deployment Readiness" value={`${readiness}%`} sub="Calculated from live issues" tone={readiness >= 95 ? 'green' : readiness >= 80 ? 'yellow' : 'red'} />,
    <Metric key="backup" icon={Database} label="Backup Integrity" value={`${Math.round(backupHealth)}%`} sub={`${backupLogs.length} live backup logs`} tone={backupHealth >= 95 ? 'green' : backupHealth ? 'yellow' : 'slate'} />,
    <Metric key="push" icon={Send} label="Push Delivery Health" value={`${Math.round(pushHealth)}%`} sub={`${pushLogs.length} live push logs`} tone={pushHealth >= 95 ? 'green' : pushHealth ? 'yellow' : 'slate'} />
  ]}><div className="ref-admin-layout"><main><div className="ref-admin-top"><Panel title="Active Workspaces" icon={Settings} action="View all"><div className="ref-table compact"><div className="head"><span>Workspace</span><span>Plan</span><span>Owner</span><span>Users</span><span>Status</span><span>Activity</span></div>{realRowsOrMessage(activeWorkspaces, 'No live workspace records accessible').map((r,idx)=> r.__empty ? <div className="tr" key="empty"><span>{r.name}</span><span/><span/><span/><Status tone="slate">Empty</Status><span/></div> : <div className="tr" key={r.id || r.name}><span>{r.name || r.restaurantName || r.id}</span><span>{r.planId || r.subscription?.planId || 'Unknown'}</span><span>{r.ownerName || r.ownerEmail || 'Owner'}</span><span>{allUsers.filter(u => u.restaurantId === r.id || u.restaurantId === r.restaurantId).length}</span><Status tone={statusTone(r.status || 'Active')}>{r.status || 'Active'}</Status><Progress value={safePct(allUsers.filter(u => u.restaurantId === r.id || u.restaurantId === r.restaurantId).length, Math.max(1, allUsers.length))}/></div>)}</div></Panel><Panel title="Deployment Readiness" icon={ShieldCheck} action="View details"><div className="ref-list tight">{['Build & Tests','Security Scans','Environment Config','Database Migrations','Backup Verification','Feature Flags'].map((n)=><div className="ref-row" key={n}><span>{n}</span><Status tone={readiness >= 90 ? 'green' : 'yellow'}>{readiness >= 90 ? 'Pass' : 'Review'}</Status></div>)}</div></Panel><Panel title="Backup Center" icon={HardDrive} action="Open"><div className="ref-kv"><span>Latest Backup</span><b>{backupLogs[0] ? timeAgo(backupLogs[0]) : 'No live backup logs'}</b></div><div className="ref-kv"><span>Integrity Check</span><b className={backupHealth >= 95 ? 'good' : 'warn'}>{Math.round(backupHealth)}%</b></div><div className="ref-kv"><span>Restore Readiness</span><b className={backupHealth >= 95 ? 'good' : 'warn'}>{backupHealth >= 95 ? 'Ready' : 'Review'}</b></div><div className="ref-kv"><span>Backup Logs</span><b>{backupLogs.length}</b></div><button type="button" className="ref-wide-action">Open Backup Center</button></Panel></div><div className="ref-admin-mid"><Panel title="Security Center" icon={Shield}><div className="ref-kv"><span>App Version</span><b>{CURRENT_VERSION}</b></div><div className="ref-kv"><span>Rules Status</span><b className="good">Client gated</b></div><div className="ref-kv"><span>Critical Issues</span><b className={criticalIssues.length ? 'bad' : 'good'}>{criticalIssues.length}</b></div></Panel><Panel title="Push Health" icon={Send}><div className="ref-kv"><span>Push Logs</span><b>{pushLogs.length}</b></div><div className="ref-kv"><span>Delivered</span><b className="good">{successfulPush}</b></div><div className="ref-kv"><span>Failed</span><b className={pushLogs.length - successfulPush ? 'bad' : 'good'}>{pushLogs.length - successfulPush}</b></div></Panel><Panel title="Automation / Ops Intelligence" icon={Bot} action="Open"><div className="ref-side-stat"><Donut value={readiness} label="Readiness" tone="copper"/><div><div className="ref-row"><span>Audit Logs</span><b>{auditLogs.length}</b></div><div className="ref-row"><span>Issues</span><b>{issues.length}</b></div><div className="ref-row"><span>Backups</span><b>{backupLogs.length}</b></div><div className="ref-row"><span>Push Logs</span><b>{pushLogs.length}</b></div></div></div></Panel><Panel title="Forensics Timeline" icon={Activity} action="View all"><div className="ref-timeline">{realRowsOrMessage(auditLogs.slice(0,5), 'No live audit logs accessible').map((e,idx)=> e.__empty ? <div key="empty"><i/><b>{e.name}</b><span>Empty</span><small>Live</small></div> : <div key={e.id || idx}><i/><b>{e.action || e.title || e.type || 'Audit Event'}</b><span>{e.email || e.userEmail || e.actor || 'System'}</span><small>{timeAgo(e)}</small></div>)}</div></Panel></div><div className="ref-admin-bottom"><Panel title="Client Roster" icon={Users} action="View all clients"><div className="ref-table compact"><div className="head"><span>Workspace</span><span>Plan</span><span>Owner</span><span>Users</span><span>Last Active</span><span>Status</span></div>{realRowsOrMessage(activeWorkspaces, 'No live clients accessible').map((r)=> r.__empty ? <div className="tr" key="empty"><span>{r.name}</span><span/><span/><span/><span/><Status tone="slate">Empty</Status></div> : <div className="tr" key={r.id || r.name}><span>{r.name || r.restaurantName || r.id}</span><span>{r.planId || 'Unknown'}</span><span>{r.ownerName || r.ownerEmail || 'Owner'}</span><span>{allUsers.filter(u => u.restaurantId === r.id || u.restaurantId === r.restaurantId).length}</span><span>{timeAgo(r)}</span><Status tone={statusTone(r.status || 'Active')}>{r.status || 'Active'}</Status></div>)}</div></Panel><Panel title="Support / Diagnostics" icon={Wrench} action="View all"><div className="ref-list tight">{realRowsOrMessage(issues.slice(0,5), 'No live support issues').map((n,idx)=> n.__empty ? <div className="ref-row" key="empty"><span>{n.name}</span><Status>Clear</Status></div> : <div className="ref-row" key={n.id || idx}><span>{n.title || n.type || 'Issue'}</span><small>{n.workspaceName || n.restaurantId || 'Platform'}</small><Status tone={statusTone(n.severity || n.status)}>{n.severity || n.status || 'Open'}</Status></div>)}</div></Panel><Panel title="System Summary" icon={Database}><div className="ref-kv"><span>Total Workspaces</span><b>{restaurants.length}</b></div><div className="ref-kv"><span>Total Users</span><b>{allUsers.length}</b></div><div className="ref-kv"><span>Backup Logs</span><b>{backupLogs.length}</b></div><div className="ref-kv"><span>Issues</span><b>{issues.length}</b></div></Panel></div></main><aside className="ref-right-rail admin"><Panel title="Live Issues" action={null}>{realRowsOrMessage(issues.slice(0,5), 'No live issues right now').map((i,idx)=> i.__empty ? <div className="ref-alert-card small" key="empty"><CheckCircle size={16}/><div><b>{i.name}</b><span>Platform clear</span></div><em>Live</em></div> : <div className="ref-alert-card small" key={i.id || idx}><AlertTriangle size={16}/><div><b>{i.title || i.type || 'Issue'}</b><span>{i.workspaceName || i.service || 'Platform'}</span></div><em>{timeAgo(i)}</em></div>)}</Panel><Panel title="Quick Actions" action={null}>{[
  ['Deploy Workspace','workspaces', false],
  ['Broadcast Alert','support', false],
  ['Global Refresh','overview', false],
  ['Pause Automation','automation', false],
  ['Emergency Read-Only','security', true],
  ['Open Audit Log','audit', false]
].map(([a,target,danger])=><button key={a} type="button" className={`ref-wide-action ${danger?'danger':''}`} onClick={()=>{
  if (target === 'audit') { setActiveTab?.('audit'); return; }
  if (target === 'overview' && a === 'Global Refresh') { addToast?.('System Administrator', 'Refreshing the current system overview.'); window.dispatchEvent(new CustomEvent('chaos-ref-panel-action', { detail: { title: 'System Summary', action: 'Global Refresh' } })); return; }
  goAdminSection(target, a);
}}>{a}</button>)}</Panel></aside></div></Page>;
}
