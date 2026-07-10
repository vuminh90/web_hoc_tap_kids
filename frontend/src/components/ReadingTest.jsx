import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncToServer } from '../sync';

const GRADE3_VIETNAMESE = [
  { id: 'grammar', name: 'Ngữ pháp (Từ vựng, Câu)', icon: '📝' },
  { id: 'reading', name: 'Tập Đọc (Chấm điểm AI)', icon: '🎙️' },
  { id: 'writing', name: 'Tập Làm Văn', icon: '✍️' }
];

const PREP_VIETNAMESE = [
  { id: 'prep_letters', name: 'Đọc Bảng Chữ Cái', icon: '🅰️' },
  { id: 'prep_words', name: 'Đọc Từ Ghép', icon: '🔤' }
];

const GRADE3_PASSAGES = [
  "Mùa xuân đã về. Trăm hoa đua nở. Bầu trời trong xanh và không khí thật ấm áp.",
  "Mỗi buổi sáng em đều thức dậy sớm để tập thể dục và ăn sáng trước khi đi học.",
  "Trường học của em rất đẹp. Sân trường có nhiều cây xanh toả bóng mát rượi."
];

const PREP_LETTERS = ["a", "b", "c", "d", "e", "g", "h", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "x", "y"];
const PREP_SINGLE_WORDS = ["bàn", "ghế", "chó", "mèo", "cây", "lá", "hoa", "quả", "sách", "bút", "cá", "chim", "trời", "đất", "nước"];
const PREP_COMPOUND_WORDS = ["bàn ghế", "bố mẹ", "con chó", "cây xanh", "quả cam", "quyển sách", "bút chì", "hoa hồng", "con mèo", "mặt trời", "trường học", "cô giáo"];

