# Google Drive Tree Browser

This project is a Google Drive file browser with a tree view, built with SolidJS
and Hono.

## Architecture

The application uses a server-side architecture where:

- **Frontend**: SolidJS application that displays the file tree
- **Backend**: Hono server that proxies all Google Drive API calls
- **Authentication**: Server-side only - token configured via environment
  variable

All Google Drive API access goes through the Hono server. The server reads the
access token from environment variables, eliminating the need for browser-based
OAuth.

## Prerequisites

- Node.js and npm (for building the frontend)
- Deno (for running the server)
- Google OAuth 2.0 credentials (Client ID, Client Secret, Refresh Token)

## Getting Google OAuth 2.0 Credentials

The server uses OAuth 2.0 refresh token for automatic access token renewal.

1. **Set up OAuth 2.0 credentials in Google Cloud Console:**
   - Go to https://console.cloud.google.com/
   - Create or select a project
   - Enable the Google Drive API
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Add authorized redirect URI:
     `https://developers.google.com/oauthplayground`
   - Save and note your **Client ID** and **Client Secret**

2. **Get a Refresh Token using OAuth 2.0 Playground:**
   - Visit https://developers.google.com/oauthplayground/
   - Click the gear icon (⚙️) in the top right
   - Check "Use your own OAuth credentials"
   - Enter your **OAuth Client ID** and **OAuth Client Secret**
   - In Step 1, select "Drive API v3" →
     `https://www.googleapis.com/auth/drive.readonly` (or `drive` for full
     access)
   - Click "Authorize APIs" and grant permissions
   - In Step 2, click "Exchange authorization code for tokens"
   - Copy the **Refresh token** (it starts with `1//` and is long-lived)

**Note:** The refresh token allows the server to automatically obtain and renew
access tokens as needed.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**

   Copy `.env.local.example` to `.env.local` and configure your credentials:
   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REFRESH_TOKEN=your-refresh-token
   GOOGLE_DRIVE_ID=your-shared-drive-id
   ```

3. **Build the frontend:**
   ```bash
   npm run build
   ```

4. **Run the server:**
   ```bash
   deno task server
   ```

   The server will start on `http://localhost:8000`

## Development

For frontend development with hot reload:

```bash
# Terminal 1: Build frontend in dev mode
npm run dev

# Terminal 2: Run the server
export GOOGLE_CLIENT_ID=your-client-id
export GOOGLE_CLIENT_SECRET=your-client-secret
export GOOGLE_REFRESH_TOKEN=your-refresh-token
export GOOGLE_DRIVE_ID=your-shared-drive-id
deno task server
```

During development, if running frontend dev server separately:

- Frontend dev server: `http://localhost:3000` (or port from vite)
- Backend API server: `http://localhost:8000`
- Set `VITE_API_BASE_URL=http://localhost:8000` in `.env.local` to connect to
  backend

## Available Scripts

### Frontend (npm)

- `npm run dev` - Start Vite dev server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Backend (deno)

- `deno task server` - Run Hono server
- `deno task serve` - Serve static files (legacy)

## API Endpoints

The Hono server provides these endpoints:

- `GET /api/auth/check` - Check if server has a valid Google Drive token
  configured
- `POST /api/drive/files/list` - List files from Google Drive

## Browser Compatibility

This project works in all modern browsers. No browser-specific authentication is
required.

## Learn More

To learn more about the technologies used:

- [SolidJS Documentation](https://www.solidjs.com/docs/latest)
- [Hono Documentation](https://hono.dev/)
- [Google Drive API](https://developers.google.com/drive/api/v3/about-sdk)

## Notes

- **Token Management:** The server uses OAuth 2.0 refresh token for automatic
  access token renewal
- Access tokens are automatically refreshed when they expire (typically every
  hour)
- No user authentication is performed - the application uses a single set of
  credentials for all requests
- The refresh token is long-lived and doesn't expire unless revoked
