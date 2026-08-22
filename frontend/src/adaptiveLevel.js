import { getChildMaxLevel, getLevelPhase, getLevelStage, getLevelTiming } from './learningLevels.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const readProgressMap = (username) => {
  try {
    return JSON.parse(localStorage.getItem(`learningLevelProgress_${username}`) || '{}');
  } catch {
    return {};
  }
};

export const getProgressKey = (subject, moduleId) => `${subject}:${moduleId}`;

export const describeLevel = (username, subject, moduleId, level, itemCount = 10) => ({
  level,
  maxLevel: getChildMaxLevel(username),
  stage: getLevelStage(username, level),
  phase: getLevelPhase(username, level),
  timing: getLevelTiming(username, subject, moduleId, level, itemCount)
});

export const evaluateAdaptiveLevel = ({
  username,
  currentLevel,
  correct,
  total,
  scorePercent,
  timeSpentSec,
  targetTimeSec,
  isTimeout = false,
  timeRequired = true,
  previousProgress = {}
}) => {
  const maxLevel = getChildMaxLevel(username);
  const safeLevel = clamp(parseInt(currentLevel, 10) || 1, 1, maxLevel);
  const accuracy = clamp(
    Number.isFinite(scorePercent) ? scorePercent / 100 : ((Number(correct) || 0) / Math.max(1, Number(total) || 1)),
    0,
    1
  );
  const hasTarget = timeRequired && Number(targetTimeSec) > 0;
  const timeRatio = hasTarget ? Math.max(0, Number(timeSpentSec) || 0) / Number(targetTimeSec) : null;
  const timeMet = !hasTarget || (!isTimeout && timeRatio <= 1);
  const valid = true;
  const mastered = accuracy >= 0.9 && timeMet;
  const proficient = accuracy >= 0.8;
  const weak = accuracy < 0.6;
  const result = {
    level: safeLevel,
    accuracy: Math.round(accuracy * 100),
    timeRatio: timeRatio === null ? null : Number(timeRatio.toFixed(2)),
    timeMet,
    mastered,
    proficient,
    weak,
    valid,
    at: new Date().toISOString()
  };

  const sameLevelResults = previousProgress.level === safeLevel && Array.isArray(previousProgress.recentResults)
    ? previousProgress.recentResults
    : [];
  const recentResults = [...sameLevelResults, result].slice(-3);
  const masteryCount = recentResults.filter((item) => item.mastered).length;
  const lastTwo = recentResults.slice(-2);
  const weakTwice = lastTwo.length === 2 && lastTwo.every((item) => item.weak);

  let nextLevel = safeLevel;
  let decision = 'hold';
  let message = `Giữ level ${safeLevel} để luyện chắc hơn.`;
  if (mastered && masteryCount >= 2 && safeLevel < maxLevel) {
    nextLevel = safeLevel + 1;
    decision = 'up';
    message = `Đã làm chủ cả độ chính xác và thời gian. Bé lên level ${nextLevel}.`;
  } else if (weakTwice && safeLevel > 1) {
    nextLevel = safeLevel - 1;
    decision = 'down';
    message = `Hai lượt gần nhất còn yếu. Hệ thống giảm về level ${nextLevel} và nới nhịp để ôn chắc.`;
  } else if (accuracy >= 0.9 && !timeMet) {
    decision = 'train_speed';
    message = `Bé làm đúng nhưng chưa đạt thời gian mục tiêu; giữ level ${safeLevel} để luyện tốc độ.`;
  } else if (mastered && safeLevel === maxLevel) {
    decision = 'max_mastered';
    message = `Bé đã làm chủ level tối đa ${maxLevel} của module này.`;
  } else if (proficient) {
    message = masteryCount === 1
      ? `Bé đã có 1 lượt đạt chuẩn ở level ${safeLevel}; cần thêm 1 lượt ổn định để lên level.`
      : `Bé hiểu bài ở level ${safeLevel}; tiếp tục luyện độ ổn định và tốc độ.`;
  } else if (weak) {
    decision = 'review';
    message = `Giữ level ${safeLevel} và tăng hỗ trợ; chỉ giảm nếu kết quả yếu lặp lại.`;
  }

  const nextProgress = {
    level: nextLevel,
    recentResults: nextLevel === safeLevel ? recentResults : [],
    lastDecision: decision,
    lastAccuracy: result.accuracy,
    lastTimeRatio: result.timeRatio,
    masteryCount: nextLevel === safeLevel ? masteryCount : 0,
    updatedAt: result.at
  };

  return { nextLevel, decision, message, result, progress: nextProgress };
};

export const saveAdaptiveProgress = (username, subject, moduleId, progress) => {
  const map = readProgressMap(username);
  const key = getProgressKey(subject, moduleId);
  const nextMap = { ...map, [key]: progress };
  localStorage.setItem(`learningLevelProgress_${username}`, JSON.stringify(nextMap));
  return nextMap;
};
