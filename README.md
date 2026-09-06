# Autoship production API

Autoship now builds its production server with `scripts/build-server.mjs`.

## CORS

Set `AUTOSHIP_CORS_ORIGINS` to a comma-separated allow-list of frontend origins. If it is not set, `APP_URL` is used; if neither is set, `*` is used.

Example:

```env
AUTOSHIP_CORS_ORIGINS=https://your-agentside.example
APP_URL=https://your-agentside.example
```

## API authentication

Set `AUTOSHIP_API_TOKEN` in the deployment environment. When configured, non-GET `/api/*` requests require:

```http
Authorization: Bearer <AUTOSHIP_API_TOKEN>
```

GET requests remain available for status/read operations. GitHub webhook routes remain available for their existing webhook handling.

Do not put `AUTOSHIP_API_TOKEN` into the AgentsIDE browser bundle. Use a server-side integration such as GitHub Actions for authenticated deployment triggers.