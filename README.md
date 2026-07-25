# Event-Driven GitHub Automation Bot MVP

This project is an Event-Driven GitHub Automation Bot built as a full-stack MVP. It connects your GitHub account, monitors repository events (such as issue opens and pull requests) via authenticated webhooks, evaluates automation rules, acts back on GitHub (auto-labeling, posting issue comments), and fires notifications directly to a Slack team channel.

A real-time observability dashboard allows you to track ingested events, inspect detailed execution action logs, and dynamically configure custom automation rules.

---

## 1. Core Architecture Overview

```
                          ┌──────────────────────────┐
                          │     User's Browser       │
                          └─────────────┬────────────┘
                                        │ (HTTPS)
                                        ▼
                          ┌──────────────────────────┐
                          │    Next.js Frontend      │
                          │   (Deployed on Vercel)   │
                          └─────────────┬────────────┘
                                        │ (API Proxy Rewrites)
                                        ▼
                          ┌──────────────────────────┐
                          │     FastAPI Backend      │◄─────── (HTTPS Webhook) ──────┐
                          │   (Deployed on Render)   │                               │
                          └──────┬───────────────┬───┘                               │
                                 │               │                                   │
                    (Read/Write) │               │ (Async In-Memory Queue)           │
                                 ▼               ▼                                   │
                       ┌───────────┐       ┌───────────┐                             │
                       │ Postgres  │       │Background │                             │
                       │  (Neon)   │       │   Tasks   │                             │
                       └───────────┘       └─────┬─────┘                             │
                                                 │                                   │
                                                 │ (Outbound API Writes)             │
                                                 ▼                                   │
                                           ┌───────────┐                       ┌─────┴─────┐
                                           │ Slack API │                       │GitHub App │
                                           └───────────┘                       └───────────┘
```

* **Backend (FastAPI)**: Asynchronous API utilizing Python 3.13 and SQLAlchemy 2.0. Dispatches background actions non-blockingly using FastAPI's built-in `BackgroundTasks` thread pool.
* **Database (PostgreSQL via Neon)**: Relational schema mapping users, connected repositories, dynamic rules, enqueued webhooks, and historical audit logs.
* **Frontend (Next.js)**: Modern user interface built using Next.js App Router and styled with Vanilla CSS Modules. Uses cookie-based session headers and proxies backend calls.
* **Observability & Security**: Enforces constant-time HMAC-SHA256 webhook signature validation and prevents duplicate actions (idempotency) by verifying delivery IDs and action-type constraints.

---

## 2. Key Features

1. **GitHub Sign-In (OAuth)**: Authenticate secure user profile ingestion and tokens encryption.
2. **Repository Manager**: List active GitHub repositories and toggle live webhook monitoring.
3. **Webhook Gateway**: Parse incoming deliveries, verify authenticity against database keys, and perform deduplication check.
4. **Dynamic Rule Engine**: Evaluate user-defined rule conditions (e.g. IF title contains "bug" THEN add "bug" label and trigger Slack alerts).
5. **Observability Log**: Inspect execution logs (`ActionLog` entries) tracing exact API calls, statuses, and exceptions.

---

## 3. Environment Variables Settings

Create a `.env` configuration file inside your `backend/` directory (see `backend/.env.example` for details):

```env
# Application Configuration
APP_NAME="GitHub Automation Bot"
APP_ENV=development  # development, staging, production
DEBUG=true

# Database Connection (Neon / Postgres)
DATABASE_URL="postgresql+asyncpg://<username>:<password>@<host>/<database>?sslmode=require"

# JWT Cookie Signing & AES-256 Fernet Symmetrical Encryption Key
SECRET_KEY="your-jwt-signing-key"
ENCRYPTION_KEY="your-base64-encoded-32-byte-fernet-key"

# GitHub integration credentials
GITHUB_CLIENT_ID="your_oauth_app_client_id"
GITHUB_CLIENT_SECRET="your_oauth_app_client_secret"
GITHUB_WEBHOOK_SECRET="your_global_hook_signing_secret"

# Callback Base URL (Ngrok tunnel or public host domain)
WEBHOOK_BASE_URL="http://localhost:8000"

# CORS Setup
BACKEND_CORS_ORIGINS='["http://localhost:3000"]'
```

---

## 4. Running Locally

### Step 1: Clone and Set Up Backend
Navigate to the backend directory, initialize a virtual environment, and install dependencies:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Generate your symmetrical Fernet encryption key and save it to `ENCRYPTION_KEY` inside your `.env`:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Apply database migrations:
```bash
alembic upgrade head
```

Start the API server:
```bash
uvicorn app.main:app --reload --port 8000
```

### Step 2: Set Up Frontend
Navigate to the frontend directory, install npm packages, and start the Next.js development server:
```bash
cd ../frontend
npm install
npm run dev
```

Open your browser and navigate to the dashboard landing page at `http://localhost:3000`.

---

## 5. Public Deployment Blueprint

### Database (Neon PostgreSQL)
* Create a free serverless PostgreSQL database on [Neon](https://neon.tech).
* Retrieve the database connection string and use it as `DATABASE_URL` (appending `?sslmode=require` and using `postgresql+asyncpg` driver).

### Backend (Render)
1. Register on [Render](https://render.com) and create a new **Web Service** connected to your GitHub repository.
2. Configure settings:
   * **Root Directory**: `backend`
   * **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add all your environment variables in the Render Dashboard Settings.
4. Execute `alembic upgrade head` in Render's web shell console to build tables.

### Frontend (Vercel)
1. Import your GitHub repository inside [Vercel](https://vercel.com).
2. Configure **Root Directory** as `frontend`.
3. Vercel automatically deploys the Next.js app. Next.js handles reverse proxy routing to your Render API backend dynamically via rewrites.

---

## 6. Local Webhook Testing Steps

1. Create a `payload.json` file representing a GitHub webhook event:
   ```json
   {
     "action": "opened",
     "issue": {
       "number": 42,
       "title": "Critical bug in login form",
       "body": "The app crashes when clicking the button."
     },
     "repository": {
       "name": "my-bot-repo",
       "owner": {
         "login": "octocat"
       },
       "full_name": "octocat/my-bot-repo"
     }
   }
   ```
2. Connect the repository details and copy its webhook secret using your API auth tokens.
3. Compute the signature of the payload using your secret:
   ```bash
   SIGNATURE=$(openssl dgst -sha256 -hmac "YOUR_WEBHOOK_SECRET_KEY" payload.json | awk '{print $2}')
   ```
4. Fire the test webhook to your FastAPI backend:
   ```bash
   curl -i -X POST \
     -H "Content-Type: application/json" \
     -H "X-GitHub-Event: issues" \
     -H "X-GitHub-Delivery: $(uuidgen)" \
     -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
     -d @payload.json \
     http://localhost:8000/api/v1/webhooks/github
   ```

---

## 7. User Interface Screenshots

### Landing & Authentication Page
![Landing Page UI Mockup](https://raw.githubusercontent.com/username/project/main/screenshots/landing.png)

### Telemetry Dashboard overview & live logs
![Dashboard Telemetry View Mockup](https://raw.githubusercontent.com/username/project/main/screenshots/dashboard.png)

### Repository Connections & Webhook toggles
![Connected Repos List Mockup](https://raw.githubusercontent.com/username/project/main/screenshots/repositories.png)

### Dynamic Rules Configurator
![Rules Form Mockup](https://raw.githubusercontent.com/username/project/main/screenshots/rules.png)
