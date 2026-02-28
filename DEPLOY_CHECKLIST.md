# Deployment Checklist for Keriva

## ✅ Pre-Deployment (Already Done)

- [x] Built web version (`npm run build:web`)
- [x] Created `vercel.json` configuration
- [x] Updated `.gitignore` to include `.env` for deployment
- [x] Created deployment documentation
- [x] Verified build output in `dist/` folder

## 📋 Next Steps (You Need to Do)

### Option A: GitHub + Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Ready for deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/keriva-farmacias.git
   git push -u origin main
   ```

2. **Deploy on Vercel**
   - Go to https://vercel.com
   - Sign in with GitHub
   - Click "Add New..." → "Project"
   - Import your repository
   - Add environment variables:
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
     - `EXPO_PUBLIC_SUPABASE_URL`
   - Click "Deploy"

3. **Get Your URL**
   - Your app will be at: `https://keriva-farmacias.vercel.app`
   - Or custom domain if you configure it

### Option B: Direct CLI Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

## 🎉 After Deployment

### Test Your App
- [ ] Open URL on mobile browser
- [ ] Test map functionality
- [ ] Test location permissions
- [ ] Test pharmacy list
- [ ] Test reporting feature

### Share on Instagram
- [ ] Add link to Instagram bio
- [ ] Create Story with link sticker
- [ ] Post about your app

### Monitor
- [ ] Check Vercel dashboard for analytics
- [ ] Monitor error logs
- [ ] Check user feedback

## 🔧 Troubleshooting

**Map not loading?**
- Ensure HTTPS is being used
- Check browser console for errors
- Verify location permissions

**Environment variables not working?**
- Check Vercel dashboard → Settings → Environment Variables
- Redeploy after adding variables

**Build failing?**
- Run `npm run build:web` locally first
- Check build logs in Vercel dashboard
- Verify all dependencies are in package.json

## 📱 Your Public URL

Once deployed, your URL will look like:
- **Vercel Default:** `https://keriva-farmacias.vercel.app`
- **Custom Domain:** `https://keriva.app` (if configured)

Share this link anywhere - it works on all devices without login!
