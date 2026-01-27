# Google Drive Tree Browser

This project is a Google Drive file browser with a tree view, built with SolidJS and Hono.

## Architecture

The application uses a server-side architecture where:
- **Frontend**: SolidJS application that displays the file tree
- **Backend**: Hono server that proxies all Google Drive API calls
- **Authentication**: OAuth2 flow handled in the browser, tokens stored on the server

All Google Drive API access goes through the Hono server to centralize authentication and improve security.

## Prerequisites

- Node.js and npm (for building the frontend)
- Deno (for running the server)
- Google Cloud Console project with Drive API enabled
- OAuth 2.0 Client ID

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Copy `.env.local.example` to `.env.local` and fill in your Google OAuth Client ID:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local`:
   ```
   VITE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
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

# Terminal 2: Run the server (in production, server serves built files)
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

- `POST /api/auth/token` - Store OAuth token
- `POST /api/auth/revoke` - Revoke token  
- `GET /api/auth/check` - Check if user has valid credentials
- `POST /api/drive/files/list` - List files from Google Drive

## Browser Compatibility

This project is currently only compatible with Google Chrome because of the authentication GUI element.

## Learn More

To learn more about the technologies used:

- [SolidJS Documentation](https://www.solidjs.com/docs/latest)
- [Hono Documentation](https://hono.dev/)
- [Google Drive API](https://developers.google.com/drive/api/v3/about-sdk)
