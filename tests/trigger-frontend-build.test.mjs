import test from "node:test";
import assert from "node:assert/strict";
import { triggerFrontendBuild } from "../scripts/trigger-frontend-build.mjs";
const hook = "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/00000000-0000-4000-8000-000000000001";

test("frontend deploy hook is triggered only by explicit POST", async () => {
  let count = 0;
  const result = await triggerFrontendBuild(hook, async (url, options) => {
    assert.equal(url, hook);
    assert.equal(options.method, "POST");
    count++;
    return Response.json({ success: true, result: { build_uuid: "new-frontend-build" } });
  });
  assert.equal(result, "new-frontend-build");
  assert.equal(count, 1);
});

test("missing, malformed, and unsuccessful frontend build hooks reject release", async () => {
  await assert.rejects(triggerFrontendBuild(undefined), /missing or invalid/);
  await assert.rejects(triggerFrontendBuild("https://example.com/hook"), /missing or invalid/);
  await assert.rejects(triggerFrontendBuild(hook, async () => new Response(null, { status: 503 })), /HTTP 503/);
  await assert.rejects(triggerFrontendBuild(hook, async () => Response.json({ success: false })), /not queued/);
});
