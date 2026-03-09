# CollabPlatform — Developer Workflow Guide

A full-stack collaborative project management platform built with **Django + Django Channels** (backend) and **React 18** (frontend). It supports real-time group chat via WebSockets, project/task management, GitHub integration, notifications, and analytics.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Prerequisites](#3-prerequisites)
4. [Environment Setup](#4-environment-setup)
5. [Backend Setup & Workflow](#5-backend-setup--workflow)
6. [Frontend Setup & Workflow](#6-frontend-setup--workflow)
7. [Running the Full Stack](#7-running-the-full-stack)
8. [API Reference](#8-api-reference)
9. [WebSocket Protocol](#9-websocket-protocol)
10. [Authentication Flow](#10-authentication-flow)
11. [Key Feature Workflows](#11-key-feature-workflows)
12. [Database Migrations Workflow](#12-database-migrations-workflow)
13. [GitHub Integration Workflow](#13-github-integration-workflow)
14. [Development Tips & Conventions](#14-development-tips--conventions)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│          React 18 SPA  (port 3000)                  │
│   Axios REST calls ──────► /api/*                   │
│   WebSocket (ws://) ────► /ws/chat/<group_id>/      │
└────────────┬───────────────────────┬────────────────┘
             │ HTTP                  │ WebSocket
             ▼                       ▼
┌─────────────────────────────────────────────────────┐
│         Daphne ASGI Server  (port 8000)             │
│  ┌──────────────────┐   ┌─────────────────────────┐ │
│  │  Django REST API │   │  Django Channels        │ │
│  │  (DRF + JWT)     │   │  ChatConsumer (WS)      │ │
│  └──────────────────┘   └───────────┬─────────────┘ │
│                                     │               │
│                          In-Memory Channel Layer    │
│                         (Redis optional for prod)   │
└─────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│            SQLite (dev) / PostgreSQL (prod)         │
└─────────────────────────────────────────────────────┘
```

**Key technology choices:**

| Layer | Technology |
|---|---|
| Backend framework | Django 4.2, Django REST Framework |
| Real-time | Django Channels 4, Daphne ASGI, WebSockets |
| Auth | JWT (`djangorestframework-simplejwt`), django-allauth, GitHub OAuth |
| Frontend | React 18, React Router 6, Axios, Zustand, IndexedDB |
| Database | SQLite (default dev), PostgreSQL ready (`psycopg2-binary`) |
| Channel layer | In-Memory (dev) / Redis (prod) |

---

## 2. Project Structure

```
collab_platform/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── collab_platform/          # Django project config
│   │   ├── settings.py
│   │   ├── urls.py               # Root URL dispatcher
│   │   ├── asgi.py               # ASGI + WebSocket routing
│   │   └── wsgi.py
│   └── apps/
│       ├── users/                # Custom user model, auth views
│       ├── projects/             # Project CRUD, membership, join requests
│       ├── tasks/                # Task management per project
│       ├── communications/       # Groups, messages, WebSocket consumers
│       ├── notifications/        # In-app notification system
│       ├── github_integration/   # GitHub repo linking & commit sync
│       └── analytics/            # Project/user analytics endpoints
└── frontend/
    ├── package.json
    ├── public/
    └── src/
        ├── App.js                # Router & route definitions
        ├── context/AuthContext.js
        ├── hooks/useChatWebSocket.js   # WS connection hook
        ├── services/indexedDB.js       # Offline message cache
        ├── components/           # Reusable UI (Navbar, modals, panels)
        └── pages/                # Route-level page components
```

---

## 3. Prerequisites

| Tool | Minimum version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |
| Redis *(optional, dev uses in-memory)* | 6+ |

---

## 4. Environment Setup

### Backend `.env`

Create `collab_platform/backend/.env`:

```env
SECRET_KEY=your-very-secret-key-here
DEBUG=True

# Database (leave blank to use SQLite default)
DATABASE_URL=

# Redis (optional for dev; required for multi-instance / production)
REDIS_URL=redis://localhost:6379/0

# GitHub OAuth App credentials
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
```

> **Note:** Without `REDIS_URL` set to a running Redis instance, the Channel Layer falls back to `InMemoryChannelLayer` (single-process only — suitable for local development).

---

## 5. Backend Setup & Workflow

```bash
# 1. Navigate to backend directory
cd collab_platform/backend

# 2. Create and activate a virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Apply all migrations
python manage.py migrate

# 5. (Optional) Create a superuser for Django Admin
python manage.py createsuperuser

# 6. Start the development server (Daphne ASGI)
python manage.py runserver
```

The backend will be available at **http://localhost:8000**.

The Django Admin panel is at **http://localhost:8000/admin/**.

### Running with Daphne directly (recommended for WebSocket testing)

```bash
daphne -b 0.0.0.0 -p 8000 collab_platform.asgi:application
```

---

## 6. Frontend Setup & Workflow

```bash
# 1. Navigate to frontend directory
cd collab_platform/frontend

# 2. Install dependencies
npm install

# 3. Start the development server
npm start
```

The React app will be available at **http://localhost:3000**.

The `package.json` proxy setting forwards all `/api/*` and WebSocket requests to `http://localhost:8000`, so no CORS issues occur during development.

### Available scripts

| Script | Description |
|---|---|
| `npm start` | Start development server (hot-reload) |
| `npm run build` | Production build into `build/` |
| `npm test` | Run Jest tests |

---

## 7. Running the Full Stack

Open **two terminals** side by side:

**Terminal 1 — Backend**
```bash
cd collab_platform/backend
venv\Scripts\activate          # or: source venv/bin/activate
python manage.py runserver
```

**Terminal 2 — Frontend**
```bash
cd collab_platform/frontend
npm start
```

Navigate to **http://localhost:3000** in your browser.

---

## 8. API Reference

All REST endpoints are prefixed with `/api/`. JWT `Bearer` token required on protected endpoints.

### Users — `/api/users/`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/users/register/` | Register a new user |
| `POST` | `/api/users/login/` | Obtain JWT access + refresh tokens |
| `POST` | `/api/users/token/refresh/` | Refresh access token |
| `GET/PUT` | `/api/users/profile/<id>/` | View / update user profile |
| `GET` | `/api/users/search/` | Search users by username/email |

### Projects — `/api/projects/`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects/` | List all public projects |
| `POST` | `/api/projects/` | Create a new project |
| `GET/PUT/DELETE` | `/api/projects/<slug>/` | Project detail / update / delete |
| `POST` | `/api/projects/<slug>/join/` | Request to join a project |
| `POST` | `/api/projects/<slug>/join-requests/<id>/approve/` | Approve join request (owner) |
| `POST` | `/api/projects/<slug>/join-requests/<id>/reject/` | Reject join request (owner) |

### Tasks — `/api/tasks/`

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/tasks/` | List / create tasks |
| `GET/PUT/DELETE` | `/api/tasks/<id>/` | Task detail / update / delete |
| `PATCH` | `/api/tasks/<id>/` | Update task status or assignment |

### Communications — `/api/communications/`

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/communications/groups/` | List / create chat groups |
| `GET` | `/api/communications/groups/<id>/messages/` | Fetch message history |
| `POST` | `/api/communications/groups/<id>/members/` | Add a member to a group |

### Notifications — `/api/notifications/`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notifications/` | List user notifications |
| `PATCH` | `/api/notifications/<id>/read/` | Mark notification as read |
| `POST` | `/api/notifications/mark-all-read/` | Mark all as read |

### GitHub Integration — `/api/github/`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/github/connect/` | Link a GitHub repository to a project |
| `GET` | `/api/github/commits/<project_id>/` | Fetch synced commits |

### Analytics — `/api/analytics/`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics/project/<id>/` | Project activity analytics |
| `GET` | `/api/analytics/user/<id>/` | User contribution analytics |

---

## 9. WebSocket Protocol

WebSocket connections use JWT authentication via a custom `JwtAuthMiddlewareStack` that reads the token from the `Authorization` header or query parameter.

**Connection URL:**
```
ws://localhost:8000/ws/chat/<group_id>/
```

### Client → Server messages

```json
// Send a chat message
{ "type": "chat_message", "message": "Hello team!" }

// Typing indicator
{ "type": "typing", "is_typing": true }

// Mark messages as read
{ "type": "read_receipt", "message_id": 42 }
```

### Server → Client events

```json
// New message broadcast
{
  "type": "chat_message",
  "message": { "id": 42, "content": "Hello team!", "sender": {...}, "timestamp": "..." }
}

// Typing indicator
{ "type": "typing_indicator", "user_id": 5, "username": "alice", "is_typing": true }

// Member joined/left
{ "type": "member_update", "action": "joined", "user": {...} }
```

The `useChatWebSocket` hook (frontend) manages the connection lifecycle, automatic reconnect, and offline message queuing via **IndexedDB**.

---

## 10. Authentication Flow

```
User fills Login form
        │
        ▼
POST /api/users/login/
        │
        ▼
Server returns { access, refresh }
        │
        ▼
AuthContext stores tokens in localStorage
        │
        ├─► All Axios requests attach Authorization: Bearer <access>
        │
        └─► WebSocket connected with JWT for WS auth middleware
```

**Token lifetime:**
- Access token: **1 hour**
- Refresh token: **7 days** (rotated on each refresh, old token blacklisted)

**GitHub OAuth login** is available via `/accounts/github/login/` (handled by `django-allauth`). Configure a GitHub OAuth App with the callback URL: `http://localhost:8000/accounts/github/login/callback/`.

---

## 11. Key Feature Workflows

### Creating a Project

```
1. Authenticated user navigates to /projects/new
2. Fills CreateProject form (name, description, tech stack, visibility)
3. POST /api/projects/  →  project created with creator as owner
4. Redirect to /projects/<slug>
```

### Joining a Project

```
1. User browses /projects  →  finds a project  →  clicks "Request to Join"
2. POST /api/projects/<slug>/join/  →  JoinRequest created
3. Project owner receives an in-app notification
4. Owner visits project detail  →  opens Join Requests panel
5. Owner approves/rejects  →  POST .../join-requests/<id>/approve|reject/
6. New member added; requester receives notification
```

### Real-Time Group Chat

```
1. User navigates to /groups  →  selects or creates a group
2. GroupChat page mounts  →  useChatWebSocket hook opens WS connection
3. On connect: server sends recent message history
4. User types message  →  WS "chat_message" event sent
5. ChatConsumer broadcasts to all group members
6. Incoming messages rendered in real-time; stored in IndexedDB for offline access
7. Read receipts sent automatically when messages are visible
```

### Task Management

```
1. Project member navigates to project detail (/projects/<slug>)
2. Creates task: POST /api/tasks/ with project, title, description, assignee, due date
3. Assignee receives notification
4. Status updated via PATCH /api/tasks/<id>/  (todo → in_progress → done)
5. Activity logged for analytics
```

---

## 12. Database Migrations Workflow

```bash
# After modifying any models file:
python manage.py makemigrations <app_name>

# Apply pending migrations
python manage.py migrate

# Check migration state
python manage.py showmigrations

# Rollback to a specific migration
python manage.py migrate <app_name> <migration_number>
```

**App migration directories:**

| App | Path |
|---|---|
| users | `apps/users/migrations/` |
| projects | `apps/projects/migrations/` |
| tasks | `apps/tasks/migrations/` |
| communications | `apps/communications/migrations/` |
| notifications | `apps/notifications/migrations/` |
| github_integration | `apps/github_integration/migrations/` |
| analytics | `apps/analytics/migrations/` |

---

## 13. GitHub Integration Workflow

1. Create a **GitHub OAuth App** at [github.com/settings/developers](https://github.com/settings/developers)
   - Authorization callback URL: `http://localhost:8000/accounts/github/login/callback/`
2. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to your `.env` file
3. In the Django Admin → Social Applications → add a GitHub social application
4. Users can link their GitHub account via the Profile page
5. Project owners link a GitHub repository via the project detail page
6. The integration syncs commits (`GET /api/github/commits/<project_id>/`) and displays them in the project activity feed

---

## 14. Development Tips & Conventions

### Adding a new backend app

```bash
cd collab_platform/backend
python manage.py startapp <app_name> apps/<app_name>
```

Then add `'apps.<app_name>'` to `INSTALLED_APPS` in `settings.py` and register its URLs in `collab_platform/urls.py`.

### CORS

`CORS_ALLOW_ALL_ORIGINS = True` is set for development. For production, replace with an explicit `CORS_ALLOWED_ORIGINS` list.

### Channel Layer (Redis for production)

Replace the in-memory layer in `settings.py`:

```python
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': { 'hosts': [os.environ.get('REDIS_URL', 'redis://localhost:6379/0')] },
    }
}
```

### Code conventions

- Backend follows standard Django/DRF conventions; serializers live alongside views in each app.
- Frontend uses **React functional components** with hooks only (no class components).
- Global auth state is managed via `AuthContext`; local component state uses `useState`/`useReducer`; persistent chat state uses `Zustand` + IndexedDB.
- CSS is co-located with each component/page (e.g., `GroupChat.css` next to `GroupChat.js`).

### Useful management commands

```bash
# Reset the database (dev only)
python manage.py flush

# Open Django shell
python manage.py shell

# Collect static files (before deployment)
python manage.py collectstatic
```
