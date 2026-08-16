const DAY_MS = 24 * 60 * 60 * 1000;

export const SUBJECT_LABELS = {
  math: 'Toán',
  reading: 'Tiếng Việt'
};

export const CATEGORY_LABELS = {
  algebra: 'Đại số và phép tính',
  geometry: 'Hình học và đếm hình',
  logic: 'Toán có lời văn',
  probability: 'Xác suất',
  all: 'Toán tổng hợp',
  basic_math: 'Cộng trừ',
  visual_math: 'Đếm hình',
  grammar: 'Ngữ pháp',
  writing: 'Tập làm văn',
  reading: 'Đọc thành tiếng và đọc hiểu',
  prep_passage: 'Đọc đoạn văn',
  prep_riddle: 'Đố vui và suy luận',
  prep_letters: 'Nhận biết chữ',
  prep_words: 'Đọc từ'
};

export const ERROR_TYPE_LABELS = {
  concept: 'Hổng kiến thức',
  procedure: 'Sai quy trình',
  comprehension: 'Đọc hiểu đề',
  careless: 'Thiếu cẩn thận',
  behavior: 'Hành vi làm bài',
  fluency: 'Độ trôi chảy',
  writing: 'Kỹ năng viết',
  unknown: 'Cần quan sát thêm'
};

export const parseLearningDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const parts = String(value).split(/[\s,]+/);
  const datePart = parts.find(part => part.includes('/'));
  const timePart = parts.find(part => part.includes(':')) || '00:00:00';
  if (!datePart) return null;
  const [day, month, year] = datePart.split('/');
  const parsed = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${timePart}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfLocalDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const getPeriodDays = period => ({ today: 1, week: 7, month: 30, quarter: 90 }[period] || null);

export const filterStatsByPeriod = (stats = [], period = 'week', now = new Date(), offset = 0) => {
  const days = getPeriodDays(period);
  if (!days) return [...stats];
  const end = new Date(startOfLocalDay(now).getTime() - (offset * days * DAY_MS) + DAY_MS);
  const start = new Date(end.getTime() - (days * DAY_MS));
  return stats.filter(stat => {
    const date = parseLearningDate(stat.date);
    return date && date >= start && date < end;
  });
};

const validQuestionTotal = stat => {
  const correct = Number(stat.correct);
  const incorrect = Number(stat.incorrect);
  return Number.isFinite(correct) && Number.isFinite(incorrect) ? Math.max(0, correct + incorrect) : 0;
};

const accuracyForStat = stat => {
  const total = validQuestionTotal(stat);
  if (total > 0) return Number(stat.correct || 0) / total;
  if (Number.isFinite(Number(stat.accuracy))) return Number(stat.accuracy) / 100;
  if (Number.isFinite(Number(stat.writingScore))) return Number(stat.writingScore) / 10;
  if (Number.isFinite(Number(stat.readingScore))) return Number(stat.readingScore) / 100;
  return null;
};

const confidenceFromEvidence = (attempts, sessions) => {
  if (attempts >= 30 && sessions >= 4) return 'Cao';
  if (attempts >= 12 && sessions >= 2) return 'Trung bình';
  return 'Thấp';
};

const masteryStatus = (accuracy, attempts, sessions) => {
  if (attempts < 5 || sessions < 1 || accuracy === null) return 'Chưa đủ dữ liệu';
  if (accuracy < 0.5) return 'Cần hỗ trợ';
  if (accuracy < 0.75) return 'Đang hình thành';
  if (accuracy < 0.9 || sessions < 3) return 'Đạt';
  return 'Vững';
};

