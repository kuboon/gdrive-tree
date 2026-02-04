/**
 * Google OAuth2 認証フロー
 * このタスクを実行して refresh token を取得します
 */

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const REDIRECT_URI = "http://localhost:8080/oauth2callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("環境変数 GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET が必要です");
  Deno.exit(1);
}

// OAuth2 スコープ
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
];

// Step 1: 認証URLを生成
const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES.join(" "));
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\n=== Google OAuth2 認証 ===\n");
console.log("以下のURLをブラウザで開いてください：\n");
console.log(authUrl.toString());
console.log("\n");

// Step 2: コールバックサーバーを起動
const server = Deno.serve({
  port: 8080,
  hostname: "localhost",
  onListen: () => {
    console.log(
      "認証コールバックサーバーを起動しました (http://localhost:8080)",
    );
    console.log("認証完了後、このサーバーは自動的に終了します\n");
  },
}, async (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/oauth2callback") {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>認証エラー</title></head>
        <body>
          <h1>認証エラー</h1>
          <p>エラー: ${error}</p>
          <p>このウィンドウを閉じてください。</p>
        </body>
        </html>
      `;
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (!code) {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>エラー</title></head>
        <body>
          <h1>エラー</h1>
          <p>認証コードが取得できませんでした。</p>
        </body>
        </html>
      `;
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Step 3: 認証コードをトークンに交換
    try {
      const tokenResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code",
          }),
        },
      );

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(
          `トークン取得エラー: ${tokenResponse.status} - ${errorText}`,
        );
      }

      const tokens = await tokenResponse.json();

      console.log("\n=== 認証成功！ ===\n");
      console.log(
        "以下の refresh token を .env ファイルに追加してください：\n",
      );
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);

      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>認証成功</title></head>
        <body>
          <h1>認証成功！</h1>
          <p>ターミナルに表示された refresh token を .env ファイルに追加してください。</p>
          <p>このウィンドウを閉じてください。</p>
        </body>
        </html>
      `;

      // サーバーを終了
      setTimeout(() => {
        console.log("サーバーを終了します...");
        server.shutdown();
      }, 1000);

      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch (error) {
      console.error("エラー:", error);
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>エラー</title></head>
        <body>
          <h1>エラー</h1>
          <p>${error instanceof Error ? error.message : String(error)}</p>
        </body>
        </html>
      `;
      return new Response(html, {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  }

  return new Response("Not Found", { status: 404 });
});
