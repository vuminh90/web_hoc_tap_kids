import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAdaptiveLevel } from './adaptiveLevel.js';
import { getChildMaxLevel, getLevelTiming, getModuleContentLevel } from './learningLevels.js';

test('uses the requested 20/50 maximum levels', () => {
  assert.equal(getChildMaxLevel('vuanhthu'), 20);
  assert.equal(getChildMaxLevel('vuanhduc'), 50);
});

test('keeps content difficulty stable while a cycle tightens time', () => {
  const thuContent = [1, 2, 3, 4].map(level => getModuleContentLevel('vuanhthu', 'math', 'basic_math', level));
  assert.deepEqual(thuContent, [1, 1, 1, 1]);
  assert.ok(getModuleContentLevel('vuanhthu', 'math', 'basic_math', 5) > thuContent[3]);
  assert.equal(getModuleContentLevel('vuanhthu', 'math', 'basic_math', 20), 8);
  assert.equal(getModuleContentLevel('vuanhduc', 'math', 'geometry', 50), 100);
  const times = [1, 2, 3].map(level => getLevelTiming('vuanhthu', 'math', 'basic_math', level, 10).targetSeconds);
  assert.ok(times[0] > times[1]);
  assert.ok(times[1] > times[2]);
});

test('requires two mastered attempts before increasing one level', () => {
  const first = evaluateAdaptiveLevel({
    username: 'vuanhduc', subject: 'math', moduleId: 'algebra', currentLevel: 10,
    correct: 10, total: 10, timeSpentSec: 150, targetTimeSec: 200
  });
  assert.equal(first.nextLevel, 10);
  assert.equal(first.progress.masteryCount, 1);

  const second = evaluateAdaptiveLevel({
    username: 'vuanhduc', subject: 'math', moduleId: 'algebra', currentLevel: 10,
    correct: 9, total: 10, timeSpentSec: 180, targetTimeSec: 200,
    previousProgress: first.progress
  });
  assert.equal(second.nextLevel, 11);
  assert.equal(second.decision, 'up');
});

test('accuracy without target speed keeps the level for speed practice', () => {
  const result = evaluateAdaptiveLevel({
    username: 'vuanhthu', subject: 'math', moduleId: 'basic_math', currentLevel: 6,
    correct: 10, total: 10, timeSpentSec: 250, targetTimeSec: 200
  });
  assert.equal(result.nextLevel, 6);
  assert.equal(result.decision, 'train_speed');
});

test('drops only one level after two weak valid attempts', () => {
  const first = evaluateAdaptiveLevel({
    username: 'vuanhduc', subject: 'math', moduleId: 'logic', currentLevel: 20,
    correct: 4, total: 10, timeSpentSec: 300, targetTimeSec: 300
  });
  const second = evaluateAdaptiveLevel({
    username: 'vuanhduc', subject: 'math', moduleId: 'logic', currentLevel: 20,
    correct: 3, total: 10, timeSpentSec: 300, targetTimeSec: 300,
    previousProgress: first.progress
  });
  assert.equal(second.nextLevel, 19);
  assert.equal(second.decision, 'down');
});
