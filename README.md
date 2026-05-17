# neko-analytics

Drop-in offline-first analytics for React Native (Expo) and pure React apps using `@neko-os/ui`. Tracks devices, sessions, and events against a REST API. Survives offline use, app kills, and forgotten browser tabs.

## Peer Dependencies

- `@neko-os/ui` (Storage, Platform)
- `react` (hooks)

### Optional (auto-detected via conditional require)

- `expo-device` — for `device_model`, `platform_version`
- `expo-constants` — for `app_version`
- `expo-localization` — for `language`, `country`
- `expo-network` — for `network` (wifi/cellular/etc.)

Library works without any of these. Web falls back to `navigator.language` for locale and `navigator.connection` for network type.

## Setup

Call `useNekoAnalyticsSetup` once at app root. Handles device ID, session lifecycle, ping loop, flush loop, app state listeners, and (on web) user interaction tracking.

```jsx
import { useNekoAnalyticsSetup } from './external/analytics'

useNekoAnalyticsSetup({
  apiUrl: process.env.EXPO_PUBLIC_ANALYTICS_API,
  account: process.env.EXPO_PUBLIC_ANALYTICS_ACCOUNT,
  publicToken: process.env.EXPO_PUBLIC_ANALYTICS_TOKEN,
})
```

## Configuration

All options passed to `useNekoAnalyticsSetup`. None are required — sensible defaults applied.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | `''` | Base URL of analytics API. e.g. `https://api.example.com` |
| `account` | `string` | `''` | App identifier sent as `account` header |
| `publicToken` | `string` | `''` | Auth token sent as `public_token` header |
| `pingInterval` | `number` | `180000` (3 min) | How often to ping the server while user is active |
| `flushInterval` | `number` | `300000` (5 min) | How often to flush event/session queues |
| `sessionTimeout` | `number` | `1800000` (30 min) | Inactivity before a new session is created |
| `trackAccesses` | `boolean` | `true` | If `false`, `setScreen` only tags events with screen name — does not create access records. `useAnalyticsAccess` and `startAccess` direct calls still work (explicit opt-in). |
| `language` | `string` | auto | Override auto-detected language code |
| `country` | `string` | auto | Override auto-detected region code |
| `device_model` | `string` | auto | Override device model |
| `platform_version` | `string` | auto | Override OS version |
| `app_version` | `string` | auto | Override app version |

**Tuning example:** override defaults if needed.

```js
useNekoAnalyticsSetup({
  apiUrl, account, publicToken,
  sessionTimeout: 15 * 60 * 1000,  // shorter sessions
  pingInterval: 5 * 60 * 1000,     // less frequent pings
})
```

Default 30 min sessionTimeout matches GA4, Firebase, Mixpanel, Amplitude, PostHog.

## Exports

### Hooks

| Export | Description |
|--------|-------------|
| `useNekoAnalyticsSetup(config)` | Initializes library, starts session, manages lifecycle. Call once at app root. |
| `useAnalyticsAccess(screen, data?)` | Start access on mount, end on unmount. For per-component opt-in tracking (modals, components without router integration). |

### NekoAnalytics namespace (callable from anywhere, not React-only)

```js
import { NekoAnalytics } from './external/analytics'
```

| Method | Description |
|--------|-------------|
| `NekoAnalytics.event(name, data?, opts?)` | Track an event. Fire-and-forget — queued to Storage, batched on flush. |
| `NekoAnalytics.flush()` | Force-flush event and session queues to the API. |
| `NekoAnalytics.activity()` | Mark user as active. Web hook calls this automatically on DOM interaction. Manual use only if marking activity programmatically. |
| `NekoAnalytics.setScreen(name)` | Set the current screen name. Tags events AND tracks access duration. Pass `null` to clear. |
| `NekoAnalytics.startAccess(screen, data?)` | Manually start an access record. Returns access id. Ends current access if any. |
| `NekoAnalytics.endAccess(id?)` | End current access (or specific id). Used internally by setScreen and the hook. |
| `NekoAnalytics.error(err, opts?)` | Report an error. Tries direct send; on failure queues to Storage for retry. `opts`: `{ type, handled, screen, network, data }`. Defaults: `type='manual'`, `handled=true`. |

### Screen Tracking

**React Navigation (native):** wire `NekoAnalytics.setScreen` to navigation state changes:

```jsx
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'
import { NekoAnalytics } from './external/analytics'

function App() {
  const navigationRef = useNavigationContainerRef()
  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => NekoAnalytics.setScreen(navigationRef.getCurrentRoute()?.name)}
      onStateChange={() => NekoAnalytics.setScreen(navigationRef.getCurrentRoute()?.name)}
    >
      {/* ... */}
    </NavigationContainer>
  )
}
```

