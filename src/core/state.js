export const KEYS = {
  deviceId: 'analytics:deviceId',
  sessionId: 'analytics:sessionId',
  sessionStartAt: 'analytics:sessionStartAt',
  lastPing: 'analytics:lastPing',
  sessionQueue: 'analytics:sessionQueue',
  eventQueue: 'analytics:eventQueue',
  accessQueue: 'analytics:accessQueue',
  errorQueue: 'analytics:errorQueue',
}

export const DEFAULTS = {
  apiUrl: process.env.EXPO_PUBLIC_ANALYTICS_API || 'https://nekoapps.net/analytics',
  pingInterval: 3 * 60 * 1000,
  flushInterval: 5 * 60 * 1000,
  sessionTimeout: 30 * 60 * 1000,
  trackAccesses: true,
}

export const state = {
  config: { ...DEFAULTS },
  deviceId: null,
  sessionId: null,
  session: null,
  currentScreen: null,
  currentAccess: null,
  pingTimer: null,
  flushTimer: null,
  lastActivity: 0,
  initialized: false,
  flushing: false,
}
