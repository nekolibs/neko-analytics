import { state } from './state'
import { generateUUIDv7, isValidUUIDv7 } from '../utils/uuid'
import { queueAccess } from './queue'

export function setScreen(name) {
  const next = name || null
  if (state.currentScreen === next) return
  state.currentScreen = next
  if (state.config.trackAccesses === false) return
  endAccess()
  if (next) startAccess(next)
}

export function getScreen() {
  return state.currentScreen
}

export function startAccess(screen, data) {
  try {
    if (state.currentAccess) endAccess(state.currentAccess.id)

    if (!screen) return null
    if (!isValidUUIDv7(state.sessionId)) return null

    const now = new Date().toISOString()
    const id = generateUUIDv7()

    state.currentAccess = {
      id,
      session_id: state.sessionId,
      screen,
      start_at: now,
      end_at: now,
      data: data || null,
    }

    queueAccess(state.currentAccess)
    return id
  } catch (e) {
    console.warn('NekoAnalytics: startAccess failed', e)
    return null
  }
}

export function endAccess(id) {
  try {
    if (!state.currentAccess) return
    if (id !== undefined && id !== state.currentAccess.id) return

    state.currentAccess.end_at = new Date().toISOString()
    queueAccess(state.currentAccess)
    state.currentAccess = null
  } catch (e) {
    console.warn('NekoAnalytics: endAccess failed', e)
  }
}