**React Router (web):** drop a small component inside the router that watches `location` and calls `setScreen` on change.

```jsx
import { useEffect } from 'react'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { NekoAnalytics } from './external/analytics'

function ScreenTracker() {
  const location = useLocation()
  useEffect(() => {
    NekoAnalytics.setScreen(location.pathname)
  }, [location.pathname])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <ScreenTracker />
      {/* routes */}
    </BrowserRouter>
  )
}
```

`setScreen` is generic — pass any string. Works with any router (Next.js `router.pathname`, TanStack Router `useLocation`, etc.) using the same pattern.

After wiring, any `event()` call automatically tags the current screen — no need to pass `opts.screen` manually. Access records are also created automatically (see "Access Tracking" below).

### Access Tracking

Captures duration users spend on each screen. Sent to `POST /rest/analytics_accesses` as upserts (start_at on enter, end_at updated on ping/leave). Each focus on a screen = new access record.

**Automatic (recommended):** `setScreen` already manages access lifecycle. If you've wired `setScreen` for screen tagging (above), access tracking works out of the box. Nothing else to do.

**Per-component opt-in:** Use `useAnalyticsAccess` to track specific components (e.g. modals, full-screen views without router integration):

```jsx
import { useAnalyticsAccess } from './external/analytics'

function CheckoutModal() {
  useAnalyticsAccess('CheckoutModal')
  return <View>...</View>
}
```

**React Navigation focus-based (alternative to setScreen):** Use `useFocusEffect` for fine-grained per-screen focus tracking:

```jsx
import { useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { NekoAnalytics } from './external/analytics'

function HomeScreen() {
  useFocusEffect(useCallback(() => {
    const id = NekoAnalytics.startAccess('HomeScreen')
    return () => NekoAnalytics.endAccess(id)
  }, []))
  return <View>...</View>
}
```

**Lifecycle:**

| Event | Behavior |
|-------|----------|
| Navigate Home → Profile | End Home access, start Profile access |
| Stay on Home | Ping updates Home `end_at` every 3 min (crash safety) |
| Navigate A → B → A | Three records: A1, B, A2 (each focus = new record) |
| App background | End current access (foreground time only) |
| App foreground | Start new access for current screen |
| App crash | Access has `end_at` = last ping (max ~3 min loss) |

### Error Reporting

Captures JS errors and unhandled promise rejections. Sent to `POST /rest/analytics_errors`.

**Send-first pattern:** Errors try to send immediately. On failure (offline, server down), falls back to Storage queue. Next flush retries. Storage queue stays empty in normal conditions.

**Automatic (recommended):** Setup hook installs global handlers automatically. No extra code:

| Source | Type | Handled |
|--------|------|---------|
| Uncaught JS error (`ErrorUtils.setGlobalHandler` / `window.onerror`) | `error` | `false` |
| Unhandled promise rejection (`unhandledrejection`) | `rejection` | `false` |

**Manual:**

```js
import { NekoAnalytics } from './external/analytics'

try {
  doSomething()
} catch (e) {
  NekoAnalytics.error(e)
  // Or with context:
  NekoAnalytics.error(e, {
    type: 'manual',
    handled: true,
    data: { userAction: 'submit_form', formId: 'checkout' },
  })
}
```

**React Error Boundary:** Use the built-in `<NekoAnalyticsBoundary>` to catch component render errors and report them as `type: 'react'`.

```jsx
import { NekoAnalyticsBoundary } from './external/analytics'

function App() {
  return (
    <NekoAnalyticsBoundary fallback={<ErrorScreen />}>
      <AppContent />
    </NekoAnalyticsBoundary>
  )
}
```

Props:

| Prop | Type | Description |
|------|------|-------------|
| `children` | node | Tree to wrap |
| `fallback` | node \| function | UI to render after an error. If function, called with no args. If omitted, renders `null`. |

Boundary catches errors during render/lifecycle of children. Won't catch async errors inside event handlers — those are caught by the global handler.

**Cannot catch:** Native crashes (iOS Obj-C, Android NDK, C++ exceptions), JS engine crashes, OOM kills. For those, integrate Sentry/Crashlytics alongside.

**Payload sent to API:**

