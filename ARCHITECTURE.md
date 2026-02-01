# Architecture Migration Summary

## Problem Statement (Japanese)

jsr:@hono/hono を使ってサーバサイドを作り、google drive
へのアクセスは全てサーバサイドを経由するように。

**Translation:** Create a server-side using jsr:@hono/hono, and make all access
to Google Drive go through the server-side.

## Solution Overview

Successfully migrated from a client-side architecture to a server-side
architecture using Hono framework with server-side token management.

### Before (Client-Side Direct Access)

```
┌─────────┐
│ Browser │
│         │
│ SolidJS │────────────────┐
│   App   │                │
└─────────┘                │
     │                     │
     │ OAuth2             │ Google Drive API
     │ (GIS)              │ (gapi.client.drive)
     │                     │
     ▼                     ▼
┌──────────────────────────────┐
│   Google Services            │
│  - OAuth2                    │
│  - Drive API                 │
└──────────────────────────────┘
```

### After (Server-Side Proxy with Environment Token)

```
┌─────────┐
│ Browser │
│         │
│ SolidJS │
│   App   │
└─────────┘
     │
     │ HTTP API
     │ (/api/*)
     │
     ▼
┌─────────────┐         ┌──────────────────┐
│ Hono Server │         │ Environment Var  │
│  (Deno)     │◄────────│ GOOGLE_DRIVE_    │
│             │         │ TOKEN            │
└─────────────┘         └──────────────────┘
     │
     │ Google Drive API
     │ (REST with Bearer token)
     │
     ▼
┌──────────────┐
│ Google Drive │
│     API      │
└──────────────┘
```

## Key Changes

### New Components

1. **Hono Server** (`server/main.ts`)
   - Runs on Deno runtime
   - Provides REST API endpoints
   - Reads token from environment variable `GOOGLE_DRIVE_TOKEN`
   - Proxies all Google Drive API calls
   - No session management needed

2. **Simplified API Client** (`src/api/driveClient.js`)
   - Wrapper for server API calls
   - No session IDs or token storage
   - Simple fetch-based communication

### Modified Components

1. **Authentication** (`src/init.js`)
   - Removed all browser OAuth (GIS/GAPI)
   - No external script loading
   - Immediately sets app as ready

2. **Drive Operations** (`src/main/triggerFilesRequest.js`)
   - Simplified to direct API calls
   - Removed OAuth token request logic
   - No retry/refresh mechanism needed

3. **UI** (`src/header/NavBar.jsx`)
   - Removed "Revoke authorization" button
   - Shows connection status badge instead
   - Green badge when token configured, red when not

4. **Configuration** (`.env.local.example`)
   - Changed from `VITE_CLIENT_ID` to `GOOGLE_DRIVE_TOKEN`
   - Token is server-side only, never sent to browser

## API Endpoints

| Endpoint                | Method | Description                     |
| ----------------------- | ------ | ------------------------------- |
| `/api/auth/check`       | GET    | Check if server has valid token |
| `/api/drive/files/list` | POST   | List files from Google Drive    |

**Removed endpoints:**

- `POST /api/auth/token` - No longer needed (token from env)
- `POST /api/auth/revoke` - No longer needed (server-side only)

## Security Improvements

1. **No Client-Side Tokens**: Access tokens never transmitted to or stored in
   browser
2. **Environment-Based Auth**: Token configured server-side via environment
   variables
3. **Simpler Architecture**: No session management, token storage, or OAuth flow
   complexity
4. **Input Validation**: FolderId parameter validated against regex pattern

## Running the Application

### Development

```bash
# Set token
export GOOGLE_DRIVE_TOKEN=your-token

# Terminal 1: Frontend dev server
npm run dev

# Terminal 2: Backend server
deno task server
```

### Production

```bash
# Build frontend
npm run build

# Run server (serves built files + API)
export GOOGLE_DRIVE_TOKEN=your-token
deno task server
```

## Files Changed

- ✅ Modified: `server/main.ts` - Simplified to use env token
- ✅ Modified: `src/api/driveClient.js` - Removed session logic
- ✅ Modified: `src/init.js` - Removed OAuth libraries
- ✅ Modified: `src/main/triggerFilesRequest.js` - Removed token request logic
- ✅ Modified: `src/header/NavBar.jsx` - Simplified to status display
- ✅ Modified: `.env.local.example` - Changed to GOOGLE_DRIVE_TOKEN
- ✅ Modified: `README.md` - Updated documentation

## Token Management

**Getting a Token:**

1. OAuth 2.0 Playground: https://developers.google.com/oauthplayground/
2. gcloud CLI: `gcloud auth application-default print-access-token`
3. Service Account: Generate from JSON key file

**Token Lifetime:**

- Access tokens typically expire after 1 hour
- For long-running deployments, consider:
  - Using a service account
  - Implementing token refresh logic
  - Using a refresh token to obtain new access tokens

## Compatibility

- Browser: All modern browsers (no browser-specific auth)
- Runtime: Deno 1.x or higher
- Node.js: 14.x or higher (for frontend build)
