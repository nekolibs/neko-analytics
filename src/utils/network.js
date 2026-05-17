let NetworkModule = null
try { NetworkModule = require('expo-network') } catch {}

let _current = null

function _normalize(type) {
  if (!type) return null
  const lower = String(type).toLowerCase()
  if (lower === 'none') return null
  return lower
}

function _getBrowserNetwork() {
  if (typeof navigator === 'undefined') return null
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!conn) return null
  return _normalize(conn.type || conn.effectiveType)
}

export async function updateNetwork() {
  try {
    if (NetworkModule?.getNetworkStateAsync) {
      const state = await NetworkModule.getNetworkStateAsync()
      _current = _normalize(state?.type)
      return
    }
    _current = _getBrowserNetwork()
  } catch {
    _current = null
  }
}

export function getNetwork() {
  return _current
}
