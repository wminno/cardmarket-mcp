import crypto from "node:crypto";
const enc = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

/** OAuth 1.0a HMAC-SHA1 Authorization header as required by Cardmarket API v2.0. */
export function oauthHeader({ method, url, creds, nonce, timestamp }) {
  const u = new URL(url);
  const baseUrl = u.origin + u.pathname;
  const oauth = {
    oauth_consumer_key: creds.appToken,
    oauth_nonce: nonce ?? crypto.randomBytes(12).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp ?? Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const all = [];
  for (const [k, v] of u.searchParams) all.push([enc(k), enc(v)]);
  for (const [k, v] of Object.entries(oauth)) all.push([enc(k), enc(v)]);
  all.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const paramStr = all.map(([k, v]) => `${k}=${v}`).join("&");
  const base = [method.toUpperCase(), enc(baseUrl), enc(paramStr)].join("&");
  const key = `${enc(creds.appSecret)}&${enc(creds.accessTokenSecret)}`;
  const sig = crypto.createHmac("sha1", key).update(base).digest("base64");
  const parts = [`realm="${baseUrl}"`, ...Object.entries({ ...oauth, oauth_signature: sig }).map(([k, v]) => `${k}="${enc(v)}"`)];
  return { header: "OAuth " + parts.join(", "), base };
}
