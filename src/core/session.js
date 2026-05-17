// TODO: Remove neko-ui deps
import { Storage } from '@neko-os/ui'

import { state, KEYS } from './state'
import { generateUUIDv7, isValidUUIDv7 } from '../utils/uuid'
import { getDeviceInfo } from '../utils/deviceInfo'

export function newSession() {
  const info = getDeviceInfo(state.config)
  const now = new Date().toISOString()

  state.sessionId = generateUUIDv7()
  Storage.set(KEYS.sessionId, state.sessionId)
  Storage.set(KEYS.sessionStartAt, now)

  state.session = {
    id: state.sessionId,
    device_id: state.deviceId,
    ...info,
    start_at: now,
    end_at: now,
  }
}

export function isSessionExpired() {
  const lastPing = Storage.get(KEYS.lastPing)
  if (!lastPing) return true
  return Date.now() - lastPing >= state.config.sessionTimeout
}

export function restoreSession() {
  const storedId = Storage.get(KEYS.sessionId)
  if (!isValidUUIDv7(storedId)) return false

  const info = getDeviceInfo(state.config)
  state.sessionId = storedId

  state.session = {
    id: state.sessionId,
    device_id: state.deviceId,
    ...info,
    start_at: Storage.get(KEYS.sessionStartAt) || new Date().toISOString(),
    end_at: new Date().toISOString(),
  }

  return true
}
