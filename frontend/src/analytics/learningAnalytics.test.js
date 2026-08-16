import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeMistakes,
  buildCompetencyProfile,
  buildLearningOverview,
  filterStatsByPeriod
} from './learningAnalytics.js';

const now = new Date('2026-08-16T12:00:00+07:00');

test('filters rolling periods using local calendar boundaries', () => {
  const stats = [
    { date: '2026-08-16T01:00:00+07:00' },
    { date: '2026-08-10T20:00:00+07:00' },
    { date: '2026-08-09T20:00:00+07:00' }
  ];
  assert.equal(filterStatsByPeriod(stats, 'week', now).length, 2);
});

test('uses actual attempted question count instead of assuming ten questions', () => {
  const profile = buildCompetencyProfile([
    { subject: 'math', category: 'logic', correct: 3, incorrect: 2, timeSpentSec: 50, date: '2026-08-15T10:00:00+07:00' },
    { subject: 'math', category: 'logic', correct: 4, incorrect: 1, timeSpentSec: 40, date: '2026-08-16T10:00:00+07:00' }
  ]);
  assert.equal(profile[0].attempts, 10);
  assert.equal(profile[0].accuracyPct, 70);
  assert.equal(profile[0].averageSeconds, 9);
});

test('marks a mistake recurring only across enough occurrences and sessions', () => {
  const wrong = { q: 'Một câu', userAns: 1, correctAns: 2, skill: 'Toán lời văn', errorType: 'comprehension', misconceptionCode: 'word.problem' };
  const mistakes = analyzeMistakes([
    { subject: 'math', category: 'logic', date: '2026-08-15T10:00:00+07:00', wrongDetails: [wrong, { ...wrong, q: 'Câu khác' }] },
    { subject: 'math', category: 'logic', date: '2026-08-16T10:00:00+07:00', wrongDetails: [{ ...wrong, q: 'Câu thứ ba' }] }
  ], now);
  assert.equal(mistakes[0].occurrences, 3);
  assert.equal(mistakes[0].sessions, 2);
  assert.equal(mistakes[0].recurring, true);
  assert.equal(mistakes[0].status, 'Cần ưu tiên');
});

test('excludes random-click sessions from ability accuracy', () => {
  const overview = buildLearningOverview([
    { subject: 'math', category: 'algebra', date: '2026-08-16T08:00:00+07:00', correct: 8, incorrect: 2, timeSpentSec: 100 },
    { subject: 'math', category: 'algebra', date: '2026-08-16T09:00:00+07:00', correct: 0, incorrect: 10, timeSpentSec: 10, randomClicking: true }
  ], 'week', now);
  assert.equal(overview.current.accuracyPct, 80);
  assert.equal(overview.current.validSessions, 1);
});

