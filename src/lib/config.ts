/**
 * Centralized configuration
 * Env vars validated at runtime, not build time
 */

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Lazy config that validates on first access
export const config = {
  get supabase() {
    return {
      url: getEnv('SUPABASE_URL'),
      serviceKey: getEnv('SUPABASE_SERVICE_KEY'),
    };
  },

  get qstash() {
    return {
      token: getEnv('QSTASH_TOKEN'),
      currentSigningKey: getEnv('QSTASH_CURRENT_SIGNING_KEY'),
      nextSigningKey: getEnv('QSTASH_NEXT_SIGNING_KEY'),
    };
  },

  get gmail() {
    return {
      user: getEnv('GMAIL_USER'),
      appPassword: getEnv('GMAIL_APP_PASSWORD'),
      fromName: process.env.GMAIL_FROM_NAME || 'Yahya from Elystra',
    };
  },

  get twilio() {
    return {
      accountSid: getEnv('TWILIO_ACCOUNT_SID'),
      authToken: getEnv('TWILIO_AUTH_TOKEN'),
      phoneNumber: getEnv('TWILIO_PHONE_NUMBER'),
    };
  },

  get calendly() {
    return {
      webhookSecret: getEnv('CALENDLY_WEBHOOK_SECRET'),
    };
  },

  get app() {
    return {
      url: getEnv('APP_URL'),
      rescheduleUrl: getEnv('RESCHEDULE_URL'),
    };
  },
};

// Timing constants (in milliseconds)
export const TIMING = {
  SAME_DAY: {
    T_MINUS_30M: 30 * 60 * 1000,     // SMS reminder 30 min before
    T_MINUS_10M: 10 * 60 * 1000,     // Join link email
    T_PLUS_8M: 8 * 60 * 1000,        // No-show SMS (A/B)
    T_PLUS_1H: 60 * 60 * 1000,       // Post no-show email
  },
  NEXT_DAY: {
    T_MINUS_4H: 4 * 60 * 60 * 1000,  // Morning-of email reminder
    T_MINUS_30M: 30 * 60 * 1000,     // SMS reminder 30 min before
    T_MINUS_10M: 10 * 60 * 1000,     // Join link email
    T_PLUS_8M: 8 * 60 * 1000,        // No-show SMS (A/B)
    T_PLUS_1H: 60 * 60 * 1000,       // Post no-show email
  },
  FUTURE: {
    T_MINUS_48H: 48 * 60 * 60 * 1000, // Value bomb email
    T_MINUS_24H: 24 * 60 * 60 * 1000, // Day-before SMS
    T_MINUS_4H: 4 * 60 * 60 * 1000,   // Morning-of email reminder
    T_MINUS_30M: 30 * 60 * 1000,      // SMS reminder 30 min before
    T_MINUS_10M: 10 * 60 * 1000,      // Join link email
    T_PLUS_8M: 8 * 60 * 1000,         // No-show SMS (A/B)
    T_PLUS_1H: 60 * 60 * 1000,        // Post no-show email
  },
} as const;
