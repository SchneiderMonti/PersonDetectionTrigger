import type { PresenceEvent } from './personPresence'

export type BackendConnectionStatus = 'connected' | 'disconnected'

type StatusListener = (status: BackendConnectionStatus) => void

const BACKEND_URL = 'ws://localhost:8080'
const RECONNECT_DELAY_MS = 2000

export class EventClient {
  private socket: WebSocket | null = null
  private reconnectTimer: number | null = null
  private closedByClient = false
  private status: BackendConnectionStatus = 'disconnected'
  private readonly onStatusChange: StatusListener
  private readonly getStationId: () => string

  constructor(getStationId: () => string, onStatusChange: StatusListener) {
    this.getStationId = getStationId
    this.onStatusChange = onStatusChange
    this.onStatusChange(this.status)
    this.connect()
  }

  sendPresenceEvent(type: PresenceEvent) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('Backend is disconnected; event was not sent:', type)
      return
    }

    this.socket.send(JSON.stringify({ stationId: this.getStationId(), type }))
  }

  close() {
    this.closedByClient = true
    this.clearReconnectTimer()
    this.socket?.close()
    this.socket = null
    this.setStatus('disconnected')
  }

  private connect() {
    this.clearReconnectTimer()

    try {
      this.socket = new WebSocket(BACKEND_URL)
    } catch (error) {
      console.warn('Could not create backend WebSocket:', error)
      this.setStatus('disconnected')
      this.scheduleReconnect()
      return
    }

    this.socket.addEventListener('open', () => {
      this.setStatus('connected')
    })

    this.socket.addEventListener('close', () => {
      this.setStatus('disconnected')
      this.socket = null

      if (!this.closedByClient) {
        this.scheduleReconnect()
      }
    })

    this.socket.addEventListener('error', () => {
      this.setStatus('disconnected')
    })
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, RECONNECT_DELAY_MS)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer === null) return

    window.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  private setStatus(status: BackendConnectionStatus) {
    if (this.status === status) return

    this.status = status
    this.onStatusChange(status)
  }
}
