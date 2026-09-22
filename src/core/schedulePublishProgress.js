export const createSchedulePublishGuard = () => {
  let active = false;
  return {
    begin() {
      if (active) return false;
      active = true;
      return true;
    },
    end() {
      active = false;
    },
    isActive() {
      return active;
    },
  };
};

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const fraction = (current, total) => {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (!safeTotal) return 0;
  return Math.max(0, Math.min(1, (Number(current) || 0) / safeTotal));
};

export const getSchedulePublishProgressPercent = (phase, current = 0, total = 0) => {
  switch (phase) {
    case 'preparing': return 4;
    case 'loading': return 10;
    case 'planning': return 18;
    case 'confirming': return 24;
    case 'backup': return 30;
    case 'publishing': return clampPercent(32 + (fraction(current, total) * 30));
    case 'verifying': return clampPercent(62 + (fraction(current, total) * 24));
    case 'time-off': return 90;
    case 'notifications': return 96;
    case 'complete': return 100;
    default: return 0;
  }
};

export const makeSchedulePublishProgress = ({
  phase = 'idle',
  label = '',
  detail = '',
  current = 0,
  total = 0,
  active = phase !== 'idle' && phase !== 'complete' && phase !== 'error' && phase !== 'cancelled',
} = {}) => ({
  phase,
  label,
  detail,
  current: Number(current) || 0,
  total: Number(total) || 0,
  active: Boolean(active),
  percent: getSchedulePublishProgressPercent(phase, current, total),
});
