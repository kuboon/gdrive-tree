/**
 * Token Manager for Google OAuth 2.0
 * Handles access token refresh using refresh token
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface TokenManagerOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export class TokenManager {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private accessToken: string | null;
  private expiresAt: number;

  constructor(options: TokenManagerOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.refreshToken = options.refreshToken;
    this.accessToken = null;
    this.expiresAt = 0;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    // If token exists and is still valid (with 5 minute buffer), return it
    if (this.accessToken && Date.now() < this.expiresAt - 5 * 60 * 1000) {
      return this.accessToken;
    }

    // Otherwise, refresh the token
    console.log("Access token expired or missing, refreshing...");
    await this.refreshAccessToken();

    if (!this.accessToken) {
      throw new Error("Failed to obtain access token");
    }

    return this.accessToken;
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    const tokenEndpoint = "https://oauth2.googleapis.com/token";

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: "refresh_token",
    });

    try {
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Token refresh failed:", errorText);
        throw new Error(
          `Failed to refresh token: ${response.status} ${errorText}`,
        );
      }

      const data: TokenResponse = await response.json();

      this.accessToken = data.access_token;
      // Set expiration time (expires_in is in seconds)
      this.expiresAt = Date.now() + data.expires_in * 1000;

      console.log(
        `Access token refreshed successfully. Expires in ${data.expires_in} seconds`,
      );
    } catch (error) {
      console.error("Error refreshing access token:", error);
      throw error;
    }
  }

  /**
   * Force refresh the access token
   */
  async forceRefresh(): Promise<string> {
    await this.refreshAccessToken();
    if (!this.accessToken) {
      throw new Error("Failed to refresh access token");
    }
    return this.accessToken;
  }
}

/**
 * Create a token manager from environment variables
 */
export function createTokenManagerFromEnv(): TokenManager | null {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");

  // Check if we have all required credentials
  if (clientId && clientSecret && refreshToken) {
    console.log("Using refresh token for automatic token renewal");
    return new TokenManager({
      clientId,
      clientSecret,
      refreshToken,
    });
  }

  // Return null if credentials are missing
  return null;
}
