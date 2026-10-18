import { createHmac } from "node:crypto";

/** Official signing: decoded sorted query values, exact path/body bytes, secret wrapping, HMAC-SHA256. */
export function signTikTokShopRequest(path: string, query: Readonly<Record<string, string>>, appSecret: string, body: Uint8Array = new Uint8Array(), contentType = "application/json"): string {
  const params = Object.keys(query).filter((k) => k !== "sign" && k !== "access_token").sort().map((k) => k + query[k]).join("");
  const hmac = createHmac("sha256", appSecret).update(appSecret).update(path).update(params);
  if (contentType.split(";", 1)[0].trim().toLowerCase() !== "multipart/form-data") hmac.update(body);
  return hmac.update(appSecret).digest("hex");
}
