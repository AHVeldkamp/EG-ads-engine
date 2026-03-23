# NLSpec: project-scaffold
# Version: 1.0
# Date: 2026-03-23
# Source: specs/INTERVIEW_project-scaffold.md

## 1. Context

### 1.1 Problem Statement
The EG-ads-engine project has no application code yet — only NLSpec workflow
configuration files (CLAUDE.md, ARCHITECTURE.md, specs/). A working NestJS
project skeleton is needed before any feature (creative-generation, meta-campaigns,
ad-pipeline) can be built.

### 1.2 Prior Art
No existing code. This is the first implementation in the repository. The
ARCHITECTURE.md defines the target conventions that this scaffold must establish.

### 1.3 Scope

**IN scope:**
- `package.json` with all NestJS, Prisma, and tooling dependencies
- `tsconfig.json` and `tsconfig.build.json` for TypeScript compilation
- NestJS application bootstrap (`src/main.ts`, `src/app.module.ts`)
- Prisma setup (`prisma/schema.prisma` with PostgreSQL datasource)
- Configuration module using `@nestjs/config` with Joi env validation
- Health endpoint: `GET /api/v1/health` with database connectivity check
- Docker Compose file for local PostgreSQL 16
- `.env.example` with all environment variables documented
- ESLint + Prettier configuration
- Jest configuration (config only, no test files — tests are protected)
- `.gitignore` for Node.js/NestJS project
- `nest-cli.json` for NestJS CLI configuration

**OUT of scope — do NOT implement:**
- Business logic or feature modules (no `src/modules/` content beyond health)
- Meta Marketing API integration
- Google Gemini API integration
- Test files (the `test/` directory is protected — agents must not create or modify tests)
- CI/CD pipelines
- Dockerfile for production deployment
- API documentation (Swagger/OpenAPI)
- Authentication guards or middleware
- Database seed scripts

## 2. Architecture

### 2.1 New Files

```
# Project root configuration
package.json
tsconfig.json
tsconfig.build.json
nest-cli.json
.eslintrc.js
.prettierrc
.gitignore
.env.example
docker-compose.yml

# Prisma
prisma/schema.prisma

# Application source
src/main.ts
src/app.module.ts
src/app.controller.ts
src/app.service.ts

# Configuration module
src/config/config.module.ts
src/config/env.validation.ts
```

### 2.2 Modified Files
None — greenfield project, no existing files to modify.

### 2.3 Module Registration
`AppModule` is the root module. It imports:
- `ConfigModule.forRoot(...)` — global config with env validation
- `PrismaModule` is NOT needed as a separate module for the scaffold. Instead,
  `AppService` creates a `PrismaClient` instance directly for the health check.
  A shared `PrismaModule` will be introduced when the first feature module needs
  database access.

### 2.4 Dependencies

**Production dependencies:**
- `@nestjs/common` — NestJS core decorators and utilities
- `@nestjs/core` — NestJS application core
- `@nestjs/platform-express` — Express HTTP adapter for NestJS
- `@nestjs/config` — Configuration module with env file loading
- `@prisma/client` — Prisma database client
- `joi` — Schema validation for environment variables
- `reflect-metadata` — Required by NestJS decorators
- `rxjs` — Required by NestJS (Observable support)

**Dev dependencies:**
- `@nestjs/cli` — NestJS CLI for build and generate commands
- `@nestjs/schematics` — NestJS code generation schematics
- `@nestjs/testing` — NestJS testing utilities
- `prisma` — Prisma CLI for migrations and schema management
- `typescript` — TypeScript compiler
- `@types/node` — Node.js type definitions
- `@types/jest` — Jest type definitions
- `@types/express` — Express type definitions
- `ts-jest` — TypeScript preprocessor for Jest
- `jest` — Testing framework
- `ts-node` — TypeScript execution for development
- `tsconfig-paths` — Path alias resolution
- `eslint` — Linting
- `@typescript-eslint/eslint-plugin` — TypeScript ESLint rules
- `@typescript-eslint/parser` — TypeScript ESLint parser
- `eslint-config-prettier` — Disable ESLint rules that conflict with Prettier
- `eslint-plugin-prettier` — Run Prettier as an ESLint rule
- `prettier` — Code formatting
- `source-map-support` — Source map support for debugging

**Does NOT use:**
- `class-validator` / `class-transformer` — Not needed until feature modules with DTOs
- `@nestjs/swagger` — No API documentation in scaffold
- `@nestjs/passport` / `passport` — No authentication in scaffold
- `facebook-nodejs-business-sdk` — Meta integration is a separate feature
- `@google/generative-ai` — Gemini integration is a separate feature

