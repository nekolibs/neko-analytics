// TODO: Remove neko-ui deps
import { Storage } from '@neko-os/ui'

import { state, KEYS, DEFAULTS } from './state'
import { generateUUIDv7, isValidUUIDv7 } from '../utils/uuid'
import { updateNetwork, getNetwork } from '../utils/network'
import { setRequestConfig } from '../_request/request'
import { newSession, isSessionExpired, restoreSession } from './session'
import { startAccess, endAccess, setScreen, getScreen } from './access'
import { queueSession, queueAccess, flush } from './queue'
import { scheduleRepeat, clearSchedule } from './schedule'
import { reportError } from './errors'

export { setScreen, getScreen, startAccess, endAccess, flush }
export { reportError as error }

export function getDeviceId() {
  return state.deviceId || Storage.get(KEYS.deviceId)
}

export function init(cfg) {
  if (state.initialized) return
  state.initialized = true

  try {
    state.config = { ...DEFAULTS, ...cfg }

    setRequestConfig(state.config)
    state.lastActivity = Date.now()
    updateNetwork()

    state.deviceId = Storage.get(KEYS.deviceId)
    if (!isValidUUIDv7(state.deviceId)) {
      state.deviceId = generateUUIDv7()
      Storage.set(KEYS.deviceId, state.deviceId)
      Storage.set(KEYS.sessionId, null)
      Storage.set(KEYS.sessionStartAt, null)
      Storage.set(KEYS.lastPing, null)
      Storage.set(KEYS.sessionQueue, [])
      Storage.set(KEYS.eventQueue, [])
      Storage.set(KEYS.accessQueue, [])
      Storage.set(KEYS.errorQueue, [])
    }

    scheduleRepeat('flushTimer', state.config.flushInterval, _flushTick)
    flush()
  } catch (e) {
    console.warn('NekoAnalytics: init failed', e)
  }
}

export function activity() {
  state.lastActivity = Date.now()
}

export function ping() {
  try {
    const isIdle = state.lastActivity && Date.now() - state.lastActivity >= state.config.sessionTimeout
    if (isIdle) {
      scheduleRepeat('pingTimer', state.config.pingInterval, ping)
      return
    }

    updateNetwork()

    let isNewSession = false
    if (isSessionExpired()) {
      newSession()
      isNewSession = true
    } else if (!state.session) {
      if (!restoreSession()) {
        newSession()
        isNewSession = true
      }
    }

    state.session.end_at = new Date().toISOString()
    Storage.set(KEYS.lastPing, Date.now())
    queueSession(state.session)

    if (state.config.trackAccesses !== false) {
      if (state.currentAccess) {
        state.currentAccess.end_at = new Date().toISOString()
        queueAccess(state.currentAccess)
      } else if (state.currentScreen) {
        startAccess(state.currentScreen)
      }
    }

    scheduleRepeat('pingTimer', state.config.pingInterval, ping)

    if (isNewSession) flush()
  } catch (e) {
    console.warn('NekoAnalytics: ping failed', e)
  }
}

export function pause() {
  try {
    clearSchedule('pingTimer')

    if (state.session) {
      state.session.end_at = new Date().toISOString()
      Storage.set(KEYS.lastPing, Date.now())
      queueSession(state.session)
    }

    endAccess()

    flush()
  } catch (e) {
    console.warn('NekoAnalytics: pause failed', e)
  }
}

export function event(name, data, opts) {
  state.lastActivity = Date.now()

  const eventObj = {
    session_id: state.sessionId,
    name,
    screen: opts?.screen || state.currentScreen,
    network: opts?.network || getNetwork(),
    data: data || null,
    occurred_at: new Date().toISOString(),
  }

  setTimeout(() => {
    try {
      const queue = Storage.get(KEYS.eventQueue) || []
      queue.push(eventObj)
      Storage.set(KEYS.eventQueue, queue)
    } catch (e) {
      console.warn('NekoAnalytics: failed to queue event', e)
    }
  }, 2)
}

function _flushTick() {
  flush()
  scheduleRepeat('flushTimer', state.config.flushInterval, _flushTick)
}
