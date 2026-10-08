import { WebSocketServer } from 'ws'
import {
  OscSender,
  type PresenceEvent,
  type PresenceState,
  type StationPresenceEvent,
  type StationPresenceState,
} from './oscSender.js'

const PORT = 8080
const HOST = '127.0.0.1'
const VALID_EVENT_TYPES = new Set<string>(['PERSON_ENTER', 'PERSON_LEAVE'])
const VALID_PRESENCE_STATES = new Set<string>(['ABSENT', 'PRESENT'])
const oscSender = new OscSender()

function isPresenceEvent(type: unknown): type is PresenceEvent {
  return typeof type === 'string' && VALID_EVENT_TYPES.has(type)
}

function isPresenceState(state: unknown): state is PresenceState {
  return typeof state === 'string' && VALID_PRESENCE_STATES.has(state)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStationPresenceEvent(message: unknown): message is StationPresenceEvent {
  if (typeof message !== 'object' || message === null) return false

  const candidate = message as { stationId?: unknown; type?: unknown }
  return isNonEmptyString(candidate.stationId) && isPresenceEvent(candidate.type)
}

function isStationPresenceState(message: unknown): message is StationPresenceState {
  if (typeof message !== 'object' || message === null) return false

  const candidate = message as { stationId?: unknown; type?: unknown; state?: unknown }
  return (
    isNonEmptyString(candidate.stationId) &&
    candidate.type === 'PERSON_PRESENCE' &&
    isPresenceState(candidate.state)
  )
}

const server = new WebSocketServer({ port: PORT, host: HOST })

server.on('connection', (socket) => {
  console.log('[WS] client connected')

  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as unknown

      if (isStationPresenceEvent(message)) {
        console.log(`[EVENT] ${message.stationId} ${message.type}`)
        oscSender.sendPresenceEvent(message)
        return
      }

      if (isStationPresenceState(message)) {
        console.log(`[STATE] ${message.stationId} ${message.state}`)
        oscSender.sendPresenceState(message)
        return
      }

      console.warn('[WS] ignored invalid message:', data.toString())
    } catch {
      console.warn('[WS] ignored non-JSON message:', data.toString())
    }
  })

  socket.on('close', () => {
    console.log('[WS] client disconnected')
  })
})

server.on('listening', () => {
  console.log(`[WS] listening on ws://${HOST}:${PORT}`)
})

server.on('error', (error) => {
  console.error('[WS] server error:', error)
})
