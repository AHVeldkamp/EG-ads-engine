# NLSpec: Meta Access Token Auto-Refresh

## 1. Problem

Meta short-lived User Access Tokens expire after ~1-2 hours. When the token expires, all Meta API calls (campaign creation, ad publishing, image uploads) fail with "Session has expired". Currently the user must manually generate a new token in the Facebook developer portal and update it — this breaks autonomous operation.

## 2. Goal

Ensure the EG-ads-engine always has a valid Meta access token without manual intervention.

## 3. How Meta Token Exchange Works

Meta provides a token exchange flow:

1. **Short-lived token** (1-2 hours) — generated in Graph API Explorer or via login
2. **Long-lived token** (60 days) — exchanged from a short-lived token using:
   ```
   GET /oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={app-id}
     &client_secret={app-secret}
     &fb_exchange_token={short-lived-token}
   ```
3. **Refresh** — a long-lived token can be refreshed (exchanged again) before it expires to get a new 60-day token. Once expired, it cannot be refreshed.

## 4. Implementation

### 4.1 New Service: `MetaTokenService`

Location: `src/modules/meta-api/meta-token.service.ts`

Responsibilities:
- Store the current token + expiry timestamp
- On app startup, exchange the configured token for a long-lived token if it isn't already long-lived
- Periodically check if the token is nearing expiry (e.g., <7 days remaining)
- Auto-refresh the token before it expires
- Persist the refreshed token so it survives restarts

### 4.2 Token Storage

Add a new Prisma model to persist token state:

```
model MetaToken {
  id           String   @id @default("singleton")
  accessToken  String
  expiresAt    DateTime
  refreshedAt  DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("meta_tokens")
}
```

On startup:
1. Check if a `MetaToken` record exists in the database
2. If yes, use the stored token (it's the latest refreshed one)
3. If no, use the `META_ACCESS_TOKEN` env var, exchange it for a long-lived token, and store it

### 4.3 Refresh Scheduler

Use `@nestjs/schedule` (cron) to run a daily check:

```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async refreshTokenIfNeeded(): Promise<void>
```

Logic:
1. Load the current `MetaToken` from the database
2. If `expiresAt` is more than 7 days away → do nothing
3. If `expiresAt` is within 7 days → exchange for a new long-lived token
4. If `expiresAt` is in the past → log error, mark as expired (user must provide a new short-lived token)
5. Update the `MetaToken` record with the new token + expiry
6. Re-initialize the `FacebookAdsApi` with the new token

### 4.4 MetaApiService Changes

Modify `MetaApiService` to:
- Inject `MetaTokenService`
- On initialization, get the current valid token from `MetaTokenService` instead of reading the env var directly
- Expose a method to re-initialize the SDK when the token is refreshed

### 4.5 Token Status Endpoint

Add a health-check endpoint:

```
GET /api/v1/meta/token-status
```

Response:
```json
{
  "valid": true,
  "expiresAt": "2026-05-26T00:00:00Z",
  "daysRemaining": 53,
  "lastRefreshed": "2026-03-27T22:00:00Z"
}
```

### 4.6 Manual Token Update Endpoint

For when a token fully expires and the user provides a new short-lived token:

```
POST /api/v1/meta/token
Body: { "accessToken": "EAA..." }
```

This endpoint:
1. Exchanges the provided short-lived token for a long-lived token
2. Stores it in the database
3. Re-initializes the Meta SDK
4. Returns the new expiry

## 5. Dependencies

Add to `package.json`:
- `@nestjs/schedule` — for cron-based token refresh

## 6. Environment Variables

No new env vars required. `META_ACCESS_TOKEN` in `.env` is only used as the initial seed token on first run. After that, the database holds the active token.

## 7. Database Migration

Add `MetaToken` table via Prisma migration.

## 8. Error Handling

- Token exchange fails → log warning, retry in 1 hour
- Token fully expired → log error, set `valid: false` in token-status endpoint
- All Meta API calls should check token validity before executing and return a clear error if the token is expired

## 9. Frontend

Frontend: Not required — API-only. Token status can be monitored via the `/meta/token-status` endpoint, and the dark-factory agent can call `/meta/token` to provide a new token if needed.

## 10. File Structure

```
src/modules/meta-api/
├── meta-api.module.ts          (modified — register MetaTokenService, ScheduleModule)
├── meta-api.service.ts         (modified — use MetaTokenService for token)
├── meta-api.controller.ts      (modified — add token-status and token endpoints)
├── meta-token.service.ts       (new)
└── meta-token.dto.ts           (new)
```
