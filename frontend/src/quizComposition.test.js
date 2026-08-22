import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDifficultySchedule, buildReadingDifficultySchedule, composeReadingQuestions, getTierContentLevel } from './quizComposition.js';

describe('quiz composition', () => {
  it('starts easy and follows the introductory 6/3/1 ratio', () => {
    const schedule = buildDifficultySchedule('vuanhthu', 1, () => 0.42);
    assert.equal(schedule[0], 'easy');
    assert.equal(schedule.filter((x) => x === 'easy').length, 6);
    assert.equal(schedule.filter((x) => x === 'medium').length, 3);
    assert.equal(schedule.filter((x) => x === 'hard').length, 1);
  });

  it('never places three challenging questions consecutively', () => {
    const schedule = buildDifficultySchedule('vuanhduc', 50, () => 0.1);
    assert.doesNotMatch(schedule.join(','), /(?:hard|special),(?:hard|special),(?:hard|special)/);
  });

  it('maps tiers around the module content level', () => {
    const easy = getTierContentLevel('vuanhduc', 'math', 'algebra', 30, 'easy');
    const hard = getTierContentLevel('vuanhduc', 'math', 'algebra', 30, 'hard');
    const special = getTierContentLevel('vuanhduc', 'math', 'algebra', 30, 'special');
    assert.ok(easy <= hard);
    assert.ok(special >= hard);
  });

  it('uses 2 easy, 2 medium and 1 hard for five reading questions', () => {
    const schedule = buildReadingDifficultySchedule(() => 0.6);
    assert.equal(schedule[0], 'easy');
    assert.equal(schedule.filter((x) => x === 'easy').length, 2);
    assert.equal(schedule.filter((x) => x === 'medium').length, 2);
    assert.equal(schedule.filter((x) => x === 'hard').length, 1);
  });

  it('keeps the first reading-comprehension question easy', () => {
    const questions = Array.from({ length: 5 }, (_, index) => ({ q: `q${index}` }));
    const composed = composeReadingQuestions(questions, () => 0.4);
    assert.equal(composed[0].difficultyTier, 'easy');
    assert.equal(new Set(composed.map((item) => item.q)).size, 5);
  });
});
