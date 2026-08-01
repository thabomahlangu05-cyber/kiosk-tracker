# Docker Deployment Guide — Go Live in 15 Minutes

**Target**: Railway or Render (free tier available, auto-deploy from GitHub)

---

## Prerequisites (2 min setup)

### 1. Create a free Docker Hub account
- Go to https://hub.docker.com/signup
- Create account (free tier is fine)
- Note your username and password

### 2. Create a Railway or Render account
**Railway (Recommended - simpler)**
- https://railway.app/dashboard
- Sign up with GitHub

**OR Render**
- https://dashboard.render.com
- Sign up with GitHub

### 3. Push code to GitHub
```bash
cd "C:\Users\guest1\production tracker"
git init
git add .
git commit -m "Kiosk Production Tracker - Phase 0-5 complete"
git remote add origin https://github.com/YOUR_USERNAME/kiosk-tracker
git push -u origin main
```
(Create the repo on github.com first)

---

## Quick Deploy Option: Railway (Recommended)

### Step 1: Connect GitHub to Railway
1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Authorize GitHub
5. Select your `kiosk-tracker` repo

### Step 2: Add Environment Variables
In Railway dashboard, go to "Variables":

```
DATABASE_URL=postgresql://postgres:YOUR_SECURE_PASSWORD@localhost:5432/kiosk_prod
NODE_ENV=production
SESSION_SECRET=<run: openssl rand -base64 32>
NEXT_PUBLIC_SITE_URL=https://YOUR_RAILWAY_URL.railway.app
```

### Step 3: Add PostgreSQL Plugin
1. Click "Add Services"
2. Select "PostgreSQL"
3. Railway auto-fills DATABASE_URL ✓

### Step 4: Deploy
Railway auto-deploys on git push. Watch logs in dashboard.

**Result**: Live at `https://your-app.railway.app` in ~2-3 minutes

---

## Manual Docker Build & Push (If preferred)

### Step 1: Build locally
```bash
cd "C:\Users\guest1\production tracker"
docker build -t YOUR_DOCKER_USERNAME/kiosk-tracker:latest .
```

### Step 2: Login to Docker Hub
```bash
docker login
# Enter username and password when prompted
```

### Step 3: Push to Docker Hub
```bash
docker push YOUR_DOCKER_USERNAME/kiosk-tracker:latest
```

### Step 4: Deploy to Railway with custom image
1. Railway → New Project → "Docker Image"
2. Enter: `YOUR_DOCKER_USERNAME/kiosk-tracker:latest`
3. Set environment variables (see Step 2 above)
4. Deploy

---

## Environment Variables Explained

| Variable | Value | How to generate |
|----------|-------|-----------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Railway auto-fills, OR use external managed DB |
| `NODE_ENV` | `production` | Always production for live |
| `SESSION_SECRET` | 32+ char random string | `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | Your domain | `https://your-app.railway.app` |

---

## Verify Deployment Works

Once live at your URL:

```bash
# Test login page
curl https://your-app.railway.app/login

# Test dashboard (should redirect to login if not authed)
curl https://your-app.railway.app/dashboard
```

Should return HTML (not 404).

---

## Demo Login After Deploy

Once live:
- Email: `thabo.mahlangu@tymedigital.com`
- Password: `changeme123` (dev only — change in production!)

---

## Production Checklist

Before sharing with team:

- [ ] Change `SESSION_SECRET` to a strong random string
- [ ] Update initial seeded user passwords
- [ ] Set `NEXT_PUBLIC_SITE_URL` correctly
- [ ] Enable HTTPS (Railway/Render do this automatically)
- [ ] Configure backup of PostgreSQL database
- [ ] Test all features with real data
- [ ] Set up monitoring/alerts

---

## Troubleshooting

### "Build failed" in Railway logs
Check: `.env` file committed to git (it shouldn't be)
```bash
git rm --cached .env
git commit -m "Remove .env from tracking"
```

### "Database connection refused"
Check: `DATABASE_URL` is set in Railway variables
Should be auto-filled if you added PostgreSQL plugin.

### "Cold start" delays
Railway/Render have ~10s first request. Normal for serverless.

### Logs show "Cannot find module"
Usually means npm install didn't run. Check build logs.

---

## Custom Domain (After going live)

### Add your domain to Railway
1. Railway dashboard → Settings → "Custom Domain"
2. Enter your domain (e.g., `kiosk.yourcompany.com`)
3. Add CNAME record to your DNS provider

---

## Next Steps

1. **This session**: Deploy to Railway/Render
2. **Before team use**: Change passwords, set production secrets
3. **Week 1**: Gather feedback, fix bugs
4. **Week 2+**: Add Phase 5.5 features (barcode scanning, admin UI, communications)

---

## Support

**Railway support**: https://railway.app/support
**Render support**: https://render.com/docs
**Docker docs**: https://docs.docker.com

Everything is working. Just deploy! 🚀
