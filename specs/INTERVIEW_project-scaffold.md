# Interview — project-scaffold

## Round 1: Scope & Purpose

**What problem does this solve?**
Sets up the foundational NestJS project skeleton so all future features (creative-generation, meta-campaigns, ad-pipeline) have a working codebase to build on.

**What's IN scope?**
Full scaffold: package.json, tsconfig, NestJS app module, Prisma setup with PostgreSQL, config module with env validation, health endpoint with DB check, Docker Compose for PostgreSQL, .env.example, ESLint + Prettier, Jest config.

**What's OUT of scope?**
No business logic, no feature modules, no Meta/Gemini API integration, no tests beyond what NestJS generates by default. Just the project skeleton.

**Backend-only, frontend-only, or both?**
Backend-only. API-only service, no frontend.

## Round 2: Data & Configuration

**Node.js version:** Node 20 LTS (engines field in package.json).

**Environment variables (.env.example):**
- `DATABASE_URL` — PostgreSQL connection string (Prisma)
- `PORT` — App port (default: 3000)
- `NODE_ENV` — development / production / test
- `META_ACCESS_TOKEN` — Meta Marketing API access token
- `META_APP_ID` — Meta App ID
- `META_APP_SECRET` — Meta App Secret
- `GEMINI_API_KEY` — Google Gemini API key

**Database:** PostgreSQL 16 via Docker Compose. Prisma as ORM.

## Round 3: User Experience

**Health endpoint:** GET /api/v1/health returns:
```json
{
  "status": "ok",
  "database": "connected" | "disconnected",
  "uptime": <seconds>
}
```
Checks Prisma connection to verify database is reachable.

**API prefix:** Global prefix `/api/v1` on all endpoints.

## Round 4: Integration & Edge Cases

**Local database:** Docker Compose with PostgreSQL 16. Developer runs `docker compose up -d` to start.

**App port:** 3000 (configurable via PORT env var).

**No external API integration in the scaffold.** Meta and Gemini connections are separate features.

## Round 5: Frontend Impact

**Frontend: Not required.** This is purely backend infrastructure. A developer can use this end-to-end (start the app, hit the health endpoint via curl/Postman) without any UI.

## Round 6: Verification

Manual verification steps:
1. `npm install` succeeds without errors
2. `npm run build` compiles TypeScript without errors
3. `npm run lint` passes with no warnings
4. `docker compose up -d` starts PostgreSQL container
5. `npm run start:dev` boots the NestJS app
6. `GET /api/v1/health` returns HTTP 200 with `{ status: "ok", database: "connected", uptime: <number> }`
