import { request } from './request'

export const sendError = (error) => request('/rest/analytics_errors', error)
