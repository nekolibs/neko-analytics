import { state } from './state'

export function scheduleRepeat(timerKey, interval, fn) {
  if (state[timerKey]) clearTimeout(state[timerKey])
  state[timerKey] = setTimeout(() => {
    try { fn() } catch {}
  }, interval)
}

export function clearSchedule(timerKey) {
  if (state[timerKey]) {
    clearTimeout(state[timerKey])
    state[timerKey] = null
  }
}
