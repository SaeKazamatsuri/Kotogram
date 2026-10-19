import { fileURLToPath } from "node:url";

export const FRONTEND_ORIGIN = "https://kotogram.sae-chan.net";
export const PRODUCTION_API_ORIGIN = "https://kotogram-api.sae-chan.net";

export function validateFrontendApiBase(input) {
  const errors = [];
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, errors: ["NUXT_PUBLIC_RANKING_API_BASE に本番ランキングAPIのHTTPS URLを設定してください。"] };
  }
  const value = input.trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, errors: ["ランキングAPIのURLが正しくありません。"] };
  }
  const hostname = url.hostname.toLowerCase();
  const isPlaceholder = /(^localhost$|\.localhost$|\.local$|\.example$|\.invalid$|\.test$)/.test(hostname);
  const isPrivateIp = /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname)
    || hostname === "[::1]" || hostname === "0.0.0.0";
  if (url.protocol !== "https:") errors.push("ランキングAPIにはHTTPSを使用してください。");
  if (url.origin === FRONTEND_ORIGIN) errors.push("ランキングAPIは現在、Webサイトとは別のWorkerで配信されています。");
  if (isPlaceholder || isPrivateIp) errors.push("本番APIには開発用・仮のホスト名を使用できません。");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    errors.push("ランキングAPIにはパスや認証情報を含まないoriginを指定してください。");
  }
  if (value.replace(/\/+$/, "") !== url.origin) errors.push("ランキングAPIにはHTTPS originだけを指定してください。");
  if (url.origin !== PRODUCTION_API_ORIGIN) errors.push("本番APIは " + PRODUCTION_API_ORIGIN + " を指定してください。");
  return { ok: errors.length === 0, errors, origin: errors.length ? null : url.origin };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = validateFrontendApiBase(process.env.NUXT_PUBLIC_RANKING_API_BASE ?? PRODUCTION_API_ORIGIN);
  if (!report.ok) {
    for (const error of report.errors) console.error("公開前チェック: " + error);
    process.exitCode = 1;
  } else {
    console.log("公開前チェック完了: ランキングAPI " + report.origin);
  }
}
