import { state } from './state'
import { generateUUIDv7, isValidUUIDv7 } from '../utils/uuid'
import { getNetwork } from '../utils/network'
import { sendError } from '../_request/sendError'
import { queueError } from './queue'

function buildPayload(error, opts = {}) {
  let name = 'Error'
  let message = ''
  let stack = ''

  if (error instanceof Error) {
    name = error.name || 'Error'
    message = error.message || ''
    stack = error.stack || ''
  } else if (typeof error === 'string') {
    message = error
  } else if (error && typeof error === 'object') {
    name = error.name || 'Error'
    message = error.message || String(error)
    stack = error.stack || ''
  } else if (error != null) {
    message = String(error)
  }

  return {
    id: generateUUIDv7(),
    session_id: state.sessionId,
    type: opts.type || 'manual',
    name,
    message,
    stack,
    screen: opts.screen || state.currentScreen,
    network: opts.network || getNetwork(),
    handled: opts.handled !== undefined ? !!opts.handled : true,
    data: opts.data || null,
    occurred_at: new Date().toISOString(),
  }
}

export function reportError(error, opts) {
  try {
    const payload = buildPayload(error, opts)

    if (!isValidUUIDv7(payload.session_id)) {
      queueError(payload)
      return
    }

    sendError(payload).catch(() => {
      try { queueError(payload) } catch {}
    })
  } catch (e) {
    console.warn('NekoAnalytics: reportError failed', e)
  }
}
