# AI Collaboration & System Architecture Notes

This document details the AI tools used, architectural decisions, debugging pivots, and future improvements for the Event-Driven GitHub Automation Bot.

---

## 1. AI Tools Used

* **Gemini 1.5 Pro / Flash** & **Antigravity IDE Agent** (Primary coding assistants)
* **Claude / ChatGPT** (General design brainstorming and mock API reference)

---

## 2. Key Decisions

### Decision 1: FastAPI instead of Node.js
* **Rationale**: Python's type annotations, combined with FastAPI's automatic OpenAPI schema generation (via Pydantic v2), yield a highly typed, self-documenting API. FastAPI's native async capabilities handle high-concurrency webhook loads efficiently compared to traditional synchronous frameworks.

### Decision 2: FastAPI BackgroundTasks instead of Celery + Redis
* **Rationale**: The AI initially suggested a complex Celery + Redis architecture to manage task scheduling. For an MVP running on free public hosts (Render, Neon), setting up and configuring a separate Redis broker and Celery worker adds significant deployment complexity and resource overhead. Slicing the design down to FastAPI's built-in `BackgroundTasks` executes automation scripts asynchronously in the background while keeping the infrastructure completely flat and zero-cost.

### Decision 3: Neon PostgreSQL instead of Supabase
* **Rationale**: Supabase provides a heavy Backend-as-a-Service (BaaS) abstraction. For this bot, we needed a thin, high-performance relational database layer coupled with custom backend logic. Neon provides a serverless PostgreSQL database with an excellent, no-card free tier that integrates natively with SQLAlchemy 2.0 and Alembic migrations.

---

## 3. Biggest AI Mistake & Resolution

### The Mistake
During the scaffolding phase, the AI proposed a standard Pydantic configuration expecting a strict list representation (`List[str]`) for the `BACKEND_CORS_ORIGINS` environment variable. However, environment variable loaders (such as `pydantic-settings`) pull data from `.env` files as raw string literals. Consequently, the server crashed immediately on startup with a critical `ValidationError`.

### How We Fixed It
Instead of abandoning strict types or reverting to manual string splits across the codebase, we resolved the issue cleanly by introducing a custom Pydantic `@field_validator` (or `@before_validator`) utility called `parse_cors`:

```python
def parse_cors(v: Union[str, List[str]]) -> List[str]:
    if isinstance(v, str):
        if not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return [v.strip()]
    return v
```

This utility automatically detects and parses both comma-separated strings and native JSON arrays, ensuring robust configuration ingestion and preventing startup failures.

---

## 4. Future Improvements

1. **GitHub App Authentication**: Upgrade from static user OAuth tokens to GitHub App JWT keys, which are exchanged dynamically for installation tokens to support short-lived tokens and granular permissions.
2. **Dedicated Task Queue**: Migrate backend processing to Celery + Redis if webhook execution volumes scale beyond single-instance memory thresholds or require advanced retry scheduling.
3. **AI Issue Triage (Gemini API Integration)**: Pipe incoming issue strings through the Gemini API to auto-summarize descriptions, predict priorities, and suggest triage labels dynamically before posting back to GitHub.
4. **Multi-Repository Config Panel**: Expand the dashboard UI to support multi-repo switching, allowing users to define distinct conditional rule sets tailored to individual codebases.

---

## 5. AI Context / Instruction Files

* **Status**: No custom AI context or instruction files (such as `CLAUDE.md`, `AGENTS.md`, or `.cursorrules`) were used for this project. All context engineering and architectural constraints were managed directly via targeted interactive prompting.

---

## 6. Systems-Level Engineering & AI Collaboration Depth

Rather than treating the AI as an autocomplete engine or copy-pasting bulk boilerplate, our collaboration functioned as a tightly coupled principal-engineer/architect design loop. Three key highlights demonstrate the depth of this engineering process:

### 1. Cryptographic State Recovery (Key Rotation Protection)

* **The Situation:** During a container rebuild/restart on the hosting platform, the AI inadvertently generated a fresh Fernet `ENCRYPTION_KEY`. In a naive deployment, this would have permanently orphaned all active GitHub OAuth access tokens stored encrypted in the database, breaking user sessions and requiring forced re-authentication.
* **Our Collaborative Fix:** We diagnosed the decryption failures, traced the system logs, isolated the cryptographic mismatch, and synchronized the environment variables with the persistent key material. This preserved database state integrity and established a blueprint for secure key management.

### 2. Resolving Webhook Infrastructure Routing Gaps

* **The Situation:** Following deployment, the bot on Render was silently failing to receive automated GitHub webhook payloads. The AI initially assumed code-level routing errors.
* **Our Collaborative Fix:** We systematically reviewed the webhook payload registration logs and discovered that the system was capturing and registering a stale local `ngrok` tunnel interface as the callback destination. We patched the registration client logic to dynamically read the live public host domain name from the runtime configuration, establishing reliable edge-to-edge connectivity.

### 3. Defensive Webhook Architecture Design

Many webhook consumers struggle with network flakiness and duplicate delivery stress. Together with the AI, we engineered a multi-tier resilience pattern explicitly tailored to satisfy the job's strict quality requirements:

* **Strict Event Deduplication:** Evaluates unique delivery identifier headers (`X-GitHub-Delivery`) to guarantee that incoming payloads are parsed exactly once.
* **Action-Level Idempotency:** Implemented transaction state checks prior to execution, preventing duplicate GitHub labels or redundant Slack pings if GitHub retries an already completed request thread.
* **Graceful Failure Degradation:** Isolated third-party API dependencies (e.g., Slack Incoming Webhooks) inside distinct, wrapped execution context handles. If a downstream notification provider faces a temporary outage, the primary GitHub API commenting loop continues to execute uninterrupted, preventing partial failure cascades.
