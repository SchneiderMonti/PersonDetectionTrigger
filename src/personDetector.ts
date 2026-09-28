import {
  FilesetResolver,
  ObjectDetector,
  type Detection,
} from '@mediapipe/tasks-vision'

export type PersonDetection = Detection

const WASM_ASSETS_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'

export const PERSON_DETECTOR_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite'

export async function createPersonDetector() {
  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_ASSETS_URL)

    return await ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: PERSON_DETECTOR_MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      categoryAllowlist: ['person'],
      scoreThreshold: 0.35,
    })
  } catch (error) {
    console.error('Person detector initialization failed:', error)
    throw error
  }
}

export function detectPeople(
  detector: ObjectDetector,
  video: HTMLVideoElement,
  timestampMs: number,
): PersonDetection[] {
  const result = detector.detectForVideo(video, timestampMs)

  return result.detections.filter((detection) =>
    detection.categories.some((category) => category.categoryName === 'person'),
  )
}
