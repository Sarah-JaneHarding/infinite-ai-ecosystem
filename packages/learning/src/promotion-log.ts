// Promotion log — Stage 13 step 6.
//
// An append-only, in-memory promotion log for unit tests and the ratification surface.
// Every promotion is versioned. A rollback restores the previous champion exactly.
// In production, this is persisted to the Brain (append-only, per rule 11 of CLAUDE.md).

import type { PromotionLogEntry } from '@infinite-ai/contracts';

export interface PromotionRecord {
  readonly entry: PromotionLogEntry;
  readonly rollbackCommand: string;
}

export class PromotionLog {
  private readonly entries: PromotionRecord[] = [];

  /**
   * Records a ratified promotion and returns the rollback command for the ratification surface.
   * The rollback command is a stable string the ratifier and the operator can run by copy-paste.
   */
  append(entry: PromotionLogEntry): PromotionRecord {
    const rollbackCommand = `le:rollback --agent ${entry.agentId} --to-version ${entry.previousChampionVersion} --promotion ${entry.promotionId}`;
    const record: PromotionRecord = { entry, rollbackCommand };
    this.entries.push(record);
    return record;
  }

  /**
   * Returns the current champion version for an agent — the most recently promoted version.
   * Returns null if no promotion has been recorded for this agent.
   */
  currentChampion(agentId: string): string | null {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const rec = this.entries[i];
      if (rec !== undefined && rec.entry.agentId === agentId) {
        return rec.entry.newChampionVersion;
      }
    }
    return null;
  }

  /**
   * Finds the entry to roll back: the most recent promotion for this agent.
   * Returns null if no promotion exists to roll back.
   */
  latestForAgent(agentId: string): PromotionRecord | null {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const rec = this.entries[i];
      if (rec !== undefined && rec.entry.agentId === agentId) {
        return rec;
      }
    }
    return null;
  }

  /**
   * Simulates a rollback: returns the previous champion version for this agent.
   * Does not mutate the log — rollbacks are new events in production (append-only Brain).
   * Returns null when there is nothing to roll back to.
   */
  rollback(agentId: string): { previousVersion: string; rollbackCommand: string } | null {
    const latest = this.latestForAgent(agentId);
    if (!latest) return null;
    return {
      previousVersion: latest.entry.previousChampionVersion,
      rollbackCommand: latest.rollbackCommand,
    };
  }

  allEntries(): readonly PromotionRecord[] {
    return this.entries;
  }
}
