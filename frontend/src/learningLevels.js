export const CHILD_LEVEL_PROFILES = {
  vuanhthu: {
    name: 'Anh Thư',
    grade: 'Lớp 1',
    maxLevel: 20,
    cycleSize: 4,
    timePhases: [
      { name: 'Làm quen', multiplier: 1.15 },
      { name: 'Luyện đúng', multiplier: 1 },
      { name: 'Luyện nhanh', multiplier: 0.9 },
      { name: 'Làm chủ', multiplier: 0.85 }
    ],
    stages: [
      { max: 4, name: 'Làm quen', focus: 'Nhận biết và làm theo mẫu' },
      { max: 8, name: 'Nền tảng', focus: 'Kiến thức cơ bản của lớp 1' },
      { max: 12, name: 'Luyện chắc', focus: 'Đổi cách hỏi, giảm dần gợi ý' },
      { max: 16, name: 'Vận dụng', focus: 'Kết hợp 2 kỹ năng quen thuộc' },
      { max: 20, name: 'Thử thách', focus: 'Bài nâng cao vừa sức lớp 1' }
    ],
    math: [
      { id: 'basic_math', name: 'Toán - Cộng trừ', contentMax: 8, contentBands: [1, 3, 5, 7, 8], secondsPerItem: 26, complexityGrowth: 0.07 },
      { id: 'visual_math', name: 'Toán - Đếm hình', contentMax: 8, contentBands: [1, 3, 5, 7, 8], secondsPerItem: 32, complexityGrowth: 0.08 }
    ],
    vietnamese: [
      { id: 'prep_passage', name: 'Tiếng Việt - Đọc đoạn văn', contentMax: 4, secondsPerItem: 38, complexityGrowth: 0.08, assessmentMode: 'reading' },
      { id: 'prep_riddle', name: 'Tiếng Việt - Đố vui', contentMax: 4, secondsPerItem: 34, complexityGrowth: 0.08 }
    ]
  },
  vuanhduc: {
    name: 'Anh Đức',
    grade: 'Lớp 4',
    maxLevel: 50,
    cycleSize: 5,
    timePhases: [
      { name: 'Khám phá', multiplier: 1.15 },
      { name: 'Luyện đúng', multiplier: 1 },
      { name: 'Luyện nhanh', multiplier: 0.9 },
      { name: 'Vận dụng', multiplier: 1.05 },
      { name: 'Làm chủ', multiplier: 0.87 }
    ],
    stages: [
      { max: 10, name: 'Củng cố', focus: 'Ôn chắc kiến thức nền' },
      { max: 20, name: 'Chuẩn lớp 4', focus: 'Dạng bài cốt lõi của chương trình' },
      { max: 30, name: 'Vận dụng', focus: 'Kết hợp nhiều bước giải' },
      { max: 40, name: 'Nâng cao', focus: 'Đổi dữ kiện và tăng suy luận' },
      { max: 50, name: 'Thử thách', focus: 'Bài khó nhưng vẫn trong phạm vi tiểu học' }
    ],
    math: [
      { id: 'algebra', name: 'Toán - Số và phép tính', contentMax: 20, secondsPerItem: 24, complexityGrowth: 0.055 },
      { id: 'geometry', name: 'Toán - Hình học', contentMax: 100, contentBands: [5, 7, 10, 14, 20, 28, 38, 52, 70, 100], secondsPerItem: 38, complexityGrowth: 0.06 },
      { id: 'logic', name: 'Toán - Có lời văn', contentMax: 10, secondsPerItem: 48, complexityGrowth: 0.065 },
      { id: 'all', name: 'Toán - Tổng hợp', contentMax: 10, secondsPerItem: 42, complexityGrowth: 0.06 }
    ],
    vietnamese: [
      { id: 'grammar', name: 'Tiếng Việt - Luyện từ và câu', contentMax: 10, secondsPerItem: 28, complexityGrowth: 0.05 },
      { id: 'writing', name: 'Tiếng Việt - Tập làm văn', contentMax: 10, secondsPerItem: 0, complexityGrowth: 0.06, assessmentMode: 'soft-time' },
      { id: 'reading', name: 'Tiếng Việt - Đọc hiểu', contentMax: 4, secondsPerItem: 40, complexityGrowth: 0.055, assessmentMode: 'reading' }
    ]
  }
};

export const getChildLevelProfile = (username) =>
  CHILD_LEVEL_PROFILES[username] || CHILD_LEVEL_PROFILES.vuanhduc;

export const getChildMaxLevel = (username) => getChildLevelProfile(username).maxLevel;

export const getModuleDefinition = (username, subject, moduleId) =>
  getChildLevelProfile(username)[subject]?.find((module) => module.id === moduleId);

export const toContentLevel = (level, maxLevel, contentMax) => {
  const safeMax = Math.max(1, Number(maxLevel) || 1);
  const safeContentMax = Math.max(1, Number(contentMax) || 1);
  const safeLevel = Math.min(safeMax, Math.max(1, Number(level) || 1));
  if (safeMax === 1 || safeContentMax === 1) return 1;
  return 1 + Math.floor(((safeLevel - 1) * (safeContentMax - 1)) / (safeMax - 1));
};

export const getModuleContentLevel = (username, subject, moduleId, level) => {
  const profile = getChildLevelProfile(username);
  const module = getModuleDefinition(username, subject, moduleId);
  const bandCount = Math.ceil(profile.maxLevel / profile.cycleSize);
  const band = Math.ceil(Math.min(profile.maxLevel, Math.max(1, Number(level) || 1)) / profile.cycleSize);
  if (Array.isArray(module?.contentBands) && module.contentBands.length) {
    return module.contentBands[Math.min(band - 1, module.contentBands.length - 1)];
  }
  return toContentLevel(band, bandCount, module?.contentMax || bandCount);
};

export const getLevelStage = (username, level) => {
  const profile = getChildLevelProfile(username);
  return profile.stages.find((stage) => level <= stage.max) || profile.stages[profile.stages.length - 1];
};

export const getLevelPhase = (username, level) => {
  const profile = getChildLevelProfile(username);
  const phaseIndex = (Math.max(1, Number(level) || 1) - 1) % profile.cycleSize;
  return { ...profile.timePhases[phaseIndex], index: phaseIndex + 1 };
};

export const getLevelTiming = (username, subject, moduleId, level, itemCount = 10) => {
  const profile = getChildLevelProfile(username);
  const module = getModuleDefinition(username, subject, moduleId);
  const phase = getLevelPhase(username, level);
  if (!module || module.assessmentMode === 'soft-time' || !module.secondsPerItem) {
    return { targetSeconds: 0, phase, timed: false };
  }
  const band = Math.ceil(Math.min(profile.maxLevel, Math.max(1, Number(level) || 1)) / profile.cycleSize);
  const complexityMultiplier = 1 + ((band - 1) * (module.complexityGrowth || 0));
  const targetSeconds = Math.max(30, Math.round(module.secondsPerItem * itemCount * complexityMultiplier * phase.multiplier));
  return { targetSeconds, phase, timed: true, band };
};

export const createDefaultModuleLevels = (username, fallbackLevel = 1) => {
  const profile = getChildLevelProfile(username);
  const normalized = Math.min(profile.maxLevel, Math.max(1, parseInt(fallbackLevel, 10) || 1));
  return {
    mathDifficultyLevels: Object.fromEntries(profile.math.map((module) => [module.id, normalized])),
    vietnameseModuleLevels: Object.fromEntries(profile.vietnamese.map((module) => [module.id, normalized]))
  };
};
