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

  get resend() {
    return {
      apiKey: getEnv('RESEND_API_KEY'),
      from: getEnv('EMAIL_FROM'),
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
    T_MINUS_60M: 60 * 60 * 1000,
    T_MINUS_10M: 10 * 60 * 1000,
    T_PLUS_2M: 2 * 60 * 1000,
  },
  NEXT_DAY: {
    T_MINUS_4H: 4 * 60 * 60 * 1000,
    T_MINUS_10M: 10 * 60 * 1000,
    T_PLUS_2M: 2 * 60 * 1000,
  },
  FUTURE: {
    T_PLUS_24H: 24 * 60 * 60 * 1000,
    T_MINUS_48H: 48 * 60 * 60 * 1000,
    T_MINUS_4H: 4 * 60 * 60 * 1000,  // Day-of reminder (morning of demo)
    T_MINUS_10M: 10 * 60 * 1000,
    T_PLUS_2M: 2 * 60 * 1000,
  },
} as const;
