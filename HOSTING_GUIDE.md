# Comprehensive Hosting & Deployment Guide

This repository contains a full-stack **Event-Driven GitHub Automation Bot** composed of:
- **Frontend**: Next.js 14 App (React, Tailwind/Vanilla CSS)
- **Backend**: FastAPI (Python 3.11/3.13, SQLAlchemy Async, Alembic)
- **Database**: PostgreSQL (Neon, Render, Supabase, or local container)

---

## Option 1: Managed Cloud Services (Recommended - Free / Low Cost)

### Step 1: Database Setup (Neon PostgreSQL)
1. Sign up for a free PostgreSQL database at [Neon.tech](https://neon.tech).
2. Create a new database named `github_automation`.
3. Copy your connection string. It will look like:
   `postgresql://username:password@ep-xyz.region.aws.neon.tech/github_automation?sslmode=require`
4. Update the prefix to use the async driver:
   `postgresql+asyncpg://username:password@ep-xyz.region.aws.neon.tech/github_automation?sslmode=require`

### Step 2: Backend Deployment (Render.com)
1. Push your repository to GitHub.
2. Sign in to [Render.com](https://render.com) and click **New > Web Service** (or use Blueprints with `render.yaml`).
3. Connect your repository and configure:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. In **Environment Variables**, add:
   - `DATABASE_URL`: *(Your Neon PostgreSQL async connection string)*
   - `APP_ENV`: `production`
   - `DEBUG`: `false`
   - `SECRET_KEY`: *(Generate a secure random string)*
   - `ENCRYPTION_KEY`: *(Generate a 32-byte Fernet key via `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`) *
   - `GITHUB_CLIENT_ID`: *(Your GitHub OAuth App Client ID)*
   - `GITHUB_CLIENT_SECRET`: *(Your GitHub OAuth App Client Secret)*
   - `GITHUB_WEBHOOK_SECRET`: *(Your GitHub Webhook Secret)*
   - `WEBHOOK_BASE_URL`: `https://your-backend.onrender.com`
   - `BACKEND_CORS_ORIGINS`: `["https://your-frontend.vercel.app"]`
5. Click **Deploy**. Note down your backend URL (e.g. `https://github-bot-backend.onrender.com`).

### Step 3: Frontend Deployment (Vercel)
1. Sign in to [Vercel.com](https://vercel.com) and click **Add New > Project**.
2. Import your GitHub repository.
3. Set **Root Directory** to `frontend`.
4. Add Environment Variable:
   - `BACKEND_URL`: `https://github-bot-backend.onrender.com`
5. Click **Deploy**. Note down your frontend domain (e.g., `https://github-bot.vercel.app`).

---

## Option 2: Single-Server Containerized Hosting (Docker Compose)

If hosting on a Virtual Private Server (VPS) such as DigitalOcean, AWS EC2, Hetzner, or Linode:

1. Clone the repository onto your server.
2. Create a `.env` file in the project root:
   ```env
   SECRET_KEY=generate_your_jwt_secret_key
   ENCRYPTION_KEY=generate_your_fernet_key
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
   WEBHOOK_BASE_URL=https://your-domain.com
   ```
3. Run:
   ```bash
   docker-compose up -d --build
   ```
4. Access your application at `http://<your-server-ip>:3000`.

---

## Option 3: Quick Local Tunnel for Live Webhook Testing (Ngrok)

To host locally while allowing GitHub to deliver live webhooks:

1. Start local backend and frontend services:
   ```bash
   # Terminal 1 - Backend
   cd backend && python3 -m uvicorn app.main:app --reload --port 8000

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```
2. Start an Ngrok tunnel:
   ```bash
   ngrok http 8000
   ```
3. Copy the HTTPS URL provided by Ngrok (e.g., `https://a1b2c3d4.ngrok-free.app`) and set it as `WEBHOOK_BASE_URL` in `backend/.env`.

---

## Post-Deployment GitHub App Configuration

In your GitHub Developer Settings (OAuth App / GitHub App):
- **Homepage URL**: Set to your frontend domain (e.g. `https://github-bot.vercel.app`)
- **Authorization Callback URL**: Set to `https://github-bot.vercel.app/api/v1/auth/github/callback` (or your backend domain `/api/v1/auth/github/callback` if direct)
- **Webhook Payload URL**: Set to `https://github-bot-backend.onrender.com/api/v1/webhooks/github`
