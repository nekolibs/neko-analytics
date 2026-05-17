let _apiUrl = ''
let _account = ''
let _publicToken = ''

export function setRequestConfig({ apiUrl, account, publicToken }) {
  _apiUrl = apiUrl || ''
  _account = account || ''
  _publicToken = publicToken || ''
}

export async function request(path, data) {
  const res = await fetch(`${_apiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      subdomain: _account,
      public_token: _publicToken,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
