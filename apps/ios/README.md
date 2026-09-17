# Summon iOS

Capacitor WKWebView shell that puts the Summon company control plane on iPhone.
The board's job (chat, decisions, scoreboard) is phone-sized; deep console work
stays on desktop.

## Architecture

- Same pattern as `apps/desktop` (Electron wrapper around 127.0.0.1:3100).
- Instead of Electron, uses Capacitor 6 / WKWebView targeting the Tailscale IP.
- Control plane never exposed publicly. Phone reaches desktop over Tailscale mesh.
- First-launch settings screen: enter the Tailscale URL once, stored in localStorage.
- Reconnect on network switch: auto-polls until the control plane responds.
- APNs push notifications: v2. v1 polls on open.

## Build (Mac required for Xcode)

```bash
cd apps/ios
npm install
npx cap add ios    # generates ios/ Xcode project
npx cap open ios   # opens Xcode
```

See `TESTFLIGHT_CHECKLIST.md` for the full board setup walkthrough.

## Key files

| File | Purpose |
|---|---|
| `capacitor.config.ts` | Bundle ID, webDir, allowed navigation hosts |
| `src/index.html` | Settings/launcher page (Tailscale URL input, auto-connect) |
| `ios-info-plist-additions.xml` | Privacy strings to paste into Info.plist |
| `TESTFLIGHT_CHECKLIST.md` | End-to-end board setup: prereqs through TestFlight install |

## Bundle ID

`company.summon.ios` - change in capacitor.config.ts and Xcode signing if needed.

## Security

- `allowNavigation` in capacitor.config.ts restricts to `*.ts.net` and Tailscale
  CGNAT range only.
- `NSAppTransportSecurity` in Info.plist allows HTTP only to `ts.net` subdomains.
- No public exposure of the control plane.
- Keys never leave the desktop.
