#!/bin/bash
# Test predemo follow-up (email + SMS)
# Usage: ./scripts/test-followup.sh [BASE_URL] [YOUR_EMAIL] [YOUR_PHONE]
# Example: ./scripts/test-followup.sh https://your-app.vercel.app you@example.com +33612345678

BASE_URL="${1:-http://localhost:3000}"
EMAIL="${2:-}"
PHONE="${3:-}"

if [ -z "$EMAIL" ]; then
  echo "Usage: $0 [BASE_URL] YOUR_EMAIL [YOUR_PHONE]"
  echo "Example: $0 https://your-app.vercel.app you@example.com +33612345678"
  exit 1
fi

echo "Testing predemo follow-up against $BASE_URL"
echo "=========================================="

# 1. CONFIRM_INITIAL (email)
echo ""
echo "[1/4] CONFIRM_INITIAL (email)..."
RESP=$(curl -s -X POST "$BASE_URL/api/test/send" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"name\":\"Test User\",\"messageType\":\"CONFIRM_INITIAL\"}")
if echo "$RESP" | grep -q '"status":"sent"'; then
  echo "  ✓ Sent"
else
  echo "  ✗ Failed: $RESP"
fi

# 2. CONFIRM_REMINDER (email)
echo ""
echo "[2/4] CONFIRM_REMINDER (email)..."
RESP=$(curl -s -X POST "$BASE_URL/api/test/send" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"name\":\"Test User\",\"messageType\":\"CONFIRM_REMINDER\"}")
if echo "$RESP" | grep -q '"status":"sent"'; then
  echo "  ✓ Sent"
else
  echo "  ✗ Failed: $RESP"
fi

# 3. JOIN_LINK (email)
echo ""
echo "[3/4] JOIN_LINK (email)..."
RESP=$(curl -s -X POST "$BASE_URL/api/test/send" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"name\":\"Test User\",\"messageType\":\"JOIN_LINK\"}")
if echo "$RESP" | grep -q '"status":"sent"'; then
  echo "  ✓ Sent"
else
  echo "  ✗ Failed: $RESP"
fi

# 4. SMS (SMS_REMINDER template via test/sms)
if [ -n "$PHONE" ]; then
  echo ""
  echo "[4/4] SMS (Twilio)..."
  BODY="Test User, we're on in 30 minutes for your 7-minute audit. If something came up, text R now."
  RESP=$(curl -s -X POST "$BASE_URL/api/test/sms" \
    -H "Content-Type: application/json" \
    -d "{\"to\":\"$PHONE\",\"body\":\"$BODY\"}")
  if echo "$RESP" | grep -q '"status":"sent"'; then
    echo "  ✓ Sent"
  else
    echo "  ✗ Failed: $RESP"
  fi
else
  echo ""
  echo "[4/4] SMS - skipped (no phone provided)"
fi

echo ""
echo "=========================================="
echo "Done. Check your inbox (and phone if tested)."
echo "If localhost: run 'npm run dev' first."
echo "If Vercel: use your deployment URL as BASE_URL."