## 3. Data Model

### 3.1 Entity / Model
No application data models in the scaffold. The Prisma schema defines only the
datasource and generator configuration — no `model` blocks.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Models will be added by feature specs (creative-generation, meta-campaigns, etc.).

### 3.2 DTOs / Request Schemas
None — no endpoints that accept request bodies.

### 3.3 Enums / Constants
None.

## 4. API Endpoints

### 4.1 GET /api/v1/health

- **Purpose:** Verify the application is running and the database is reachable.
- **Auth:** None — health endpoints are public.
- **Path/Query Parameters:** None.
- **Request Body:** None.
- **Success Response (200):**
```json
{
  "status": "ok",
  "database": "connected",
  "uptime": 42.7
}
```
Where:
  - `status`: always `"ok"` if the server responds
  - `database`: `"connected"` if Prisma can execute `SELECT 1`, `"disconnected"` if the query fails
  - `uptime`: process uptime in seconds (floating point, from `process.uptime()`)

- **Error Responses:**
  The health endpoint itself does NOT return error status codes. If the database is
  unreachable, it still returns HTTP 200 with `"database": "disconnected"`. The
  purpose is observability, not gating — a monitoring system reads the `database`
  field to alert, but the endpoint itself always succeeds if the app is running.

  | Scenario | Status | Response |
  |----------|--------|----------|
  | App running, DB connected | 200 | `{ "status": "ok", "database": "connected", "uptime": 42.7 }` |
  | App running, DB unreachable | 200 | `{ "status": "ok", "database": "disconnected", "uptime": 42.7 }` |
  | App not running | Connection refused (no HTTP response) | N/A |

- **Side Effects:** None — read-only diagnostic.
- **Security Notes:** No sensitive data exposed. Uptime is safe to share publicly.

## 5. Business Logic

### 5.1 Core Flow
1. On application bootstrap (`main.ts`):
   a. Create NestJS application with `NestFactory.create(AppModule)`
   b. Set global prefix `api/v1`
   c. Enable CORS (no restrictions for development — tighten later)
   d. Read `PORT` from config, default to `3000`
   e. Start listening on `0.0.0.0:${PORT}`
   f. Log: `"Application running on http://localhost:${PORT}/api/v1"`

2. On `GET /api/v1/health`:
   a. `AppController.getHealth()` calls `AppService.getHealth()`
   b. `AppService` executes `prismaClient.$queryRaw\`SELECT 1\`` inside a try/catch
   c. If query succeeds → `database: "connected"`
   d. If query throws → `database: "disconnected"` (catch, do NOT rethrow)
   e. Return `{ status: "ok", database, uptime: process.uptime() }`

### 5.2 External Service Interactions
None — this module works entirely with local infrastructure.

### 5.3 Multi-Tenancy / Tenant Isolation
Not applicable — single-tenant service.

## 6. Exemplars

### 6.1 Reference Module
No existing modules to reference — this scaffold establishes the patterns.

### 6.2 What to Replicate
Follow standard NestJS project structure as generated by `@nestjs/cli` version 10.x,
with these customizations:
- Global prefix `api/v1`
- `@nestjs/config` with Joi validation (not the default plain config)
- Prisma instead of TypeORM

### 6.3 What NOT to Replicate
- Do NOT use the NestJS CLI `nest new` generator directly — it produces a simpler
  setup without config validation, Prisma, or Docker Compose.

## 7. Constraints

### 7.1 Forbidden Approaches
- Do NOT use `dotenv` directly — use `@nestjs/config` which wraps it with validation.
- Do NOT create a `PrismaModule` or `PrismaService` in this scaffold — that belongs
  in the first feature that needs shared database access. The health check uses a
  local `PrismaClient` instance in `AppService`.
- Do NOT add `class-validator` or `class-transformer` — no DTOs in the scaffold.
- Do NOT create any files inside `test/` — this directory is protected.
- Do NOT create `src/modules/` directory — it will be created by the first feature module.
- Do NOT add Swagger/OpenAPI decorators or setup.
- Do NOT add a `Dockerfile` — production deployment is out of scope.

### 7.2 Error Handling
The health endpoint catches database connection errors internally and returns a
degraded response (`"database": "disconnected"`). It does NOT throw exceptions.

For unhandled errors elsewhere, rely on NestJS's built-in global exception filter
which returns standard error responses.

### 7.3 Logging
Use NestJS built-in `Logger`:
- `main.ts`: Use `Logger` instance for bootstrap messages (INFO level)
- `AppService`: Use `Logger` for database connectivity warnings (WARN level when
  database is unreachable on health check)

### 7.4 Protected Files
- `test/**` — Do NOT create, modify, or delete any files in the test directory.

## 8. Frontend Impact

### Verdict C — "Frontend not required"
- **Why not needed:** This is backend infrastructure scaffolding. It sets up the
  project skeleton, configuration, and a diagnostic health endpoint. There is no
  user-facing functionality.
- **End-to-end usability confirmed:** A developer can verify the scaffold works
  by running `docker compose up -d`, `npm run start:dev`, and
  `curl http://localhost:3000/api/v1/health`.

## 9. Acceptance Criteria

### 9.1 Functional
- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles TypeScript without errors
- [ ] `npm run lint` passes with zero errors and zero warnings
- [ ] `docker compose up -d` starts a PostgreSQL 16 container
- [ ] `npm run start:dev` boots the NestJS application without errors
- [ ] `GET /api/v1/health` returns HTTP 200 with `{ "status": "ok", "database": "connected", "uptime": <number> }`
- [ ] When PostgreSQL is stopped, `GET /api/v1/health` returns HTTP 200 with `{ "status": "ok", "database": "disconnected", "uptime": <number> }`
- [ ] `.env.example` contains all 7 environment variables: DATABASE_URL, PORT, NODE_ENV, META_ACCESS_TOKEN, META_APP_ID, META_APP_SECRET, GEMINI_API_KEY
- [ ] `prisma/schema.prisma` has PostgreSQL datasource with `env("DATABASE_URL")`
- [ ] Environment variables are validated on startup via Joi — app refuses to start if required vars are missing

### 9.2 Tenant Isolation
Not applicable — single-tenant service.

### 9.3 Structural
- [ ] Files in correct directories per ARCHITECTURE.md
- [ ] `AppModule` imports `ConfigModule.forRoot(...)` with global flag
- [ ] No `src/modules/` directory created
- [ ] No files created inside `test/`
- [ ] No new dependencies beyond those listed in Section 2.4
- [ ] No `console.log` statements — use NestJS `Logger`
- [ ] No existing protected files modified
- [ ] `.gitignore` includes: `node_modules/`, `dist/`, `.env`, `*.js.map`, `prisma/*.db`

### 9.4 Build
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (Jest runs with zero tests, exits cleanly)

## 10. Configuration Details

### 10.1 package.json scripts
```json
{
  "build": "nest build",
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:debug": "nest start --debug --watch",
  "start:prod": "node dist/main",
  "lint": "eslint \"{src,apps,libs}/**/*.ts\"",
  "format": "prettier --write \"src/**/*.ts\"",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "test:e2e": "jest --config ./test/jest-e2e.json",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:studio": "prisma studio"
}
```

### 10.2 tsconfig.json
Standard NestJS tsconfig:
- `target`: `"ES2021"`
- `module`: `"commonjs"`
- `strict`: `true`
- `esModuleInterop`: `true`
- `emitDecoratorMetadata`: `true`
- `experimentalDecorators`: `true`
- `outDir`: `"./dist"`
- `rootDir`: `"./src"`
- `baseUrl`: `"."`
- `paths`: `{ "@/*": ["src/*"] }`

### 10.3 Environment Validation (Joi schema)
```
DATABASE_URL: string, required
PORT: number, optional, default 3000
NODE_ENV: string, valid("development", "production", "test"), default "development"
META_ACCESS_TOKEN: string, optional (not used by scaffold, but validated when present)
META_APP_ID: string, optional
META_APP_SECRET: string, optional
GEMINI_API_KEY: string, optional
```

Only `DATABASE_URL` is required for the scaffold. The Meta and Gemini keys are
optional — they will become required when their respective feature modules are built.

### 10.4 Docker Compose
```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: egads
      POSTGRES_PASSWORD: egads_dev
      POSTGRES_DB: egads_engine
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Matching `.env.example` DATABASE_URL: `postgresql://egads:egads_dev@localhost:5432/egads_engine`

### 10.5 .env.example
```env
# Database
DATABASE_URL="postgresql://egads:egads_dev@localhost:5432/egads_engine"

# Application
PORT=3000
NODE_ENV=development

# Meta Marketing API (required for meta-campaigns feature)
META_ACCESS_TOKEN=
META_APP_ID=
META_APP_SECRET=

# Google Gemini (required for creative-generation feature)
GEMINI_API_KEY=
```
