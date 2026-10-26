import { fileURLToPath } from "node:url";

export async function triggerFrontendBuild(hook, fetcher = fetch) {
  if (typeof hook !== "string" || !/^https:\/\/api\.cloudflare\.com\/client\/v4\/workers\/builds\/deploy_hooks\/[0-9a-f-]{36}$/.test(hook)) {
    throw new Error("Cloudflare frontend deploy hook secret is missing or invalid");
  }
  const response = await fetcher(hook, { method: "POST", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Frontend deploy hook: HTTP " + response.status);
  const payload = await response.json();
  if (payload.success !== true || typeof payload.result?.build_uuid !== "string") throw new Error("Frontend build was not queued");
  return payload.result.build_uuid;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const build = await triggerFrontendBuild(process.env.KOTOGRAM_FRONTEND_DEPLOY_HOOK);
    console.log("Frontend build queued after API deployment: " + build);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
