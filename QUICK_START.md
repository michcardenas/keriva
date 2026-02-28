# Quick Start - Deploy Keriva in 5 Minutes

## The Fastest Way to Get Your App Online

### Step 1: Create GitHub Repository (2 minutes)

1. Go to https://github.com/new
2. Repository name: `keriva-farmacias`
3. Keep it Public or Private (your choice)
4. Click "Create repository"
5. Copy the repository URL

### Step 2: Push Your Code (1 minute)

Open terminal in your project folder and run:

```bash
git init
git add .
git commit -m "Initial commit - Keriva app ready for deployment"
git branch -M main
git remote add origin YOUR_GITHUB_URL_HERE
git push -u origin main
```

### Step 3: Deploy on Vercel (2 minutes)

1. Go to https://vercel.com/signup
2. Click "Continue with GitHub"
3. Click "Import Project"
4. Select your `keriva-farmacias` repository
5. Vercel will detect everything automatically
6. Click "Deploy"

**IMPORTANT:** Add environment variables before clicking Deploy:
- Click "Environment Variables"
- Add: `EXPO_PUBLIC_SUPABASE_ANON_KEY` = (your key from .env)
- Add: `EXPO_PUBLIC_SUPABASE_URL` = (your URL from .env)

### Step 4: Get Your Link

Wait 2-3 minutes for deployment to complete.

Your app will be live at: `https://keriva-farmacias.vercel.app`

### Step 5: Share on Instagram

Copy your Vercel URL and:

1. **Instagram Bio:**
   - Go to Edit Profile
   - Paste link in "Website" field

2. **Instagram Story:**
   - Create new story
   - Tap sticker icon
   - Select "Link" sticker
   - Paste your URL
   - Customize and share

3. **Instagram Post/Reel:**
   - Include the link in your caption
   - Example: "Find pharmacies near you: keriva-farmacias.vercel.app 💊"

## That's It!

Your app is now:
- ✅ Live on the internet
- ✅ Accessible from any device
- ✅ No login required
- ✅ Mobile optimized
- ✅ Ready to share

## Need Help?

- **Build failed?** Check [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Have questions?** Review [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)
- **Want to customize?** Edit files and push to GitHub - auto-deploys!

---

**Pro Tip:** Every time you push to GitHub, Vercel automatically updates your live app!
