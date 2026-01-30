# Google Drive Tree Browser

This project is a Google Drive file browser with a tree view, built with SolidJS and Hono.

## Architecture

The application uses a server-side architecture where:
- **Frontend**: SolidJS application that displays the file tree
- **Backend**: Hono server that proxies all Google Drive API calls
- **Authentication**: Server-side only - token configured via environment variable

All Google Drive API access goes through the Hono server. The server reads the access token from environment variables, eliminating the need for browser-based OAuth.

## Prerequisites

- Node.js and npm (for building the frontend)
- Deno (for running the server)
- Google Drive API access token

## Getting a Google Drive Access Token

You can obtain an access token in several ways:

1. **Using OAuth 2.0 Playground:**
   - Visit https://developers.google.com/oauthplayground/
   - Select "Drive API v3" and the scopes you need
   - Click "Authorize APIs" and follow the OAuth flow
   - Exchange authorization code for tokens
   - Copy the access token

2. **Using gcloud CLI:**
   ```bash
   gcloud auth application-default print-access-token
   ```

3. **Service Account (for server-to-server):**
   - Create a service account in Google Cloud Console
   - Generate and download the JSON key file
   - Use the service account to generate access tokens

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   
   Set the `GOOGLE_DRIVE_TOKEN` environment variable with your access token:
   ```bash
   export GOOGLE_DRIVE_TOKEN=your-google-drive-access-token
   ```
   
   Or copy `.env.local.example` to `.env.local` and fill in your token:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local`:
   ```
   GOOGLE_DRIVE_TOKEN=your-google-drive-access-token
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
export GOOGLE_DRIVE_TOKEN=your-token
deno task server
```

During development, if running frontend dev server separately:
- Frontend dev server: `http://localhost:3000` (or port from vite)
- Backend API server: `http://localhost:8000`
- Set `VITE_API_BASE_URL=http://localhost:8000` in `.env.local` to connect to backend

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

- `GET /api/auth/check` - Check if server has a valid Google Drive token configured
- `POST /api/drive/files/list` - List files from Google Drive

## Browser Compatibility

This project works in all modern browsers. No browser-specific authentication is required.

## Learn More

To learn more about the technologies used:

- [SolidJS Documentation](https://www.solidjs.com/docs/latest)
- [Hono Documentation](https://hono.dev/)
- [Google Drive API](https://developers.google.com/drive/api/v3/about-sdk)

## Notes

- The access token is read from the `GOOGLE_DRIVE_TOKEN` environment variable
- Access tokens typically expire after 1 hour. For long-running deployments, consider using a service account or implementing token refresh logic
- No user authentication is performed - the application uses a single token for all requests
