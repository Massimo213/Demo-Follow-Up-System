/**
 * Pure scheduling helpers — unit-testable without DB.
 */

import type { MessageType } from '@/types/demo';

export type StepScheduleInput = {
  messageType: MessageType;
  offsetMs: number;
  scheduledAtMs: number;
  nowMs: number;
  /** ingest = offset from the moment the booking lands. meeting = offset from the walkthrough. */
  anchor?: 'meeting' | 'ingest';
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
  const anchor = input.anchor ?? (messageType === 'CONFIRM_INITIAL' ? 'ingest' : 'meeting');
  const meetingStarted = nowMs >= scheduledAtMs;

  const scheduledForMs = anchor === 'ingest' ? nowMs + offsetMs : scheduledAtMs + offsetMs;

  // The booking text has no job once the walkthrough has already begun.
  if (anchor === 'ingest' && messageType !== 'CONFIRM_INITIAL' && scheduledForMs >= scheduledAtMs) {
    return { action: 'skip', reason: 'after_meeting' };
  }

  if (scheduledForMs < nowMs) {
    if (meetingStarted) {
      return { action: 'skip', reason: 'meeting_started' };
    }
    return { action: 'schedule', scheduledForMs: nowMs, compacted: true };
  }

  return { action: 'schedule', scheduledForMs, compacted: false };
}
