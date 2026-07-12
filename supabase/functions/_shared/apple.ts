// WeBudget: Sign in with Apple 用の共有ヘルパー（Deno / Edge Functions）。
// - client_secret（ES256 JWT）生成
// - authorization_code → refresh_token 交換
// - refresh_token の失効（revoke）
//
// 必要な Secret（未設定なら appleConfigured() が false になり、呼び出し側は no-op）:
//   APPLE_TEAM_ID     … Apple Developer の Team ID
//   APPLE_KEY_ID      … Sign in with Apple 用キー(.p8)の Key ID
//   APPLE_CLIENT_ID   … ネイティブ Sign in with Apple の client_id（= アプリの Bundle ID）
//   APPLE_PRIVATE_KEY … 上記キー(.p8)の内容（-----BEGIN PRIVATE KEY----- を含む PEM 文字列）

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

/** 必要な Apple シークレットが揃っているか。揃わなければ Apple 連携は no-op。 */
export function appleConfigured(): boolean {
  return (
    !!Deno.env.get('APPLE_TEAM_ID') &&
    !!Deno.env.get('APPLE_KEY_ID') &&
    !!Deno.env.get('APPLE_CLIENT_ID') &&
    !!Deno.env.get('APPLE_PRIVATE_KEY')
  );
}

function base64urlFromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromString(s: string): string {
  return base64urlFromBytes(new TextEncoder().encode(s));
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/** Apple 用 client_secret（ES256 署名の JWT）を生成する。 */
async function makeClientSecret(): Promise<string> {
  const teamId = Deno.env.get('APPLE_TEAM_ID')!;
  const keyId = Deno.env.get('APPLE_KEY_ID')!;
  const clientId = Deno.env.get('APPLE_CLIENT_ID')!;
  const privateKeyPem = Deno.env.get('APPLE_PRIVATE_KEY')!;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 5, // 5分（単発の交換/失効に十分）
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };
  const signingInput = `${base64urlFromString(JSON.stringify(header))}.${base64urlFromString(JSON.stringify(payload))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  // Web Crypto の ECDSA 署名は r||s の生バイト（=JOSE 形式）を返すため DER 変換は不要。
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64urlFromBytes(new Uint8Array(sig))}`;
}

/** authorization_code を refresh_token に交換する。取得できなければ null。 */
export async function exchangeAuthCode(authorizationCode: string): Promise<string | null> {
  if (!appleConfigured()) return null;
  const clientSecret = await makeClientSecret();
  const body = new URLSearchParams({
    client_id: Deno.env.get('APPLE_CLIENT_ID')!,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: authorizationCode,
  });
  const res = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return (json && typeof json.refresh_token === 'string') ? json.refresh_token : null;
}

/** refresh_token を失効（revoke）する。ベストエフォート（例外は投げない）。 */
export async function revokeToken(refreshToken: string): Promise<void> {
  if (!appleConfigured()) return;
  try {
    const clientSecret = await makeClientSecret();
    const body = new URLSearchParams({
      client_id: Deno.env.get('APPLE_CLIENT_ID')!,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: 'refresh_token',
    });
    await fetch(APPLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch {
    // 失効失敗でアカウント削除自体は止めない。
  }
}
