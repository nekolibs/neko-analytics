# neko-analytics

Offline-first analytics for React Native + Web. Tracks devices, sessions, events, and per-screen accesses against a REST API.

## Structure

```
analytics/
├── index.js                          # Public exports
├── core/                             # Internal domain logic + shared state
│   ├── nekoAnalytics.js              # Orchestrator: init, activity, ping, pause, event + re-exports
│   ├── state.js                      # Shared state object, KEYS, DEFAULTS
│   ├── session.js                    # Session lifecycle (newSession, isSessionExpired, restoreSession)
│   ├── access.js                     # Access lifecycle (setScreen, getScreen, startAccess, endAccess)
│   ├── errors.js                     # Error reporting (reportError — send-first, queue fallback)
│   ├── queue.js                      # Queueing (queueSession, queueAccess, queueError) + flush
│   └── schedule.js                   # Timer factory (scheduleRepeat, clearSchedule)
├── hooks/                            # React hooks
│   ├── useNekoAnalytics.js           # Web setup hook
│   ├── useNekoAnalytics.native.js    # Native setup hook
│   └── useAnalyticsAccess.js         # Per-component access tracking
├── components/                       # React components
│   └── NekoAnalyticsBoundary.js      # ErrorBoundary that reports caught errors
├── utils/                            # Pure helpers (no state, no React)
│   ├── uuid.js                       # generateUUIDv7 + isValidUUIDv7
│   ├── deviceInfo.js                 # Auto-detect via conditional require + browser fallback
│   └── network.js                    # Network type cache (expo-network + navigator.connection)
└── _request/                         # HTTP transport
    ├── request.js                    # Shared fetch wrapper + config state (setRequestConfig)
    ├── sendSession.js                # POST /rest/analytics_sessions
    ├── sendEvents.js                 # POST /rest/analytics_events
    ├── sendAccess.js                 # POST /rest/analytics_accesses
    └── sendError.js                  # POST /rest/analytics_errors
```

**Shared state pattern:** All `core/` modules import the same `state` object from `core/state.js` and mutate its fields. No circular imports — domain modules (`session`, `access`, `queue`, `errors`) only depend on `state`, `../utils/*`, and `../_request/*`.

## Key Patterns

- **No env var coupling** — all config passed via `useNekoAnalyticsSetup({ apiUrl, account, publicToken, ... })`. Project decides where values come from.
- **No hard `react-native` import in core** — Platform comes from `@neko-os/ui`. AppState only imported in `.native.js` hook.
- **Conditional requires** for `expo-device`, `expo-constants`, `expo-localization`, `expo-network` (try/catch require). Library works without them.
- **Module-level state, not React context** — `event()`, `flush()`, `activity()`, `setScreen()`, `startAccess()`, `endAccess()` callable from anywhere.
- **All boundaries try/catch'd** — library never crashes the app.
- **`setTimeout` chains, not `setInterval`** — self-rescheduling, no accumulation.
- **Cross-platform via `.native.js` / `.js` split** — Metro resolves native, bundlers resolve web.
- **Pessimistic flush** — queue items removed only on send success. Survives app kill mid-send.
- **Send-first errors** — `reportError` tries direct send. Only queues to Storage on failure. Reused queue + flush infrastructure for retry.

## Session Model

Time-gap based — **not** tied to app state.

- `ping()` checks `LAST_PING_KEY` from Storage. Gap >= `sessionTimeout` → new session. Otherwise → same session, update `end_at`.
- Survives app kill, tab close, brief offline periods.
- Pause on backgrounding does one final ping + flush, doesn't end session.

## Access Model

Per-screen duration tracking. New record per focus (A → B → A = 3 records).

- `setScreen(name)` manages access lifecycle automatically. Ends current access, starts new.
- `startAccess(screen, data?)` / `endAccess(id?)` direct API. `endAccess()` ends current; `endAccess(id)` only ends if id matches.
- `useAnalyticsAccess(screen)` hook = start on mount, end on unmount.
- `ping()` updates current access `end_at` every 3 min (crash safety).
- `pause()` ends current access (background time excluded).
- `ping()` after pause starts new access for current screen (engagement-time only).
- **`trackAccesses: false` config flag** — disables auto-tracking via `setScreen`. `setScreen` still updates `_currentScreen` for event tagging. `useAnalyticsAccess` and `startAccess` direct calls bypass the flag (explicit opt-in still works).
- **Single current access** — only one access active at a time. Mixing `setScreen` + `useAnalyticsAccess` works but the latter "steals" current access on mount; ping recovers within 3 min after the hook unmounts.