```json
{
  "id": "<uuid>",
  "session_id": "<uuid>",
  "type": "error",
  "name": "TypeError",
  "message": "Cannot read property 'x' of undefined",
  "stack": "TypeError: ...\n    at ...",
  "screen": "HomeScreen",
  "network": "wifi",
  "handled": false,
  "data": null,
  "occurred_at": "2026-05-14T10:05:30.000Z"
}
```

### Tracking Events

```js
import { NekoAnalytics } from './external/analytics'

// Just a name
NekoAnalytics.event('button_click')

// With data
NekoAnalytics.event('purchase_complete', { amount: 29.99, currency: 'EUR' })

// With screen context and network info
NekoAnalytics.event('scroll_bottom',
  { section: 'comments' },
  { screen: 'ArticleScreen', network: 'wifi' }
)
```

Event payload sent to API:

```json
{
  "session_id": "<uuid>",
  "name": "button_click",
  "screen": "HomeScreen",
  "network": "wifi",
  "data": { "any": "json" },
  "occurred_at": "2026-05-13T10:05:00.000Z"
}
```

## How It Works

### Device ID

Generated client-side (UUIDv7) on first launch, persisted in Storage under `analytics:deviceId`. Reused forever. No API call needed.

### Sessions

Time-gap based — **not** tied to app foreground/background.

- On first ping: session created with new UUIDv7, `start_at = now`
- Each subsequent ping: same session, `end_at = now`
- If gap between pings > `sessionTimeout`: previous session ends, new one created
- Survives app kill, tab close, brief offline periods

### Pings

Self-rescheduling `setTimeout` chain (not `setInterval` — avoids accumulation). Each ping:

1. Checks idle: no user activity since last ping → skip send, let `lastPing` go stale
2. Otherwise: updates `end_at`, queues session payload, schedules next ping

Idle detection prevents forgotten browser tabs from generating infinite sessions.

### Activity Tracking

**Web:** Hook adds DOM listeners for `click`, `keydown`, `scroll`, `touchstart`. Each marks `_lastActivity = Date.now()`. Combined with `visibilitychange` for tab switches.

**Native:** Activity tracking unnecessary. AppState listener handles foreground/background: `active → background` triggers `pause()` (one final ping + flush). `background → active` triggers `ping()`.

### Offline / Failure Handling

Both event and session sends go through Storage queues:

- `analytics:sessionQueue` — deduped by session ID, only latest entry per session kept (older pings superseded by newer `end_at`)
- `analytics:eventQueue` — all events accumulated

On flush:

1. Read both queues
2. Clear both immediately (optimistic)
3. Send sessions (latest only) and events (batch) in parallel
4. On failure: re-queue back to Storage, retry on next flush cycle

Queues persist across app kills. Events queued offline are sent on next launch. **Library never crashes the app** — every boundary is try/catch.

### API Endpoints

Both expect JSON body and headers `account` + `public_token`. Upsert semantics — same `id` updates the row.

| Method | Path | Body |
|--------|------|------|
| `POST` | `/rest/analytics_sessions` | Full session object |
| `POST` | `/rest/analytics_events` | Array of event objects |
| `POST` | `/rest/analytics_accesses` | Full access object |
| `POST` | `/rest/analytics_errors` | Single error object |

### Session payload

```json
{
  "id": "<uuid>",
  "device_id": "<uuid>",
  "platform": "ios",
  "language": "en",
  "country": "DE",
  "device_model": "iPhone 15 Pro",
  "platform_version": "18.1",
  "app_version": "1.2.0",
  "start_at": "2026-05-13T10:00:00.000Z",
  "end_at": "2026-05-13T10:15:00.000Z"
}
```

## Storage Keys

| Key | Purpose |
|-----|---------|
| `analytics:deviceId` | Persistent device UUID (created once) |
| `analytics:sessionId` | Current session UUID (rolled over on timeout) |
| `analytics:sessionStartAt` | Session `start_at` (preserves original on restore) |
| `analytics:lastPing` | Epoch ms of last successful ping (for timeout check) |
| `analytics:sessionQueue` | Pending session upserts (offline-resilient) |
| `analytics:eventQueue` | Pending event batch (offline-resilient) |
| `analytics:accessQueue` | Pending access upserts (offline-resilient) |
| `analytics:errorQueue` | Failed error sends pending retry (only used as fallback) |

## Cross-Platform

| File | Used on |
|------|---------|
| `useNekoAnalytics.native.js` | React Native (Metro resolves automatically) |
| `useNekoAnalytics.js` | Web / pure React |

Core module (`nekoAnalytics.js`) is platform-neutral — only depends on `@neko-os/ui` (Storage, Platform). Native-specific code (AppState) lives only in the `.native.js` hook variant.
