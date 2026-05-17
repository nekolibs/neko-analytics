import { request } from './request'

export const sendSession = (session) => request('/rest/analytics_sessions', session)
