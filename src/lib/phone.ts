/**
 * Normalize Calendly / Twilio phone strings to E.164.
 * North America assumed when no country code is present.
 */

export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) return null;

  if (trimmed.startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return `+${digits}`;
}
