/**
 * Google OAuth2 トークン管理
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * refresh token から access token を取得
 * トークンをキャッシュし、期限切れ前に自動的に再取得する
 */
export async function getAccessToken(): Promise<string> {
  // キャッシュされたトークンがまだ有効な場合
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) { // 1分の余裕を持つ
    return cachedAccessToken;
  }

  const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error(
      "環境変数 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN が必要です",
    );
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `アクセストークン取得エラー: ${response.status} - ${errorText}`,
      );
    }

    const tokens: TokenResponse = await response.json();

    // トークンをキャッシュ
    cachedAccessToken = tokens.access_token;
    tokenExpiresAt = Date.now() + (tokens.expires_in * 1000);

    return tokens.access_token;
  } catch (error) {
    // エラー時はキャッシュをクリア
    cachedAccessToken = null;
    tokenExpiresAt = 0;
    throw error;
  }
}

/**
 * キャッシュをクリア（テスト用など）
 */
export function clearTokenCache(): void {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}
