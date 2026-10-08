import { createRequire } from 'node:module'

export type PresenceEvent = 'PERSON_ENTER' | 'PERSON_LEAVE'
export interface StationPresenceEvent {
  stationId: string
  type: PresenceEvent
}

interface OscMessage {
  address: string
  args: unknown[]
}

interface UdpPort {
  open(): void
  send(message: OscMessage): void
  on(event: 'error', listener: (error: unknown) => void): void
}

interface OscModule {
  UDPPort: new (options: {
    localAddress: string
    localPort: number
    remoteAddress: string
    remotePort: number
    metadata: boolean
  }) => UdpPort
}

interface OscTarget {
  host: string
  port: number
}

const require = createRequire(import.meta.url)
const osc = require('osc') as OscModule

const DEFAULT_OSC_HOST = '127.0.0.1'
const DEFAULT_OSC_PORT = 5005

const EVENT_ADDRESS_SUFFIXES: Record<PresenceEvent, string> = {
  PERSON_ENTER: 'enter',
  PERSON_LEAVE: 'leave',
}

function createPresenceEventAddress(event: StationPresenceEvent): string {
  return `/station/${event.stationId}/person/${EVENT_ADDRESS_SUFFIXES[event.type]}`
}

function getOscTarget(): OscTarget {
  const host = process.env.OSC_HOST || DEFAULT_OSC_HOST
  const parsedPort = Number.parseInt(process.env.OSC_PORT || '', 10)
  const port = Number.isFinite(parsedPort) ? parsedPort : DEFAULT_OSC_PORT

  return { host, port }
}

export class OscSender {
  private readonly host: string
  private readonly port: number
  private readonly udpPort: UdpPort

  constructor() {
    const target = getOscTarget()

    this.host = target.host
    this.port = target.port
    this.udpPort = new osc.UDPPort({
      localAddress: '0.0.0.0',
      localPort: 0,
      remoteAddress: this.host,
      remotePort: this.port,
      metadata: true,
    })

    this.udpPort.on('error', (error) => {
      console.error('[OSC] error:', error)
    })

    this.udpPort.open()
    console.log(`[OSC] Target: ${this.host}:${this.port}`)
  }

  sendPresenceEvent(event: StationPresenceEvent) {
    const address = createPresenceEventAddress(event)

    this.udpPort.send({ address, args: [] })
    console.log(`[OSC] ${address} -> ${this.host}:${this.port}`)
  }
}
