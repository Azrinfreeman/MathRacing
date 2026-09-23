import type { AttemptRecord } from '../game/core/RaceState';

export type PlayerEvidence = {
  playerId: string;
  name: string;
  /** Items solved (one per correct attempt). */
  correct: number;
  attempts: number;
  hintsUsed: number;
  /** Items where any support (visual picture or simpler item) was used. */
  supportUsed: number;
};

export type TopicEvidence = {
  topicId: string;
  /** SK range as printed in the KPM plan. */
  sk: string;
  /** Distinct items the pupils worked on. */
  items: number;
  attempts: number;
  correct: number;
};

export type EvidenceSummary = { players: PlayerEvidence[]; topics: TopicEvidence[] };

/**
 * Teacher-facing evidence from a session's attempt records. This is deliberately descriptive counts only: it
 * never converts anything into a score or a Tahap Penguasaan (TP); that judgement stays with the teacher.
 */
export function summarizeEvidence(
  records: readonly AttemptRecord[],
  players: readonly { id: string; name: string }[],
): EvidenceSummary {
  const perPlayer = new Map<
    string,
    PlayerEvidence & { hintItems: Set<string>; supportItems: Set<string> }
  >();
  for (const p of players) {
    perPlayer.set(p.id, {
      playerId: p.id,
      name: p.name,
      correct: 0,
      attempts: 0,
      hintsUsed: 0,
      supportUsed: 0,
      hintItems: new Set(),
      supportItems: new Set(),
    });
  }
  const perTopic = new Map<string, TopicEvidence & { itemIds: Set<string> }>();
  for (const r of records) {
    if (r.outcome === 'replaced' || r.outcome === 'unsolved') {
      // Closing markers are not attempts by the pupil, but support use on the item still counts.
      const player = perPlayer.get(r.playerId);
      if (player && r.supportUsed !== 'none') player.supportItems.add(`${r.itemIndex}`);
      continue;
    }
    const player = perPlayer.get(r.playerId);
    if (player) {
      player.attempts += 1;
      if (r.correct) player.correct += 1;
      if (r.hintUsed) player.hintItems.add(`${r.itemIndex}`);
      if (r.supportUsed !== 'none') player.supportItems.add(`${r.itemIndex}`);
    }
    let topic = perTopic.get(r.topicId);
    if (!topic) {
      topic = {
        topicId: r.topicId,
        sk: r.standardKandungan,
        items: 0,
        attempts: 0,
        correct: 0,
        itemIds: new Set(),
      };
      perTopic.set(r.topicId, topic);
    }
    topic.attempts += 1;
    if (r.correct) topic.correct += 1;
    topic.itemIds.add(`${r.playerId}:${r.itemIndex}`);
  }
  return {
    players: [...perPlayer.values()].map(({ hintItems, supportItems, ...rest }) => ({
      ...rest,
      hintsUsed: hintItems.size,
      supportUsed: supportItems.size,
    })),
    topics: [...perTopic.values()].map(({ itemIds, ...rest }) => ({
      ...rest,
      items: itemIds.size,
    })),
  };
}
