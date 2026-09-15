# 🚀 Deploying LexiRead to Render (Free Tier)

This guide walks you through deploying the full stack (Flask backend + React frontend +
Postgres database) entirely on **Render's free tier** with HTTPS handled automatically.

---

## Prerequisites

- A [GitHub](https://github.com) account (code must be in a GitHub repo)
- A [Render](https://render.com) account (free, no credit card required)
- A [Groq](https://console.groq.com) account (free API key)
- Optionally, a [Sentry](https://sentry.io) account (free, for error monitoring)

---

## Step 1 — Push your code to GitHub

```bash
git add .
git commit -m "Production ready"
git push origin main
```

---

## Step 2 — Create a Postgres Database on Render

1. Go to [render.com](https://render.com) → **New** → **PostgreSQL**
2. Name: `lexiread-db`
3. Plan: **Free**
4. Click **Create Database**
5. Copy the **Internal Database URL** (starts with `postgresql://`) — you'll need it in Step 4

> **Note:** Render's free Postgres database **expires after 90 days**. Upgrade to the $7/month
> plan for a persistent database, or use [Supabase](https://supabase.com) or [Neon](https://neon.tech)
> for a permanently free Postgres database.

---

## Step 3 — Deploy the Backend (Flask)

1. Go to **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   | Field | Value |
   |---|---|
   | **Name** | `lexiread-backend` |
   | **Root Directory** | `backend` |
   | **Runtime** | `Docker` |
   | **Plan** | Free |

4. Under **Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `APP_ENV` | `production` |
   | `JWT_SECRET_KEY` | *(generate: `python -c "import secrets; print(secrets.token_hex(32))"`)* |
   | `DATABASE_URL` | *(paste Internal Database URL from Step 2)* |
   | `GROQ_API_KEY` | *(your key from https://console.groq.com/keys)* |
   | `GROQ_MODEL` | `openai/gpt-oss-120b` |
   | `ALLOWED_ORIGINS` | *(leave blank for now — fill in after Step 4)* |
   | `SENTRY_DSN` | *(optional — from https://sentry.io)* |
   | `FLASK_DEBUG` | `false` |

5. Click **Deploy** — wait for it to go green ✅
6. Copy your backend URL: `https://lexiread-backend.onrender.com`

---

## Step 4 — Deploy the Frontend (React)

1. Go to **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   | Field | Value |
   |---|---|
   | **Name** | `lexiread-frontend` |
   | **Root Directory** | `frontend` |
   | **Runtime** | `Docker` |
   | **Plan** | Free |

4. Under **Environment Variables** → **Build Args**, add:

   | Key | Value |
   |---|---|
   | `REACT_APP_API_URL` | `https://lexiread-backend.onrender.com` *(your backend URL)* |
   | `REACT_APP_SENTRY_DSN` | *(optional — from https://sentry.io)* |

5. Click **Deploy** — wait for it to go green ✅
6. Copy your frontend URL: `https://lexiread-frontend.onrender.com`

---

## Step 5 — Update ALLOWED_ORIGINS in the Backend

1. Go back to your **backend** service on Render
2. **Environment** → update `ALLOWED_ORIGINS`:
   ```
   https://lexiread-frontend.onrender.com
   ```
3. Click **Save Changes** — Render will auto-redeploy

---

## Step 6 — Verify Everything Works

Open your frontend URL in the browser and test:

- [ ] Create a new profile (sign up)
- [ ] Log in with the profile
- [ ] Upload an image with text — verify OCR extracts text
- [ ] Click "Simplify" — verify AI simplification works
- [ ] Click "Generate Quiz" — verify quiz is created
- [ ] Log out and log back in
- [ ] Close the tab and reopen — verify session persists

---

## Troubleshooting

### Backend fails to start
- Check **Logs** tab on Render — look for the startup error message
- Most common cause: `GROQ_API_KEY` or `JWT_SECRET_KEY` not set in production env vars

### Frontend shows "No response from server"
- `REACT_APP_API_URL` is wrong — it must point to your Render backend URL
- The value is **baked at build time** — you must trigger a redeploy after changing it

### OCR not working
- The Tesseract system packages are installed in the backend Dockerfile — this is correct
- Check backend logs for `Tesseract executable` lines

### Free tier cold starts
- Render's free tier **spins down** services after 15 minutes of inactivity
- The first request after a cold start can take **30-60 seconds**
- This is normal on free tier — upgrade to a paid plan to avoid this

---

## Alternative Free Hosting Options

| Platform | Backend | Frontend | Database |
|---|---|---|---|
| **Railway** | ✅ Docker | ✅ Docker | ✅ Postgres (free $5 credit) |
| **Fly.io** | ✅ Docker | ✅ Docker | ✅ Postgres |
| **Supabase** | ❌ | ❌ | ✅ Postgres (permanently free) |
| **Vercel** | ❌ Flask | ✅ React | ❌ |
| **Netlify** | ❌ Flask | ✅ React | ❌ |

> **Recommended combo for 100% free:** Render (backend) + Render (frontend) + Neon/Supabase (database)
