import './style.css'
import { EventClient } from './eventClient'
import { createPersonDetector, detectPeople, type PersonDetection } from './personDetector'
import { PersonPresence } from './personPresence'
import { getStationId, saveStationId } from './stationConfig'

const initialStatus = 'Kamera wird gestartet...'

function escapeHtml(value: string) {
  const element = document.createElement('div')
  element.textContent = value
  return element.innerHTML
}

function renderApp(stationId: string) {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <main class="app-shell">
      <h1>MediaPipe Person Detection</h1>
      <p id="status" class="status">${initialStatus}</p>
      <section class="presence-panel" aria-label="Person presence status">
        <p>Station: <strong id="station-id">${escapeHtml(stationId)}</strong> <button id="change-station" type="button">Station ändern</button></p>
        <p>Raw detection: <strong id="raw-detection">not detected</strong></p>
        <p>Stable presence state: <strong id="presence-state">ABSENT</strong></p>
        <p>Last event: <strong id="last-event">none</strong></p>
        <p>Backend: <strong id="backend-status">disconnected</strong></p>
      </section>
      <div class="video-stage">
        <video id="webcam" autoplay playsinline></video>
        <canvas id="overlay" aria-hidden="true"></canvas>
      </div>
    </main>
  `
}

function showStationSetupDialog(currentStationId = ''): Promise<string> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'station-setup-overlay'
    overlay.innerHTML = `
      <form class="station-setup-dialog">
        <h2>Station einrichten</h2>
        <label>
          Station ID
          <input id="station-input" type="text" placeholder="Station1" value="${escapeHtml(currentStationId)}" autocomplete="off" />
        </label>
        <p id="station-error" class="station-error" aria-live="polite"></p>
        <button type="submit">Speichern</button>
      </form>
    `

    document.body.appendChild(overlay)

    const form = overlay.querySelector<HTMLFormElement>('form')!
    const input = overlay.querySelector<HTMLInputElement>('#station-input')!
    const error = overlay.querySelector<HTMLElement>('#station-error')!

    input.focus()
    input.select()

    form.addEventListener('submit', (event) => {
      event.preventDefault()

      const stationId = input.value.trim()
      if (!stationId) {
        error.textContent = 'Bitte eine Station ID eingeben.'
        input.focus()
        return
      }

      const savedStationId = saveStationId(stationId)
      overlay.remove()
      resolve(savedStationId)
    })
  })
}

async function startWebcam(video: HTMLVideoElement, status: HTMLElement) {
  status.textContent = initialStatus

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    })

    video.srcObject = stream
    await video.play()
  } catch (error) {
    console.error('Webcam access failed:', error)
    status.textContent = 'Kamera konnte nicht gestartet werden'
    throw error
  }
}

function resizeOverlay(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  if (!video.videoWidth || !video.videoHeight) return

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
  }
}

function drawDetections(canvas: HTMLCanvasElement, detections: PersonDetection[]) {
  const context = canvas.getContext('2d')
  if (!context) return

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.lineWidth = 4
  context.strokeStyle = '#22c55e'
  context.fillStyle = '#22c55e'
  context.font = '16px system-ui, sans-serif'

  for (const detection of detections) {
    const box = detection.boundingBox
    const category = detection.categories.find(({ categoryName }) => categoryName === 'person')
    if (!box || !category) continue

    context.strokeRect(box.originX, box.originY, box.width, box.height)

    const label = `${Math.round(category.score * 100)}%`
    const labelX = box.originX
    const labelY = Math.max(20, box.originY - 8)
    const labelWidth = context.measureText(label).width + 12

    context.fillRect(labelX, labelY - 18, labelWidth, 22)
    context.fillStyle = '#052e16'
    context.fillText(label, labelX + 6, labelY - 2)
    context.fillStyle = '#22c55e'
  }
}

async function startPersonDetection(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  status: HTMLElement,
  rawDetection: HTMLElement,
  presenceState: HTMLElement,
  lastEvent: HTMLElement,
  backendStatus: HTMLElement,
) {
  const eventClient = new EventClient(() => getStationId()!, (status) => {
    backendStatus.textContent = status
  })

  try {
    status.textContent = 'Personenerkennung wird geladen...'
    const detector = await createPersonDetector()
    const presence = new PersonPresence()
    status.textContent = 'Personenerkennung läuft'

    const detectFrame = () => {
      resizeOverlay(video, canvas)

      if (canvas.width && canvas.height) {
        const timestamp = performance.now()
        const people = detectPeople(detector, video, timestamp)
        const personDetected = people.length > 0
        const result = presence.update(personDetected, timestamp)

        drawDetections(canvas, people)
        rawDetection.textContent = personDetected ? 'detected' : 'not detected'
        presenceState.textContent = result.state

        if (result.event) {
          console.log(result.event)
          lastEvent.textContent = result.event
          eventClient.sendPresenceEvent(result.event)
        }
      }

      requestAnimationFrame(detectFrame)
    }

    detectFrame()
  } catch (error) {
    console.error('Could not start person detection:', error)
    status.textContent = 'Personenerkennung konnte nicht gestartet werden'
  }
}

async function bootstrap() {
  let stationId = getStationId()

  if (!stationId) {
    stationId = await showStationSetupDialog()
  }

  renderApp(stationId)

  const video = document.querySelector<HTMLVideoElement>('#webcam')!
  const canvas = document.querySelector<HTMLCanvasElement>('#overlay')!
  const status = document.querySelector<HTMLElement>('#status')!
  const rawDetection = document.querySelector<HTMLElement>('#raw-detection')!
  const presenceState = document.querySelector<HTMLElement>('#presence-state')!
  const lastEvent = document.querySelector<HTMLElement>('#last-event')!
  const backendStatus = document.querySelector<HTMLElement>('#backend-status')!
  const stationIdElement = document.querySelector<HTMLElement>('#station-id')!
  const changeStationButton = document.querySelector<HTMLButtonElement>('#change-station')!

  changeStationButton.addEventListener('click', async () => {
    const newStationId = await showStationSetupDialog(getStationId() ?? '')
    stationIdElement.textContent = newStationId
  })

  try {
    await startWebcam(video, status)
    await startPersonDetection(video, canvas, status, rawDetection, presenceState, lastEvent, backendStatus)
  } catch {
    // Error details are logged where they occur.
  }
}

bootstrap()
