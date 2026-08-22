import { getChildLevelProfile, getModuleContentLevel, getModuleDefinition } from './learningLevels.js';

export const QUIZ_RATIOS = [
  { easy: 6, medium: 3, hard: 1, special: 0 },
  { easy: 4, medium: 4, hard: 2, special: 0 },
  { easy: 3, medium: 4, hard: 2, special: 1 },
  { easy: 2, medium: 3, hard: 3, special: 2 },
  { easy: 1, medium: 3, hard: 3, special: 3 }
];

const shuffle = (items, random) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

const hasLongChallengeRun = (items) => {
  let run = 0;
  return items.some((tier) => {
    run = tier === 'hard' || tier === 'special' ? run + 1 : 0;
    return run > 2;
  });
};

export const getLevelStageIndex = (username, level) => {
  const stages = getChildLevelProfile(username).stages;
  const index = stages.findIndex((stage) => Number(level) <= stage.max);
  return index < 0 ? stages.length - 1 : index;
};

export const buildDifficultySchedule = (username, level, random = Math.random) => {
  const ratio = QUIZ_RATIOS[getLevelStageIndex(username, level)];
  const rest = [];
  Object.entries(ratio).forEach(([tier, count]) => {
    const remaining = tier === 'easy' ? count - 1 : count;
    for (let i = 0; i < remaining; i += 1) rest.push(tier);
  });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = ['easy', ...shuffle(rest, random)];
    if (!hasLongChallengeRun(candidate) && candidate.slice(-3).some((tier) => tier === 'easy' || tier === 'medium')) return candidate;
  }
  const pending = shuffle(rest, random);
  const support = pending.filter((tier) => tier === 'easy' || tier === 'medium');
  const challenge = pending.filter((tier) => tier === 'hard' || tier === 'special');
  const result = ['easy'];
  while (challenge.length || support.length) {
    if (challenge.length) result.push(challenge.shift());
    if (challenge.length) result.push(challenge.shift());
    if (support.length) result.push(support.shift());
  }
  return result;
};

export const getTierContentLevel = (username, subject, moduleId, level, tier = 'medium') => {
  const base = getModuleContentLevel(username, subject, moduleId, level);
  const max = getModuleDefinition(username, subject, moduleId)?.contentMax || base;
  const step = Math.max(1, Math.round(max / 20));
  const offsets = { easy: -2, medium: -1, hard: 0, special: 1 };
  return Math.min(max, Math.max(1, base + (offsets[tier] ?? -1) * step));
};

export const buildReadingDifficultySchedule = (random = Math.random) => [
  'easy',
  ...shuffle(['easy', 'medium', 'medium', 'hard'], random)
];

export const composeReadingQuestions = (questions, random = Math.random) => {
  if (!Array.isArray(questions) || questions.length !== 5) return questions || [];
  const pools = {
    easy: shuffle(questions.slice(0, 2), random),
    medium: shuffle(questions.slice(2, 4), random),
    hard: questions.slice(4)
  };
  const schedule = buildReadingDifficultySchedule(random);
  return schedule.map((tier) => ({ ...pools[tier].shift(), difficultyTier: tier }));
};
