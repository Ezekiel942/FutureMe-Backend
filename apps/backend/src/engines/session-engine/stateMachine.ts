export enum SessionState {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
}

const transitions: Record<SessionState, SessionState[]> = {
  [SessionState.IDLE]: [SessionState.ACTIVE],
  [SessionState.ACTIVE]: [SessionState.PAUSED, SessionState.ENDED],
  [SessionState.PAUSED]: [SessionState.ACTIVE, SessionState.ENDED],
  [SessionState.ENDED]: [],
};

export function canTransition(from: SessionState, to: SessionState) {
  return transitions[from]?.includes(to) ?? false;
}

export function assertCanTransition(from: SessionState, to: SessionState) {
  if (!canTransition(from, to)) {
    const err: any = new Error(`Invalid transition from ${from} to ${to}`);
    err.code = 'INVALID_TRANSITION';
    err.status = 400;
    throw err;
  }
}

export default { SessionState, canTransition, assertCanTransition };
