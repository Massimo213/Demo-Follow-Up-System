/**
 * Pure scheduling helpers — unit-testable without DB.
 */

import type { MessageType } from '@/types/demo';

export type StepScheduleInput = {
  messageType: MessageType;
  offsetMs: number;
  scheduledAtMs: number;
  nowMs: number;
};

export type StepScheduleResult =
  | { action: 'schedule'; scheduledForMs: number; compacted: boolean }
  | { action: 'skip'; reason: string };

/**
 * Resolve when a sequence step should fire.
 * Missed pre-meeting steps compact to now; skip once meeting has started.
 */
export function resolveStepSchedule(input: StepScheduleInput): StepScheduleResult {
  const { messageType, offsetMs, scheduledAtMs, nowMs } = input;
  const meetingStarted = nowMs >= scheduledAtMs;

  let scheduledForMs =
    messageType === 'CONFIRM_INITIAL' ? nowMs : scheduledAtMs + offsetMs;

  if (scheduledForMs < nowMs) {
    if (meetingStarted) {
      return { action: 'skip', reason: 'meeting_started' };
    }
    return { action: 'schedule', scheduledForMs: nowMs, compacted: true };
  }

  return { action: 'schedule', scheduledForMs, compacted: false };
}
