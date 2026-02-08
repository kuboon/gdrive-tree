# Development Guide for AI Agents

This document provides architectural insights and development guidelines for AI
coding agents working on this project.

## Project Overview

This is a Google Drive folder tree viewer built with Deno, featuring:

- Server-side OAuth 2.0 authentication
- Deno KV-based caching
- Google Drive Push Notifications for real-time updates
- Client-side bundling with bunseki (Deno.bundle)
- @remix-run/component for the frontend

## Architecture Patterns

### Workspace Structure

The project uses Deno workspaces with two main components:

- **client**: Frontend code using @remix-run/component
- **server**: Backend Hono server with Google Drive API integration

Both are referenced in the root `deno.json` workspace configuration.

### Key Technologies

1. **@remix-run/component**: Not React, but a React-like component library
   - Uses JSX with `jsxImportSource: "@remix-run/component"`
   - Signal-based reactivity similar to SolidJS
   - Component lifecycle: `createRoot()` for initialization

2. **bunseki**: Wrapper around Deno.bundle
   - Handles client-side bundling
   - Provides OTLP observability
   - Bundle configuration in `server/bundle.ts`

3. **Deno KV**: Persistent key-value storage
   - Used for caching folder data
   - See `server/tree/repo.ts` for implementation
   - Supports both in-memory (dev) and persistent (prod) modes

### Authentication Flow

**Important**: This project does NOT use browser-based OAuth. All authentication
is server-side.

```
┌─────────────┐
│  Browser    │
└──────┬──────┘
       │ HTTP Requests (no auth headers)
       ▼
┌─────────────────┐
│  Hono Server    │
│  - Has refresh  │
│    token in env │
└────────┬────────┘
         │ Uses refresh token
         │ to get access tokens
         ▼
┌──────────────────┐
│ Google Drive API │
└──────────────────┘
```

1. `GOOGLE_REFRESH_TOKEN` is stored in environment variables
2. `server/oauth.ts` manages automatic access token refresh
3. Tokens are cached in memory with expiration tracking
4. No client-side authentication code exists

### API Architecture

**Server**: `server/app.ts` is the main entry point

- Uses Hono for routing
- CORS enabled for all routes
- OTLP tracing for observability

**Tree API**: `server/tree/hono.ts` provides:

```
POST /api/watch/:folderId
  - Webhook endpoint for Google Drive notifications
  - Validates channel ID against stored watch channels
  - Triggers cache update on changes

GET /api/folders/:id
  - Returns immediate children of a folder
  - Auto-creates watch channel for push notifications
  - Optional ?refresh=true query param to bypass cache

GET /api/tree/:id
  - Recursively fetches entire folder tree
  - Creates watch channels for all folders
  - Concurrent with rate limiting (3 parallel requests)
```

**Caching Strategy**: `server/tree/repo.ts`

```typescript
// Cache key format
`tree:${folderId}` // Folder children cache
  `tree:${folderId}:watch`; // Watch channel metadata
```

- Default TTL: 24 hours
- Invalidated by Google Drive push notifications
- Falls back to Google Drive API on cache miss

### Google Drive Integration

**Watch Channels**: `server/tree/mod.ts`

The application uses Google Drive Push Notifications for real-time updates:

1. `ensureWatchChannel()` creates or renews watch channels
2. Channels expire after 24 hours (or shorter if Google decides)
3. Channel metadata is stored in Deno KV
4. Webhook URL must be publicly accessible (important for deployment)

**File Operations**: `server/gdrive.ts`

```typescript
listFiles(folderId, pageToken?)
  - Lists all files in a folder
  - Supports pagination
  - Filters by parent folder ID

watchFolder(folderId, webhookUrl)
  - Creates a push notification channel
  - Returns channel ID and expiration

stopWatching(channelId, resourceId)
  - Stops a watch channel
```

### Client-Side Architecture

**Entry Point**: `client/index.tsx`

- Uses `createRoot()` from @remix-run/component
- Renders `<Folder>` components for each root folder
- Hard-coded folder IDs (UP_FOLDER_ID, DL_FOLDER_ID)

**State Management**: `client/model.ts`

Uses signal-based reactivity:

```typescript
dispatch(event, payload)
  - Central event dispatcher
  - Events: "toggle", "refresh", "move", etc.
```

**API Client**: `client/api.ts`

