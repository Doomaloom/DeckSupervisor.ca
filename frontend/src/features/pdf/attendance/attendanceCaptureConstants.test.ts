import { describe, expect, it } from 'vitest'
import {
  ATTENDANCE_CAPTURE_HEIGHT,
  ATTENDANCE_CAPTURE_PIXEL_RATIO,
  ATTENDANCE_CAPTURE_WIDTH,
  ATTENDANCE_STAGE_HEIGHT,
  ATTENDANCE_STAGE_WIDTH,
} from './attendanceCaptureConstants'

describe('attendance capture dimensions', () => {
  it('captures a 3x Letter-landscape stage', () => {
    expect(ATTENDANCE_STAGE_WIDTH).toBe(1056)
    expect(ATTENDANCE_STAGE_HEIGHT).toBe(816)
    expect(ATTENDANCE_CAPTURE_PIXEL_RATIO).toBe(3)
    expect(ATTENDANCE_CAPTURE_WIDTH).toBe(3168)
    expect(ATTENDANCE_CAPTURE_HEIGHT).toBe(2448)
  })
})
