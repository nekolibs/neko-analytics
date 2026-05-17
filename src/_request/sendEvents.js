import { request } from './request'

export const sendEvents = (events) => request('/rest/analytics_events', events)
