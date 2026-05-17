import { event, flush, activity, setScreen, startAccess, endAccess, error, getDeviceId } from './core/nekoAnalytics'

export { useNekoAnalyticsSetup } from './hooks/useNekoAnalytics'
export { useAnalyticsAccess } from './hooks/useAnalyticsAccess'
export { NekoAnalyticsBoundary } from './components/NekoAnalyticsBoundary'

export const NekoAnalytics = { event, flush, activity, setScreen, startAccess, endAccess, error, getDeviceId }
