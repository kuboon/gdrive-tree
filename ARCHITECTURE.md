# Architecture Migration Summary

## Problem Statement (Japanese)
jsr:@hono/hono を使ってサーバサイドを作り、google drive へのアクセスは全てサーバサイドを経由するように。

**Translation:** Create a server-side using jsr:@hono/hono, and make all access to Google Drive go through the server-side.

## Solution Overview

Successfully migrated from a client-side architecture to a server-side architecture using Hono framework.

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

### After (Server-Side Proxy)
```
┌─────────┐
│ Browser │
│         │
│ SolidJS │────────────────┐
│   App   │                │
└─────────┘                │
     │                     │
     │ OAuth2             │ HTTP API
     │ (GIS)              │ (/api/*)
     │                     │
     ▼                     ▼
┌──────────┐         ┌─────────────┐
│  Google  │         │ Hono Server │
│  OAuth2  │         │  (Deno)     │
└──────────┘         └─────────────┘
                            │
                            │ Google Drive API
                            │ (REST)
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
   - Manages user sessions and tokens
   - Proxies all Google Drive API calls

2. **API Client** (`src/api/driveClient.js`)
   - Wrapper for server API calls
   - Manages session IDs
   - Handles authentication state

### Modified Components
1. **Authentication Flow** (`src/init.js`)
   - OAuth2 still happens in browser (required by Google)
   - Access tokens sent to server for storage
   - Server manages token lifecycle

2. **Drive Operations** (`src/main/triggerFilesRequest.js`)
   - Replaced `gapi.client.drive.files.list()` calls
   - Now calls `/api/drive/files/list` endpoint
   - Server handles pagination and API communication

3. **Credential Management** (`src/checkHasCredential.js`)
   - Changed from `gapi.client.getToken()` to server check
   - Uses `/api/auth/check` endpoint

4. **Token Revocation** (`src/header/NavBar.jsx`)
   - Now calls `/api/auth/revoke`
   - Clears session storage

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/token` | POST | Store OAuth token on server |
| `/api/auth/revoke` | POST | Revoke and delete token |
| `/api/auth/check` | GET | Check if user has valid token |
| `/api/drive/files/list` | POST | List files from Google Drive |

## Security Improvements

1. **Input Validation**: FolderId parameter validated against regex pattern
2. **Session Management**: Session IDs used instead of storing tokens in browser
3. **Centralized Token Storage**: Tokens stored server-side (in-memory for dev)
4. **API Isolation**: Frontend has no direct access to Google Drive API

## Running the Application

### Development
```bash
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
deno task server
```

## Files Changed
- ✅ 9 files modified
- ✅ 3 files created
- ✅ 367 lines added
- ✅ 67 lines removed

## Testing Results
- ✅ Frontend builds successfully
- ✅ No TypeScript/JavaScript errors
- ✅ CodeQL security scan: 0 issues
- ✅ Code review completed and issues addressed

## Notes for Production Deployment

⚠️ **Important**: The current implementation uses in-memory token storage, which will lose tokens on server restart. For production:

1. Implement persistent session storage (Redis, database)
2. Encrypt tokens before storage
3. Add token refresh logic
4. Implement proper CORS configuration
5. Add rate limiting
6. Use HTTPS only
7. Set up proper environment variable management

## Compatibility
- Browser: Chrome (required for Google authentication UI)
- Runtime: Deno 1.x or higher
- Node.js: 14.x or higher (for frontend build)
