# MediaPipe OSC Presence Prototype

Browser-based prototype that detects person presence with MediaPipe, derives stable enter/leave events, and forwards them as OSC messages.

## Architecture

`MediaPipe browser detection -> stable enter/leave events -> WebSocket -> Node.js backend -> OSC over UDP`

- Browser UI: MediaPipe object detection on webcam video, debug overlay/status, stable presence state (`ABSENT`/`PRESENT`).
- Event transport: browser sends `PERSON_ENTER` / `PERSON_LEAVE` with the current `stationId` to `/ws` on the current page origin. Caddy terminates HTTPS/WSS for iPad testing and proxies WebSocket traffic to the local backend on port `8080`.
- Backend: Node.js WebSocket server validates events and sends OSC over UDP.
- Station IDs are configurable in the UI and persisted in browser `localStorage`.

## OSC

Current OSC messages have no arguments:

- `/station/{stationId}/person/enter`
- `/station/{stationId}/person/leave`

Default OSC target: `127.0.0.1:5005`.

## Commands

```sh
npm install
npm run dev
```

## iPad / LAN testing with Caddy HTTPS

Safari on iPad requires HTTPS for camera access. For LAN testing, Caddy is the TLS endpoint and proxies to the normal local HTTP/WS dev servers:

- HTTPS frontend: `https://<mac-lan-ip>:8443` -> Vite `http://127.0.0.1:5173`
- WSS backend path: `wss://<mac-lan-ip>:8443/ws` -> Node `ws://127.0.0.1:8080`

1. Install Caddy on the Mac if needed:

```sh
brew install caddy
```

2. Start Vite + Node:

```sh
npm run dev
```

3. In another terminal, find your Mac LAN IP:

```sh
ipconfig getifaddr en0
```

If you are using Ethernet instead of Wi-Fi, try `en1` or check System Settings > Network.

4. Start Caddy with the provided `Caddyfile`, using your current LAN IP as `CADDY_HOST`:

```sh
CADDY_HOST=$(ipconfig getifaddr en0) caddy run --config Caddyfile
```

5. Open the HTTPS URL on the iPad, replacing the IP with the value from step 3:

```text
https://<mac-lan-ip>:8443
```

The frontend connects back through the same origin at `/ws`. OSC output remains local from the Mac backend to `127.0.0.1:5005` by default.

6. If iPad Safari does not trust the certificate, transfer Caddy's local root CA certificate to the iPad:

```text
~/Library/Application Support/Caddy/pki/authorities/local/root.crt
```

Install the profile on the iPad, then enable full trust under Settings > General > About > Certificate Trust Settings.

Local OSC test receiver:

```sh
npm run test:osc
```

This is currently a prototype/debug UI, not a finalized deployment interface.
