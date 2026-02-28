# Deploy Keriva to Vercel - Step by Step

## Method 1: Deploy via GitHub (Easiest - Recommended)

### Step 1: Push to GitHub
First, push your code to GitHub:

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit - Keriva Pharmacy Finder"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/keriva-farmacias.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to https://vercel.com
2. Click "Sign Up" or "Login" (use GitHub to sign in)
3. Click "Add New..." → "Project"
4. Click "Import" next to your GitHub repository
5. Vercel will auto-detect the configuration
6. **Important:** Click "Environment Variables" and add:
   - Name: `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - Value: (copy from your .env file)
   - Name: `EXPO_PUBLIC_SUPABASE_URL`
   - Value: (copy from your .env file)
7. Click "Deploy"

Wait 2-3 minutes and your app will be live!

### Your Public URL

Your app will be available at: `https://keriva-farmacias.vercel.app` (or similar)

## Method 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name? keriva-farmacias
# - Directory? ./
# - Override settings? No
```

## What You Get

✅ Public URL that works on all devices
✅ No login required
✅ Mobile-optimized
✅ Fast global CDN
✅ Automatic HTTPS
✅ Perfect for sharing on Instagram

## Share on Instagram

1. Copy your Vercel URL (e.g., `https://keriva-farmacias.vercel.app`)
2. On Instagram:
   - Add it to your bio
   - Add it to your Story with a "Swipe Up" link (if you have 10k+ followers)
   - Share it in posts/reels as text
   - Use the "Link Sticker" in Stories

## Troubleshooting

**Map not showing?**
- Make sure to access the URL via HTTPS (not HTTP)
- Allow location permissions on your browser/device

**Build failed?**
- Check that environment variables are set correctly in Vercel dashboard
- Rebuild: Go to Vercel dashboard → Deployments → click "..." → Redeploy

## Update Your App

Every time you push to GitHub, Vercel will automatically rebuild and deploy your app!
