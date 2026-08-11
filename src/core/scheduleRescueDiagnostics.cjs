'use strict';

function canViewScheduleRescueTechnicalDetails(user = {}) {
  const permissions = user?.permissions || {};
  const systemAccess = user?.systemAccess || {};
  return Boolean(
    user?.isOwner || user?.accountOwner || user?.workspaceOwner ||
    user?.isSuperAdmin || user?.platformAdmin || user?.isPlatformAdmin ||
    systemAccess?.superAdmin || user?.systemAdmin || user?.isSystemAdmin ||
    permissions?.systemAdmin || permissions?.systemAdministrator ||
    permissions?.platformAdmin || permissions?.owner || permissions?.admin || user?.isAdmin
  );
}

function sanitizeScheduleRescueError(error = '', max = 120) {
  return String(error || '')
    .replace(/(api[_-]?key|token|secret|password|credential|authorization)([=:\s]+)?[^\s&]*/gi, '$1:[redacted]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, Number(max || 120));
}

function buildMyScheduleIncompleteWarningView({ user = {}, error = '', incomplete = false } = {}) {
  const visible = Boolean(incomplete);
  const canViewTechnical = canViewScheduleRescueTechnicalDetails(user);
  return {
    visible,
    plainWarning: visible ? 'Schedule may be incomplete' : '',
    plainBody: visible ? 'Some older, imported, or restored shifts could not be fully checked. Your current shifts are shown, but this schedule may be incomplete.' : '',
    retryVisible: visible,
    technicalError: visible && canViewTechnical && error ? sanitizeScheduleRescueError(error) : ''
  };
}

module.exports = {
  canViewScheduleRescueTechnicalDetails,
  sanitizeScheduleRescueError,
  buildMyScheduleIncompleteWarningView
};