export const buildCompetencyProfile = (stats = []) => {
  const groups = new Map();
  stats.filter(stat => !stat.randomClicking && stat.validForAssessment !== false).forEach(stat => {
    const key = `${stat.subject || 'unknown'}:${stat.category || 'unknown'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        subject: stat.subject,
        category: stat.category,
        sessions: 0,
        attempts: 0,
        correct: 0,
        accuracySamples: [],
        totalSeconds: 0,
        latestLevel: 1,
        latestDate: null
      });
    }
    const group = groups.get(key);
    const total = validQuestionTotal(stat);
    const date = parseLearningDate(stat.date);
    group.sessions += 1;
    group.attempts += total || 1;
    group.correct += total ? Number(stat.correct || 0) : (accuracyForStat(stat) ?? 0);
    if (!total && accuracyForStat(stat) !== null) group.accuracySamples.push(accuracyForStat(stat));
    group.totalSeconds += Math.max(0, Number(stat.timeSpentSec || 0));
    if (!group.latestDate || (date && date > group.latestDate)) {
      group.latestDate = date;
      group.latestLevel = Number(stat.nextDifficultyLevel || stat.difficultyLevel || stat.level || 1);
    }
  });

  return [...groups.values()].map(group => {
    const hasQuestionData = group.correct > 1 || group.attempts > group.sessions;
    const accuracy = hasQuestionData
      ? group.correct / group.attempts
      : (group.accuracySamples.length
        ? group.accuracySamples.reduce((sum, value) => sum + value, 0) / group.accuracySamples.length
        : null);
    return {
      ...group,
      label: CATEGORY_LABELS[group.category] || group.category || 'Chưa phân loại',
      subjectLabel: SUBJECT_LABELS[group.subject] || group.subject,
      accuracyPct: accuracy === null ? null : Math.round(accuracy * 100),
      averageSeconds: group.attempts ? Math.round((group.totalSeconds / group.attempts) * 10) / 10 : 0,
      confidence: confidenceFromEvidence(group.attempts, group.sessions),
      status: masteryStatus(accuracy, group.attempts, group.sessions)
    };
  }).sort((a, b) => (a.accuracyPct ?? -1) - (b.accuracyPct ?? -1));
};

const inferErrorType = (stat, wrong = {}) => {
  if (stat.randomClicking || Number(stat.fastAnswers || 0) >= 3) return 'behavior';
  if (wrong.errorType) return wrong.errorType;
  const skill = String(wrong.skill || '').toLowerCase();
  const category = stat.category;
  if (category === 'logic') return 'comprehension';
  if (category === 'geometry' || category === 'visual_math') return 'procedure';
  if (category === 'writing') return 'writing';
  if (category === 'reading' || category === 'prep_passage') return 'comprehension';
  if (skill.includes('sắp xếp') || skill.includes('câu rõ nghĩa') || skill.includes('từ nối')) return 'procedure';
  if (skill.includes('chính tả') || skill.includes('dấu câu')) return 'careless';
  if (category === 'algebra' || category === 'basic_math') return 'procedure';
  if (category === 'grammar') return 'concept';
  return 'unknown';
};

const normalizedSkill = (stat, wrong = {}) => wrong.skill || CATEGORY_LABELS[stat.category] || stat.category || 'Ôn tập tổng hợp';

const normalizedQuestion = value => String(value || '').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');

const getMistakeAdvice = (type, category, skill) => {
  if (category === 'logic') return 'Cho bé kể lại đề bằng lời của mình, gạch chân dữ kiện, khoanh câu hỏi, vẽ sơ đồ rồi mới chọn phép tính và kiểm tra đơn vị.';
  if (category === 'geometry' || category === 'visual_math') return 'Chia hình thành nhóm nhỏ, đánh dấu hình đã đếm và đếm theo thứ tự từ hình đơn đến hình ghép để tránh bỏ sót hoặc đếm trùng.';
  if (category === 'algebra' || category === 'basic_math') return 'Đặt tính thẳng hàng, nói thành tiếng từng bước và dùng phép tính ngược để kiểm tra kết quả.';
  if (category === 'reading' || category === 'prep_passage') return 'Đọc lại từng đoạn, gạch câu chứa bằng chứng và yêu cầu bé giải thích vì sao các đáp án còn lại chưa phù hợp.';
  if (category === 'writing') return 'Cho bé viết từng câu ngắn, đọc thành tiếng, bổ sung chi tiết rồi tự kiểm tra chủ đề, dấu câu và từ nối.';
  if (String(skill).includes('Chính tả')) return 'Đọc chậm âm đầu và vần dễ nhầm, cho bé viết lại từ đúng trong một câu có nghĩa.';
  if (type === 'behavior') return 'Tạm bỏ áp lực tốc độ, yêu cầu bé đọc đề hai lần và giải thích lựa chọn trước khi bấm đáp án.';
  if (type === 'careless') return 'Dùng checklist ba bước: đọc lại đề, kiểm tra phép tính hoặc câu trả lời, rồi mới nộp.';
  return 'Làm lại một ví dụ có hướng dẫn, yêu cầu bé giải thích cách nghĩ, sau đó luyện 3 câu tương tự từ dễ đến vừa.';
};

export const analyzeMistakes = (stats = [], now = new Date()) => {
  const groups = new Map();
  stats.forEach(stat => {
    const date = parseLearningDate(stat.date);
    const wrongs = Array.isArray(stat.wrongDetails) ? [...stat.wrongDetails] : [];
    if (stat.category === 'writing' && Array.isArray(stat.weakSkills)) {
      stat.weakSkills.forEach(skill => wrongs.push({
        q: stat.topic || 'Bài tập làm văn',
        userAns: 'Bài viết của bé',
        correctAns: 'Đạt tiêu chí trong phiếu hướng dẫn',
        skill,
        errorType: 'writing',
        misconceptionCode: `vietnamese.writing.${String(skill).toLowerCase().replace(/\s+/g, '_')}`
      }));
    }
    if ((stat.category === 'reading' || stat.category === 'prep_letters' || stat.category === 'prep_words') && Number(stat.accuracy) < 70) {
      wrongs.push({
        q: 'Bài đọc thành tiếng',
        userAns: `${stat.accuracy || 0}% chính xác`,
        correctAns: 'Đọc đúng tối thiểu 80% và giữ tốc độ phù hợp',
        skill: 'Đọc chính xác và trôi chảy',
        errorType: 'fluency',
        misconceptionCode: 'vietnamese.reading.oral_fluency'
      });
    }
    wrongs.forEach(wrong => {
      const skill = normalizedSkill(stat, wrong);
      const type = inferErrorType(stat, wrong);
      const signature = wrong.misconceptionCode || `${stat.subject}:${stat.category}:${skill}:${type}`;
      if (!groups.has(signature)) {
        groups.set(signature, {
          id: signature,
          subject: stat.subject,
          category: stat.category,
          skill,
          errorType: type,
          occurrences: 0,
          sessionDates: new Set(),
          examples: [],
          lastSeen: null,
          firstSeen: null,
          recentOccurrences: 0
        });
      }
      const group = groups.get(signature);
      group.occurrences += 1;
      if (date) {
        group.sessionDates.add(date.toISOString());
        if (!group.lastSeen || date > group.lastSeen) group.lastSeen = date;
        if (!group.firstSeen || date < group.firstSeen) group.firstSeen = date;
        if ((now - date) <= 14 * DAY_MS) group.recentOccurrences += 1;
      }
      const qKey = normalizedQuestion(wrong.q);
      if (group.examples.length < 6 && !group.examples.some(item => normalizedQuestion(item.q) === qKey)) {
        group.examples.push({ ...wrong, date: stat.date, level: stat.difficultyLevel || stat.level });
      }
    });
  });

  return [...groups.values()].map(group => {
    const sessions = group.sessionDates.size;
    const confidence = confidenceFromEvidence(group.occurrences, sessions);
    const recurring = group.occurrences >= 3 && sessions >= 2;
    const priorityScore = (group.occurrences * 2) + (group.recentOccurrences * 2) + (recurring ? 4 : 0);
    return {
      ...group,
      sessionDates: [...group.sessionDates],
      sessions,
      confidence,
      recurring,
      priorityScore,
      subjectLabel: SUBJECT_LABELS[group.subject] || group.subject,
      categoryLabel: CATEGORY_LABELS[group.category] || group.category,
      errorTypeLabel: ERROR_TYPE_LABELS[group.errorType] || ERROR_TYPE_LABELS.unknown,
      advice: getMistakeAdvice(group.errorType, group.category, group.skill),
      status: recurring ? 'Cần ưu tiên' : (group.occurrences >= 2 ? 'Đang theo dõi' : 'Mới phát hiện')
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
};

const summaryNumbers = stats => {
  let questions = 0;
  let correct = 0;
  let seconds = 0;
  let validSessions = 0;
  const activeDays = new Set();
  stats.forEach(stat => {
    const date = parseLearningDate(stat.date);
    if (date) activeDays.add(startOfLocalDay(date).toISOString());
    const isValid = !stat.randomClicking && stat.validForAssessment !== false;
    if (isValid) validSessions += 1;
    const total = validQuestionTotal(stat);
    if (isValid && total) {
      questions += total;
      correct += Number(stat.correct || 0);
    }
    seconds += Math.max(0, Number(stat.timeSpentSec || 0));
  });
  return {
    sessions: stats.length,
    validSessions,
    activeDays: activeDays.size,
    questions,
    correct,
    accuracyPct: questions ? Math.round((correct / questions) * 100) : null,
    minutes: Math.round(seconds / 60),
    randomClickSessions: stats.filter(stat => stat.randomClicking).length
  };
};

export const buildLearningOverview = (allStats = [], period = 'week', now = new Date()) => {
  const currentStats = filterStatsByPeriod(allStats, period, now, 0);
  const previousStats = filterStatsByPeriod(allStats, period, now, 1);
  const current = summaryNumbers(currentStats);
  const previous = summaryNumbers(previousStats);
  const accuracyDelta = current.accuracyPct !== null && previous.accuracyPct !== null
    ? current.accuracyPct - previous.accuracyPct
    : null;
  const competencies = buildCompetencyProfile(currentStats);
  const mistakes = analyzeMistakes(currentStats, now);
  return {
    currentStats,
    previousStats,
    current,
    previous,
    accuracyDelta,
    competencies,
    mistakes,
    strengths: [...competencies].filter(item => item.accuracyPct !== null).sort((a, b) => b.accuracyPct - a.accuracyPct).slice(0, 3),
    priorities: competencies.filter(item => item.status === 'Cần hỗ trợ' || item.status === 'Đang hình thành').slice(0, 3)
  };
};

export const buildDailyTrend = (stats = [], days = 14, now = new Date()) => {
  const end = startOfLocalDay(now);
  const rows = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end.getTime() - offset * DAY_MS);
    const dayStats = stats.filter(stat => {
      const itemDate = parseLearningDate(stat.date);
      return itemDate && startOfLocalDay(itemDate).getTime() === date.getTime();
    });
    const summary = summaryNumbers(dayStats);
    rows.push({
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      accuracy: summary.accuracyPct,
      sessions: summary.sessions,
      minutes: summary.minutes
    });
  }
  return rows;
};

export const createInterventionPlan = (mistake, childId, now = new Date()) => {
  const recheckAt = new Date(now.getTime() + 7 * DAY_MS);
  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    childId,
    mistakeId: mistake.id,
    title: `Khắc phục: ${mistake.skill}`,
    subject: mistake.subject,
    category: mistake.category,
    errorType: mistake.errorType,
    evidence: `${mistake.occurrences} lỗi trong ${mistake.sessions} buổi`,
    target: 'Đạt ít nhất 8/10 ở bài đo lại và tự giải thích được cách làm.',
    activities: [
      'Làm lại một câu cũ và để bé giải thích cách nghĩ.',
      'Bố mẹ hướng dẫn theo từng bước, không nói ngay đáp án.',
      'Luyện 3 câu tương tự từ dễ đến vừa.',
      'Đo lại bằng câu mới sau 7 ngày.'
    ],
    advice: mistake.advice,
    sessionsTarget: 3,
    sessionsCompleted: 0,
    durationMinutes: 10,
    createdAt: now.toISOString(),
    recheckAt: recheckAt.toISOString(),
    status: 'active',
    notes: [],
    recheckResult: null
  };
};
