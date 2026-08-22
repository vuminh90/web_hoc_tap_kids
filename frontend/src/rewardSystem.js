import { getChildMaxLevel } from './learningLevels.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const QUALITY_MULTIPLIERS = [
  { min: 100, multiplier: 1 },
  { min: 90, multiplier: 0.92 },
  { min: 80, multiplier: 0.82 },
  { min: 70, multiplier: 0.7 },
  { min: 60, multiplier: 0.5 },
  { min: 50, multiplier: 0.3 },
  { min: 0, multiplier: 0 }
];

const MILESTONE_REWARDS = {
  vuanhthu: { 4: 5, 8: 7, 12: 10, 16: 12, 20: 15 },
  vuanhduc: { 10: 7, 20: 10, 30: 12, 40: 15, 50: 20 }
};

export const getLevelRewardCap = (username, level) => {
  const maxLevel = getChildMaxLevel(username);
  const maxReward = username === 'vuanhthu' ? 30 : 40;
  const normalized = clamp(Number(level) || 1, 1, maxLevel);
  return 10 + Math.round(((maxReward - 10) * (normalized - 1)) / (maxLevel - 1));
};

export const getGuessCorrectedQuality = (correct, total, optionCount = 4) => {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeCorrect = clamp(Number(correct) || 0, 0, safeTotal);
  const wrong = safeTotal - safeCorrect;
  const distractors = Math.max(1, (Number(optionCount) || 4) - 1);
  const corrected = (safeCorrect - (wrong / distractors)) / safeTotal;
  return Math.round(clamp(corrected, 0, 1) * 100);
};

export const getQualityMultiplier = (qualityPercent) =>
  QUALITY_MULTIPLIERS.find((tier) => qualityPercent >= tier.min)?.multiplier || 0;

export const readRewardProgress = (username) => {
  try {
    return JSON.parse(localStorage.getItem(`learningRewardProgress_${username}`) || '{}');
  } catch {
    return {};
  }
};

export const getRewardProgressKey = (subject, moduleId) => `${subject}:${moduleId}`;

export const calculateLearningReward = ({
  username,
  level,
  nextLevel = level,
  levelDecision = 'hold',
  qualityPercent,
  rawAccuracyPercent = qualityPercent,
  timeSpentSec = 0,
  targetTimeSec = 0,
  timed = true,
  skillBonus = null,
  encouraged = false,
  claimedMilestones = []
}) => {
  const levelCap = getLevelRewardCap(username, level);
  const normalizedQuality = clamp(Math.round(Number(qualityPercent) || 0), 0, 100);
  const qualityMultiplier = getQualityMultiplier(normalizedQuality);
  const qualityPoints = Math.round(levelCap * qualityMultiplier);
  const timeRatio = timed && targetTimeSec > 0 ? Math.max(0, timeSpentSec / targetTimeSec) : null;

  let earnedSkillBonus = clamp(Math.round(Number(skillBonus) || 0), 0, 3);
  if (skillBonus === null && timed && rawAccuracyPercent >= 80 && normalizedQuality >= 50 && timeRatio !== null) {
    if (timeRatio <= 0.7) earnedSkillBonus = Math.max(1, Math.round(levelCap * 0.1));
    else if (timeRatio <= 0.85) earnedSkillBonus = Math.max(1, Math.round(levelCap * 0.075));
    else if (timeRatio <= 1) earnedSkillBonus = Math.max(1, Math.round(levelCap * 0.05));
  }

  const levelUpBonus = levelDecision === 'up' ? Math.round(levelCap * 0.2) : 0;
  const encouragementBonus = encouraged ? Math.round(levelCap * 0.1) : 0;
  const milestoneReward = MILESTONE_REWARDS[username]?.[nextLevel] || 0;
  const milestoneBonus = levelDecision === 'up' && milestoneReward && !claimedMilestones.includes(nextLevel)
    ? milestoneReward
    : 0;

  return {
    total: qualityPoints + earnedSkillBonus + levelUpBonus + encouragementBonus + milestoneBonus,
    levelCap,
    qualityPercent: normalizedQuality,
    qualityMultiplier,
    qualityPoints,
    skillBonus: earnedSkillBonus,
    levelUpBonus,
    encouragementBonus,
    milestoneBonus,
    milestoneLevel: milestoneBonus ? nextLevel : null,
    timeRatio: timeRatio === null ? null : Number(timeRatio.toFixed(2))
  };
};

export const saveClaimedMilestone = (username, subject, moduleId, milestoneLevel) => {
  if (!milestoneLevel) return readRewardProgress(username);
  const progress = readRewardProgress(username);
  const key = getRewardProgressKey(subject, moduleId);
  const current = progress[key] || {};
  const claimedMilestones = [...new Set([...(current.claimedMilestones || []), milestoneLevel])].sort((a, b) => a - b);
  const next = { ...progress, [key]: { ...current, claimedMilestones, updatedAt: new Date().toISOString() } };
  localStorage.setItem(`learningRewardProgress_${username}`, JSON.stringify(next));
  return next;
};
