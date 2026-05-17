import { useEffect } from 'react'

import { init, ping, pause, activity } from '../core/nekoAnalytics'
import { reportError } from '../core/errors'

const INTERACTION_EVENTS = ['click', 'keydown', 'scroll', 'touchstart']

export function useNekoAnalyticsSetup(config) {
  useEffect(() => {
    try {
      init(config)
      activity()
      ping()
    } catch (e) {
      console.warn('NekoAnalytics: setup failed', e)
    }

    if (typeof document === 'undefined') return

    const handleVisibility = () => {
      try {
        if (document.visibilityState === 'hidden') {
          pause()
        } else if (document.visibilityState === 'visible') {
          activity()
          ping()
        }
      } catch (e) {
        console.warn('NekoAnalytics: visibility change failed', e)
      }
    }

    const handleInteraction = () => {
      try { activity() } catch {}
    }

    const handleError = (event) => {
      try {
        reportError(event?.error || event?.message || event, { type: 'error', handled: false })
      } catch {}
    }

    const handleRejection = (event) => {
      try {
        reportError(event?.reason || event, { type: 'rejection', handled: false })
      } catch {}
    }

    document.addEventListener('visibilitychange', handleVisibility)
    INTERACTION_EVENTS.forEach((e) => document.addEventListener(e, handleInteraction, { passive: true }))
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      INTERACTION_EVENTS.forEach((e) => document.removeEventListener(e, handleInteraction))
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])
}
