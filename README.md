# Task App Backend

This repository contains the backend for the Task App project. It provides REST APIs for task management including creating, updating, deleting, and listing tasks with user authentication.

## Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Hashing**: bcryptjs

## Setup

### Prerequisites

- Node.js (v20+ recommended)
- PostgreSQL (v15+)
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/<your-user>/task-app-backend.git
   cd task-app-backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file from `.env.example` and fill in your values:

   ```bash
   cp .env.example .env
   ```

   **Important environment variables:**
   - `DATABASE_URL`: PostgreSQL connection string
   - `JWT_SECRET`: Secret key for JWT signing (use a strong random string)
   - `PORT`: Server port (default: 8000)

4. Start the development server:

   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:8000`

## Build & Deployment

### Build for Production

```bash
npm run build
npm start
```

### Using Docker

1. Build the image:

   ```bash
   docker build -t task-backend .
   ```

2. Run the container (ensure PostgreSQL is running):

   ```bash
   docker run -p 8000:8000 \
     -e DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
     -e JWT_SECRET="your-secret-key" \
     task-backend
   ```

### Using Docker Compose

```bash
docker-compose up --build
```

Ensure `.env` or environment variables are set before running.

### Deploying to Heroku

1. Create a Heroku app:

   ```bash
   heroku create your-app-name
   ```

2. Set environment variables:

   ```bash
   heroku config:set DATABASE_URL="your-postgres-url"
   heroku config:set JWT_SECRET="your-jwt-secret"
   ```

3. Deploy:

   ```bash
   git push heroku main
   ```

## Environment Variables (Required for Deployment)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/task_db` |
| `JWT_SECRET` | Secret key for JWT signing | `your-super-secret-32-char-minimum-key` |
| `PORT` | Server port | `8000` |
| `DB_USER` | Database user (optional) | `postgres` |
| `DB_PASSWORD` | Database password (optional) | `password` |
| `DB_NAME` | Database name (optional) | `task_db` |

## API Endpoints

### Authentication

- `POST /auth/signup` - Register a new user
- `POST /auth/login` - Login user
- `POST /auth/tokenIsValid` - Verify JWT token

### Tasks

- `GET /tasks` - Get all tasks (requires auth)
- `POST /tasks` - Create a new task (requires auth)
- `PUT /tasks/:taskId` - Update a task (requires auth)
- `DELETE /tasks/:taskId` - Delete a task (requires auth)
- `POST /tasks/sync` - Sync offline tasks (requires auth)

## License

MIT License