## Error Model

Send-first with queue fallback. Different from sessions/accesses (which queue first).

- `reportError(error, opts)` builds payload, tries `sendError` immediately.
- On success: done, nothing queued.
- On failure: `queueError(payload)`, next flush retries.
- Auto-captured via global handlers in hooks:
  - Native: `ErrorUtils.setGlobalHandler` (chains previous handler) + `unhandledrejection`
  - Web: `window.addEventListener('error')` + `window.addEventListener('unhandledrejection')`
- Manual: `NekoAnalytics.error(err, opts)`. `opts` defaults: `type='manual'`, `handled=true`.
- Types: `error` (uncaught JS) | `rejection` (unhandled promise) | `react` (caught by `<ErrorBoundary>`) | `manual` (explicit call) | `crash` (future native).
- **Does NOT catch:** native crashes, JS engine crashes, OOM kills. Need separate native SDK for those.

## Activity / Idle Detection

Prevents forgotten browser tabs from generating infinite sessions.

- `_lastActivity` updated on init, `event()`, and DOM interaction (web only).
- `ping()` checks idle: if `now - _lastActivity >= sessionTimeout`, skip the send. Lets `lastPing` go stale → next active ping starts new session.
- **Web** hook adds `click`, `keydown`, `scroll`, `touchstart` listeners.
- **Native** doesn't need it — AppState transitions handle backgrounding.

## Offline Resilience

Three Storage queues, all flushed every `flushInterval`:

- `analytics:sessionQueue` — deduped by session id (only latest ping per session matters since API upserts)
- `analytics:eventQueue` — accumulates all events
- `analytics:accessQueue` — deduped by access id (only latest ping per access)

Flush flow (pessimistic): read all → if any send succeeds, remove from queue. Failed items stay queued for next cycle. Survives app kill mid-send.

## API Contract

All endpoints POST JSON. Headers: `Content-Type`, `account`, `public_token`. Upsert by `id`.

| Path | Body |
|------|------|
| `/rest/analytics_sessions` | Single session object |
| `/rest/analytics_events` | Array of event objects |
| `/rest/analytics_accesses` | Single access object |
| `/rest/analytics_errors` | Single error object |

Device registration removed from API — `device_id` is purely client-side, generated on first install, persisted in Storage, sent with every session.

## Storage Keys

| Key | Purpose |
|-----|---------|
| `analytics:deviceId` | Persistent device UUID |
| `analytics:sessionId` | Current session UUID |
| `analytics:sessionStartAt` | Original `start_at` of current session (so restored sessions don't overwrite it as null) |
| `analytics:lastPing` | Epoch ms of last ping (for session timeout check) |
| `analytics:sessionQueue` | Pending session upserts |
| `analytics:eventQueue` | Pending event batch |
| `analytics:accessQueue` | Pending access upserts |
| `analytics:errorQueue` | Failed error sends pending retry (empty in normal conditions) |

## Internal Exports (not in public API)

| Function | When called |
|----------|-------------|
| `init(cfg)` | Hook mount. Idempotent — guarded by `_initialized`. Sets up request config, device ID, starts flush loop. |
| `ping()` | Hook mount, foreground transition, web tab visible, scheduled timer. |
| `pause()` | App background, web tab hidden. Final ping + flush. End current access. |
| `activity()` | DOM interaction (web only). |

## Notes

- UUIDv7 inline in `utils/uuid.js` — no dependency. Time-sortable.
- `isValidUUIDv7` regex used to defensively validate IDs from Storage and incoming queue items. Bad device_id triggers full Storage reset.
- `event()` uses `setTimeout(fn, 2)` to defer Storage write off call stack (fire-and-forget).
- `_queueSession` / `_queueAccess` dedupe by id — only one entry per id in queue at any time.
- `flush()` is pessimistic — items removed from Storage only on send success. Survives app suspension.
- `_flushing` guard prevents concurrent flushes.
- Web hook returns early if `typeof document === 'undefined'` — supports SSR.
