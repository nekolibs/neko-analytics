// TODO: Remove neko-ui deps
import { Storage } from '@neko-os/ui'

import { state, KEYS } from './state'
import { isValidUUIDv7 } from '../utils/uuid'
import { sendSession } from '../_request/sendSession'
import { sendEvents } from '../_request/sendEvents'
import { sendAccess } from '../_request/sendAccess'
import { sendError } from '../_request/sendError'

function dedupedPush(key, item) {
  try {
    const queue = (Storage.get(key) || []).filter((x) => x.id !== item.id)
    queue.push({ ...item })
    Storage.set(key, queue)
  } catch (e) {
    console.warn(`NekoAnalytics: failed to queue ${key}`, e)
  }
}

export function queueSession(session) {
  dedupedPush(KEYS.sessionQueue, session)
}

export function queueAccess(access) {
  dedupedPush(KEYS.accessQueue, access)
}

export function queueError(error) {
  dedupedPush(KEYS.errorQueue, error)
}

function flushUpserts(items, key, sender) {
  return items.map((item) =>
    sender(item)
      .then(() => {
        try {
          const current = Storage.get(key) || []
          const filtered = current.filter((x) => x.id !== item.id || x.end_at > item.end_at)
          Storage.set(key, filtered)
        } catch {}
      })
      .catch((e) => {
        console.warn(`NekoAnalytics: send failed (${key})`, e)
      })
  )
}

function flushById(items, key, sender) {
  return items.map((item) =>
    sender(item)
      .then(() => {
        try {
          const current = Storage.get(key) || []
          Storage.set(
            key,
            current.filter((x) => x.id !== item.id)
          )
        } catch {}
      })
      .catch((e) => {
        console.warn(`NekoAnalytics: send failed (${key})`, e)
      })
  )
}

function flushEvents(events) {
  return sendEvents(events)
    .then(() => {
      try {
        const current = Storage.get(KEYS.eventQueue) || []
        Storage.set(KEYS.eventQueue, current.slice(events.length))
      } catch {}
    })
    .catch((e) => {
      console.warn('NekoAnalytics: events send failed', e)
    })
}

export function flush() {
  if (state.flushing) return
  try {
    const rawSessions = Storage.get(KEYS.sessionQueue) || []
    const rawEvents = Storage.get(KEYS.eventQueue) || []
    const rawAccesses = Storage.get(KEYS.accessQueue) || []
    const rawErrors = Storage.get(KEYS.errorQueue) || []
    const sessions = rawSessions.filter((s) => isValidUUIDv7(s?.id) && isValidUUIDv7(s?.device_id))
    const events = rawEvents.filter((e) => isValidUUIDv7(e?.session_id))
    const accesses = rawAccesses.filter((a) => isValidUUIDv7(a?.id) && isValidUUIDv7(a?.session_id))
    const errors = rawErrors.filter((e) => isValidUUIDv7(e?.id) && isValidUUIDv7(e?.session_id))

    if (rawSessions.length !== sessions.length) Storage.set(KEYS.sessionQueue, sessions)
    if (rawEvents.length !== events.length) Storage.set(KEYS.eventQueue, events)
    if (rawAccesses.length !== accesses.length) Storage.set(KEYS.accessQueue, accesses)
    if (rawErrors.length !== errors.length) Storage.set(KEYS.errorQueue, errors)

    if (!sessions.length && !events.length && !accesses.length && !errors.length) return

    state.flushing = true
    const promises = [
      ...flushUpserts(sessions, KEYS.sessionQueue, sendSession),
      ...flushUpserts(accesses, KEYS.accessQueue, sendAccess),
      ...flushById(errors, KEYS.errorQueue, sendError),
    ]
    if (events.length) promises.push(flushEvents(events))

    Promise.all(promises).finally(() => {
      state.flushing = false
    })
  } catch (e) {
    state.flushing = false
    console.warn('NekoAnalytics: flush failed', e)
  }
}