export default function ReadingTest() {
  const navigate = useNavigate();
  const currentUser = localStorage.getItem('currentUser') || 'vuanhduc';
  const isGrade3 = currentUser === 'vuanhduc';

  const [level, setLevel] = useState(parseInt(localStorage.getItem(`vietLevel_${currentUser}`) || '1', 10));

  const [screen, setScreen] = useState('hub');
  const [category, setCategory] = useState(null);
  const [interventions, setInterventions] = useState({});
  const [usedQuestions, setUsedQuestions] = useState(new Set());
  
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, startTime: null });
  const [wrongAnswers, setWrongAnswers] = useState([]);

  const [grammarIndex, setGrammarIndex] = useState(0);
  const [grammarQ, setGrammarQ] = useState(null);
  const [writingTopic, setWritingTopic] = useState('');
  const [writingContent, setWritingContent] = useState('');

  const [targetText, setTargetText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [scoreData, setScoreData] = useState(null);
  const startTimeRef = useRef(null);

  const [timeLeft, setTimeLeft] = useState(0);
  const [maxTime, setMaxTime] = useState(0);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);

  // --- INTERVENTION ENGINE ---
  useEffect(() => {
    const statsKey = `learningStats_${currentUser}`;
    const allStats = JSON.parse(localStorage.getItem(statsKey) || '[]');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayStats = allStats.filter(s => s.date.startsWith(todayStr) && s.subject === 'reading');
    
    const catData = {};
    GRADE3_VIETNAMESE.forEach(c => { catData[c.id] = { plays: 0, correct: 0, total: 0 }; });
    PREP_VIETNAMESE.forEach(c => { catData[c.id] = { plays: 0, correct: 0, total: 0 }; });
    
    todayStats.forEach(s => {
      if (catData[s.category]) {
        catData[s.category].plays += 1;
        if (s.category === 'grammar') {
          catData[s.category].correct += (s.correct || 0);
          catData[s.category].total += 10; 
        } else {
          catData[s.category].correct += (s.points > 5 ? 1 : 0); // rough proxy
          catData[s.category].total += 1;
        }
      }
    });

    const newInterventions = {};
    let maxPlays = 0;
    Object.keys(catData).forEach(k => {
      if (catData[k].plays > maxPlays) maxPlays = catData[k].plays;
    });

    const isInterventionEnabled = localStorage.getItem('autoInterventionEnabled') !== 'false';

    if (isInterventionEnabled) {
      Object.keys(catData).forEach(k => {
        const data = catData[k];
        const acc = data.total > 0 ? (data.correct / data.total) : 0;
        
        if (data.plays > 0 && data.plays === maxPlays && data.plays >= 2) {
          if (acc >= 0.8 || (k !== 'grammar' && acc > 0.5)) { // reading/writing is easier to pass
            if (data.plays >= 4) {
               newInterventions[k] = 'locked'; 
            } else {
               newInterventions[k] = 'nerfed'; 
            }
          }
        } else if (data.plays === 0 && maxPlays >= 2) {
          newInterventions[k] = 'boosted'; 
        }
      });
    }
    setInterventions(newInterventions);
  }, [currentUser, screen]);

  // --- COUNTDOWN EFFECT ---
  useEffect(() => {
    if ((screen === 'grammar' || (screen === 'reading' && isRecording)) && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timerRef.current);
    } else if (screen === 'grammar' && timeLeft === 0) {
      finishGrammar(stats, wrongAnswers, true);
    } else if (screen === 'reading' && isRecording && timeLeft === 0) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  }, [timeLeft, screen, isRecording, stats, wrongAnswers]);

  // --- PROCEDURAL GRAMMAR GENERATOR ---
  const generateProceduralGrammar = (lvl) => {
    const templates = [
      () => { // Spelling
        const wrongWords = ["Sắp sếp", "Suất sắc", "Xinh xẻo", "Chong chóng", "Lãn mạn", "Bổ xưng", "Chân thành"];
        const correctWords = ["Sắp xếp", "Xuất sắc", "Xinh xắn", "Chong chóng", "Lãng mạn", "Bổ sung", "Trân thành"];
        const target = wrongWords[Math.floor(Math.random() * wrongWords.length)];
        const opts = [target];
        while(opts.length < 4) {
          const cw = correctWords[Math.floor(Math.random() * correctWords.length)];
          if (!opts.includes(cw)) opts.push(cw);
        }
        return { q: "Từ nào dưới đây viết SAI chính tả?", ans: target, opts };
      },
      () => { // Word types
        const types = ["hoạt động", "đặc điểm", "sự vật"];
        const t = types[Math.floor(Math.random() * types.length)];
        const actions = ["Chạy", "Nhảy", "Khóc", "Cười", "Hát"];
        const adjectives = ["Đẹp", "Xấu", "Cao", "Thấp", "Xanh biếc"];
        const nouns = ["Bàn", "Ghế", "Mèo", "Chó", "Bút"];
        let ans, wrong1, wrong2, wrong3;
        if (t === "hoạt động") {
          ans = actions[Math.floor(Math.random() * actions.length)];
          wrong1 = adjectives[0]; wrong2 = nouns[0]; wrong3 = adjectives[1];
        } else if (t === "đặc điểm") {
          ans = adjectives[Math.floor(Math.random() * adjectives.length)];
          wrong1 = actions[0]; wrong2 = nouns[0]; wrong3 = actions[1];
        } else {
          ans = nouns[Math.floor(Math.random() * nouns.length)];
          wrong1 = adjectives[0]; wrong2 = actions[0]; wrong3 = adjectives[1];
        }
        return { q: `Từ nào dưới đây là từ chỉ ${t}?`, ans, opts: [ans, wrong1, wrong2, wrong3] };
      },
      () => { // Sentence types
        const types = ["Ai làm gì?", "Ai thế nào?", "Ai là gì?"];
        const t = types[Math.floor(Math.random() * types.length)];
        const doQs = ["Mẹ đang nấu cơm.", "Bố sửa xe.", "Em bé khóc."];
        const beQs = ["Cô giáo em rất hiền.", "Bông hoa này đẹp quá.", "Bầu trời trong xanh."];
        const isQs = ["Bố em là bác sĩ.", "Mẹ em là giáo viên.", "Hổ là chúa tể rừng xanh."];
        let ans, wrong1, wrong2;
        if (t === "Ai làm gì?") { ans = doQs[0]; wrong1 = beQs[0]; wrong2 = isQs[0]; }
        else if (t === "Ai thế nào?") { ans = beQs[0]; wrong1 = doQs[0]; wrong2 = isQs[0]; }
        else { ans = isQs[0]; wrong1 = doQs[0]; wrong2 = beQs[0]; }
        return { q: `Câu nào dưới đây thuộc mẫu câu '${t}'?`, ans, opts: [ans, wrong1, wrong2, "Tất cả đều sai"] };
      },
      // --- ADVANCED VIETNAMESE (GRADE 3) ---
      () => { // Biện pháp tu từ: So sánh
        const similes = [
          { q: "Trong câu 'Trẻ em như búp trên cành', sự vật nào được so sánh với nhau?", ans: "Trẻ em - búp trên cành", wrong: ["Trẻ em - cành cây", "Búp - cành", "Trẻ em - cành"] },
          { q: "Trong câu 'Mắt mèo sáng như hòn bi ve', sự vật nào được so sánh với nhau?", ans: "Mắt mèo - hòn bi ve", wrong: ["Mắt - mèo", "Mèo - hòn bi ve", "Mắt mèo - sáng"] },
          { q: "Từ so sánh trong câu 'Trăng tròn như quả bóng' là từ nào?", ans: "như", wrong: ["tròn", "quả bóng", "trăng"] }
        ];
        const s = similes[Math.floor(Math.random() * similes.length)];
        return { q: s.q, ans: s.ans, opts: [s.ans, ...s.wrong] };
      },
      () => { // Biện pháp tu từ: Nhân hoá
        const pQuestions = [
          { q: "Câu nào dưới đây có sử dụng biện pháp nhân hoá?", ans: "Ông Mặt Trời đạp xe qua ngọn núi.", wrong: ["Mặt Trời mọc ở đằng Đông.", "Ánh nắng chói chang.", "Bầu trời có nhiều mây."] },
          { q: "Trong câu 'Chị gió bay ngang qua xoa đầu những bông hoa', từ ngữ nào dùng để nhân hoá?", ans: "Chị, xoa đầu", wrong: ["bay ngang qua", "những bông hoa", "gió, bông hoa"] },
          { q: "Câu nào dưới đây KHÔNG có biện pháp nhân hoá?", ans: "Đàn chim đang bay lượn.", wrong: ["Anh đom đóm đang thắp đèn.", "Cô mây mặc áo trắng.", "Bác gấu đang ngáy ngủ."] }
        ];
        const p = pQuestions[Math.floor(Math.random() * pQuestions.length)];
        return { q: p.q, ans: p.ans, opts: [p.ans, ...p.wrong] };
      },
      () => { // Đặt dấu phẩy
        const cQuestions = [
          { q: "Câu nào dưới đây đặt dấu phẩy ĐÚNG vị trí?", ans: "Trong vườn, hoa hồng nở rực rỡ.", wrong: ["Trong vườn hoa, hồng nở rực rỡ.", "Trong, vườn hoa hồng nở rực rỡ.", "Trong vườn hoa hồng, nở rực rỡ."] },
          { q: "Cần điền dấu phẩy vào đâu trong câu: 'Sáng nay em đi học đi chơi'?", ans: "Sáng nay, em đi học, đi chơi", wrong: ["Sáng, nay em đi học, đi chơi", "Sáng nay, em đi học đi chơi", "Sáng nay em đi học, đi chơi"] }
        ];
        const c = cQuestions[Math.floor(Math.random() * cQuestions.length)];
        return { q: c.q, ans: c.ans, opts: [c.ans, ...c.wrong] };
      },
      () => { // Từ đồng nghĩa / Trái nghĩa
        const vocab = [
          { q: "Từ nào ĐỒNG NGHĨA với từ 'chăm chỉ'?", ans: "cần cù", wrong: ["lười biếng", "nhanh nhẹn", "thông minh"] },
          { q: "Từ nào TRÁI NGHĨA với từ 'hòa bình'?", ans: "chiến tranh", wrong: ["yên tĩnh", "náo nhiệt", "hạnh phúc"] },
          { q: "Từ nào ĐỒNG NGHĨA với từ 'dũng cảm'?", ans: "gan dạ", wrong: ["nhát gan", "hèn nhát", "rụt rè"] }
        ];
        const v = vocab[Math.floor(Math.random() * vocab.length)];
        return { q: v.q, ans: v.ans, opts: [v.ans, ...v.wrong] };
      },
      // --- KẾT NỐI TRI THỨC VỚI CUỘC SỐNG ---
      () => { // Câu kể / Câu hỏi / Câu cảm / Câu khiến
        const sentences = [
          { q: "Câu nào dưới đây là CÂU CẢM?", ans: "Ôi, bông hoa này đẹp quá!", wrong: ["Bạn đang làm gì vậy?", "Mẹ em đang nấu cơm.", "Hãy đóng cửa lại!"] },
          { q: "Câu 'Lan ơi, cậu lấy giúp mình cây bút nhé!' thuộc loại câu gì?", ans: "Câu khiến", wrong: ["Câu cảm", "Câu hỏi", "Câu kể"] },
          { q: "Dấu câu nào thường đặt ở cuối CÂU HỎI?", ans: "Dấu chấm hỏi (?)", wrong: ["Dấu chấm (.)", "Dấu phẩy (,)", "Dấu chấm than (!)"] }
        ];
        const s = sentences[Math.floor(Math.random() * sentences.length)];
        return { q: s.q, ans: s.ans, opts: [s.ans, ...s.wrong] };
      },
      () => { // Dấu ngoặc kép / Dấu gạch ngang
        const punct = [
          { q: "Trong câu: Bố dặn em: \"Nhớ đóng cửa cẩn thận nhé!\", dấu ngoặc kép có tác dụng gì?", ans: "Đánh dấu lời nói trực tiếp", wrong: ["Đánh dấu tên tác phẩm", "Đánh dấu từ ngữ đặc biệt", "Kết thúc câu"] },
          { q: "Dấu gạch ngang trong câu dùng để làm gì?", ans: "Đánh dấu chỗ bắt đầu lời nói của nhân vật", wrong: ["Ngắt quãng câu", "Kết thúc câu", "Báo hiệu phần giải thích"] }
        ];
        const p = punct[Math.floor(Math.random() * punct.length)];
        return { q: p.q, ans: p.ans, opts: [p.ans, ...p.wrong] };
      },
      () => { // Từ ngữ theo chủ điểm
        const topics = [
          { q: "Từ nào dưới đây KHÔNG thuộc chủ điểm 'Trường học'?", ans: "Bệnh viện", wrong: ["Sân trường", "Lớp học", "Thầy giáo"] },
          { q: "Nhóm từ nào dưới đây nói về chủ điểm 'Gia đình'?", ans: "Ông bà, cha mẹ, anh chị", wrong: ["Sách, vở, bút, thước", "Bác sĩ, kỹ sư, y tá", "Biển cả, núi non, sông suối"] },
          { q: "Từ nào dưới đây chỉ đặc điểm của thời tiết mùa hè?", ans: "Nóng bức", wrong: ["Lạnh giá", "Rét buốt", "Mát mẻ"] }
        ];
        const t = topics[Math.floor(Math.random() * topics.length)];
        return { q: t.q, ans: t.ans, opts: [t.ans, ...t.wrong] };
      },
      // --- NÂNG CAO TỪ VÀ CÂU (LÂM GIANG) ---
      () => { // Bộ phận trả lời câu hỏi Khi nào? Ở đâu? Vì sao?
        const questions = [
          { q: "Bộ phận in đậm trong câu 'Mùa hè năm ngoái, gia đình em đi nghỉ mát ở Nha Trang' trả lời cho câu hỏi nào?", ans: "Khi nào?", wrong: ["Ở đâu?", "Vì sao?", "Làm gì?"] },
          { q: "Bộ phận in đậm trong câu 'Để có sức khoẻ tốt, chúng ta phải chăm tập thể dục' trả lời cho câu hỏi nào?", ans: "Để làm gì?", wrong: ["Vì sao?", "Khi nào?", "Thế nào?"] },
          { q: "Bộ phận in đậm trong câu 'Những chú chim đang hót líu lo trên cành cây' trả lời cho câu hỏi nào?", ans: "Ở đâu?", wrong: ["Khi nào?", "Là gì?", "Bằng gì?"] }
        ];
        const q = questions[Math.floor(Math.random() * questions.length)];
        return { q: q.q, ans: q.ans, opts: [q.ans, ...q.wrong] };
      },
      () => { // Ghép từ tạo từ có nghĩa
        const words = [
          { q: "Tiếng 'quê' có thể ghép với tiếng nào dưới đây để tạo thành từ có nghĩa?", ans: "hương", wrong: ["xóm", "làng", "nước"] },
          { q: "Tiếng 'đồng' trong từ 'đồng bào' có nghĩa là 'cùng'. Từ nào dưới đây có tiếng 'đồng' mang nghĩa là 'cùng'?", ans: "đồng tâm", wrong: ["cánh đồng", "đồng bạc", "đồng thau"] },
          { q: "Từ nào dưới đây là tên gọi của dân tộc ta gắn với truyền thuyết Lạc Long Quân - Âu Cơ?", ans: "Con Rồng cháu Tiên", wrong: ["Con ngoan trò giỏi", "Con cháu vua Hùng", "Con vua cháu chúa"] }
        ];
        const w = words[Math.floor(Math.random() * words.length)];
        return { q: w.q, ans: w.ans, opts: [w.ans, ...w.wrong] };
      },
      // --- ÔN TẬP TỔNG HỢP LỚP 3 ---
      () => { // Từ vựng mở rộng
        const vocab = [
          { q: "Từ nào dưới đây KHÔNG dùng để chỉ trẻ em?", ans: "Người lớn", wrong: ["Thiếu nhi", "Trẻ thơ", "Nhi đồng"] },
          { q: "Từ nào dưới đây là từ dùng để gọi trẻ em với thái độ TÔN TRỌNG?", ans: "Trẻ em", wrong: ["Nhóc con", "Trẻ ranh", "Oắt con"] },
          { q: "Từ nào dưới đây gợi cho em nghĩ về Quê Hương?", ans: "Lũy tre", wrong: ["Rạp xiếc", "Nhà cao tầng", "Siêu thị"] }
        ];
        const v = vocab[Math.floor(Math.random() * vocab.length)];
        return { q: v.q, ans: v.ans, opts: [v.ans, ...v.wrong] };
      },
      () => { // So sánh hình ảnh / âm thanh
        const similes = [
          { q: "Từ nào thích hợp để điền vào chỗ trống: 'Đôi mắt bé tròn như...'", ans: "hạt nhãn", wrong: ["sợi chỉ", "khúc nhạc vui", "ngôi sao"] },
          { q: "Từ nào thích hợp để điền vào chỗ trống: 'Tiếng suối ngân nga như...'", ans: "tiếng hát", wrong: ["tiếng sấm", "tiếng xe cộ", "tiếng quạt"] },
          { q: "Từ nào thích hợp để điền vào chỗ trống: 'Đêm ấy, trời tối như...'", ans: "mực", wrong: ["ban ngày", "nước", "than"] }
        ];
        const s = similes[Math.floor(Math.random() * similes.length)];
        return { q: s.q, ans: s.ans, opts: [s.ans, ...s.wrong] };
      }
    ];
    return templates[Math.floor(Math.random() * templates.length)]();
  };

  const generateUniqueGrammar = (currentLevel) => {
    let qObj;
    let attempts = 0;
    let foundUnique = false;

    while (!foundUnique && attempts < 20) {
      qObj = generateProceduralGrammar(currentLevel);
      if (!usedQuestions.has(qObj.q)) {
        foundUnique = true;
        const newUsed = new Set(usedQuestions);
        newUsed.add(qObj.q);
        setUsedQuestions(newUsed);
      }
      attempts++;
    }

    const shuffledOpts = [...qObj.opts].sort(() => Math.random() - 0.5);
    setGrammarQ({ ...qObj, opts: shuffledOpts });
  };

  const getWritingTopic = () => {
    const topics = [
      "Viết 3-5 câu tả một đồ dùng học tập của em.",
      "Viết 3-5 câu kể về một việc em đã làm để giúp đỡ gia đình.",
      "Viết 3-5 câu giới thiệu về bản thân."
    ];
    return topics[Math.floor(Math.random() * topics.length)];
  };

  const getReadingText = (catId) => {
    if (catId === 'prep_letters') {
      let arr = [];
      for(let i=0; i<10; i++) arr.push(PREP_LETTERS[Math.floor(Math.random() * PREP_LETTERS.length)]);
      return arr.join(" ");
    }
    if (catId === 'prep_words') {
      let wordPool = level <= 2 ? PREP_SINGLE_WORDS : PREP_COMPOUND_WORDS;
      let wordCount = 5;
      
      if (level === 2) wordCount = 10;
      else if (level === 3) wordCount = 5;
      else if (level === 4) wordCount = 10;
      else if (level >= 5) wordCount = 15;

      let availableWords = [...wordPool].sort(() => Math.random() - 0.5);
      let arr = [];
      for(let i=0; i<wordCount; i++) {
        arr.push(availableWords[i % availableWords.length]);
      }
      return arr.join(" ");
    }
    return GRADE3_PASSAGES[Math.floor(Math.random() * GRADE3_PASSAGES.length)];
  };

  const saveResults = (earnedPoints, timeSpentSec, specificStats = {}, levelUpMsg = "", wrongDetails = []) => {
    let multiplier = 1;
    if (interventions[category] === 'nerfed') multiplier = 0.5;
    if (interventions[category] === 'boosted') multiplier = 2;

    const finalPoints = Math.round(earnedPoints * multiplier);

    const statsKey = `learningStats_${currentUser}`;
    const learningHistory = JSON.parse(localStorage.getItem(statsKey) || '[]');
    learningHistory.unshift({
      date: new Date().toISOString(),
      subject: 'reading',
      category: category,
      timeSpentSec: timeSpentSec,
      points: finalPoints,
      wrongDetails: wrongDetails,
      ...specificStats
    });
    if (learningHistory.length > 50) learningHistory.length = 50;
    localStorage.setItem(statsKey, JSON.stringify(learningHistory));

    const pointKey = `points_${currentUser}`;
    const historyKey = `pointsHistory_${currentUser}`;
    const currentPoints = parseInt(localStorage.getItem(pointKey) || '0', 10);
    
    if (finalPoints > 0) {
      localStorage.setItem(pointKey, (currentPoints + finalPoints).toString());
      const pHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
      pHistory.unshift({
        date: new Date().toISOString(),
        amount: finalPoints,
        reason: `Môn Tiếng Việt (${category})`,
        subject: 'reading'
      });
      localStorage.setItem(historyKey, JSON.stringify(pHistory));
    }
    
    let interventionMsg = "";
    if (multiplier === 0.5) interventionMsg = "Phần thưởng môn này đã bị giảm 50% do làm quá nhiều!\n";
    if (multiplier === 2) interventionMsg = "Tuyệt vời! Bạn nhận được x2 Điểm Khuyến khích!\n";

    setStats({ ...stats, finalPoints, timeSpentSec, interventionMsg, levelUpMsg });
    setWrongAnswers(wrongDetails);
    syncToServer(currentUser);
    setScreen('result');
  };

  const startGame = (catId) => {
    setCategory(catId);
    setStats({ correct: 0, incorrect: 0, startTime: Date.now() });
    setUsedQuestions(new Set());
    setWrongAnswers([]);

    if (catId === 'grammar') {
      setScreen('grammar');
      setGrammarIndex(0);
      const baseTime = isGrade3 ? 120 : 90;
      const timeDecay = isGrade3 ? 5 : 2;
      let calculatedMaxTime = baseTime - ((level - 1) * timeDecay);
      if (calculatedMaxTime < 30) calculatedMaxTime = 30; // Min time 30s
      setMaxTime(calculatedMaxTime);
      setTimeLeft(calculatedMaxTime);
      generateUniqueGrammar(level);
    } else if (catId === 'writing') {
      setScreen('writing');
      setWritingTopic(getWritingTopic());
      setWritingContent('');
    } else {
      setScreen('reading');
      setTargetText(getReadingText(catId));
      setTranscript("");
      setScoreData(null);
      let calculatedTime = 30;
      if (catId === 'prep_words' || catId === 'prep_letters') {
         if (level <= 1) calculatedTime = 20;
         else if (level === 2) calculatedTime = 30;
         else if (level === 3) calculatedTime = 30;
         else if (level === 4) calculatedTime = 40;
         else calculatedTime = 60;
      } else {
         calculatedTime = Math.max(30, 90 - (level * 10)); 
      }
      setMaxTime(calculatedTime);
      setTimeLeft(calculatedTime);
    }
  };

  const handleGrammarAnswer = (ans) => {
    const isCorrect = ans === grammarQ.ans;
    let newStats = { ...stats };
    let newWrongs = [...wrongAnswers];
    if (isCorrect) {
      newStats.correct += 1;
    } else {
      newStats.incorrect += 1;
      newWrongs.push({ q: grammarQ.q, userAns: ans, correctAns: grammarQ.ans });
      setWrongAnswers(newWrongs);
    }
    setStats(newStats);

    if (grammarIndex + 1 < 10) {
      setGrammarIndex(grammarIndex + 1);
      generateUniqueGrammar(level);
    } else {
      finishGrammar(newStats, newWrongs);
    }
  };

  const finishGrammar = (finalStats, finalWrongs = [], isTimeout = false) => {
    clearTimeout(timerRef.current);
    const timeSpentSec = maxTime - timeLeft;
    let earnedPoints = finalStats.correct;
    
    // Speed Bonus
    if (finalStats.correct >= 8) {
      if (timeLeft > maxTime * 0.5) earnedPoints += 5;
      else if (timeLeft > maxTime * 0.2) earnedPoints += 2;
    }

    // Level Adjustment
    let newLevel = level;
    let levelMessage = "";
    if (finalStats.correct >= 8) {
      newLevel += 1;
      levelMessage = "Tuyệt vời! Bé đã được TĂNG CẤP ĐỘ KHÓ Tiếng Việt 🚀";
    } else if (finalStats.correct <= 4 && level > 1) {
      newLevel -= 1;
      levelMessage = "Cấp độ đã được giảm xuống để bé ôn tập lại 🧸";
    }
    
    if (isTimeout) {
      levelMessage = "⏰ Hết giờ. Bạn cần cố gắng làm bài nhanh hơn!\n" + levelMessage;
    }

    if (newLevel !== level) {
      setLevel(newLevel);
      localStorage.setItem(`vietLevel_${currentUser}`, newLevel.toString());
    }

    saveResults(earnedPoints, timeSpentSec, { correct: finalStats.correct, incorrect: finalStats.incorrect }, levelMessage, finalWrongs || []);
  };

  const submitWriting = () => {
    const wordCount = writingContent.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 5) {
      alert('Bài viết quá ngắn. Bé hãy viết dài thêm một chút nữa nhé!');
      return;
    }
    let points = wordCount >= 20 ? 10 : (wordCount >= 10 ? 5 : 2);
    const timeSpentSec = Math.round((Date.now() - stats.startTime) / 1000);
    saveResults(points, timeSpentSec, { correct: 1, incorrect: 0 });
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
    } else {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng dùng Chrome.");
        return;
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'vi-VN';
      recognition.interimResults = true;
      recognition.continuous = true;
      
      recognition.onstart = () => {
        setIsRecording(true);
        setTranscript("");
        startTimeRef.current = Date.now();
      };
      
      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + " ";
        }
        setTranscript(currentTranscript);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
        calculateScore(transcript);
      };
      
      recognition.start();
    }
  };

  const calculateScore = (finalTranscript) => {
    if (!finalTranscript) return;
    const timeSpentMs = Date.now() - startTimeRef.current;
    const timeSpentSec = Math.round(timeSpentMs / 1000);
    const minutes = timeSpentMs / 60000;
    
    const targetWords = targetText.toLowerCase().replace(/[.,!?]/g, '').split(' ').filter(w => w);
    const spokenWords = finalTranscript.toLowerCase().split(' ').filter(w => w);
    
    let correctWords = 0;
    targetWords.forEach(word => {
        if (spokenWords.includes(word)) correctWords++;
    });
    
    // Phonics Scoring logic: focus on word count matching
    const accuracy = Math.round((correctWords / targetWords.length) * 100);
    let points = 0;
    if (accuracy >= 90) points = 10;
    else if (accuracy >= 70) points = 5;
    else if (accuracy >= 50) points = 2;

    setScoreData({ accuracy, wpm: 0, fluency: 0, points: points, timeSpentSec });
  };

  const finishReading = () => {
    let newLevel = level;
    let levelMessage = "";
    if (scoreData.accuracy >= 90) {
      newLevel += 1;
      levelMessage = "Tuyệt vời! Bé đọc rất chuẩn, TĂNG CẤP ĐỘ KHÓ Tiếng Việt 🚀";
    } else if (scoreData.accuracy <= 50 && level > 1) {
      newLevel -= 1;
      levelMessage = "Cấp độ đã được giảm xuống để bé đọc dễ hơn 🧸";
    }

    if (newLevel !== level) {
      setLevel(newLevel);
      localStorage.setItem(`vietLevel_${currentUser}`, newLevel.toString());
    }

    saveResults(scoreData.points, scoreData.timeSpentSec, { 
      wpm: scoreData.wpm, 
      accuracy: scoreData.accuracy, 
      fluency: scoreData.fluency 
    }, levelMessage);
  };

  if (screen === 'hub') {
    const categories = isGrade3 ? GRADE3_VIETNAMESE : PREP_VIETNAMESE;
    return (
      <div className="card" style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2>Góc Tiếng Việt 📖</h2>
        <h4 style={{ color: '#666', marginBottom: '20px' }}>
        </h4>
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
                  backgroundColor: isLocked ? '#E0E0E0' : (isBoosted ? '#E8F5E9' : '#E8F5E9'), 
                  color: isLocked ? '#9E9E9E' : (isBoosted ? '#2E7D32' : '#2E7D32'), 
                  border: `2px solid ${isLocked ? '#BDBDBD' : (isBoosted ? '#4CAF50' : '#81C784')}`, 
                  borderRadius: '10px',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  position: 'relative'
              }}
            >
              {isLocked && <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#F44336', color: 'white', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>🔒 KHOÁ</div>}
              {isNerfed && <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#FF9800', color: 'white', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>⚠️ Giảm 50% Điểm</div>}
              {isBoosted && <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#4CAF50', color: 'white', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>⭐ Khuyến khích x2 Điểm</div>}
              
              <div style={{ fontSize: '2rem', marginBottom: '10px', filter: isLocked ? 'grayscale(100%)' : 'none' }}>{c.icon}</div>
              {c.name}
            </button>
            )
          })}
        </div>
        <button onClick={() => navigate('/student')} style={{ marginTop: '30px', backgroundColor: '#888' }}>Trở lại</button>
      </div>
    );
  }

  if (screen === 'grammar') {
    const timerColor = timeLeft > maxTime * 0.5 ? '#4CAF50' : (timeLeft > maxTime * 0.2 ? '#FF9800' : '#FF5252');
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#2E7D32', margin: 0 }}>Câu {grammarIndex + 1}/10</h2>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: timerColor, padding: '5px 15px', border: `2px solid ${timerColor}`, borderRadius: '20px' }}>
            ⏱ {timeLeft}s
          </div>
        </div>
        <div style={{ fontSize: '1.3rem', margin: '30px 0', padding: '20px', background: '#F1F8E9', borderRadius: '10px' }}>
          {grammarQ?.q}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {grammarQ?.opts.map((opt, i) => (
            <button key={i} onClick={() => handleGrammarAnswer(opt)} style={{ fontSize: '1.2rem', padding: '15px', textAlign: 'left', backgroundColor: '#FFF', color: '#333', border: '1px solid #CCC' }}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === 'writing') {
    return (
      <div className="card">
        <h2 style={{ color: '#2E7D32' }}>Tập Làm Văn ✍️</h2>
        <div style={{ fontSize: '1.2rem', margin: '20px 0', padding: '15px', background: '#E3F2FD', borderRadius: '10px', fontStyle: 'italic', borderLeft: '4px solid #1976D2' }}>
          Đề bài: {writingTopic}
        </div>
        <textarea 
          value={writingContent}
          onChange={(e) => setWritingContent(e.target.value)}
          placeholder="Bé hãy bắt đầu viết bài tại đây..."
          style={{ width: '100%', height: '200px', padding: '15px', fontSize: '1.2rem', borderRadius: '8px', border: '2px solid #CCC', resize: 'none' }}
        />
        <button onClick={submitWriting} style={{ marginTop: '20px', width: '100%', backgroundColor: '#4CAF50' }}>Nộp bài</button>
      </div>
    );
  }

  if (screen === 'reading') {
    const timerColor = timeLeft > maxTime * 0.5 ? '#4CAF50' : (timeLeft > maxTime * 0.2 ? '#FF9800' : '#FF5252');
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#2E7D32', margin: 0 }}>{category.includes('prep') ? 'Đọc chữ cái / Từ' : 'Luyện Đọc'} 🎙️</h2>
          {isRecording && (
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: timerColor, padding: '5px 15px', border: `2px solid ${timerColor}`, borderRadius: '20px' }}>
              ⏱ {timeLeft}s
            </div>
          )}
        </div>
        <div style={{ padding: '30px', margin: '20px 0', background: '#f5f5f5', borderRadius: '10px', fontSize: category.includes('prep') ? '3rem' : '1.5rem', lineHeight: '1.6', fontWeight: category.includes('prep') ? 'bold' : 'normal' }}>
          {targetText}
        </div>
        {!scoreData ? (
          <div>
            <button onClick={toggleRecording} style={{ backgroundColor: isRecording ? '#FF5252' : '#4CAF50', width: '100%', padding: '15px', fontSize: '1.2rem' }}>
              {isRecording ? '🛑 Dừng Đọc (Chấm Điểm)' : '🎤 Nhấn để Bắt đầu đọc'}
            </button>
            {isRecording && <p style={{ color: '#FF5252', marginTop: '15px', animation: 'pulse 1.5s infinite' }}>🔴 Hệ thống đang lắng nghe...</p>}
            <div style={{ marginTop: '20px', minHeight: '60px', padding: '15px', border: '1px dashed #ccc', borderRadius: '10px', color: '#666', fontStyle: 'italic' }}>
              {transcript || "Giọng đọc của bé sẽ hiện ở đây..."}
            </div>
          </div>
        ) : (
          <div style={{ background: '#E8F5E9', padding: '20px', borderRadius: '10px', border: '2px solid #4CAF50', textAlign: 'left' }}>
            <h3 style={{ marginTop: 0, color: '#2E7D32', textAlign: 'center' }}>Kết quả Đánh giá</h3>
            <div className="grid-2-col" style={{ margin: '20px 0' }}>
              <div style={{ background: '#FFF', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: '#888' }}>Độ chính xác</div>
                <strong style={{ fontSize: '1.5rem', color: scoreData.accuracy > 80 ? '#4CAF50' : '#FF9800' }}>{scoreData.accuracy}%</strong>
              </div>
              <div style={{ background: '#FFF', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: '#888' }}>Tốc độ đọc (WPM)</div>
                <strong style={{ fontSize: '1.5rem', color: '#2196F3' }}>{scoreData.wpm}</strong>
              </div>
            </div>
            <h2 style={{ textAlign: 'center', color: '#E65100', margin: '20px 0' }}>Thưởng: {scoreData.points} 💎 (Điểm 10)</h2>
            <button onClick={finishReading} style={{ width: '100%' }}>Nhận Thưởng & Trở về</button>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'result') {
    return (
      <div className="card">
        <h2 style={{ color: '#E65100', textAlign: 'center' }}>Kết quả Bài kiểm tra</h2>
        <div style={{ background: '#E8F5E9', padding: '15px', borderRadius: '10px', textAlign: 'center', marginBottom: '20px' }}>
          {category === 'grammar' && <h3>Đạt: {stats.correct}/10 điểm</h3>}
          <p>Thời gian: {stats.timeSpentSec}s</p>
          <p style={{ color: '#4CAF50', fontWeight: 'bold' }}>{stats.interventionMsg}</p>
          <p style={{ color: '#1976D2', fontSize: '1.2rem', fontWeight: 'bold' }}>Tổng thưởng: {stats.finalPoints} 💎</p>
        </div>

        {wrongAnswers.length > 0 && (
          <div style={{ background: '#FFEBEE', padding: '15px', borderRadius: '10px', marginBottom: '20px', textAlign: 'left' }}>
            <h3 style={{ color: '#D32F2F', marginTop: 0 }}>Các câu cần ôn lại ({wrongAnswers.length}):</h3>
            {wrongAnswers.map((w, idx) => (
              <div key={idx} style={{ background: 'white', padding: '10px', borderRadius: '5px', marginBottom: '10px', borderLeft: '4px solid #F44336' }}>
                <div style={{ marginBottom: '5px' }}><strong>Câu hỏi:</strong> {w.q}</div>
                <div style={{ color: '#D32F2F' }}><strong>Bé chọn:</strong> {w.userAns} ❌</div>
                <div style={{ color: '#388E3C' }}><strong>Đáp án đúng:</strong> {w.correctAns} ✅</div>
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

  return null;
}
