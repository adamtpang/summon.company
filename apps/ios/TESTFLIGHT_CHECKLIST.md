# SUM-73: Summon iOS - TestFlight Setup Checklist

Board actions required (roughly 10 minutes total once prereqs are met).

## Prereqs (board, one-time)

- [ ] **Apple Developer Program** ($99/yr): enroll at developer.apple.com/enroll. Takes 24-48h for new accounts.
- [ ] **Tailscale account**: install Tailscale on the desktop (https://tailscale.com/download), sign in. Note your desktop machine's Tailscale IP (Settings > Machines). Install Tailscale on your iPhone too.
- [ ] **Mac with Xcode 16+**: required to build and sign the iOS app. Xcode available free from the Mac App Store.

## Step 1: Install dependencies (Mac terminal, 2 min)

```bash
cd apps/ios
npm install
npx cap add ios
```

This generates the `ios/` Xcode project directory.

## Step 2: Merge Info.plist privacy strings (Xcode, 2 min)

Open Xcode after step 1:

```bash
npx cap open ios
```

In Xcode, open `App/App/Info.plist`. Add each entry from `ios-info-plist-additions.xml`:
- NSLocalNetworkUsageDescription (string, privacy copy)
- NSBonjourServices (array with _tailscale._tcp)
- ITSAppUsesNonExemptEncryption (Boolean, NO)
- NSAppTransportSecurity (dict, as shown)

## Step 3: Configure signing (Xcode, 2 min)

1. Select the `App` target > Signing and Capabilities tab.
2. Set Team to your Apple Developer account.
3. Bundle Identifier: `company.summon.ios` (or change if you prefer).
4. Enable Automatically manage signing.

## Step 4: App icon (Xcode, 1 min)

Drag icons from `apps/desktop/assets/` (or generate iOS-sized variants) into `App/App/Assets.xcassets/AppIcon.appiconset`. Required sizes: 1024x1024 for App Store, 60x60, 80x80, 87x87, 120x120, 180x180.

Quick option: use the existing `icon.svg` from apps/desktop and export with:
```bash
node -e "
const sharp = require('sharp');
const sizes = [1024,180,120,87,80,60];
sizes.forEach(s => sharp('apps/desktop/icon.svg').resize(s,s).toFile('apps/ios/icons/'+s+'.png', ()=>{}));
"
```

## Step 5: Archive and upload to TestFlight (Xcode, 3 min)

1. Set the target device to **Any iOS Device (arm64)** (not a simulator).
2. Product > Archive.
3. In the Organizer, click Distribute App > TestFlight & App Store > Upload.
4. Wait ~5 min for App Store Connect processing.
5. In App Store Connect, go to TestFlight > Internal Testing > add yourself as tester.
6. Accept the TestFlight invitation email on your iPhone.

## Step 6: Connect the app to your control plane

1. Open Summon from TestFlight on iPhone.
2. Enter your Tailscale URL: `http://<your-tailscale-ip>:3100`
   (Find the IP in Tailscale app on the desktop: Settings > Machines.)
3. Tap Connect. The app polls until the control plane responds, then loads the full UI.

## Step 7: Acceptance check

- [ ] Chat inbox (Messages tab) loads on iPhone over Tailscale.
- [ ] Decisions tab shows pending decision cards.
- [ ] Resolve a real decision from the phone.
- [ ] Send a real employee message from the phone.
- [ ] Switch from WiFi to cellular - app reconnects cleanly.
- [ ] Post screenshots to SUM-73.

## Security guardrail

The control plane is never exposed to the public internet. Tailscale provides a
private encrypted mesh. The Capacitor config only permits navigation to `*.ts.net`
and Tailscale CGNAT IPs (`100.64.0.0/10`). No keys or credentials leave the
desktop.

## APNs (v2, post-TestFlight)

Push notifications are not in this build. The app polls for new content on open.
APNs wiring is tracked separately: add the Push Notifications capability in Xcode
signing, register in AppDelegate, and wire to the server heartbeat webhook.
