import type { TextSelection } from "./text-input.ts";

export class EditorHistory {
  private snapshots: TextSelection[] = [{ text: "", start: 0, end: 0 }];
  private position = 0;

  get canUndo(): boolean { return this.position > 0; }
  get canRedo(): boolean { return this.position < this.snapshots.length - 1; }

  record(state: TextSelection): void {
    if (this.snapshots[this.position]?.text === state.text) return;
    this.snapshots = this.snapshots.slice(0, this.position + 1);
    this.snapshots.push({ ...state });
    if (this.snapshots.length > 100) this.snapshots.shift();
    this.position = this.snapshots.length - 1;
  }

  undo(): TextSelection | null {
    if (!this.canUndo) return null;
    return { ...this.snapshots[--this.position]! };
  }

  redo(): TextSelection | null {
    if (!this.canRedo) return null;
    return { ...this.snapshots[++this.position]! };
  }
}
