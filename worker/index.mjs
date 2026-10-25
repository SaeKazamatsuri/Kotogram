import { DurableObject } from "cloudflare:workers";
import { sameRun } from "./validation.mjs";
import { handleApi } from "./router.mjs";

export class GuestCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)");
  }

  async nextGuest() {
    return this.sql.exec(
      "INSERT INTO counter (id, value) VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET value = value + 1 RETURNING value",
    ).one().value;
  }
}

export class StageRanking extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        nickname TEXT NOT NULL,
        source TEXT NOT NULL,
        elapsed_ticks INTEGER NOT NULL,
        char_count INTEGER NOT NULL,
        product INTEGER NOT NULL,
        completion_bp INTEGER NOT NULL DEFAULT 10000,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_runs_player ON runs (player_id);
      CREATE TABLE IF NOT EXISTS best_records (
        player_id TEXT PRIMARY KEY,
        time_run_id TEXT NOT NULL,
        chars_run_id TEXT NOT NULL,
        overall_run_id TEXT NOT NULL
      );
    `);
    if (!this.sql.exec("PRAGMA table_info(runs)").toArray().some((column) => column.name === "completion_bp")) {
      this.sql.exec("ALTER TABLE runs ADD COLUMN completion_bp INTEGER NOT NULL DEFAULT 10000");
    }
  }

  async findRun(runId) {
    const row = this.sql.exec("SELECT * FROM runs WHERE run_id = ?", runId).toArray()[0];
    return row ? this.toRun(row) : null;
  }

  async nameForPlayer(playerId) {
    return this.sql.exec(
      "SELECT nickname FROM runs WHERE player_id = ? ORDER BY created_at ASC, run_id ASC LIMIT 1", playerId,
    ).toArray()[0]?.nickname ?? null;
  }

  toRun(row) {
    return {
      runId: row.run_id, playerId: row.player_id, nickname: row.nickname,
      elapsedTicks: row.elapsed_ticks, charCount: row.char_count, source: row.source,
      completionBp: row.completion_bp,
    };
  }

  async save(input) {
    return this.ctx.storage.transactionSync(() => {
      const existing = this.sql.exec("SELECT * FROM runs WHERE run_id = ?", input.runId).toArray()[0];
      if (existing) {
        const existingRun = this.toRun(existing);
        if (!sameRun(existingRun, input)) return { conflict: true };
        return { runId: input.runId, nickname: existingRun.nickname, best: this.bests(input.playerId) };
      }
      this.sql.exec(
        "INSERT INTO runs (run_id, player_id, nickname, source, elapsed_ticks, char_count, product, completion_bp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        input.runId, input.playerId, input.nickname, input.source, input.elapsedTicks, input.charCount,
        input.elapsedTicks * input.charCount, input.completionBp, new Date().toISOString(),
      );
      const best = {
        time: this.sql.exec("SELECT run_id FROM runs WHERE player_id = ? ORDER BY (CAST(elapsed_ticks AS REAL) / completion_bp), char_count, run_id LIMIT 1", input.playerId).one().run_id,
        chars: this.sql.exec("SELECT run_id FROM runs WHERE player_id = ? ORDER BY (CAST(char_count AS REAL) / completion_bp), elapsed_ticks, run_id LIMIT 1", input.playerId).one().run_id,
        overall: this.sql.exec("SELECT run_id FROM runs WHERE player_id = ? ORDER BY (CAST(product AS REAL) / completion_bp), elapsed_ticks, char_count, run_id LIMIT 1", input.playerId).one().run_id,
      };
      this.sql.exec(
        "INSERT INTO best_records (player_id, time_run_id, chars_run_id, overall_run_id) VALUES (?, ?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET time_run_id=excluded.time_run_id, chars_run_id=excluded.chars_run_id, overall_run_id=excluded.overall_run_id",
        input.playerId, best.time, best.chars, best.overall,
      );
      return { runId: input.runId, nickname: input.nickname, best };
    });
  }

  bests(playerId) {
    const row = this.sql.exec("SELECT * FROM best_records WHERE player_id = ?", playerId).toArray()[0];
    return row ? { time: row.time_run_id, chars: row.chars_run_id, overall: row.overall_run_id } : {};
  }

  async rankings(type, limit, scoringVersion = "2026-v1") {
    const adjusted = scoringVersion === "2026-v2";
    const names = adjusted ? {
      time: ["time_run_id", "(CAST(r.elapsed_ticks AS REAL) / r.completion_bp), r.char_count"],
      chars: ["chars_run_id", "(CAST(r.char_count AS REAL) / r.completion_bp), r.elapsed_ticks"],
      overall: ["overall_run_id", "(CAST(r.product AS REAL) / r.completion_bp), r.elapsed_ticks, r.char_count"],
    } : {
      time: ["time_run_id", "r.elapsed_ticks, r.char_count"],
      chars: ["chars_run_id", "r.char_count, r.elapsed_ticks"],
      overall: ["overall_run_id", "r.product, r.elapsed_ticks, r.char_count"],
    };
    const selected = names[type];
    if (!selected) throw new RangeError("invalid ranking kind");
    const rows = this.sql.exec(
      `SELECT r.run_id, r.nickname, r.elapsed_ticks, r.char_count, r.product, r.completion_bp FROM best_records b JOIN runs r ON r.run_id = b.${selected[0]} ORDER BY ${selected[1]}, r.run_id LIMIT ?`,
      limit,
    ).toArray();
    let rank = 0;
    return rows.map((row, index) => {
      const prev = rows[index - 1];
      const tied = prev && (adjusted ? (
        type === "time" ? row.elapsed_ticks * prev.completion_bp === prev.elapsed_ticks * row.completion_bp && row.char_count === prev.char_count :
        type === "chars" ? row.char_count * prev.completion_bp === prev.char_count * row.completion_bp && row.elapsed_ticks === prev.elapsed_ticks :
        row.product * prev.completion_bp === prev.product * row.completion_bp && row.elapsed_ticks === prev.elapsed_ticks && row.char_count === prev.char_count
      ) : (
        type === "time" ? row.elapsed_ticks === prev.elapsed_ticks && row.char_count === prev.char_count :
        type === "chars" ? row.char_count === prev.char_count && row.elapsed_ticks === prev.elapsed_ticks :
        row.product === prev.product && row.elapsed_ticks === prev.elapsed_ticks && row.char_count === prev.char_count
      ));
      if (!tied) rank = index + 1;
      return { rank, runId: row.run_id, nickname: row.nickname, elapsedTicks: row.elapsed_ticks, charCount: row.char_count, completionBp: row.completion_bp };
    });
  }
}

export default { fetch: handleApi };
