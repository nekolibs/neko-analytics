export function generateUUIDv7() {
  const ts = Date.now().toString(16).padStart(12, '0')
  const r = (Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)).padEnd(20, '0')

  const randA = r.slice(0, 3)
  const varNibble = ((parseInt(r[3], 16) & 0x3) | 0x8).toString(16)
  const randB = varNibble + r.slice(4, 19)

  const hex = ts + '7' + randA + randB

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

const UUIDV7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUUIDv7(s) {
  return typeof s === 'string' && UUIDV7_REGEX.test(s)
}
