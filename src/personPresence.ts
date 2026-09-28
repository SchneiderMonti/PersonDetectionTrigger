export type PresenceState = 'ABSENT' | 'PRESENT'
export type PresenceEvent = 'PERSON_ENTER' | 'PERSON_LEAVE'

export interface PresenceUpdateResult {
  state: PresenceState
  event: PresenceEvent | null
}

export class PersonPresence {
  private state: PresenceState = 'ABSENT'
  private pendingEnterSince: number | null = null
  private pendingLeaveSince: number | null = null
  private readonly enterDelayMs: number
  private readonly leaveDelayMs: number

  constructor(enterDelayMs = 500, leaveDelayMs = 1500) {
    this.enterDelayMs = enterDelayMs
    this.leaveDelayMs = leaveDelayMs
  }

  update(personDetected: boolean, timestamp: number): PresenceUpdateResult {
    let event: PresenceEvent | null = null

    if (this.state === 'ABSENT') {
      this.pendingLeaveSince = null

      if (personDetected) {
        this.pendingEnterSince ??= timestamp

        if (timestamp - this.pendingEnterSince >= this.enterDelayMs) {
          this.state = 'PRESENT'
          this.pendingEnterSince = null
          event = 'PERSON_ENTER'
        }
      } else {
        this.pendingEnterSince = null
      }
    } else {
      this.pendingEnterSince = null

      if (!personDetected) {
        this.pendingLeaveSince ??= timestamp

        if (timestamp - this.pendingLeaveSince >= this.leaveDelayMs) {
          this.state = 'ABSENT'
          this.pendingLeaveSince = null
          event = 'PERSON_LEAVE'
        }
      } else {
        this.pendingLeaveSince = null
      }
    }

    return { state: this.state, event }
  }

  getState(): PresenceState {
    return this.state
  }
}
