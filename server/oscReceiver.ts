import { createRequire } from 'node:module'

interface OscMessage {
  address?: unknown
}

interface UdpPort {
  open(): void
  on(event: 'message', listener: (message: OscMessage) => void): void
  on(event: 'error', listener: (error: unknown) => void): void
}

interface OscModule {
  UDPPort: new (options: {
    localAddress: string
    localPort: number
    metadata: boolean
  }) => UdpPort
}

const require = createRequire(import.meta.url)
const osc = require('osc') as OscModule

const DEFAULT_OSC_PORT = 5005
const parsedPort = Number.parseInt(process.env.OSC_PORT || '', 10)
const port = Number.isFinite(parsedPort) ? parsedPort : DEFAULT_OSC_PORT

const udpPort = new osc.UDPPort({
  localAddress: '0.0.0.0',
  localPort: port,
  metadata: true,
})

udpPort.on('message', (message) => {
  if (typeof message.address === 'string') {
    console.log(`[OSC TEST] ${message.address}`)
  } else {
    console.log('[OSC TEST] received OSC message:', message)
  }
})

udpPort.on('error', (error) => {
  console.error('[OSC TEST] error:', error)
})

udpPort.open()
console.log(`[OSC TEST] listening on UDP port ${port}`)
