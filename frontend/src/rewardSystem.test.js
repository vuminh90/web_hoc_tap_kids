import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLearningReward,
  getGuessCorrectedQuality,
  getLevelRewardCap
} from './rewardSystem.js';

test('level is the main driver of the reward ceiling', () => {
  assert.equal(getLevelRewardCap('vuanhthu', 1), 10);
  assert.equal(getLevelRewardCap('vuanhthu', 20), 30);
  assert.equal(getLevelRewardCap('vuanhduc', 1), 10);
  assert.equal(getLevelRewardCap('vuanhduc', 50), 40);
});

test('guess correction maps random four-option performance close to zero', () => {
  assert.equal(getGuessCorrectedQuality(2.5, 10, 4), 0);
  assert.equal(getGuessCorrectedQuality(5, 10, 4), 33);
  assert.equal(getGuessCorrectedQuality(10, 10, 4), 100);
});

test('the same result earns more at a higher level', () => {
  const low = calculateLearningReward({ username: 'vuanhduc', level: 1, qualityPercent: 87, rawAccuracyPercent: 90, timed: false });
  const high = calculateLearningReward({ username: 'vuanhduc', level: 40, qualityPercent: 87, rawAccuracyPercent: 90, timed: false });
  assert.ok(high.total > low.total * 2);
});

test('speed uses total session time and never penalizes an individual fast answer', () => {
  const reward = calculateLearningReward({
    username: 'vuanhthu', level: 20, qualityPercent: 87, rawAccuracyPercent: 90,
    timeSpentSec: 60, targetTimeSec: 100, timed: true
  });
  assert.equal(reward.skillBonus, 3);
  assert.equal(reward.qualityPoints, 25);
});

test('milestone rewards can only be returned when not already claimed', () => {
  const first = calculateLearningReward({
    username: 'vuanhthu', level: 3, nextLevel: 4, levelDecision: 'up', qualityPercent: 100,
    timed: false, claimedMilestones: []
  });
  const repeated = calculateLearningReward({
    username: 'vuanhthu', level: 3, nextLevel: 4, levelDecision: 'up', qualityPercent: 100,
    timed: false, claimedMilestones: [4]
  });
  assert.equal(first.milestoneBonus, 5);
  assert.equal(repeated.milestoneBonus, 0);
});
