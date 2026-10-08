const STATION_STORAGE_KEY = 'mediapipe.stationId'
const VIDEO_STORAGE_KEY = 'mediapipe.videoFilename'

export function getStationId(): string | null {
  const stationId = window.localStorage.getItem(STATION_STORAGE_KEY)?.trim()
  return stationId ? stationId : null
}

export function saveStationId(stationId: string): string {
  const normalizedStationId = stationId.trim()

  if (!normalizedStationId) {
    throw new Error('Station ID must not be empty')
  }

  window.localStorage.setItem(STATION_STORAGE_KEY, normalizedStationId)
  return normalizedStationId
}

export function getVideoFilename(): string | null {
  const videoFilename = window.localStorage.getItem(VIDEO_STORAGE_KEY)?.trim()
  return videoFilename ? videoFilename : null
}

export function saveVideoFilename(videoFilename: string): string {
  const normalizedVideoFilename = videoFilename.trim()

  if (!normalizedVideoFilename) {
    throw new Error('Video filename must not be empty')
  }

  window.localStorage.setItem(VIDEO_STORAGE_KEY, normalizedVideoFilename)
  return normalizedVideoFilename
}

export { STATION_STORAGE_KEY, VIDEO_STORAGE_KEY }