```typescript
fetchFolderContents(folderId)
  - Fetches folder children from /api/folders/:id
  - Returns DriveItem[]
```

**Component**: `client/Folder.tsx`

- Recursive folder tree rendering
- Lazy loading (loads children on expand)
- Drag-and-drop support for file operations

### Build Process

**Development**: `deno task dev`

1. Watches `client/` and `server/` for changes
2. Server restarts on file changes
3. Client is bundled on-demand (not pre-built)
4. Serves bundled client via `createBundleServeMiddleware()`

**Production**: `deno task bundle` + `deno task serve`

1. Pre-bundle client to `./dist`
2. Server serves static files from `./dist` via `serveStatic()`
3. Falls back to on-demand bundling if `./dist` doesn't exist

## Common Development Tasks

### Adding a New API Endpoint

1. Add route to `server/tree/hono.ts` or `server/app.ts`
2. Implement handler with request validation
3. Update `client/api.ts` with client function
4. Use in components via `dispatch()` or direct call

### Modifying Cache Behavior

1. Edit cache keys in `server/tree/repo.ts`
2. Update TTL in `setCache()` calls
3. Ensure proper invalidation in watch handler

### Changing OAuth Scopes

1. Update `SCOPES` array in `server/auth.ts`
2. Run `deno task auth` to get new refresh token
3. Update `.env.local` with new token

### Adding a New Client Component

1. Create `.tsx` file in `client/`
2. Import from `@remix-run/component`
3. Use signal-based state, not React hooks
4. Export component for use in `index.tsx`

## Permissions Model

Defined in root `deno.json`:

```json
"permissions": {
  "default": {
    "net": true,                    // HTTP requests
    "read": ["./dist"],             // Read bundled files
    "env": {                        // Environment variables
      "allow": [
        "GOOGLE_DRIVE_ID",
        "GOOGLE_KEY",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REFRESH_TOKEN"
      ]
    }
  },
  "bundle": {
    "write": ["./dist"],            // Write build output
    "import": ["bunseki.kbn.one"]   // Import from bunseki
  }
}
```

When adding new file operations or network requests, update permissions
accordingly.

## Testing Strategy

Currently minimal automated testing. For manual testing:

1. **Auth Flow**: `deno task auth` should open browser and return token
2. **API**: Test endpoints with `curl` or browser DevTools
3. **Cache**: Check Deno KV contents with `Deno.openKv()`
4. **Watch**: Monitor console for webhook notifications

## Deployment Considerations

### Deno Deploy

Configuration in `deno.json`:

```json
"deploy": {
  "org": "kuboon-tokyo",
  "app": "gdrive-tree"
}
```

**Important for webhooks**:

- Webhook URL must use public Deno Deploy URL
- Local `localhost` webhooks won't work
- Consider environment-specific webhook URLs

### Environment Variables

Required on deployment:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_ID`

Optional:

- `USE_DENO_KV=true` for persistent cache

## Troubleshooting

### "Invalid refresh token" error

- Token may be revoked
- Run `deno task auth` to get new token
- Update `.env.local`

### Watch notifications not received

- Check webhook URL is publicly accessible
- Verify channel ID matches in Deno KV
- Channels auto-expire after 24h, renewal is automatic

### Cache not updating

- Check Deno KV is enabled (`USE_DENO_KV=true`)
- Verify watch notification handler is called
- Force refresh with `?refresh=true` query param

### Build fails

- Check `bunseki` import is accessible
- Verify Deno version >= 2.0
- Ensure write permissions to `./dist`

## Code Style

- Use Deno's built-in formatter: `deno task fmt`
- TypeScript strict mode enabled
- JSX pragma set to @remix-run/component
- Prefer `async/await` over callbacks
- Use explicit types for API boundaries

## Future Development Ideas

1. **User Authentication**: Add user-level OAuth
2. **Multi-tenant**: Support multiple Google accounts
3. **File Preview**: Inline preview for images/documents
4. **Search**: Full-text search across cached data
5. **Batch Operations**: Multi-file move/copy
6. **Offline Support**: Service worker caching

## References

- [Deno Manual](https://deno.land/manual)
- [Hono Documentation](https://hono.dev/)
- [@remix-run/component](https://www.npmjs.com/package/@remix-run/component)
- [Google Drive API](https://developers.google.com/drive/api/v3/reference)
- [Push Notifications](https://developers.google.com/drive/api/guides/push)
