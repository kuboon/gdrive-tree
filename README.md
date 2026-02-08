# Google Drive Tree Browser

A web application that displays Google Drive folder trees, built with Deno,
using a Hono server and @remix-run/component frontend.

## Architecture

- **Frontend**: React-like UI built with @remix-run/component
- **Backend**: Hono server that provides a proxy to Google Drive API
- **Bundler**: Client-side bundling with bunseki (Deno.bundle wrapper)
- **Authentication**: Server-side only - automatic token refresh using OAuth 2.0
  refresh token
- **Caching**: Folder information caching with Deno KV
- **Notifications**: Real-time updates via Google Drive Push Notifications

## Requirements

- [Deno](https://deno.land/) 2.0 or later
- Google OAuth 2.0 credentials (Client ID, Client Secret, Refresh Token)
- Google Shared Drive ID

## Obtaining OAuth 2.0 Credentials

### 1. Google Cloud Console Setup

1. Access [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the Google Drive API
4. Navigate to "APIs & Services" → "Credentials"
5. Click "Create Credentials" → "OAuth client ID"
6. Application type: "Web application"
7. Add authorized redirect URI: `http://localhost:8080/oauth2callback`
8. Note your **Client ID** and **Client Secret**

### 2. Obtaining a Refresh Token

Use the authentication script included in the project:

```bash
# Set environment variables
export GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
export GOOGLE_CLIENT_SECRET=your-client-secret

# Run the authentication flow
deno task auth
```

Open the displayed URL in your browser and authenticate with your Google
account. Once authentication is complete, the refresh token will be displayed.

## Setup

### 1. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and edit:

```bash
cp .env.local.example .env.local
```

Set the following in `.env.local`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GOOGLE_DRIVE_ID=your-shared-drive-id
```

### 2. Build the Client

```bash
deno task bundle
```

### 3. Start the Server

```bash
deno task serve
```

The server will start at `http://localhost:8000`

## Development

Development mode watches for file changes and automatically restarts:

```bash
deno task dev
```

This command:

- Watches the client and server directories for changes
- Automatically restarts the server when changes are detected
- Client code is automatically bundled on first access

## Available Tasks

Tasks defined in the root `deno.json`:

- `deno task dev` - Development mode (with hot reload)
- `deno task bundle` - Build client code and output to `./dist`
- `deno task serve` - Start server in production mode
- `deno task auth` - Run OAuth authentication flow to obtain refresh token
- `deno task fmt` - Format code, lint, and type check
- `deno task check` - Check formatting, lint, and type check

## API Endpoints

Endpoints provided by the Hono server:

- `GET /api/folders/:id` - Get children of the specified folder
- `GET /api/tree/:id` - Recursively get the entire folder tree
- `POST /api/watch/:folderId` - Receive push notifications from Google Drive
- `POST /api/move-all` - File move operation

## Project Structure

```
gdrive-tree/
├── client/              # Frontend code
│   ├── deno.json       # Client configuration
│   ├── index.tsx       # Entry point
│   ├── Folder.tsx      # Folder component
│   ├── model.ts        # State management
│   └── api.ts          # API client
├── server/              # Backend code
│   ├── deno.json       # Server configuration
│   ├── app.ts          # Hono application
│   ├── auth.ts         # OAuth authentication script
│   ├── oauth.ts        # Token management
│   ├── gdrive.ts       # Google Drive API
│   ├── bundle.ts       # Build script
│   └── tree/           # Tree features
│       ├── mod.ts      # Tree logic
│       ├── hono.ts     # Tree API
│       ├── repo.ts     # Data repository
│       └── types.ts    # Type definitions
├── deno.json            # Workspace configuration
├── .env.local           # Environment variables (gitignored)
└── dist/                # Build output (auto-generated)
```

## Deployment

This project can be deployed to Deno Deploy:

```bash
# Deploy to Deno Deploy
deno deploy
```

Configuration is managed in the `deploy` section of `deno.json`.

## Technology Stack

- **Runtime**: [Deno 2.0](https://deno.land/)
- **Frontend**:
  [@remix-run/component](https://www.npmjs.com/package/@remix-run/component)
- **Backend**: [Hono](https://hono.dev/)
- **Bundler**: [bunseki](https://bunseki.kbn.one/) (Deno.bundle wrapper)
- **API**:
  [Google Drive API v3](https://developers.google.com/drive/api/v3/about-sdk)
- **Cache**: Deno KV
- **Observability**: OTLP Exporter (bunseki)

## Notes

- **Token Management**: Automatic access token refresh using refresh token
- **Caching**: Folder information is cached in Deno KV for improved performance
- **Real-time Updates**: Changes are detected via Google Drive Push
  Notifications
- User authentication is not implemented - all requests use a single set of
  credentials
- The refresh token is long-lived and remains valid until revoked

## License

This project is released under the MIT License.
