# Multi-Stream Rotating Alerts

One elegant widget for **Twitch + Kick + YouTube**  
Shows latest: Follower/Sub per platform → rotates every **7s**

---

## Setup (5 mins)

1. **Click "Use this template"** → Create repo
2. Go to **Settings > Secrets and variables > Actions**
3. Add these secrets:
   - `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_USER_ID`
   - `YOUTUBE_API_KEY`, `YOUTUBE_LIVE_CHAT_ID`
   - `WEBHOOK_SECRET` (random 32 chars)
4. Go to [Render.com](https://render.com) → New Web Service → Connect your GitHub repo
5. Deploy → Done!

---

## OBS Setup

Add **Browser Source**:
