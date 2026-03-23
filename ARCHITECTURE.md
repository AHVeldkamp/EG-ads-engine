# Architecture — EG-ads-engine

> Ad creative generation via Google Gemini + Meta campaign management for enduro-gear.nl

## Tech Stack

- **Runtime:** Node.js / TypeScript
- **Framework:** NestJS
- **Database:** PostgreSQL
- **ORM / Query Layer:** Prisma
- **Frontend:** None (API only)
- **Testing:** Jest

## Directory Structure

```
EG-ads-engine/
├── src/                            ← Main source code
│   ├── modules/                    ← Feature modules (one folder per feature)
│   │   └── [feature]/
│   │       ├── [feature].module.ts
│   │       ├── [feature].controller.ts
│   │       ├── [feature].service.ts
│   │       ├── [feature].dto.ts
│   │       └── [feature].entity.ts
│   ├── common/                     ← Shared code (guards, filters, interceptors, decorators)
│   ├── config/                     ← Configuration (env validation, config modules)
│   └── prisma/                     ← Prisma schema and migrations
├── test/                           ← Tests (protected — agents cannot modify)
│   ├── unit/                       ← Unit tests
│   ├── e2e/                        ← End-to-end tests
│   └── fixtures/                   ← Test fixtures and helpers
└── specs/                          ← NLSpec and interview files
```

## Module Structure

A typical feature module in this project follows this structure:

```
src/modules/[feature]/
├── [feature].module.ts             ← NestJS module registration
├── [feature].controller.ts         ← API endpoints
├── [feature].service.ts            ← Business logic
├── [feature].dto.ts                ← Data transfer objects / request schemas
├── [feature].entity.ts             ← Prisma model reference / domain entity
└── [feature].types.ts              ← Feature-specific TypeScript types (if needed)
```

## Patterns

### Authentication & Authorization
API keys only. Meta access tokens and Gemini API keys are stored as environment variables. No user-facing authentication — this is a single-tenant service for enduro-gear.nl.

### Error Handling
NestJS built-in exceptions (HttpException, BadRequestException, NotFoundException, etc.). The framework's global exception filter handles error responses automatically.

### Multi-Tenancy
Not applicable — single-tenant service for enduro-gear.nl.

### Logging
NestJS built-in Logger service. Each module uses `private readonly logger = new Logger(FeatureService.name)`.

### Module Registration
NestJS module system. Each feature module is registered in `app.module.ts` via the `@Module` decorator's `imports` array.

### Protected Files
- `test/` — All test files. Agents must never modify tests.

## Build & Test Commands

```bash
# Build
npm run build

# Lint
npm run lint

# Test
npm run test

# Test single feature
npx jest --testPathPattern="feature"
```

## Exemplar Module

None yet — first feature will establish the pattern.

## Conventions

- **File naming:** kebab-case for files (e.g., `ad-creative.service.ts`)
- **Class naming:** PascalCase (e.g., `AdCreativeService`)
- **Variable/function naming:** camelCase
- **Module structure:** One folder per feature under `src/modules/`
- **Imports:** Use NestJS dependency injection, avoid direct imports between modules
- **DTOs:** Use `class-validator` decorators for input validation
- **Config:** Use `@nestjs/config` with `.env` files, validated with Joi or class-validator
