import { ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID } from "../app/scoring/score.ts";
import { scopeObjectId, validateRunPayload, validateScope, verifyRunResult } from "./validation.mjs";

const json = (value, status, cors) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors },
});

export async function handleApi(request, env) {
  const origin = request.headers.get("Origin");
  const cors = origin && origin === env.ALLOWED_ORIGIN
    ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }
    : {};
  if (origin && !cors["Access-Control-Allow-Origin"]) return json({ error: "origin_not_allowed" }, 403, cors);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, service: "kotogram-api", versions: {
        seasonId: SEASON_ID, engineVersion: ENGINE_VERSION, languageVersion: LANGUAGE_VERSION, scoringVersion: SCORING_VERSION,
      } }, 200, cors);
    }

    if (request.method === "POST" && url.pathname === "/api/results") {
      const headerLength = Number(request.headers.get("Content-Length") ?? 0);
      if (headerLength > 8192) return json({ error: "payload_too_large" }, 413, cors);
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 8192) return json({ error: "payload_too_large" }, 413, cors);
      let input;
      try { input = validateRunPayload(JSON.parse(raw)); }
      catch { return json({ error: "invalid_run" }, 400, cors); }

      const stub = env.RANKING.get(env.RANKING.idFromName(scopeObjectId(input)));
      const known = await stub.findRun(input.runId);
      if (known) {
        if (known.playerId !== input.playerId || known.elapsedTicks !== input.elapsedTicks ||
            known.charCount !== input.charCount || known.source !== input.source) {
          return json({ error: "run_id_conflict" }, 409, cors);
        }
        return json({ ok: true, runId: input.runId, nickname: known.nickname, duplicate: true }, 200, cors);
      }

      try { verifyRunResult(input); }
      catch { return json({ error: "invalid_run" }, 400, cors); }

      const nickname = input.nickname || await stub.nameForPlayer(input.playerId) || (
        "ゲスト" + await env.COUNTER.get(env.COUNTER.idFromName(input.seasonId)).nextGuest()
      );
      const saved = await stub.save({ ...input, nickname });
      if (saved.conflict) return json({ error: "run_id_conflict" }, 409, cors);
      return json({ ok: true, ...saved, duplicate: false }, 201, cors);
    }

    const match = url.pathname.match(/^\/api\/stages\/(stage-[a-z0-9-]+)\/rankings$/);
    if (request.method === "GET" && match) {
      const scope = validateScope({
        seasonId: url.searchParams.get("seasonId"),
        stageId: match[1],
        stageVersion: url.searchParams.get("stageVersion"),
        engineVersion: url.searchParams.get("engineVersion"),
        languageVersion: url.searchParams.get("languageVersion"),
        scoringVersion: url.searchParams.get("scoringVersion"),
      });
      const type = url.searchParams.get("type");
      if (!["time", "chars", "overall"].includes(type)) return json({ error: "invalid_type" }, 400, cors);
      const limit = Number(url.searchParams.get("limit") ?? 20);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) return json({ error: "invalid_limit" }, 400, cors);
      const stub = env.RANKING.get(env.RANKING.idFromName(scopeObjectId(scope)));
      const rows = await stub.rankings(type, limit);
      return json({ ok: true, type, stageId: scope.stageId, rows }, 200, cors);
    }

    return json({ error: "not_found" }, 404, cors);
  } catch (error) {
    if (error instanceof RangeError) return json({ error: "invalid_scope" }, 400, cors);
    return json({ error: "temporary_error" }, 503, cors);
  }
}
