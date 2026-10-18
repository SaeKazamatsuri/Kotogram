import {
  ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID,
  type RankingScope,
} from "../scoring/score.ts";

export type RankingKind = "time" | "chars" | "overall";
export type RankingRow = {
  rank: number;
  runId: string;
  nickname: string;
  elapsedTicks: number;
  charCount: number;
};
export type RunSubmission = RankingScope & {
  runId: string;
  playerId: string;
  nickname: string;
  source: string;
  elapsedTicks: number;
  charCount: number;
};
export type SavedSubmission = {
  ok: true;
  nickname: string;
  runId: string;
  duplicate: boolean;
  best?: { time?: string; chars?: string; overall?: string };
};
export type RankingResponse = {
  ok: true;
  type: RankingKind;
  stageId: string;
  rows: RankingRow[];
};

export function createScope(stageId: string, stageVersion: string): RankingScope {
  return {
    seasonId: SEASON_ID,
    stageId,
    stageVersion,
    engineVersion: ENGINE_VERSION,
    languageVersion: LANGUAGE_VERSION,
    scoringVersion: SCORING_VERSION,
  };
}

export function getOrCreatePlayerId(storage: Pick<Storage, "getItem" | "setItem">, createId: () => string): string {
  const current = storage.getItem("kotogram.player");
  if (current && /^[a-f0-9-]{36}$/i.test(current)) return current;
  const id = createId();
  storage.setItem("kotogram.player", id);
  return id;
}

export class RankingClient {
  private readonly apiBase: string;
  private readonly requester: typeof fetch;

  constructor(apiBase: string, requester: typeof fetch = (input, init) => globalThis.fetch(input, init)) {
    this.apiBase = apiBase;
    this.requester = requester;
  }

  private endpoint(path: string): string {
    const trimmed = this.apiBase.trim().replace(/\/+$/, "");
    if (!/^https?:\/\/[^/]+/i.test(trimmed)) throw new Error("ranking API endpoint is not configured");
    return trimmed + path;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.requester(this.endpoint(path), {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!response.ok) throw new Error(response.status === 409 ? "run_id_conflict" : "ranking_api_unavailable");
    return await response.json() as T;
  }

  async submit(data: RunSubmission): Promise<SavedSubmission> {
    return this.request<SavedSubmission>("/api/results", { method: "POST", body: JSON.stringify(data) });
  }

  async list(scope: RankingScope, type: RankingKind, limit = 20): Promise<RankingResponse> {
    const query = new URLSearchParams({ ...scope, type, limit: String(limit) });
    return this.request<RankingResponse>(`/api/stages/${encodeURIComponent(scope.stageId)}/rankings?${query}`);
  }
}
