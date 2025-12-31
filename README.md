# Demo Follow-up Automation System

Minimal email-based follow-up automation for demo bookings. Replaces Zapier.

## Architecture

```
Calendly Webhook → API Route → DemoService → SchedulerService (QStash)
                                                    ↓
                                            Scheduled Jobs
                                                    ↓
                                    QStash Callback → MessagingService → Resend
                                                    
Email Reply → API Route → ReplyService → Update Demo State
```

## Sequences (Email Only)

### SAME_DAY (≤12h out)
| Time | Message |
|------|---------|
| T0 | Confirm request |
| T-60m | Reminder |
| T-10m | Join link |
| T+2m | Urgent join |

### NEXT_DAY (12-36h out)
| Time | Message |
|------|---------|
| T0 | Confirm request |
| T0+1s | Receipt |
| T-4h | Reminder |
| T-10m | Join link |

### FUTURE (36h+ out)
| Time | Message |
|------|---------|
| T0 | Confirm request |
| T+24h | Reminder |
| T-48h | Earlier time offer |
| T-10m | Join link (if confirmed) |

## Setup

### 1. Database (Supabase)
```bash
# Run sql/schema.sql in Supabase SQL Editor
```

### 2. Environment Variables
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# QStash (Upstash)
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-signing-key
QSTASH_NEXT_SIGNING_KEY=your-next-signing-key

# Resend (Email)
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=you@yourdomain.com

# Calendly
CALENDLY_WEBHOOK_SECRET=your-calendly-webhook-secret

# App
APP_URL=https://your-app.vercel.app
RESCHEDULE_URL=https://calendly.com/your-reschedule-link
```

### 3. Deploy
```bash
npm install
npm run build
npm start

# Or deploy to Vercel
vercel deploy
```

### 4. Configure Webhooks

**Calendly:**
1. Go to Calendly → Integrations → Webhooks
2. Add webhook URL: `https://your-app.vercel.app/api/webhooks/calendly`
3. Select events: `invitee.created`, `invitee.canceled`
4. Copy signing secret to `CALENDLY_WEBHOOK_SECRET`

**Resend (Inbound Email):**
1. Verify domain in Resend
2. Set up inbound webhook: `https://your-app.vercel.app/api/webhooks/reply/email`

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/webhooks/calendly` | POST | Calendly booking events |
| `/api/webhooks/qstash` | POST | Scheduled job execution |
| `/api/webhooks/reply/email` | POST | Inbound email replies |

## Reply Detection

The system parses email replies for:
- **YES**: `yes`, `yep`, `yeah`, `y`, `confirm`, `👍`, `see you`, etc.
- **RESCHEDULE**: `reschedule`, `can't`, `cancel`, `different time`, etc.
- **SOONER**: `sooner`, `1`, `2`, `morning`, `afternoon`, etc.

## State Machine

```
PENDING → CONFIRMED → COMPLETED
    ↓         ↓
RESCHEDULED  NO_SHOW
    ↓
CANCELLED
```

## Local Development

```bash
# Start dev server
npm run dev

# Tunnel for webhooks
ngrok http 3000

# Update APP_URL to ngrok URL
```
