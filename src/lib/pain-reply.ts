/**
 * The pre-demo question is open. This is their answer, in their words.
 * A bare yes, a thanks, or a reschedule is not an answer.
 */

const LEADING_YES =
  /^(?:yes|yep|yeah|yup|y|confirm|confirmed|i'?m in|im in|ok|okay|sure)[,.!\s]+/i;

const NOT_A_PAIN =
  /^(thanks|thank you|thx|ok|okay|k|hi|hey|hello|cool|great|perfect|sounds good|see you|see you then|got it|yes|yep|yeah|yup|y|confirm|confirmed|i'?m in|im in|i'?ll be there|i will be there|i'?m coming|count me in|sure|good|still on|stop|unsubscribe|cancel|reschedule|no|nope)[.!\s]*$/i;

export function extractPainReply(body: string): string | null {
  let text = body.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  text = text.replace(LEADING_YES, '').trim();
  if (text.length < 4) return null;
  if (NOT_A_PAIN.test(text)) return null;
  if (text.length > 500) text = text.slice(0, 500).trim();
  return text || null;
}

const EARLIER_ANSWERS: Record<string, string> = {
  close_rate: 'close rate',
  deal_size: 'deal size',
  follow_up: 'follow-up',
  revenue: 'total revenue',
};

export function painReply(demo: {
  focus_reply?: string | null;
  focus_metric?: string | null;
}): string | null {
  const text = demo.focus_reply?.replace(/\s+/g, ' ').trim();
  if (text) return text;
  if (demo.focus_metric && EARLIER_ANSWERS[demo.focus_metric]) {
    return EARLIER_ANSWERS[demo.focus_metric];
  }
  return null;
}

/** Texts stay readable if they wrote a paragraph. Emails use the full stored reply. */
export function painReplyForSms(
  demo: { focus_reply?: string | null; focus_metric?: string | null },
  max = 140
): string | null {
  const text = painReply(demo);
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
