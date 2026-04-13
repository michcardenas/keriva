#!/bin/bash
# Write Vercel env vars to .env so Expo can read them
echo "EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL" > .env
echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY" >> .env
echo "EXPO_PUBLIC_MAPBOX_TOKEN=$EXPO_PUBLIC_MAPBOX_TOKEN" >> .env

echo "=== .env contents ==="
cat .env
echo "====================="

# Clear Metro cache and build
npx expo export --platform web --clear
