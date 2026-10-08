import { WebSocketServer } from 'ws'
import { OscSender, type PresenceEvent, type StationPresenceEvent } from './oscSender.js'

const PORT = 8080
const HOST = '127.0.0.1'
const VALID_EVENT_TYPES = new Set<string>(['PERSON_ENTER', 'PERSON_LEAVE'])
const oscSender = new OscSender()

function isPresenceEvent(type: unknown): type is PresenceEvent {
  return typeof type === 'string' && VALID_EVENT_TYPES.has(type)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStationPresenceEvent(message: unknown): message is StationPresenceEvent {
  if (typeof message !== 'object' || message === null) return false

  const candidate = message as { stationId?: unknown; type?: unknown }
  return isNonEmptyString(candidate.stationId) && isPresenceEvent(candidate.type)
}

const server = new WebSocketServer({ port: PORT, host: HOST })

server.on('connection', (socket) => {
  console.log('[WS] client connected')

  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as unknown

      if (!isStationPresenceEvent(message)) {
        console.warn('[WS] ignored invalid message:', data.toString())
        return
      }

      console.log(`[EVENT] ${message.stationId} ${message.type}`)
      oscSender.sendPresenceEvent(message)
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
