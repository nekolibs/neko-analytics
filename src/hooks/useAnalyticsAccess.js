import { useEffect } from 'react'

import { startAccess, endAccess } from '../core/nekoAnalytics'

export function useAnalyticsAccess(screen, data) {
  useEffect(() => {
    if (!screen) return
    const id = startAccess(screen, data)
    if (!id) return
    return () => endAccess(id)
  }, [screen])
}
