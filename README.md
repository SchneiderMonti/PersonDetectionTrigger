# MediaPipe OSC Presence Prototype

Browser-based prototype that detects person presence with MediaPipe, derives stable enter/leave events, and forwards them as OSC messages.

## Architecture

`MediaPipe browser detection -> stable enter/leave events -> WebSocket -> Node.js backend -> OSC over UDP`

- Browser UI: MediaPipe object detection on webcam video, debug overlay/status, stable presence state (`ABSENT`/`PRESENT`).
- Event transport: browser sends `PERSON_ENTER` / `PERSON_LEAVE` with the current `stationId` to `ws://localhost:8080`.
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

Local OSC test receiver:

```sh
npm run test:osc
```

This is currently a prototype/debug UI, not a finalized deployment interface.
