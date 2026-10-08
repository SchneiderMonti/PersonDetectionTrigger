import './style.css'
import { EventClient } from './eventClient'
import { createPersonDetector, detectPeople, type PersonDetection } from './personDetector'
import { PersonPresence, type PresenceEvent } from './personPresence'
import { getStationId, getVideoFilename, saveStationId, saveVideoFilename } from './stationConfig'

const availableVideos = ['video01.mp4', 'video02.mp4', 'video03.mp4', 'video04.mp4']
const PRESENCE_SIGNAL_INTERVAL_MS = 1000

type SafariFullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
}

let activePersonDetectionCleanup: (() => void) | null = null

function escapeHtml(value: string) {
  const element = document.createElement('div')
  element.textContent = value
  return element.innerHTML
}

function renderSetup() {
  const savedStationId = getStationId() ?? ''
  const savedVideoFilename = getVideoFilename() ?? ''
  const videoOptions = availableVideos
    .map(
      (filename) =>
        `<option value="${escapeHtml(filename)}"${filename === savedVideoFilename ? ' selected' : ''}>${escapeHtml(filename)}</option>`,
    )
    .join('')

  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <main class="setup-screen">
      <form id="setup-form" class="setup-form">
        <h1>Setup</h1>
        <label>
          Station:
          <input id="station-input" type="text" placeholder="Ipad1" value="${escapeHtml(savedStationId)}" autocomplete="off" />
        </label>
        <label>
          Video:
          <select id="video-select">
            <option value="">Bitte auswählen</option>
            ${videoOptions}
          </select>
        </label>
        <button id="start-button" type="submit" disabled>Start</button>
        <p id="setup-error" class="setup-error" aria-live="polite"></p>
      </form>
    </main>
  `
}

function renderExhibition(videoFilename: string) {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <main class="exhibition-screen">
      <video id="exhibition-video" src="/videos/${escapeHtml(videoFilename)}" playsinline preload="auto" muted loop></video>
      <video id="webcam" class="media-pipe-input" autoplay playsinline muted></video>
      <canvas id="overlay" class="media-pipe-input" aria-hidden="true"></canvas>
    </main>
  `
}

async function startWebcam(video: HTMLVideoElement) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    })

    video.srcObject = stream
    await video.play()
  } catch (error) {
    console.error('Webcam access failed:', error)
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
  onPresenceEvent: (event: PresenceEvent) => void,
) {
  activePersonDetectionCleanup?.()
  activePersonDetectionCleanup = null

  const eventClient = new EventClient(() => getStationId()!, () => undefined)
  let animationFrameId: number | null = null
  let presenceSignalIntervalId: number | null = null
  let stopped = false

  const cleanup = () => {
    if (stopped) return

    stopped = true

    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    if (presenceSignalIntervalId !== null) {
      window.clearInterval(presenceSignalIntervalId)
      presenceSignalIntervalId = null
    }

    eventClient.close()
    window.removeEventListener('pagehide', cleanup)

    if (activePersonDetectionCleanup === cleanup) {
      activePersonDetectionCleanup = null
    }
  }

  activePersonDetectionCleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })

  try {
    const detector = await createPersonDetector()
    if (stopped) return

    const presence = new PersonPresence()

    presenceSignalIntervalId = window.setInterval(() => {
      const stableState = presence.getState()
      eventClient.sendPresenceEvent(stableState === 'PRESENT' ? 'PERSON_ENTER' : 'PERSON_LEAVE')
    }, PRESENCE_SIGNAL_INTERVAL_MS)

    const detectFrame = () => {
      if (stopped) return

      resizeOverlay(video, canvas)

      if (canvas.width && canvas.height) {
        const timestamp = performance.now()
        const people = detectPeople(detector, video, timestamp)
        const personDetected = people.length > 0
        const result = presence.update(personDetected, timestamp)

        drawDetections(canvas, people)

        if (result.event) {
          console.log(result.event)
          onPresenceEvent(result.event)
        }
      }

      animationFrameId = requestAnimationFrame(detectFrame)
    }

    detectFrame()
  } catch (error) {
    cleanup()
    console.error('Could not start person detection:', error)
  }
}

