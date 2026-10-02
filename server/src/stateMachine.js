const { Status } = require('@prisma/client');

const VALID_TRANSITIONS = {
  [Status.DRAFT]: [Status.SUBMITTED],
  [Status.SUBMITTED]: [Status.ASSIGNED, Status.REJECTED],
  [Status.ASSIGNED]: [Status.IN_PROGRESS, Status.REJECTED],
  [Status.IN_PROGRESS]: [Status.RESOLVED, Status.REJECTED],
  [Status.RESOLVED]: [Status.SUBMITTED], // Reopened
  [Status.REJECTED]: [Status.SUBMITTED], // Reopened
};

function isValidTransition(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

module.exports = { VALID_TRANSITIONS, isValidTransition };