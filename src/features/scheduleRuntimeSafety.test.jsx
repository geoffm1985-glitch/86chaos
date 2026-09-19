import React from 'react';
import { render, waitFor } from '@testing-library/react';

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Circle: () => null,
  useMapEvents: () => null,
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})), collection: jest.fn(() => ({})), addDoc: jest.fn(), updateDoc: jest.fn(), deleteDoc: jest.fn(), doc: jest.fn(() => ({})),
  onSnapshot: jest.fn(() => () => {}), query: jest.fn((value) => value), where: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(), getDocs: jest.fn(),
  getDocsFromServer: jest.fn(), writeBatch: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
}));
jest.mock('firebase/app', () => ({ initializeApp: jest.fn(() => ({})) }));
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(() => ({})), signInWithEmailAndPassword: jest.fn(), sendPasswordResetEmail: jest.fn(), createUserWithEmailAndPassword: jest.fn(), updatePassword: jest.fn() }));
jest.mock('firebase/messaging', () => ({ getToken: jest.fn(), onMessage: jest.fn() }));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), uploadBytes: jest.fn(), getDownloadURL: jest.fn() }));

jest.mock('../core/alertMemory', () => ({
  buildAlertFingerprint: (...parts) => parts.join('|'),
  useRememberedAlert: () => ({ isDismissed: false, dismiss: jest.fn() }),
}));

jest.mock('../components/common', () => ({
  CheersLogo: () => null,
  Modal: ({ isOpen, children }) => isOpen ? <div>{children}</div> : null,
  DrawerMenu: () => null,
  DayDotPrintScreen: () => null,
  MapClickListener: () => null,
  SmartEmptyState: () => null,
  MiniProblemCard: () => null,
  getHomeProfile: () => ({}),
  calculatePunchHours: () => 0,
  getWeekStart: (value) => value,
  roleMatches: (left, right) => String(left || '').toLowerCase() === String(right || '').toLowerCase(),
  toLocalTimeInput: () => '',
  makeLocalIso: () => '',
  PunchTable: () => null,
  FriendlyEmpty: ({ title }) => <div>{title}</div>,
  GlobalSearchModal: () => null,
  QuickActionDock: () => null,
  KitchenTVMode: () => null,
  ChangeLogModal: () => null,
  UndoBar: () => null,
}));

jest.mock('../core/appCore', () => {
  const pad = value => String(value).padStart(2, '0');
  const month = value => String(value || '').slice(0, 7);
  return {
    T: new Proxy({}, { get: () => '' }), db: {}, storage: {}, auth: {}, messaging: {}, firebaseConfig: {}, MASTER_ADMIN_EMAIL: '', EVENT_TAGS: [], CURRENT_VERSION: '17.0.12',
    secureFetch: jest.fn(async () => ({ ok: true, json: async () => ({ ok: true, presets: [] }) })),
    useLiveCollection: () => [], useLiveCollectionState: () => ({ data: [], resolved: true, error: null }),
    formatDate: value => value, getToday: () => '2026-09-19', getMonthStr: month,
    formatDisplayDate: value => String(value || ''), formatDisplayFullDate: value => String(value || ''), formatDisplayMonth: value => String(value || ''),
    getDaysInMonth: value => { const [year, mon] = month(value).split('-').map(Number); return new Date(year, mon, 0).getDate(); },
    formatShortTime: value => String(value || ''), formatClockTime: value => String(value || ''), formatClockDateTime: value => String(value || ''),
    getAvatar: () => '', generateTempPass: () => '', getExpDate: () => '', getHoliday: () => '', logAudit: jest.fn(), customMapIcon: {},
    getRestaurantExportPrefix: () => 'qa', safeFilenamePart: value => String(value || ''), downloadCsvRows: jest.fn(), downloadTextFile: jest.fn(), openPrintableReport: jest.fn(),
    recordScheduleOperationDiagnostic: jest.fn(), pad,
  };
});

const { TabSchedule } = require('./schedule');

const appUser = {
  id: 'manager-1', name: 'Manager QA', email: 'manager@example.test', restaurantId: 'qa-restaurant', isAdmin: true,
  permissions: { schedule: true, events: true, team: true }, systemSettings: { scheduleMode: 'monthly', scheduleWeekStart: 'Monday' },
};
const users = [{ id: 'staff-1', name: 'Cook QA', email: 'cook@example.test', role: 'Kitchen', isActive: true, wage: 15 }];
const malformedEvents = [
  { id: 'legacy-missing-date', type: 'special_event', title: 'Legacy event without date' },
  { id: 'legacy-timestamp-date', type: 'special_event', title: 'Timestamp event', date: { seconds: 1788220800, nanoseconds: 0 } },
  null,
  { id: 'valid', type: 'special_event', title: 'September event', date: '2026-09-22' },
];

test('Schedule Builder renders and navigates months with malformed legacy event rows', async () => {
  const props = { users, shifts: [], events: malformedEvents, timeOffRequests: [], timePunches: [], addToast: jest.fn(), appUser, clientData: {}, initialSubTab: 'schedule' };
  const { container, rerender } = render(<TabSchedule {...props} currentDate="2026-09-01" />);
  await waitFor(() => expect(container.querySelector('.schedule-builder-control-deck')).toBeTruthy());
  expect(container.textContent).toContain('September event');
  expect(container.textContent).not.toContain('Legacy event without date');

  rerender(<TabSchedule {...props} currentDate="2026-10-01" />);
  await waitFor(() => expect(container.querySelector('.schedule-builder-control-deck')).toBeTruthy());

  rerender(<TabSchedule {...props} currentDate="2026-09-01" />);
  await waitFor(() => expect(container.textContent).toContain('September event'));
});
