'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/features/schedule.jsx'), 'utf8');
const ast = babel.parseSync(source, { sourceType: 'module', babelrc: false, configFile: false, parserOpts: { plugins: ['jsx'] } });
const initializers = new Map();
let grid;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && node.init) initializers.set(node.id.name, source.slice(node.init.start, node.init.end));
  if (node.type === 'JSXElement' && node.openingElement.attributes.some(a => a.name?.name === 'className' && a.value?.value === 'schedule-builder-grid-shell')) grid = source.slice(node.start, node.end);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
function compile(expression, context) {
  const code = babel.transformSync(`(${expression})`, { babelrc: false, configFile: false, plugins: [require.resolve('@babel/plugin-transform-react-jsx')] }).code;
  return vm.runInNewContext(code, context);
}
function scheduleGridFixture({ days = 31, events = false } = {}) {
  const schedulePeriodDays = Array.from({ length: days }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  const people = [{ id: 'clare', name: 'Clare' }, { id: 'allen', name: 'Allen with a long name' }];
  const event = { id: 'event', date: schedulePeriodDays[22], title: 'A long event title', time: '18:00' };
  const context = {
    React, T: { card: 'chaos-card border border-[#2A353D] rounded-xl', copper: 'text-[#D4A381]', muted: 'text-slate-400', grad: '' },
    schedulePeriodDays, schedulePeriodEvents: events ? [event] : [], eventsByScheduleDay: events ? { [event.date]: [event] } : {},
    scheduleBuilderStickyTop: 0, scheduleBuilderHeaderScrollRef: { current: null }, scheduleBuilderBodyScrollRef: { current: null },
    syncScheduleBuilderHorizontalScroll: () => {}, sortedRoles: ['Bartender', 'Kitchen'], groupedUsers: { Bartender: [people[0]], Kitchen: [people[1]] },
    selectedEmp: '', assignDates: [], timeOffRequests: [], projectedDailyLabor: Object.fromEntries(schedulePeriodDays.map(d => [d, 0])),
    getHoliday: () => null, getScheduleBuilderShiftsForPersonDate: (date, person) => person.id === 'allen' ? [{ id: date, startTime: '10:00', endTime: '21:00' }] : [],
    getScheduleShiftTimeStatus: () => ({ valid: true, displayRange: '10a-9p' }), getRoleColors: () => 'bg-purple-400', isBuilderShiftPublished: () => false,
    formatShortTime: value => value === '10:00' ? '10a' : '9p', formatScheduleBuilderEventTitle: value => value.title, formatScheduleBuilderEventLabel: value => value.title,
    handleCellClick: () => {}, handleDeleteSpecificShift: () => {}, openEditEventModal: () => {}, setSelectedEmp: () => {}, setAssignDates: () => {},
  };
  for (const name of ['scheduleBuilderTableStyle', 'renderScheduleBuilderColgroup', 'renderScheduleBuilderHeaderRow']) context[name] = compile(initializers.get(name), context);
  if (!grid) throw new Error('Production Schedule Builder grid is missing');
  return renderToStaticMarkup(compile(grid, context));
}
function scrollBindings() {
  return `const scheduleBuilderScrollSyncRef = {current:false}; const useCallback = fn => fn;
    const sync = ${initializers.get('syncScheduleBuilderHorizontalScroll')};
    const header = document.querySelector('[data-testid="schedule-builder-header-scroll"]');
    const body = document.querySelector('[data-testid="schedule-builder-body-scroll"]');
    header.addEventListener('scroll', () => sync(header, {current:body}));
    body.addEventListener('scroll', () => sync(body, {current:header}));`;
}
module.exports = { scheduleGridFixture, scrollBindings };
