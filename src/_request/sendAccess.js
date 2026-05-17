import { request } from './request'

export const sendAccess = (access) => request('/rest/analytics_accesses', access)
