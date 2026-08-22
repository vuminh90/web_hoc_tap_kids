import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncToServer } from '../sync';
import { createAdvancedShapePuzzle, createShapePuzzle } from '../math/shapePuzzleGenerator';
import FairPlayReminder from './FairPlayReminder';
import { getChildMaxLevel, getLevelPhase, getLevelTiming, getModuleContentLevel } from '../learningLevels';
import { evaluateAdaptiveLevel, getProgressKey, readProgressMap, saveAdaptiveProgress } from '../adaptiveLevel';

const GRADE3_CATEGORIES = [
  { id: 'algebra', name: 'Đại số (Cộng/Trừ, Nhân/Chia)', icon: '🔢' },
  { id: 'geometry', name: 'Hình học: Đếm hình nâng cao', icon: '📐' },
  { id: 'logic', name: 'Toán có lời văn (Logic)', icon: '🧠' },
  { id: 'all', name: 'Đề Tổng hợp', icon: '🏆' }
];

const PREP_CATEGORIES = [
  { id: 'basic_math', name: 'Phép tính cộng, trừ trong phạm vi 100', icon: '➕' },
  { id: 'visual_math', name: 'Hình học: Đếm số lượng hình', icon: '▢' }
];

const PREP_DIFFICULTIES = [
  { key: 'easy', name: 'Dễ', minLevel: 1, maxLevel: 2, pointBonus: 0, time: 120 },
  { key: 'medium', name: 'Trung bình', minLevel: 3, maxLevel: 4, pointBonus: 2, time: 100 },
  { key: 'hard', name: 'Khó', minLevel: 5, maxLevel: 6, pointBonus: 4, time: 85 },
  { key: 'special', name: 'Đặc biệt', minLevel: 7, maxLevel: 8, pointBonus: 7, time: 70 }
];

const MAX_GRADE3_ALGEBRA_LEVEL = 20;
const MAX_GRADE4_WORD_LEVEL = 10;
const WORD_PROBLEMS_PER_LEVEL = 50;
const MIN_GRADE3_SHAPE_LEVEL = 5;
const MAX_GRADE3_SHAPE_LEVEL = 100;
const MIN_ANSWER_TIME_MS = 2000;
const getPrepDifficulty = (lvl) => PREP_DIFFICULTIES.find(d => lvl >= d.minLevel && lvl <= d.maxLevel) || PREP_DIFFICULTIES[0];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const DIFFICULTY_NAMES = [
  'Mới bắt đầu',
  'Rất dễ',
  'Dễ',
  'Dễ+',
  'Trung bình',
  'Trung bình+',
  'Khó',
  'Khó+',
  'Rất khó',
  'Thử thách'
];

const getCategoryMaxDifficulty = (isAdvancedStudent) => {
  return isAdvancedStudent ? 50 : 20;
};
const getDifficultyName = (level, maxLevel) => {
  const index = Math.ceil((clamp(level, 1, maxLevel) / maxLevel) * DIFFICULTY_NAMES.length) - 1;
  return DIFFICULTY_NAMES[clamp(index, 0, DIFFICULTY_NAMES.length - 1)];
};
const readLevelMap = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
};
const getMathMistakeAdvice = (catId, wrongItem = {}) => {
  if (wrongItem.svg || catId === 'geometry' || catId === 'visual_math') {
    return 'Cách sửa: đếm từng nhóm nhỏ, đánh dấu hình đã đếm, rồi kiểm tra lại từ trái sang phải để tránh bỏ sót hoặc đếm trùng.';
  }
  if (catId === 'logic') {
    return 'Cách sửa: gạch chân dữ kiện quan trọng, viết phép tính từng bước ra giấy nháp, làm xong đọc lại câu hỏi để chắc đáp án đúng đơn vị.';
  }
  if (catId === 'algebra' || catId === 'basic_math') {
    return 'Cách sửa: đặt tính thẳng hàng, làm chậm từng hàng đơn vị/chục/trăm, sau đó thử tính ngược để kiểm tra kết quả.';
  }
  return 'Cách sửa: đọc lại đề 2 lần, xác định đề hỏi gì, viết phép tính ra giấy nháp rồi mới chọn đáp án.';
};

const getMathMistakeMetadata = (catId, question = {}) => {
  const skillNames = {
    algebra: 'Thực hiện phép tính',
    basic_math: 'Cộng trừ',
    geometry: 'Hình học và đếm hình',
    visual_math: 'Đếm hình',
    logic: 'Đọc hiểu toán có lời văn',
    all: 'Toán tổng hợp'
  };
  const errorTypes = {
    algebra: 'procedure',
    basic_math: 'procedure',
    geometry: 'procedure',
    visual_math: 'procedure',
    logic: 'comprehension',
    all: 'concept'
  };
  const skill = question.skill || skillNames[catId] || 'Ôn tập Toán';
  return {
    skill,
    errorType: question.errorType || errorTypes[catId] || 'unknown',
    misconceptionCode: question.misconceptionCode || `math.${catId}.${String(skill).toLowerCase().replace(/\s+/g, '_')}`
  };
};

const getQuizBasePoints = (correct) => {
  if (correct <= 4) return 0;
  if (correct <= 6) return 2;
  if (correct === 7) return 5;
  if (correct === 8) return 8;
  if (correct === 9) return 10;
  return 12;
};

const getGrade3ShapeMaxReward = (level) => 10 + Math.floor(Math.min(MAX_GRADE3_SHAPE_LEVEL, Math.max(MIN_GRADE3_SHAPE_LEVEL, level)) * 0.4);
const getGrade3AlgebraMaxReward = (level) => 12 + Math.floor(Math.min(MAX_GRADE3_ALGEBRA_LEVEL, Math.max(1, level)) * 0.8);
const getGrade4WordMaxReward = (level) => 16 + Math.floor(Math.min(MAX_GRADE4_WORD_LEVEL, Math.max(1, level)) * 2.4);