function preloadVideo(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve()
      return
    }

    video.addEventListener('loadedmetadata', () => resolve(), { once: true })
    video.addEventListener('error', () => resolve(), { once: true })
    video.load()
  })
}

function requestBrowserFullscreen() {
  if (typeof document.documentElement.requestFullscreen !== 'function') {
    console.warn('Browser fullscreen is not supported; continuing to start the exhibition normally.')
    return
  }

  try {
    void document.documentElement.requestFullscreen().catch((error) => {
      console.warn('Browser fullscreen request was rejected; continuing to start the exhibition normally:', error)
    })
  } catch (error) {
    console.warn('Browser fullscreen request failed; continuing to start the exhibition normally:', error)
  }
}

function enterNativeVideoFullscreenOrFallback(video: HTMLVideoElement) {
  const safariVideo = video as SafariFullscreenVideoElement

  video.muted = true
  video.controls = false
  video.removeAttribute('controls')

  if (typeof safariVideo.webkitEnterFullscreen !== 'function') {
    console.warn('Native Safari video fullscreen is not supported; falling back to browser fullscreen.')
    requestBrowserFullscreen()
    return
  }

  try {
    safariVideo.webkitEnterFullscreen()
  } catch (error) {
    console.warn('Native Safari video fullscreen request failed; falling back to browser fullscreen:', error)
    requestBrowserFullscreen()
  }
}

function syncPlaybackAppearance(video: HTMLVideoElement) {
  video.classList.toggle('is-playing', !video.paused)
  video.classList.toggle('is-paused', video.paused)
}

async function enterExhibitionMode(stationId: string, videoFilename: string) {
  saveStationId(stationId)
  saveVideoFilename(videoFilename)
  renderExhibition(videoFilename)

  const webcamVideo = document.querySelector<HTMLVideoElement>('#webcam')!
  const canvas = document.querySelector<HTMLCanvasElement>('#overlay')!
  const exhibitionVideo = document.querySelector<HTMLVideoElement>('#exhibition-video')!

  exhibitionVideo.pause()
  syncPlaybackAppearance(exhibitionVideo)
  exhibitionVideo.addEventListener('play', () => syncPlaybackAppearance(exhibitionVideo))
  exhibitionVideo.addEventListener('pause', () => syncPlaybackAppearance(exhibitionVideo))
  exhibitionVideo.addEventListener('ended', () => syncPlaybackAppearance(exhibitionVideo))
  enterNativeVideoFullscreenOrFallback(exhibitionVideo)
  await preloadVideo(exhibitionVideo)
  await startWebcam(webcamVideo)
  await startPersonDetection(webcamVideo, canvas, (event) => {
    if (event === 'PERSON_ENTER') {
      void exhibitionVideo.play().catch((error) => {
        console.warn('Exhibition video playback failed:', error)
      })
    } else if (event === 'PERSON_LEAVE') {
      exhibitionVideo.pause()
    }
  })
}

function bootstrap() {
  renderSetup()

  const form = document.querySelector<HTMLFormElement>('#setup-form')!
  const stationInput = document.querySelector<HTMLInputElement>('#station-input')!
  const videoSelect = document.querySelector<HTMLSelectElement>('#video-select')!
  const startButton = document.querySelector<HTMLButtonElement>('#start-button')!
  const setupError = document.querySelector<HTMLElement>('#setup-error')!

  const updateStartButton = () => {
    startButton.disabled = !stationInput.value.trim() || !videoSelect.value
  }

  stationInput.addEventListener('input', updateStartButton)
  videoSelect.addEventListener('change', updateStartButton)
  updateStartButton()

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    const stationId = stationInput.value.trim()
    const videoFilename = videoSelect.value

    if (!stationId || !videoFilename) return

    startButton.disabled = true
    setupError.textContent = ''

    try {
      await enterExhibitionMode(stationId, videoFilename)
    } catch (error) {
      console.error('Could not enter exhibition mode:', error)
      renderSetup()
      bootstrap()
    }
  })
}

bootstrap()
