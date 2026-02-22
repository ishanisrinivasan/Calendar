# Aria Calendar — Deployment Guide

Your personal AI calendar app. Follow these steps to get it live on your phone in ~15 minutes.

---

## Step 1 — Set up GitHub (one time)

1. Go to **github.com** → Sign up for a free account
2. Click **"New repository"** (the green button)
3. Name it `aria-calendar`, set it to **Private**, click **Create**
4. Download **GitHub Desktop** from desktop.github.com (easiest way to upload files)
5. In GitHub Desktop: File → Clone Repository → pick `aria-calendar`
6. **Copy all these project files** into the cloned folder
7. In GitHub Desktop: write a commit message ("first upload") → click **Commit** → **Push**

---

## Step 2 — Deploy on Vercel (free)

1. Go to **vercel.com** → Sign up with your GitHub account
2. Click **"Add New Project"**
3. Select your `aria-calendar` repository
4. Vercel auto-detects React — just click **Deploy**
5. Wait ~2 minutes — you'll get a live URL like `aria-calendar-abc.vercel.app`

---

## Step 3 — Set your secret password

1. In Vercel, go to your project → **Settings** → **Environment Variables**
2. Add a new variable:
   - **Name:** `REACT_APP_PASSWORD`
   - **Value:** (choose your own password, e.g. `mysecretpass123`)
3. Click **Save**
4. Go to **Deployments** → click the 3 dots on your latest deployment → **Redeploy**

Now your app is protected — only someone with your password can open it.

---

## Step 4 — Add API key

1. Go to **console.anthropic.com** → sign up / log in
2. Go to **API Keys** → create a new key → copy it
3. Back in Vercel → Settings → Environment Variables
4. Add another variable:
   - **Name:** `REACT_APP_ANTHROPIC_KEY`
   - **Value:** (paste your API key)
5. Redeploy again

> ⚠️ Note: For a personal app used only by you, putting the API key as an env variable is fine. Don't share your URL publicly.

---

## Step 5 — Install on your phone as an app

### iPhone (Safari):
1. Open your Vercel URL in **Safari**
2. Tap the **Share button** (box with arrow) at the bottom
3. Scroll down → tap **"Add to Home Screen"**
4. Name it "Aria" → tap **Add**
5. It appears on your home screen like a real app! ✅

### Android (Chrome):
1. Open your URL in **Chrome**
2. Tap the **three dots** menu (top right)
3. Tap **"Add to Home screen"**
4. Tap **Add** → done! ✅

---

## Updating the app later

Whenever you make changes to the code:
1. Save your changes
2. In GitHub Desktop: commit + push
3. Vercel automatically rebuilds and redeploys in ~2 minutes

---

## Your app features

- 💬 **Chat** — Type naturally to add/edit/delete events
- 📷 **Timetable scan** — Photo → automatic class schedule
- 🔴🟢 **Attendance** — Mark classes mandatory or optional
- 🔔 **Notifications** — Reminders before events
- 💾 **Saved data** — Events persist between sessions (localStorage)
- 📱 **Mobile-first** — Designed for phone use

---

## Troubleshooting

**"Password not working"** — Make sure you redeployed after adding the env variable

**"AI not responding"** — Check your Anthropic API key in Vercel env variables

**"Notifications not working"** — Tap "🔔 Reminders" in the app and allow notifications in your phone settings

---

Made with ❤️ using React + Claude AI
