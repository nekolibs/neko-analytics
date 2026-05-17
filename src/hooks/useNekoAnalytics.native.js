import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

import { init, ping, pause, activity } from '../core/nekoAnalytics'
import { reportError } from '../core/errors'

export function useNekoAnalyticsSetup(config) {
  const appState = useRef(AppState.currentState)

  useEffect(() => {
    try {
      init(config)
      activity()
      ping()
    } catch (e) {
      console.warn('NekoAnalytics: setup failed', e)
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      try {
        const prev = appState.current
        appState.current = nextState

        if (prev === 'active' && /inactive|background/.test(nextState)) {
          pause()
        } else if (/inactive|background/.test(prev) && nextState === 'active') {
          activity()
          ping()
        }
      } catch (e) {
        console.warn('NekoAnalytics: app state change failed', e)
      }
    })

    const ErrorUtils = global?.ErrorUtils
    let restoreErrorHandler = null
    if (ErrorUtils?.setGlobalHandler) {
      const prev = ErrorUtils.getGlobalHandler?.()
      ErrorUtils.setGlobalHandler((error, isFatal) => {
        try { reportError(error, { type: 'error', handled: false }) } catch {}
        if (prev) prev(error, isFatal)
      })
      restoreErrorHandler = () => { if (prev) ErrorUtils.setGlobalHandler(prev) }
    }

    const handleRejection = (event) => {
      try { reportError(event?.reason || event, { type: 'rejection', handled: false }) } catch {}
    }
    if (typeof global !== 'undefined' && global?.addEventListener) {
      global.addEventListener('unhandledrejection', handleRejection)
    }

    return () => {
      subscription.remove()
      if (restoreErrorHandler) restoreErrorHandler()
      if (typeof global !== 'undefined' && global?.removeEventListener) {
        global.removeEventListener('unhandledrejection', handleRejection)
      }
    }
  }, [])
}