export default function GameArea() {
  const navigate = useNavigate();
  const currentUser = localStorage.getItem('currentUser') || 'vuanhduc';
  const isGrade3 = currentUser === 'vuanhduc';

  const difficultyLevelKey = `mathDifficultyLevels_${currentUser}`;
  const [difficultyLevels, setDifficultyLevels] = useState(() => readLevelMap(difficultyLevelKey));
  const [activeDifficultyLevel, setActiveDifficultyLevel] = useState(1);
  const [activeTimeLevel, setActiveTimeLevel] = useState(1);

  const [screen, setScreen] = useState('hub'); 
  const [category, setCategory] = useState(null);
  const [interventions, setInterventions] = useState({});
  const [usedQuestions, setUsedQuestions] = useState(new Set()); // Anti-repetition
  
  const [question, setQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, startTime: null });
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [canAnswer, setCanAnswer] = useState(false);
  const [fairPlayReminder, setFairPlayReminder] = useState(null);
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [maxTime, setMaxTime] = useState(0);
  const timerRef = useRef(null);
  const answerDelayRef = useRef(null);
  const questionStartedAtRef = useRef(null);
  const answerTimingsRef = useRef([]);

  const beginAnswerDelay = () => {
    clearTimeout(answerDelayRef.current);
    questionStartedAtRef.current = Date.now();
    setCanAnswer(false);
    answerDelayRef.current = setTimeout(() => setCanAnswer(true), MIN_ANSWER_TIME_MS);
  };

  const recordAnswerTiming = () => {
    const elapsedMs = Date.now() - (questionStartedAtRef.current || Date.now());
    answerTimingsRef.current.push(elapsedMs);
    return false;
  };

  const getStoredDifficultyLevel = (catId) => {
    const maxLevel = getCategoryMaxDifficulty(isGrade3, catId);
    return clamp(parseInt(difficultyLevels[catId] || '1', 10), 1, maxLevel);
  };

  const saveDifficultyLevel = (catId, nextLevel) => {
    const maxLevel = getCategoryMaxDifficulty(isGrade3, catId);
    const normalized = clamp(nextLevel, 1, maxLevel);
    const nextLevels = { ...difficultyLevels, [catId]: normalized };
    setDifficultyLevels(nextLevels);
    localStorage.setItem(difficultyLevelKey, JSON.stringify(nextLevels));
    return normalized;
  };

  // --- INTERVENTION ENGINE ---
  useEffect(() => {
    const statsKey = `learningStats_${currentUser}`;
    const allStats = JSON.parse(localStorage.getItem(statsKey) || '[]');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayStats = allStats.filter(s => s.date.startsWith(todayStr) && s.subject === 'math');
    
    const catData = {};
    GRADE3_CATEGORIES.forEach(c => { catData[c.id] = { plays: 0, correct: 0, total: 0 }; });
    PREP_CATEGORIES.forEach(c => { catData[c.id] = { plays: 0, correct: 0, total: 0 }; });
    
    todayStats.forEach(s => {
      if (catData[s.category]) {
        catData[s.category].plays += 1;
        catData[s.category].correct += (s.correct || 0);
        catData[s.category].total += 10; 
      }
    });

    const newInterventions = {};
    let maxPlays = 0;
    
    Object.keys(catData).forEach(k => {
      if (k === 'all') return;
      if (catData[k].plays > maxPlays) maxPlays = catData[k].plays;
    });

    // Check Auto Intervention toggle from Admin
    const isInterventionEnabled = localStorage.getItem('autoInterventionEnabled') !== 'false'; // Default true

    if (isInterventionEnabled) {
      Object.keys(catData).forEach(k => {
        if (k === 'all') return;
        const data = catData[k];
        const acc = data.total > 0 ? (data.correct / data.total) : 0;
        
        if (data.plays > 0 && data.plays === maxPlays && data.plays >= 2) {
          if (acc >= 0.8) {
            if (data.plays >= 4) newInterventions[k] = 'nerfed';
          }
        } else if (data.plays === 0 && maxPlays >= 2) {
          newInterventions[k] = 'boosted'; // Encourage weak/unplayed subjects
        }
      });
    }
    setInterventions(newInterventions);
  }, [currentUser, screen]);

  // --- COUNTDOWN EFFECT ---
  useEffect(() => {
    if (screen === 'playing' && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timerRef.current);
    } else if (screen === 'playing' && timeLeft === 0) {
      handleFinishGame(stats, wrongAnswers, true);
    }
  }, [timeLeft, screen]);

  useEffect(() => () => clearTimeout(answerDelayRef.current), []);

  // --- PROCEDURAL GENERATORS (AI ENGINE) ---
  const generateAlgebra3 = (lvl) => {
    const effectiveLevel = Math.min(MAX_GRADE3_ALGEBRA_LEVEL, Math.max(1, lvl));
    const typeCount = effectiveLevel >= 3 ? 8 : 5;
    const type = Math.floor(Math.random() * typeCount);
    const maxVal = effectiveLevel <= 2 ? 100 : (effectiveLevel <= 6 ? 1000 : (effectiveLevel <= 12 ? 5000 : 10000));
    
    if (type === 0) { // Addition
      const a = Math.floor(Math.random() * maxVal) + 10;
      const b = Math.floor(Math.random() * maxVal) + 10;
      return { q: `${a} + ${b} = ?`, ans: a + b };
    } else if (type === 1) { // Subtraction
      const a = Math.floor(Math.random() * maxVal) + 20;
      const b = Math.floor(Math.random() * a);
      return { q: `${a} - ${b} = ?`, ans: a - b };
    } else if (type === 2) { // Multiplication
      const maxMulA = effectiveLevel <= 2 ? 5 : 9;
      const maxMulB = effectiveLevel === 1 ? 10 : (effectiveLevel <= 6 ? 50 : 100);
      const a = Math.floor(Math.random() * maxMulA) + 2;
      const b = Math.floor(Math.random() * maxMulB) + 2;
      return { q: `${a} x ${b} = ?`, ans: a * b };
    } else if (type === 3) { // Division
      const maxDivA = effectiveLevel <= 2 ? 5 : 9;
      const maxDivAns = effectiveLevel === 1 ? 10 : (effectiveLevel <= 6 ? 50 : 100);
      const b = Math.floor(Math.random() * maxDivA) + 2;
      const ans = Math.floor(Math.random() * maxDivAns) + 2;
      const a = b * ans;
      return { q: `${a} : ${b} = ?`, ans: ans };
    } else if (type === 4) { // Finding X
      const isAdd = Math.random() > 0.5;
      const ans = Math.floor(Math.random() * (maxVal/2)) + 10;
      if (isAdd) {
        const b = Math.floor(Math.random() * (maxVal/2)) + 10;
        return { q: `Tìm X: X + ${b} = ${ans + b}`, ans: ans };
      } else {
        const b = Math.floor(Math.random() * (maxVal/2)) + 10;
        return { q: `Tìm X: X - ${b} = ${ans}`, ans: ans + b }; // Wait, ans is X, so X = ans + b. So ans is the option.
      }
    } else if (type === 5) { // Parentheses: (a + b) x c
      const a = randInt(2, 20 + effectiveLevel);
      const b = randInt(2, 20 + effectiveLevel);
      const c = randInt(2, Math.min(12, 4 + Math.floor(effectiveLevel / 2)));
      return { q: `(${a} + ${b}) x ${c} = ?`, ans: (a + b) * c };
    } else if (type === 6) { // Parentheses: a x (b + c)
      const a = randInt(2, Math.min(12, 4 + Math.floor(effectiveLevel / 2)));
      const b = randInt(2, 15 + effectiveLevel);
      const c = randInt(2, 15 + effectiveLevel);
      return { q: `${a} x (${b} + ${c}) = ?`, ans: a * (b + c) };
    } else { // Parentheses: (a - b) : c
      const c = randInt(2, Math.min(12, 4 + Math.floor(effectiveLevel / 2)));
      const ans = randInt(2, 10 + effectiveLevel);
      const b = randInt(5, 30 + effectiveLevel);
      const a = b + ans * c;
      return { q: `(${a} - ${b}) : ${c} = ?`, ans };
    }
  };

  const generateGeometry3 = (lvl, excludedKeys = usedQuestions) => {
    const selected = createAdvancedShapePuzzle(lvl, Math.random, excludedKeys);
    return {
      q: selected.q,
      svg: selected.svg,
      ans: selected.ans,
      skill: selected.skill,
      key: selected.key
    };
  };

  const generateProbability3 = (lvl) => {
    const nouns = ["viên bi", "quả bóng", "cái kẹo", "chiếc bút"];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const colors = ["đỏ", "xanh", "vàng", "đen"];
    const c1 = colors[Math.floor(Math.random() * 2)];
    const c2 = colors[Math.floor(Math.random() * 2) + 2];
    
    const total = lvl <= 2 ? 5 : 10;
    const red = Math.floor(Math.random() * total);
    return { 
      q: `Trong hộp có ${red} ${noun} ${c1} và ${total - red} ${noun} ${c2}. Lấy ngẫu nhiên 1 ${noun}. Khả năng lấy được ${noun} ${c1} là? (0: Không thể, 1: Có thể, 2: Chắc chắn)`, 
      ans: red === 0 ? 0 : (red === total ? 2 : 1) 
    };
  };

  const generateLogic3 = (lvl) => {
    const templates = [
      () => {
        const nouns = ["quả cam", "viên bi", "quyển vở", "cái kẹo"];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const ans = Math.floor(Math.random() * 5) + 3; // 3-7
        const finalC = Math.floor(Math.random() * 4) + 2; // 2-5
        const d = Math.floor(Math.random() * 3) + 1; // 1-3
        const finalB = Math.floor(Math.random() * 8) + 2; // 2-9
        const finalA = (ans + d) * finalC + finalB;
        return { 
          q: `Mẹ có ${finalA} ${noun}. Mẹ cho đi ${finalB} ${noun}. Số ${noun} còn lại mẹ chia đều vào ${finalC} hộp. Nhưng một hộp bị hỏng mất ${d} ${noun}. Hỏi hộp đó còn lại bao nhiêu ${noun} nguyên vẹn?`,
          ans: ans
        };
      },
      () => {
        const a = Math.floor(Math.random() * 5) + 2;
        const diff = Math.floor(Math.random() * 3) + 3; // 3-5 times
        return {
          q: `Năm nay con ${a} tuổi. Tuổi bố gấp ${diff} lần tuổi con. Hỏi bố hơn con bao nhiêu tuổi?`,
          ans: (a * diff) - a
        };
      },
      () => {
        const price = (Math.floor(Math.random() * 5) + 2) * 1000;
        const qty = Math.floor(Math.random() * 4) + 2;
        const total = price * qty;
        const paid = total + (Math.floor(Math.random() * 3) + 1) * 5000;
        return {
          q: `An mua ${qty} quyển truyện, mỗi quyển giá ${price}đ. An đưa cô bán hàng ${paid}đ. Hỏi cô bán hàng phải thối lại bao nhiêu tiền?`,
          ans: paid - total
        };
      },
      () => {
        const groups = Math.floor(Math.random() * 4) + 3; // 3-6
        const perGroup = Math.floor(Math.random() * 5) + 4; // 4-8
        const total = groups * perGroup;
        const absent = Math.floor(Math.random() * 3) + 1;
        return {
          q: `Lớp 3A có ${total} học sinh, được chia đều thành ${groups} tổ. Hôm nay tổ 1 có ${absent} bạn nghỉ học. Hỏi hôm nay tổ 1 có bao nhiêu bạn đi học?`,
          ans: perGroup - absent
        };
      },
      // --- NEW ADVANCED TEMPLATES FROM PDF ---
      () => { // Transporting people (Division with Math.ceil)
        const busCap = Math.floor(Math.random() * 10) * 5 + 30; // 30, 35, 40, 45...
        const buses = Math.floor(Math.random() * 3) + 3; // 3-5 buses
        const totalPpl = busCap * (buses - 1) + Math.floor(Math.random() * (busCap - 5)) + 1; 
        return {
          q: `Trường cần thuê xe ô tô ${busCap} chỗ ngồi để chở ${totalPpl} học sinh đi tham quan. Hỏi cần ít nhất bao nhiêu xe ô tô để chở hết số học sinh?`,
          ans: Math.ceil(totalPpl / busCap)
        };
      },
      () => { // Planting trees/posts (Distance / Interval + 1)
        const interval = Math.floor(Math.random() * 4) + 2; // 2-5 m
        const posts = Math.floor(Math.random() * 10) + 10; // 10-19 posts
        const distance = interval * (posts - 1);
        return {
          q: `Một đoạn đường dài ${distance}m. Người ta trồng cây ở cả 2 đầu đường, cứ cách ${interval}m lại trồng một cây. Hỏi có bao nhiêu cây trên đoạn đường đó?`,
          ans: posts
        };
      },
      () => { // Age difference over time trick
        const bro = Math.floor(Math.random() * 5) + 10; // 10-14
        const sis = Math.floor(Math.random() * 3) + 5; // 5-7
        const years = Math.floor(Math.random() * 5) + 3; // 3-7
        return {
          q: `Hiện nay anh ${bro} tuổi, em ${sis} tuổi. Hỏi ${years} năm nữa anh hơn em bao nhiêu tuổi?`,
          ans: bro - sis
        };
      },
      () => { // Geometry Perimeter with gaps
        const side = Math.floor(Math.random() * 10) + 10; // 10-19
        const doors = Math.floor(Math.random() * 2) + 1; // 1-2 doors
        const doorWidth = Math.floor(Math.random() * 2) + 2; // 2-3m
        return {
          q: `Khu vườn hình vuông cạnh ${side}m. Người ta rào xung quanh và để lại ${doors} cửa ra vào, mỗi cửa rộng ${doorWidth}m. Hỏi hàng rào dài bao nhiêu mét?`,
          ans: side * 4 - doors * doorWidth
        };
      },
      () => { // Simple Time / Calendar logic
        const days = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu"];
        const dayIdx = Math.floor(Math.random() * days.length);
        const date = Math.floor(Math.random() * 15) + 1;
        const addWeeks = Math.floor(Math.random() * 2) + 1;
        return {
          q: `${days[dayIdx]} tuần này là ngày ${date}. Hỏi ${days[dayIdx]} tuần sau (cùng tháng) là ngày mấy?`,
          ans: date + 7
        };
      },
      // --- NEW MULTI-STEP LOGIC FROM 90 TOAN DO (PROBLEMS 10-15) ---
      () => { // Time Travel (Ngày 1 Bài 10)
        const min1 = Math.floor(Math.random() * 10) + 10; // 10-19
        const mult = Math.floor(Math.random() * 2) + 2; // 2-3
        return {
          q: `Nam đi bộ từ nhà đến hiệu sách hết ${min1} phút. Quãng đường từ hiệu sách đến sân bóng đi lâu gấp ${mult} lần từ nhà đến hiệu sách. Hỏi Nam đi từ nhà đến sân bóng (qua hiệu sách) mất tất cả bao nhiêu phút?`,
          ans: min1 + (min1 * mult)
        };
      },
      () => { // Resource Management (Ngày 2 Bài 14)
        const box = Math.floor(Math.random() * 3) + 4; // 4-6
        const itemPerBox = Math.floor(Math.random() * 5) + 8; // 8-12
        const remove = Math.floor(Math.random() * 10) + 5; // 5-14
        const addBox = Math.floor(Math.random() * 2) + 2; // 2-3
        return {
          q: `Cửa hàng có ${box} hộp bút, mỗi hộp ${itemPerBox} chiếc. Buổi sáng bán đi ${remove} chiếc. Buổi chiều nhập thêm ${addBox} hộp cùng loại. Hỏi cuối ngày cửa hàng có bao nhiêu chiếc bút?`,
          ans: (box * itemPerBox) - remove + (addBox * itemPerBox)
        };
      },
      () => { // Perimeter Walk (Ngày 1 Bài 12 / Ngày 3 Bài 12)
        const length = Math.floor(Math.random() * 10) + 20; // 20-29
        const diff = Math.floor(Math.random() * 5) + 5; // 5-9
        const width = length - diff;
        const rounds = Math.floor(Math.random() * 2) + 2; // 2-3
        const extra = Math.floor(Math.random() * 10) + 10; // 10-19
        return {
          q: `Sân trường hình chữ nhật có chiều dài ${length}m, chiều rộng kém chiều dài ${diff}m. Bác bảo vệ đi tuần tra quanh sân ${rounds} vòng, rồi đi thêm ${extra}m để về phòng. Hỏi bác đã đi tất cả bao nhiêu mét?`,
          ans: (length + width) * 2 * rounds + extra
        };
      },
      () => { // Multi-day task (Ngày 2 Bài 11)
        const total = Math.floor(Math.random() * 20) + 80; // 80-99
        const d1 = Math.floor(Math.random() * 5) + 10; // 10-14
        const diff = Math.floor(Math.random() * 5) + 5; // 5-9
        const mult = 2;
        const d2 = d1 + diff;
        const d3 = d1 * mult;
        return {
          q: `Minh đọc cuốn sách ${total} trang trong 4 ngày. Ngày đầu đọc ${d1} trang. Ngày hai đọc nhiều hơn ngày đầu ${diff} trang. Ngày ba đọc gấp ${mult} lần ngày đầu. Hỏi ngày thứ tư Minh cần đọc bao nhiêu trang để xong cuốn sách?`,
          ans: total - (d1 + d2 + d3)
        };
      },
      () => { // Tile Laying (Ngày 2 Bài 12)
        const len = Math.floor(Math.random() * 5) + 5; // 5-9 dm
        const wid = Math.floor(Math.random() * 3) + 3; // 3-5 dm
        const broken = Math.floor(Math.random() * 4) + 2; // 2-5
        return {
          q: `Bác thợ lát nền một lối đi hình chữ nhật dài ${len}dm, rộng ${wid}dm bằng các viên gạch hình vuông cạnh 1dm. Trong khi lát, bác làm vỡ ${broken} viên nên phải dùng viên mới thay vào. Hỏi bác đã dùng tất cả bao nhiêu viên gạch nguyên vẹn?`,
          ans: (len * wid) + broken
        };
      },
      () => { // Money Shopping (Ngày 3 Bài 11)
        const priceA = (Math.floor(Math.random() * 3) + 5) * 1000; // 5k-7k
        const qtyA = Math.floor(Math.random() * 2) + 3; // 3-4
        const priceB = (Math.floor(Math.random() * 2) + 3) * 1000; // 3k-4k
        const qtyB = Math.floor(Math.random() * 2) + 2; // 2-3
        const envs = Math.floor(Math.random() * 2) + 2; // 2-3
        const ans = (Math.floor(Math.random() * 5) + 5) * 1000; // 5k-9k
        const totalMoney = (priceA * qtyA) + (priceB * qtyB) + (ans * envs);
        return {
          q: `Mai có ${totalMoney}đ. Mai mua ${qtyA} quyển vở (mỗi quyển ${priceA}đ) và ${qtyB} cây bút (mỗi cây ${priceB}đ). Số tiền còn lại Mai chia đều vào ${envs} con heo đất. Hỏi mỗi con heo đất có bao nhiêu tiền?`,
          ans: ans
        };
      },
      // --- NEW TEMPLATES FROM THAY CUONG PDF ---
      () => { // Rút về đơn vị
        const A = Math.floor(Math.random() * 4) + 5; // 5-8
        const C = Math.floor(Math.random() * 3) + 2; // 2-4
        const val = (Math.floor(Math.random() * 5) + 5) * 10; // 50-90 kg per bag
        const B = A * val;
        return {
          q: `Có ${A} bao gạo đựng tất cả ${B} kg gạo. Hỏi ${C} bao gạo như thế đựng bao nhiêu kg?`,
          ans: val * C
        };
      },
      () => { // Nested multiplication
        const A = Math.floor(Math.random() * 3) + 3; // 3-5
        const B = Math.floor(Math.random() * 3) + 4; // 4-6
        const C = Math.floor(Math.random() * 5) + 20; // 20-24
        return {
          q: `Cửa hàng có ${A} thùng kẹo. Mỗi thùng có ${B} hộp kẹo. Mỗi hộp có ${C} viên kẹo. Hỏi cửa hàng có tất cả bao nhiêu viên kẹo?`,
          ans: A * B * C
        };
      },
      () => { // Fraction and remainder
        const B = Math.floor(Math.random() * 3) + 4; // 4-6
        const val = Math.floor(Math.random() * 5) + 5; // 5-9
        const A = B * val;
        return {
          q: `Một bao gạo có ${A} kg. Người ta lấy ra 1/${B} số gạo trong bao. Hỏi trong bao còn lại bao nhiêu kg gạo?`,
          ans: A - val
        };
      },
      () => { // 3 quantities relation
        const A = Math.floor(Math.random() * 10) + 12; // 12-21
        const B = Math.floor(Math.random() * 2) + 3; // 3-4
        const C = 2;
        return {
          q: `Có 3 thùng dầu. Thùng thứ nhất có ${A} lít. Thùng thứ hai chứa nhiều gấp ${B} lần thùng thứ nhất. Thùng thứ ba chứa ít hơn thùng thứ hai ${C} lần. Hỏi thùng thứ ba chứa bao nhiêu lít?`,
          ans: (A * B) / C
        };
      },
      () => { // Sum with ratio
        const B = Math.floor(Math.random() * 3) + 3; // 3-5
        const val = Math.floor(Math.random() * 5) + 10; // 10-14
        const A = B * val;
        return {
          q: `Lan có ${A} quyển truyện. Số truyện của Lan gấp ${B} lần số truyện của Mai. Hỏi cả hai bạn có tất cả bao nhiêu quyển truyện?`,
          ans: A + val
        };
      },
      // --- NEW TEMPLATES FROM HSG LOP 3 PDF ---
      () => { // Transfer logic (Working backwards)
        const total = 42; 
        const finalPerRow = total / 3; // 14
        const B = Math.floor(Math.random() * 4) + 3; // 3-6
        // If row 1 gives 1/3 of its students, it retains 2/3. So finalPerRow must be divisible by 2.
        // Let's generate row 1 so it's a multiple of 3.
        const row1 = Math.floor(Math.random() * 3 + 6) * 3; // 18, 21, 24, 27
        const transferred = row1 / 3;
        const remainingRow1 = row1 - transferred;
        
        // We need total to be such that remainingRow1 = total/3.
        const newTotal = remainingRow1 * 3;
        const newFinalPerRow = newTotal / 3;
        
        return {
          q: `Có ${newTotal} bạn xếp thành 3 hàng không đều nhau. Chuyển 1/3 số bạn ở hàng Một sang hàng Hai, rồi lại chuyển ${B} bạn từ hàng Hai sang hàng Ba, lúc này số bạn ở mỗi hàng đều bằng nhau. Hỏi lúc đầu hàng Một có bao nhiêu bạn?`,
          ans: row1
        };
      },
      () => { // Bird branches (Ratio after transfer)
        const C = Math.floor(Math.random() * 3) + 2; // 2-4
        const finalUpper = Math.floor(Math.random() * 4) + 3; // 3-6
        const A = finalUpper + C; // Original upper
        const mult = Math.floor(Math.random() * 3) + 2; // 2-4
        const finalLower = finalUpper * mult;
        const origLower = finalLower - C;
        const B = origLower - A; 
        if (B < 0) return { q: `Một đàn chim đậu trên 2 cành cây. Cành trên có 12 con, cành dưới có 16 con. Nếu 5 con từ cành trên bay xuống cành dưới thì số chim cành dưới gấp mấy lần cành trên?`, ans: 3 }; // fallback
        return {
          q: `Có ${A} con chim đậu ở cành trên, số chim đậu ở cành dưới nhiều hơn cành trên là ${B} con. Bây giờ ${C} con ở cành trên đậu xuống cành dưới. Hỏi lúc này số chim ở cành dưới gấp mấy lần số chim ở cành trên?`,
          ans: mult
        };
      },
      () => { // Constant difference with unknown addition
        const A = Math.floor(Math.random() * 5) + 5; // 5-9
        const X = Math.floor(Math.random() * 5) + 3; // 3-7
        const B = 2 * A + X; 
        return {
          q: `Thùng thứ nhất có ${A} lít dầu, thùng thứ hai có ${B} lít dầu. Hỏi phải cùng rót thêm vào mỗi thùng bao nhiêu lít dầu để số dầu ở thùng thứ hai gấp đôi số dầu ở thùng thứ nhất?`,
          ans: X
        };
      },
      // --- NEW TEMPLATES FROM TERRY CHEW (7-8 TUỔI) ---
      () => { // Interval (Trees)
        const trees = Math.floor(Math.random() * 5) + 5; // 5-9
        const distance = Math.floor(Math.random() * 5) + 2; // 2-6
        return {
          q: `Trên đường có ${trees} cái cây được trồng cách đều nhau. Mỗi cây cách nhau ${distance}m. Hỏi cây thứ ${trees} cách cây thứ nhất bao nhiêu mét?`,
          ans: (trees - 1) * distance
        };
      },
      () => { // Substitution
        const square = Math.floor(Math.random() * 5) + 3; // 3-7
        const circle = Math.floor(Math.random() * 5) + 3; // 3-7
        const eq1 = square + circle;
        const eq2 = square + circle + square;
        return {
          q: `Biết: Hình Tròn + Hình Vuông = ${eq1} và Hình Tròn + Hình Vuông + Hình Vuông = ${eq2}. Hỏi Hình Vuông có giá trị là bao nhiêu?`,
          ans: square
        };
      },
      () => { // Age problem
        const ageA = Math.floor(Math.random() * 5) + 5; // 5-9
        const ageB = Math.floor(Math.random() * 5) + 25; // 25-29
        const years = Math.floor(Math.random() * 5) + 5; // 5-9
        return {
          q: `Năm nay bé ${ageA} tuổi, mẹ ${ageB} tuổi. Hỏi ${years} năm nữa tổng số tuổi của hai mẹ con là bao nhiêu?`,
          ans: ageA + ageB + years * 2
        };
      },
      () => { // Chicken and Rabbit
        const bikes = Math.floor(Math.random() * 4) + 2; // 2-5
        const trikes = Math.floor(Math.random() * 4) + 2; // 2-5
        const totalVehicles = bikes + trikes;
        const totalWheels = bikes * 2 + trikes * 3;
        return {
          q: `Trong sân có ${totalVehicles} chiếc xe gồm xe đạp (2 bánh) và xe ba bánh. Tổng cộng đếm được ${totalWheels} bánh xe. Hỏi có bao nhiêu chiếc xe ba bánh?`,
          ans: trikes
        };
      },
      () => { // Clock striking (Intervals of time)
        const ticks1 = Math.floor(Math.random() * 2) + 3; // 3-4
        const intervalTime = Math.floor(Math.random() * 2) + 2; // 2-3 seconds per interval
        const time1 = (ticks1 - 1) * intervalTime;
        const ticks2 = Math.floor(Math.random() * 3) + 5; // 5-7
        return {
          q: `Một chiếc đồng hồ quả lắc mất ${time1} giây để đánh ${ticks1} tiếng chuông. Hỏi nó sẽ mất bao nhiêu giây để đánh ${ticks2} tiếng chuông?`,
          ans: (ticks2 - 1) * intervalTime
        };
      }
    ];
    return templates[Math.floor(Math.random() * templates.length)]();
  };

  const createWordProblemByPattern = (level, index) => {
    const n = index + 1;
    const scale = level * 2 + Math.floor(index / 5);
    const pattern = index % 10;

    if (pattern === 0) {
      const boxes = 3 + level + (n % 5);
      const each = 6 + scale + (n % 7);
      const sold = 4 + level + (n % 9);
      return {
        q: `Cửa hàng có ${boxes} hộp bút, mỗi hộp có ${each} chiếc. Buổi sáng bán ${sold} chiếc. Hỏi cửa hàng còn lại bao nhiêu chiếc bút?`,
        ans: boxes * each - sold
      };
    }
    if (pattern === 1) {
      const unit = 4 + level + (n % 6);
      const first = unit * (2 + (n % 3));
      const second = first + (level + 2) * (1 + (n % 4));
      return {
        q: `Lan đọc ngày thứ nhất ${first} trang sách. Ngày thứ hai Lan đọc nhiều hơn ngày thứ nhất ${second - first} trang. Hỏi hai ngày Lan đọc được tất cả bao nhiêu trang?`,
        ans: first + second
      };
    }
    if (pattern === 2) {
      const length = 18 + scale + (n % 12);
      const width = length - (4 + level + (n % 5));
      const rounds = 1 + Math.floor(level / 4) + (n % 2);
      return {
        q: `Một sân hình chữ nhật dài ${length}m, rộng ${width}m. Đức chạy quanh sân ${rounds} vòng. Hỏi Đức chạy tất cả bao nhiêu mét?`,
        ans: (length + width) * 2 * rounds
      };
    }
    if (pattern === 3) {
      const pack = 5 + level + (n % 8);
      const total = pack * (6 + (n % 7));
      const need = 2 + level + (n % 5);
      return {
        q: `Có ${total} kg gạo đựng đều trong ${pack} bao. Hỏi ${need} bao như thế đựng bao nhiêu kg gạo?`,
        ans: (total / pack) * need
      };
    }
    if (pattern === 4) {
      const priceA = (4 + level + (n % 6)) * 1000;
      const qtyA = 2 + (n % 4);
      const priceB = (3 + level + (n % 5)) * 1000;
      const qtyB = 1 + (n % 3);
      const change = (5 + level + (n % 8)) * 1000;
      const paid = priceA * qtyA + priceB * qtyB + change;
      return {
        q: `Mai mua ${qtyA} quyển vở, mỗi quyển ${priceA}đ và ${qtyB} cây bút, mỗi cây ${priceB}đ. Mai đưa người bán ${paid}đ. Hỏi Mai được trả lại bao nhiêu tiền?`,
        ans: change
      };
    }
    if (pattern === 5) {
      const interval = 2 + level + (n % 5);
      const trees = 8 + level + (n % 10);
      return {
        q: `Người ta trồng ${trees} cây thành một hàng thẳng, hai cây liền nhau cách ${interval}m. Hỏi cây đầu tiên cách cây cuối cùng bao nhiêu mét?`,
        ans: (trees - 1) * interval
      };
    }
    if (pattern === 6) {
      const child = 7 + (n % 5);
      const parent = child * 3 + level + (n % 7);
      const years = 3 + level + (n % 6);
      return {
        q: `Năm nay Đức ${child} tuổi, bố ${parent} tuổi. Hỏi sau ${years} năm nữa tổng số tuổi của hai bố con là bao nhiêu?`,
        ans: child + parent + years * 2
      };
    }
    if (pattern === 7) {
      const side = 6 + level + (n % 8);
      const broken = 2 + level + (n % 6);
      return {
        q: `Bác thợ lát nền một phòng hình vuông cạnh ${side}dm bằng gạch hình vuông cạnh 1dm. Khi lát bị vỡ ${broken} viên nên phải thay viên mới. Hỏi bác thợ đã dùng tất cả bao nhiêu viên gạch?`,
        ans: side * side + broken
      };
    }
    if (pattern === 8) {
      const square = 3 + level + (n % 7);
      const circle = 2 + level + (n % 6);
      return {
        q: `Biết Hình tròn + Hình vuông = ${circle + square}; Hình tròn + 2 hình vuông = ${circle + square * 2}. Hỏi hình vuông có giá trị bằng bao nhiêu?`,
        ans: square
      };
    }

    const total = 60 + level * 12 + (n % 20);
    const day1 = 8 + level + (n % 8);
    const day2 = day1 + 3 + (n % 5);
    const day3 = day1 * (2 + (level >= 7 ? 1 : 0));
    return {
      q: `Minh đọc một cuốn sách ${total} trang trong 4 ngày. Ngày một đọc ${day1} trang, ngày hai đọc ${day2} trang, ngày ba đọc ${day3} trang. Hỏi ngày bốn Minh cần đọc bao nhiêu trang để xong sách?`,
      ans: total - day1 - day2 - day3
    };
  };

  const GRADE4_WORD_PROBLEMS = Array.from({ length: MAX_GRADE4_WORD_LEVEL }, (_, levelIndex) => {
    const problemLevel = levelIndex + 1;
    return Array.from({ length: WORD_PROBLEMS_PER_LEVEL }, (_, problemIndex) => ({
      ...createWordProblemByPattern(problemLevel, problemIndex),
      level: problemLevel,
      skill: `Toán có lời văn lớp 4 - cấp ${problemLevel}`,
      key: `grade4-word-${problemLevel}-${problemIndex + 1}`
    }));
  }).flat();

  const generateWordProblem4 = (lvl, excludedKeys = usedQuestions) => {
    const effectiveLevel = Math.min(MAX_GRADE4_WORD_LEVEL, Math.max(1, lvl));
    const pool = GRADE4_WORD_PROBLEMS.filter(item => item.level === effectiveLevel);
    const available = pool.filter(item => !excludedKeys.has(item.key));
    const selectedPool = available.length ? available : pool;
    return selectedPool[Math.floor(Math.random() * selectedPool.length)];
  };

  const generatePrepMath = (lvl) => {
    const difficulty = getPrepDifficulty(lvl);
    const isAdd = Math.random() < (difficulty.key === 'easy' ? 0.65 : 0.52);
    const maxTens = difficulty.key === 'easy' ? 3 : (difficulty.key === 'medium' ? 6 : 9);

    if (isAdd) {
      const sumUnitsTarget = difficulty.key === 'easy' ? randInt(2, 8) : randInt(3, 9);
      const aUnits = randInt(0, sumUnitsTarget);
      const bUnits = sumUnitsTarget - aUnits;
      const maxTensSum = difficulty.key === 'easy' ? 3 : (difficulty.key === 'medium' ? 7 : 9);
      const aTens = randInt(difficulty.key === 'easy' ? 0 : 1, maxTens);
      const bTens = randInt(0, Math.max(0, maxTensSum - aTens));
      const a = aTens * 10 + aUnits;
      const b = bTens * 10 + bUnits;
      return {
        q: `${a} + ${b} = ?`,
        ans: a + b,
        difficulty: difficulty.name,
        skill: 'Cộng không nhớ trong phạm vi 100'
      };
    }

    const aTens = randInt(difficulty.key === 'easy' ? 0 : 1, maxTens);
    const bTens = randInt(0, aTens);
    const aUnits = randInt(difficulty.key === 'easy' ? 1 : 0, 9);
    const bUnits = randInt(0, aUnits);
    let a = aTens * 10 + aUnits;
    let b = bTens * 10 + bUnits;

    if (a === b) {
      a = Math.min(99, a + 1);
    }

    return {
      q: `${a} - ${b} = ?`,
      ans: a - b,
      difficulty: difficulty.name,
      skill: 'Trừ không mượn trong phạm vi 100'
    };
  };

  const generatePrepVisual = (lvl, excludedKeys = usedQuestions) => {
    const difficulty = getPrepDifficulty(lvl);
    const selected = createShapePuzzle(lvl, Math.random, excludedKeys);

    return {
      q: selected.q,
      svg: selected.svg,
      ans: selected.ans,
      difficulty: difficulty.name,
      skill: selected.skill,
      key: selected.key
    };
  };

  // --- ANTI-REPETITION WRAPPER ---
  const generateUniqueQuestion = (catId, currentLevel, questionHistory = usedQuestions) => {
    const contentLevel = getModuleContentLevel(currentUser, 'math', catId, currentLevel);
    let qObj;
    let attempts = 0;
    let foundUnique = false;

    while (!foundUnique && attempts < 20) {
      if (isGrade3) {
        if (catId === 'algebra') qObj = generateAlgebra3(contentLevel);
        else if (catId === 'geometry') qObj = generateGeometry3(contentLevel, questionHistory);
        else if (catId === 'probability') qObj = generateProbability3(contentLevel);
        else if (catId === 'logic') qObj = generateWordProblem4(contentLevel, questionHistory);
        else {
          const funcs = [generateAlgebra3, lvl => generateGeometry3(lvl, questionHistory), lvl => generateWordProblem4(lvl, questionHistory)];
          qObj = funcs[Math.floor(Math.random() * funcs.length)](contentLevel);
        }
      } else {
        if (catId === 'basic_math') qObj = generatePrepMath(contentLevel);
        else qObj = generatePrepVisual(contentLevel, questionHistory);
      }

      const questionKey = qObj.key || `${qObj.q}|${qObj.svg || ''}`;
      if (!questionHistory.has(questionKey)) {
        foundUnique = true;
        const newUsed = new Set(questionHistory);
        newUsed.add(questionKey);
        setUsedQuestions(newUsed);
      }
      attempts++;
    }

    let opts = [qObj.ans];
    const isShapeQuestion = (!isGrade3 && catId === 'visual_math') || (isGrade3 && catId === 'geometry');
    const optionSpread = !isGrade3 && isShapeQuestion ? 5 : 12;
    const optionMin = isShapeQuestion ? 1 : 0;
    const optionMax = !isGrade3 && isShapeQuestion
      ? 6
      : (!isGrade3 ? 100 : Math.max(100, qObj.ans + optionSpread));
    const nearbyOptions = [];
    for (let offset = -optionSpread; offset <= optionSpread; offset++) {
      if (offset !== 0) nearbyOptions.push(qObj.ans + offset);
    }
    nearbyOptions.sort(() => Math.random() - 0.5);
    nearbyOptions.forEach(fakeAns => {
      if (opts.length < 4 && fakeAns >= optionMin && fakeAns <= optionMax && !opts.includes(fakeAns)) {
        opts.push(fakeAns);
      }
    });
    while (opts.length < 4) {
      const fakeAns = randInt(optionMin, optionMax);
      if (!opts.includes(fakeAns)) opts.push(fakeAns);
    }
    opts.sort(() => Math.random() - 0.5);
    
    setQuestion(qObj);
    setOptions(opts);
    beginAnswerDelay();
  };

  const beginGame = (catId, effectiveLevel, effectiveTimeLevel, calculatedMaxTime) => {
    setActiveDifficultyLevel(effectiveLevel);
    setActiveTimeLevel(effectiveTimeLevel);
    setCategory(catId);
    setScreen('playing');
    setStats({ correct: 0, incorrect: 0, startTime: Date.now() });
    setWrongAnswers([]);
    setQuestionIndex(0);
    answerTimingsRef.current = [];
    setCanAnswer(false);
    const freshQuestionHistory = new Set();
    setUsedQuestions(freshQuestionHistory); // Reset anti-repetition for new game
    
    setMaxTime(calculatedMaxTime);
    setTimeLeft(calculatedMaxTime);

    generateUniqueQuestion(catId, effectiveLevel, freshQuestionHistory);
  };

  const startGame = (catId) => {
    const effectiveLevel = getStoredDifficultyLevel(catId);
    const effectiveTimeLevel = getLevelPhase(currentUser, effectiveLevel).index;
    const calculatedMaxTime = getLevelTiming(currentUser, 'math', catId, effectiveLevel, 10).targetSeconds;
    const contentLevel = getModuleContentLevel(currentUser, 'math', catId, effectiveLevel);
    const previewReward = isGrade3 && catId === 'geometry'
      ? getGrade3ShapeMaxReward(contentLevel)
      : (isGrade3 && catId === 'logic'
        ? getGrade4WordMaxReward(contentLevel)
        : (isGrade3 && catId === 'algebra'
          ? getGrade3AlgebraMaxReward(contentLevel)
          : getQuizBasePoints(10) + getPrepDifficulty(contentLevel).pointBonus));
    setFairPlayReminder({
      timeSec: calculatedMaxTime,
      rewardText: `tối đa khoảng ${previewReward} 💎 nếu làm tốt`,
      onConfirm: () => beginGame(catId, effectiveLevel, effectiveTimeLevel, calculatedMaxTime)
    });
  };

  const handleAnswer = (ans) => {
    if (!canAnswer) return;
    recordAnswerTiming();
    const isCorrect = ans === question.ans;
    let newStats = { ...stats };
    let newWrongs = [...wrongAnswers];
    if (isCorrect) {
      newStats.correct += 1;
    } else {
      newStats.incorrect += 1;
      newWrongs.push({
        q: question.q,
        svg: question.svg,
        userAns: ans,
        correctAns: question.ans,
        advice: getMathMistakeAdvice(category, question),
        ...getMathMistakeMetadata(category, question)
      });
      setWrongAnswers(newWrongs);
    }
    setStats(newStats);

    if (questionIndex + 1 < 10) {
      setQuestionIndex(questionIndex + 1);
      generateUniqueQuestion(category, activeDifficultyLevel);
    } else {
      handleFinishGame(newStats, newWrongs);
    }
  };

  const handleFinishGame = (finalStats, finalWrongs = [], isTimeout = false) => {
    clearTimeout(timerRef.current);
    const timeSpentSec = maxTime - timeLeft;
    const isGrade3Shape = isGrade3 && category === 'geometry';
    const isGrade3Algebra = isGrade3 && category === 'algebra';
    const isGrade4Word = isGrade3 && category === 'logic';
    const effectiveLevel = activeDifficultyLevel;
    const contentLevel = getModuleContentLevel(currentUser, 'math', category, effectiveLevel);
    const effectiveTimeLevel = activeTimeLevel;
    
    // Check intervention multiplier
    let multiplier = 1;
    if (interventions[category] === 'nerfed') multiplier = 0.5;
    if (interventions[category] === 'boosted') multiplier = 2;

    // Calculate base points
    const prepDifficulty = getPrepDifficulty(contentLevel);
    const fastAnswers = 0;
    const answerTimings = answerTimingsRef.current;
    const averageAnswerMs = answerTimings.length
      ? Math.round(answerTimings.reduce((sum, item) => sum + item, 0) / answerTimings.length)
      : 0;
    const isRandomClicking = false;
    const fastMultiplier = 1;
    const difficultyBonus = !isGrade3 && finalStats.correct >= 5 ? prepDifficulty.pointBonus : 0;
    let earnedPoints = isGrade3Shape
      ? Math.round(getGrade3ShapeMaxReward(contentLevel) * (finalStats.correct / 10))
      : (isGrade3Algebra
        ? Math.round(getGrade3AlgebraMaxReward(contentLevel) * (finalStats.correct / 10) * multiplier)
        : (isGrade4Word
          ? Math.round(getGrade4WordMaxReward(contentLevel) * (finalStats.correct / 10) * multiplier)
          : Math.round((getQuizBasePoints(finalStats.correct) + difficultyBonus) * multiplier)));
    
    // Speed Bonus (Not affected by multiplier)
    let bonus = 0;
    let bonusReason = "";
    if (!isGrade3Shape && finalStats.correct >= 8) {
      if (timeLeft > maxTime * 0.5) {
        bonus = 5;
        bonusReason = "Thưởng Tốc Độ Siêu Tốc (+5💎)";
      } else if (timeLeft > maxTime * 0.2) {
        bonus = 2;
        bonusReason = "Thưởng Tốc Độ Nhanh (+2💎)";
      }
    }
    if (!isGrade3 && finalStats.correct === 10) {
      bonus += 3;
      bonusReason = bonusReason ? `${bonusReason} + Hoàn hảo (+3💎)` : "Hoàn hảo (+3💎)";
    }
    if (isGrade3Shape) earnedPoints = Math.round(earnedPoints * multiplier);
    earnedPoints = Math.round((earnedPoints + bonus) * fastMultiplier);

    // Level controls both content difficulty and target time. Two mastered
    // sessions among the latest three are required before moving up.
    const progressMap = readProgressMap(currentUser);
    const progressKey = getProgressKey('math', category);
    const evaluation = evaluateAdaptiveLevel({
      username: currentUser,
      subject: 'math',
      moduleId: category,
      currentLevel: effectiveLevel,
      correct: finalStats.correct,
      total: 10,
      timeSpentSec,
      targetTimeSec: maxTime,
      isTimeout,
      isRandomClicking,
      previousProgress: progressMap[progressKey]
    });
    const savedDifficultyLevel = saveDifficultyLevel(category, evaluation.nextLevel);
    saveAdaptiveProgress(currentUser, 'math', category, evaluation.progress);
    const savedTimeLevel = getLevelPhase(currentUser, savedDifficultyLevel).index;
    const nextMaxTime = getLevelTiming(currentUser, 'math', category, savedDifficultyLevel, 10).targetSeconds;
    const levelMessage = evaluation.message;
    const timeMessage = `Mục tiêu thời gian level ${savedDifficultyLevel}: ${nextMaxTime}s cho 10 câu.`;

    // Save Stats
    const statsKey = `learningStats_${currentUser}`;
    const learningHistory = JSON.parse(localStorage.getItem(statsKey) || '[]');
    learningHistory.unshift({
      schemaVersion: 3,
      sessionId: globalThis.crypto?.randomUUID?.() || `math-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(), 
      subject: 'math',
      category: category,
      correct: finalStats.correct,
      incorrect: finalStats.incorrect,
      timeSpentSec: timeSpentSec,
      points: earnedPoints,
      fastAnswers: fastAnswers,
      averageAnswerMs,
      randomClicking: isRandomClicking,
      validForAssessment: !isRandomClicking,
      level: effectiveLevel,
      difficultyLevel: effectiveLevel,
      nextDifficultyLevel: savedDifficultyLevel,
      levelDecision: evaluation.decision,
      accuracyPercent: evaluation.result.accuracy,
      targetTimeSec: maxTime,
      timeRatio: evaluation.result.timeRatio,
      timeMet: evaluation.result.timeMet,
      masteryCount: evaluation.progress.masteryCount,
      contentLevel,
      difficultyName: getDifficultyName(effectiveLevel, getCategoryMaxDifficulty(isGrade3, category)),
      timeLevel: effectiveTimeLevel,
      nextTimeLevel: savedTimeLevel,
      maxTimeSec: maxTime,
      maxReward: isGrade3Shape ? getGrade3ShapeMaxReward(contentLevel) : (isGrade4Word ? getGrade4WordMaxReward(contentLevel) : undefined),
      wrongDetails: finalWrongs
    });
    if (learningHistory.length > 1000) learningHistory.length = 1000;
    localStorage.setItem(statsKey, JSON.stringify(learningHistory));

    const pointKey = `points_${currentUser}`;
    const historyKey = `pointsHistory_${currentUser}`;
    const currentPoints = parseInt(localStorage.getItem(pointKey) || '0', 10);
    
    if (earnedPoints > 0) {
      localStorage.setItem(pointKey, (currentPoints + earnedPoints).toString());
      const pHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
      pHistory.unshift({
        date: new Date().toISOString(),
        amount: earnedPoints,
        reason: `Kiểm tra Toán (${category})`,
        subject: 'math'
      });
      localStorage.setItem(historyKey, JSON.stringify(pHistory));
    }

    let interventionMsg = "";
    if (isTimeout) interventionMsg += "⏰ Hết giờ. Bạn cần cố gắng làm bài nhanh hơn!\n";
    if (multiplier === 0.5) interventionMsg += "Phần thưởng môn này đã bị giảm 50% do làm quá nhiều!\n";
    if (multiplier === 2) interventionMsg += "Tuyệt vời! Bạn nhận được x2 Điểm Khuyến khích!\n";
    setStats({
      ...finalStats,
      earnedPoints,
      timeSpentSec,
      interventionMsg,
      bonusReason,
      levelMessage,
      timeMessage,
      fastAnswers,
      averageAnswerMs,
      level: effectiveLevel,
      difficultyName: getDifficultyName(effectiveLevel, getCategoryMaxDifficulty(isGrade3, category)),
      timeLevel: effectiveTimeLevel,
      nextTimeLevel: savedTimeLevel,
      maxReward: isGrade3Shape ? getGrade3ShapeMaxReward(contentLevel) : (isGrade4Word ? getGrade4WordMaxReward(contentLevel) : undefined)
    });
    setWrongAnswers(finalWrongs || []);
    syncToServer(currentUser);
    setScreen('result');
  };


  if (screen === 'hub') {
    const categories = isGrade3 ? GRADE3_CATEGORIES : PREP_CATEGORIES;
    return (
      <>
      <div className="card" style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2>Góc Học Toán Học 🧮</h2>
        <div className="grid-2-col">
          {categories.map(c => {
            const isLocked = interventions[c.id] === 'locked';
            const isNerfed = interventions[c.id] === 'nerfed';
            const isBoosted = interventions[c.id] === 'boosted';
            return (
              <button 
                key={c.id} 
                onClick={() => !isLocked && startGame(c.id)}
                disabled={isLocked}
                style={{ 
                  padding: '20px', fontSize: '1.1rem', 
                  backgroundColor: isLocked ? '#E0E0E0' : (isBoosted ? '#E8F5E9' : '#E3F2FD'), 
                  color: isLocked ? '#9E9E9E' : (isBoosted ? '#2E7D32' : '#1565C0'), 
                  border: `2px solid ${isLocked ? '#BDBDBD' : (isBoosted ? '#81C784' : '#90CAF9')}`, 
                  borderRadius: '10px',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  position: 'relative'
                }}
              >
                {isLocked && <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#F44336', color: 'white', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>🔒 KHOÁ</div>}
                {isNerfed && <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#FF9800', color: 'white', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>⚠️ Giảm 50% Điểm</div>}
                {isBoosted && <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#4CAF50', color: 'white', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>⭐ Khuyến khích x2 Điểm</div>}
                
                <div style={{ fontSize: '2rem', marginBottom: '10px', filter: isLocked ? 'grayscale(100%)' : 'none' }}>{c.icon}</div>
                <div>{c.name}</div>
                <div style={{ marginTop: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  Level {getStoredDifficultyLevel(c.id)}/{getChildMaxLevel(currentUser)} · {getLevelPhase(currentUser, getStoredDifficultyLevel(c.id)).name}
                </div>
              </button>
            )
          })}
        </div>
        <button onClick={() => navigate('/student')} style={{ marginTop: '30px', backgroundColor: '#888' }}>Trở lại</button>
      </div>
      <FairPlayReminder
        reminder={fairPlayReminder}
        onCancel={() => setFairPlayReminder(null)}
        onConfirm={() => {
          const confirmAction = fairPlayReminder?.onConfirm;
          setFairPlayReminder(null);
          confirmAction?.();
        }}
      />
      </>
    );
  }

  if (screen === 'result') {
    return (
      <div className="card">
        <h2 style={{ color: '#E65100', textAlign: 'center' }}>Kết quả Bài kiểm tra</h2>
        <div style={{ background: '#E8F5E9', padding: '15px', borderRadius: '10px', textAlign: 'center', marginBottom: '20px' }}>
          <h3>Đạt: {stats.correct}/10 điểm</h3>
          <p>Thời gian: {stats.timeSpentSec}s</p>
          <p style={{ color: '#4CAF50', fontWeight: 'bold' }}>{stats.interventionMsg} {stats.bonusReason}</p>
          {stats.levelMessage && <p style={{ color: '#6A1B9A', fontWeight: 'bold' }}>{stats.levelMessage}</p>}
          {stats.timeMessage && <p style={{ color: '#455A64' }}>{stats.timeMessage}</p>}
          <p style={{ color: '#1976D2', fontSize: '1.2rem', fontWeight: 'bold' }}>Tổng thưởng: {stats.earnedPoints} 💎</p>
        </div>

        {wrongAnswers.length > 0 && (
          <div style={{ background: '#FFEBEE', padding: '15px', borderRadius: '10px', marginBottom: '20px', textAlign: 'left' }}>
            <h3 style={{ color: '#D32F2F', marginTop: 0 }}>Các câu cần ôn lại ({wrongAnswers.length}):</h3>
            {wrongAnswers.map((w, idx) => (
              <div key={idx} style={{ background: 'white', padding: '10px', borderRadius: '5px', marginBottom: '10px', borderLeft: '4px solid #F44336' }}>
                <div style={{ marginBottom: '5px' }}><strong>Câu hỏi:</strong> {w.q}</div>
                {w.svg && <div dangerouslySetInnerHTML={{ __html: w.svg }} />}
                <div style={{ color: '#D32F2F' }}><strong>Bé chọn:</strong> {w.userAns} ❌</div>
                <div style={{ color: '#388E3C' }}><strong>Đáp án đúng:</strong> {w.correctAns} ✅</div>
                <div style={{ marginTop: '8px', color: '#5D4037', background: '#FFF8E1', padding: '8px', borderRadius: '6px' }}><strong>Cách sửa:</strong> {w.advice || getMathMistakeAdvice(category, w)}</div>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => navigate('/student')} style={{ width: '100%', padding: '15px', fontSize: '1.2rem', backgroundColor: '#FF9800' }}>
          Quay về trang chủ
        </button>
      </div>
    );
  }

  const timerColor = timeLeft > maxTime * 0.5 ? '#4CAF50' : (timeLeft > maxTime * 0.2 ? '#FF9800' : '#FF5252');

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: '#E65100', margin: 0 }}>Câu {questionIndex + 1}/10</h2>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: timerColor, padding: '5px 15px', border: `2px solid ${timerColor}`, borderRadius: '20px' }}>
          ⏱ {timeLeft}s
        </div>
      </div>

      <div style={{ fontSize: '1.5rem', margin: '30px 0', padding: '20px', background: '#FFF3E0', borderRadius: '10px', minHeight: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ marginBottom: question?.svg ? '20px' : '0' }}>{question?.q}</div>
        {question?.svg && <div dangerouslySetInnerHTML={{ __html: question.svg }} />}
      </div>
      
      <div className="grid-2-col">
        {options.map((opt, i) => (
          <button key={i} onClick={() => handleAnswer(opt)} disabled={!canAnswer} style={{ fontSize: '1.5rem', padding: '15px', cursor: canAnswer ? 'pointer' : 'not-allowed', opacity: canAnswer ? 1 : 0.65 }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
