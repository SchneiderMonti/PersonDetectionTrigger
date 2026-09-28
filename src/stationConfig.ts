const STATION_STORAGE_KEY = 'mediapipe.stationId'

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

export { STATION_STORAGE_KEY }
