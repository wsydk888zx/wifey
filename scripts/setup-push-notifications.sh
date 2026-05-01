#!/usr/bin/env bash
# Run this once to finish the push notification setup.
# Requires: SUPABASE_ACCESS_TOKEN env var set, or run `supabase login` first.
set -e

PROJECT_REF="bxeoleynlmnhagveqrmn"
VAPID_PUBLIC="BH2bT8IawBFDGiLIk2rTzQ685BOd2qOnB6hWWWT-U2t9c5ZD6606c_M7AcP6hSwdwjvykSPYtG9XPxpVliwHQuo"
VAPID_PRIVATE="-zIlw4Cic-NBGX_gaf2PiYGkDSgVxm22N4m8MGb6cg0"
VAPID_SUBJECT="mailto:jonjump@mac.com"

echo "→ Setting Supabase secrets..."
supabase secrets set \
  VAPID_SUBJECT="$VAPID_SUBJECT" \
  VAPID_PUBLIC_KEY="$VAPID_PUBLIC" \
  VAPID_PRIVATE_KEY="$VAPID_PRIVATE" \
  --project-ref "$PROJECT_REF"

echo "→ Running SQL migration..."
supabase db push --project-ref "$PROJECT_REF"

echo "→ Deploying Edge Function..."
supabase functions deploy send-scheduled-notifications --project-ref "$PROJECT_REF"

echo "→ Scheduling Edge Function (every minute)..."
supabase functions schedule send-scheduled-notifications \
  --cron "* * * * *" \
  --project-ref "$PROJECT_REF"

echo ""
echo "✓ Done. Supabase push notification backend is live."
echo ""
echo "Next: add these env vars to the Vercel player project:"
echo "  VITE_SUPABASE_URL=https://bxeoleynlmnhagveqrmn.supabase.co"
echo "  VITE_SUPABASE_ANON_KEY=<your anon key>"
echo "  VITE_VAPID_PUBLIC_KEY=$VAPID_PUBLIC"
