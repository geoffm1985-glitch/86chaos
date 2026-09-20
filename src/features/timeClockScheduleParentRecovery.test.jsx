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
  const month = value => String(value || '').slice(0, 7);
  return {
    T: new Proxy({}, { get: () => '' }), db: {}, storage: {}, auth: {}, messaging: {}, firebaseConfig: {}, MASTER_ADMIN_EMAIL: '', EVENT_TAGS: [], CURRENT_VERSION: '17.0.29',
    secureFetch: jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })),
    useLiveCollection: () => [], useLiveCollectionState: () => ({ data: [], resolved: false, loading: false, error: null, stale: false, cached: false }),
    formatDate: value => value, getToday: () => '2026-09-20', getMonthStr: month,
    formatDisplayDate: value => String(value || ''), formatDisplayFullDate: value => String(value || ''), formatDisplayMonth: value => String(value || ''),
    getDaysInMonth: value => { const [year, mon] = month(value).split('-').map(Number); return new Date(year, mon, 0).getDate(); },
    formatShortTime: value => String(value || ''), formatClockTime: value => String(value || ''), formatClockDateTime: value => String(value || ''),
    getAvatar: () => '', generateTempPass: () => '', getExpDate: () => '', getHoliday: () => '', logAudit: jest.fn(), customMapIcon: {},
    getRestaurantExportPrefix: () => 'qa', safeFilenamePart: value => String(value || ''), downloadCsvRows: jest.fn(), downloadTextFile: jest.fn(), openPrintableReport: jest.fn(),
    recordScheduleOperationDiagnostic: jest.fn(),
  };
});

// This test is intentionally hostile to the new Schedule Builder / Request Off safety layer.
// The known-good 16.0.227 parent route did not invoke these helpers just to open My Schedule / Time Clock.
// If a future change eagerly calls any of them at the parent boundary, this exact regression test fails.
jest.mock('../core/scheduleRuntimeSafety', () => {
  const forbidden = (name) => jest.fn(() => { throw new Error(`${name} must not run while opening My Schedule / Time Clock`); });
  return {
    safeScheduleObjectRows: forbidden('safeScheduleObjectRows'),
    safeScheduleRosterRows: forbidden('safeScheduleRosterRows'),
    safeScheduleShiftRows: forbidden('safeScheduleShiftRows'),
    safeScheduleAvailabilityRows: forbidden('safeScheduleAvailabilityRows'),
    safeScheduleEventRows: forbidden('safeScheduleEventRows'),
  };
});

const scheduleSafety = require('../core/scheduleRuntimeSafety');
const { TabMasterSchedule } = require('./schedule');

class RecoveryBoundaryProbe extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div>This section hit a snag</div>;
    return this.props.children;
  }
}

test('Time Clock & Schedule opens My Schedule without executing Schedule Builder or Request Off sanitizers', async () => {
  const appUser = {
    id: 'manager-1', uid: 'manager-1', name: 'Manager QA', email: 'manager@example.test', restaurantId: 'qa-restaurant', isAdmin: true,
    permissions: { schedule: true, events: true, team: true }, systemSettings: { scheduleMode: 'monthly', scheduleWeekStart: 'Monday' },
  };
  const users = [{ id: 'manager-1', uid: 'manager-1', name: 'Manager QA', email: 'manager@example.test', role: 'Manager', isActive: true }];
  const shifts = [];
  const events = [];

  const { container, getByRole } = render(
    <RecoveryBoundaryProbe>
      <TabMasterSchedule
        currentDate="2026-09-20"
        appUser={appUser}
        users={users}
        shifts={shifts}
        shiftSwaps={[]}
        timeOffRequests={[]}
        events={events}
        addToast={jest.fn()}
        scheduleBuilderProps={{ currentDate: '2026-09-20', users, shifts, events, timeOffRequests: [], timePunches: [], addToast: jest.fn(), appUser, clientData: {} }}
        clientData={{}}
      />
    </RecoveryBoundaryProbe>
  );

  await waitFor(() => expect(getByRole('button', { name: /clock in/i })).toBeTruthy());
  expect(container.textContent).not.toContain('This section hit a snag');

  expect(scheduleSafety.safeScheduleObjectRows).not.toHaveBeenCalled();
  expect(scheduleSafety.safeScheduleRosterRows).not.toHaveBeenCalled();
  expect(scheduleSafety.safeScheduleShiftRows).not.toHaveBeenCalled();
  expect(scheduleSafety.safeScheduleAvailabilityRows).not.toHaveBeenCalled();
  expect(scheduleSafety.safeScheduleEventRows).not.toHaveBeenCalled();
});
