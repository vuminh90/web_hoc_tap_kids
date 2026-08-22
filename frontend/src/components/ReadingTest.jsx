import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncToServer } from '../sync';
import FairPlayReminder from './FairPlayReminder';
import { getChildMaxLevel, getLevelPhase, getLevelTiming, getModuleContentLevel } from '../learningLevels';
import { evaluateAdaptiveLevel, getProgressKey, readProgressMap, saveAdaptiveProgress } from '../adaptiveLevel';
import { buildDifficultySchedule, composeReadingQuestions, getTierContentLevel } from '../quizComposition';
import { calculateLearningReward, getGuessCorrectedQuality, getLevelRewardCap, getRewardProgressKey, readRewardProgress, saveClaimedMilestone } from '../rewardSystem';

const GRADE3_VIETNAMESE = [
  { id: 'grammar', name: 'Ngữ pháp (Từ vựng, Câu)', icon: '📝' },
  { id: 'reading', name: 'Tập Đọc (Chấm điểm AI)', icon: '🎙️' },
  { id: 'writing', name: 'Tập Làm Văn', icon: '✍️' }
];

const PREP_VIETNAMESE = [
  { id: 'prep_passage', name: 'Đọc Đoạn Văn', icon: '📖' },
  { id: 'prep_riddle', name: 'Đố Vui Hoa Quả & Con Vật', icon: '🧩' }
];

const GRADE3_PASSAGES = [
  "Mùa xuân đã về. Trăm hoa đua nở. Bầu trời trong xanh và không khí thật ấm áp.",
  "Mỗi buổi sáng em đều thức dậy sớm để tập thể dục và ăn sáng trước khi đi học.",
  "Trường học của em rất đẹp. Sân trường có nhiều cây xanh toả bóng mát rượi.",
  "Sáng sớm, khu vườn nhà An rất yên tĩnh. Trên cành cây xoài, một chú sẻ nhỏ đang tập bay. Chú vỗ đôi cánh bé xíu rồi nhảy từ cành này sang cành khác. Bỗng nhiên, chú trượt chân và rơi xuống bãi cỏ. An nhìn thấy liền chạy lại. Em nhẹ nhàng đặt chú sẻ vào một chiếc hộp nhỏ có lót khăn mềm. Một lát sau, chú sẻ tỉnh lại. An mở hộp, đưa chú ra gần gốc cây. Chú sẻ vỗ cánh bay lên cành xoài. Nó hót líu lo như muốn cảm ơn An. Từ đó, mỗi sáng An đều nghe tiếng chim hót trong vườn. Em cảm thấy rất vui vì đã giúp được một người bạn nhỏ."
];

const GRADE3_READING_SEEDS = [
  { who: "An", place: "khu vườn", friend: "chú sẻ nhỏ", action: "nhặt chiếc lá khô để làm dấu trang", lesson: "biết yêu thiên nhiên", object: "chiếc hộp giấy", detail: "tiếng chim hót líu lo" },
  { who: "Bình", place: "thư viện trường", friend: "bạn Mai", action: "tìm một quyển truyện về lòng dũng cảm", lesson: "biết giữ sách sạch đẹp", object: "thẻ mượn sách", detail: "mùi giấy mới thơm nhẹ" },
  { who: "Chi", place: "sân trường", friend: "em lớp Một", action: "nhặt quả bóng lăn xa", lesson: "biết giúp đỡ người nhỏ hơn", object: "quả bóng xanh", detail: "hàng cây rì rào trong gió" },
  { who: "Dũng", place: "lớp học", friend: "cô giáo", action: "xếp lại góc đọc sách", lesson: "biết làm việc ngăn nắp", object: "giá sách nhỏ", detail: "ánh nắng rơi trên bảng" },
  { who: "Hà", place: "bên bờ ao", friend: "ông nội", action: "quan sát đàn cá bơi", lesson: "biết kiên nhẫn quan sát", object: "cuốn sổ tay", detail: "mặt nước lăn tăn" },
  { who: "Khánh", place: "con đường làng", friend: "bác đưa thư", action: "nhặt phong thư rơi", lesson: "biết trả lại của rơi", object: "chiếc phong bì", detail: "tiếng xe đạp leng keng" },
  { who: "Lan", place: "vườn rau", friend: "mẹ", action: "tưới nước cho luống cải", lesson: "biết chăm lao động", object: "bình tưới nhỏ", detail: "những giọt nước long lanh" },
  { who: "Minh", place: "phòng học mỹ thuật", friend: "bạn Nam", action: "chia sẻ hộp màu", lesson: "biết chia sẻ với bạn", object: "hộp màu sáp", detail: "bức tranh rực rỡ" },
  { who: "Ngọc", place: "nhà văn hóa", friend: "các bạn trong tổ", action: "tập kể chuyện trước lớp", lesson: "biết tự tin hơn", object: "tờ giấy ghi ý", detail: "tiếng vỗ tay nhẹ nhàng" },
  { who: "Phúc", place: "bếp nhỏ", friend: "bà ngoại", action: "rửa rau giúp bà", lesson: "biết phụ giúp gia đình", object: "rổ rau xanh", detail: "mùi canh thơm ấm" },
  { who: "Quân", place: "công viên", friend: "bố", action: "nhặt rác bỏ vào thùng", lesson: "biết giữ nơi công cộng sạch sẽ", object: "túi giấy", detail: "bãi cỏ xanh mướt" },
  { who: "Vy", place: "góc học tập", friend: "chị gái", action: "luyện đọc một bài thơ", lesson: "biết đọc chậm và rõ", object: "quyển Tiếng Việt", detail: "chiếc đèn bàn sáng dịu" }
];

const LEVEL_CONFIG = {
  easy: { name: "Dễ", min: 50, max: 90, target: 70 },
  medium: { name: "Trung bình", min: 90, max: 150, target: 120 },
  hard: { name: "Khó", min: 150, max: 260, target: 200 },
  special: { name: "Đặc biệt", min: 260, max: 500, target: 340 }
};

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

const getReadingLevelKey = (currentLevel) => {
  const keys = ["easy", "medium", "hard", "special"];
  return keys[Math.min(Math.max(currentLevel - 1, 0), keys.length - 1)];
};

const countWords = (text) =>
  text
    .replace(/[.,!?;:()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .length;

const buildPassageText = (seed, levelKey, index) => {
  const intro = `${seed.who} là học sinh lớp Ba. Một buổi sáng, ${seed.who} đến ${seed.place} và nhìn thấy ${seed.detail}. Bạn cảm thấy rất vui nên muốn làm một việc thật có ích.`;
  const body = `${seed.who} gặp ${seed.friend}. Hai người cùng ${seed.action}. Lúc đầu, công việc hơi lúng túng, nhưng ${seed.who} bình tĩnh lắng nghe, làm từng bước và không bỏ cuộc.`;
  const close = `Sau đó, ${seed.who} cất ${seed.object} đúng chỗ. Mọi người khen bạn chăm chỉ. Qua câu chuyện, ${seed.who} hiểu rằng mỗi việc nhỏ đều giúp mình ${seed.lesson}.`;
  const extra = [
    `Trên đường về, ${seed.who} kể lại mọi chuyện cho gia đình nghe. Bạn nói rõ điều mình đã thấy, việc mình đã làm và cảm xúc của mình sau buổi học.`,
    `Ngày hôm sau, ${seed.who} tiếp tục luyện đọc đoạn văn này. Bạn chú ý dừng ở dấu phẩy, nghỉ lâu hơn ở dấu chấm và đọc các tiếng khó thật rõ ràng.`,
    `Cô giáo nhắc cả lớp rằng đọc hay không chỉ là đọc nhanh. Người đọc cần hiểu nội dung, biết nhấn giọng ở chi tiết quan trọng và trả lời được câu hỏi sau khi đọc.`,
    `${seed.who} ghi vào sổ tay ba điều cần nhớ: đọc đúng từng từ, giữ giọng vừa phải và kể lại được nhân vật, nơi chốn, việc làm trong câu chuyện.`,
    `Từ trải nghiệm ấy, ${seed.who} tự tin hơn trong giờ Tập đọc. Bạn cũng động viên các bạn khác luyện đọc mỗi ngày để tiến bộ từng chút một.`
  ];
  const config = LEVEL_CONFIG[levelKey];
  let text = [intro, body, close].join(" ");
  let extraIndex = index % extra.length;
  while (countWords(text) < config.min) {
    text += ` ${extra[extraIndex % extra.length]}`;
    extraIndex += 1;
  }
  return text;
};

const makeReadingQuestions = (seed) => ([
  {
    q: `Nhân vật chính trong đoạn văn là ai?`,
    a: seed.who,
    options: shuffle([seed.who, seed.friend, "cô hiệu trưởng", "bác bảo vệ"])
  },
  {
    q: `Câu chuyện diễn ra ở đâu?`,
    a: seed.place,
    options: shuffle([seed.place, "bến xe", "siêu thị", "sân vận động"])
  },
  {
    q: `${seed.who} đã làm việc gì?`,
    a: seed.action,
    options: shuffle([seed.action, "ngủ quên trong lớp", "làm mất sách của bạn", "chạy ra ngoài trời mưa"])
  },
  {
    q: `Đồ vật nào được nhắc đến trong bài?`,
    a: seed.object,
    options: shuffle([seed.object, "chiếc đồng hồ đỏ", "cặp kính đen", "lọ mực tím"])
  },
  {
    q: `Bài đọc muốn nhắc bé điều gì?`,
    a: seed.lesson,
    options: shuffle([seed.lesson, "nên vội vàng khi đọc", "không cần giúp ai", "chỉ làm việc khi có phần thưởng"])
  }
]);

const makeGrade3ReadingLibrary = () => {
  const levels = Object.keys(LEVEL_CONFIG);
  const library = [];
  levels.forEach((levelKey) => {
    for (let i = 0; i < 50; i++) {
      const seed = GRADE3_READING_SEEDS[(i + levels.indexOf(levelKey) * 3) % GRADE3_READING_SEEDS.length];
      library.push({
        id: `${levelKey}-${i + 1}`,
        level: levelKey,
        levelName: LEVEL_CONFIG[levelKey].name,
        title: `Bài đọc ${LEVEL_CONFIG[levelKey].name} ${i + 1}: ${seed.who} làm việc tốt`,
        text: buildPassageText(seed, levelKey, i),
        questions: makeReadingQuestions(seed)
      });
    }
  });
  return library;
};

const GRADE3_READING_LIBRARY = makeGrade3ReadingLibrary();

const PREP_READING_LEVELS = ['easy', 'medium', 'hard', 'special'];

const normalizeWords = (text) =>
  text
    .replace(/[.,!?;:()"“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

const makePrepReadingLibrary = () => {
  const easyOpeners = [
    "Bé An đi học", "Bé Na đọc sách", "Nam tưới cây", "Lan vẽ hoa", "Minh rửa tay",
    "Bé Mai ăn cơm", "Bố đưa bé đi", "Mẹ kể chuyện", "Cô giáo cười", "Bé Hà hát",
    "Bé Bin xếp sách", "Bé Su lau bàn", "Bé Bông tô màu", "Bé Tôm đá bóng", "Bé Ken chào cô",
    "Bé Miu ngồi học", "Bé Sóc nhặt lá", "Bé Gạo gấp áo", "Bé Mây ngắm hoa", "Bé Tin đọc bài"
  ];
  const easyClosers = [
    "Bé đọc chậm và rất vui hôm nay.", "Cả nhà khen bé học thật ngoan hôm nay.", "Bạn nhỏ cười tươi khi đọc xong bài.",
    "Cô khen bé ngoan và chăm chỉ lắm.", "Bé làm thật tốt trong giờ học này."
  ];

  const mediumOpeners = [
    "Sáng nay trời nắng đẹp", "Giờ ra chơi rất vui", "Trong lớp học nhỏ", "Buổi tối ở nhà", "Chiều nay trong sân",
    "Trên đường đến lớp", "Sau bữa cơm tối", "Ở góc vườn xanh", "Khi nghe cô gọi", "Lúc tan học về",
    "Trong giờ đọc sách", "Bên cửa sổ sáng", "Ngày chủ nhật vui", "Ở bàn học gọn", "Dưới bóng cây mát",
    "Sau khi rửa tay", "Trong buổi sinh hoạt", "Khi mẹ đi chợ", "Ở sân trường rộng", "Lúc trời vừa mưa"
  ];
  const mediumActions = [
    "bé đọc từng tiếng thật chậm, sau đó mỉm cười với cô giáo và đọc lại một lần nữa.",
    "bé xếp sách vở ngay ngắn trên bàn rồi chuẩn bị đọc bài cho cả nhóm nghe nhé.",
    "bé cùng bạn hát một bài thật vui trước khi vào lớp học và mở sách mới nhé.",
    "bé tưới nước cho chậu hoa nhỏ, nhặt lá khô bên cạnh rồi rửa tay sạch sẽ.",
    "bé chào ông bà rồi vào nhà học bài cùng mẹ trong góc bàn sáng nhỏ."
  ];

  const hardOpeners = [
    "Sáng thứ hai, bé An dậy sớm, đánh răng và chuẩn bị cặp sách",
    "Trong giờ đọc, cô giáo chỉ từng dòng để bé nhìn chữ rõ hơn",
    "Chiều chủ nhật, Lan theo bà ra chợ và quan sát nhiều gian hàng",
    "Sau cơn mưa, sân trường sạch hơn, những chiếc lá xanh rung nhẹ",
    "Buổi tối, cả nhà ngồi bên bàn ăn và kể chuyện trong ngày",
    "Ở góc vườn, Nam chăm chú nhổ cỏ quanh luống rau nhỏ",
    "Khi vào lớp, bé treo cặp lên ghế rồi lấy sách Tiếng Việt",
    "Trong thư viện, các bạn đi nhẹ, nói khẽ và chọn sách tranh",
    "Trên đường về, bé nhìn thấy hàng cây nghiêng mình trong gió",
    "Giờ thủ công, Mai cắt giấy màu và dán thành bông hoa"
  ];
  const hardClosers = [
    "Bé đọc chậm, đọc rõ từng tiếng, rồi nhớ chào cô trước khi cùng mẹ trở về nhà hôm nay nhé.",
    "Bạn nhỏ làm từng việc cẩn thận, biết hỏi khi chưa hiểu nên được mọi người khen rất nhiều nhé.",
    "Bé thấy việc học vui hơn khi kiên nhẫn luyện đọc và cố gắng thêm mỗi ngày ở lớp nhé.",
    "Cô mỉm cười vì bé biết lắng nghe, nhìn chữ kỹ và làm theo lời dặn thật tốt nhé.",
    "Bé hoàn thành bài đọc, vui vẻ giúp bạn xếp lại đồ dùng rồi mới ra chơi cùng lớp nhé.",
    "Bạn nhỏ nhắc mình đọc thong thả, không vội vàng, để câu nào cũng rõ ràng hơn nhé.",
    "Cả nhóm cùng cổ vũ nhẹ nhàng, giúp bé tự tin hơn trong giờ luyện đọc hôm nay nhé.",
    "Bé nhìn từng dòng chữ, nghỉ đúng chỗ có dấu phẩy và đọc tiếp thật bình tĩnh nhé.",
    "Sau bài học, bé kể lại nội dung ngắn gọn để cô biết bé đã hiểu rõ nhé.",
    "Mẹ khen bé tiến bộ vì biết đọc liền mạch hơn và nhớ giữ giọng rõ ràng nhé."
  ];

  const specialOpeners = [
    "Hôm nay lớp Một của bé có buổi trực nhật đầu tuần",
    "Trong chuyến tham quan công viên, các bạn xếp hàng ngay ngắn",
    "Buổi sáng mùa xuân, sân trường có nhiều bông hoa mới nở",
    "Khi cả nhà chuẩn bị bữa tối, bé được mẹ giao vài việc nhỏ",
    "Trong giờ kể chuyện, cô giáo mở quyển sách có nhiều tranh đẹp",
    "Chiều thứ bảy, ông dẫn bé ra vườn xem những luống rau xanh",
    "Sau giờ học, nhóm của Lan ở lại luyện đọc thêm cùng cô",
    "Ngày hội đọc sách ở trường diễn ra trong không khí vui vẻ",
    "Trước khi đi ngủ, bé tự soạn sách vở cho ngày học mới",
    "Trong tiết học ngoài trời, cô đưa cả lớp ra quan sát cây"
  ];
  const specialMiddles = [
    "Bé cùng các bạn lau bảng, kê bàn ghế, nhặt giấy vụn và đặt sách vở vào đúng chỗ.",
    "Bạn nhỏ lắng nghe lời cô, đi chậm theo hàng và nhường đường cho em bé hơn.",
    "Bé đọc từng câu, gặp từ chưa quen thì dừng lại hỏi cô để hiểu nghĩa.",
    "Mọi người vừa làm vừa trò chuyện nhẹ nhàng, nên công việc xong nhanh và rất vui.",
    "Bé quan sát màu sắc, hình dáng, mùi hương rồi kể lại bằng những câu ngắn gọn.",
    "Các bạn thay nhau đọc bài, người đọc trước giúp người đọc sau sửa từng tiếng nhỏ.",
    "Bé nhìn tranh, đoán nội dung câu chuyện, rồi đọc lại để kiểm tra xem mình đoán đúng không.",
    "Cô chia nhóm nhỏ, mỗi bạn phụ trách một việc để cả lớp cùng hoàn thành bài học.",
    "Bé chuẩn bị bút chì, sách đọc và thẻ chữ trước khi bắt đầu luyện đọc cùng bạn.",
    "Khi gặp câu dài, bé dừng nhẹ ở dấu phẩy, hít thở rồi đọc tiếp bằng giọng đều."
  ];
  const specialClosers = [
    "Cuối buổi, bé thấy mình tự tin hơn vì đã cố gắng đọc rõ ràng, chăm chú và không bỏ cuộc nữa.",
    "Cô khen cả nhóm biết hợp tác, giữ trật tự, hoàn thành nhiệm vụ được giao và giúp nhau đọc tốt hơn.",
    "Về nhà, bé kể lại câu chuyện cho bố mẹ nghe bằng giọng chậm rãi, vui tươi và rõ từng câu hơn.",
    "Từ hôm đó, bé thích luyện đọc mỗi ngày vì thấy chữ nào cũng trở nên quen thuộc và gần gũi hơn nhiều.",
    "Bạn nhỏ hiểu rằng làm việc cẩn thận sẽ giúp lớp học sạch đẹp, ấm áp và ai cũng thấy vui hơn.",
    "Sau đó, bé ghi nhớ những từ mới, thử đặt câu ngắn và dùng lại trong lúc nói chuyện hằng ngày.",
    "Cả lớp vỗ tay nhẹ nhàng, khiến bạn nào cũng muốn cố gắng hơn ở lượt đọc sau của mình nữa.",
    "Bé nhận ra đọc chậm mà chắc giúp mình hiểu bài tốt hơn và không bỏ sót chữ nào nữa.",
    "Kết thúc tiết học, cô nhắc các bạn giữ sách sạch đẹp để ngày mai đọc tiếp thật vui hơn.",
    "Bé vui vẻ cất đồ dùng, chào cô và kể rằng hôm nay mình đã đọc được nhiều hơn trước rồi."
  ];

  const levels = [
    { level: 'easy', first: easyOpeners, second: easyClosers },
    { level: 'medium', first: mediumOpeners, second: mediumActions },
    { level: 'hard', first: hardOpeners, second: hardClosers },
    { level: 'special', first: specialOpeners, second: specialMiddles, third: specialClosers }
  ];

  return levels.flatMap(({ level, first, second, third }) =>
    first.flatMap((start) =>
      second.map((middle, index) => ({
        level,
        text: third ? `${start}. ${middle} ${third[index % third.length]}` : `${start}. ${middle}`
      }))
    )
  );
};

const PREP_PASSAGES = makePrepReadingLibrary();

const getPrepDifficulty = (currentLevel) =>
  PREP_READING_LEVELS[Math.min(Math.max(currentLevel - 1, 0), PREP_READING_LEVELS.length - 1)];

const getPrepPassage = (currentLevel) => {
  const difficulty = getPrepDifficulty(currentLevel);
  const candidates = PREP_PASSAGES.filter((item) => {
    const count = normalizeWords(item.text).length;
    if (item.level === 'easy') return item.level === difficulty && count >= 10 && count <= 20;
    if (item.level === 'medium') return item.level === difficulty && count >= 20 && count <= 30;
    if (item.level === 'hard') return item.level === difficulty && count >= 30 && count <= 50;
    return item.level === difficulty && count >= 50 && count <= 100;
  });
  const pool = candidates.length ? candidates : PREP_PASSAGES.filter((item) => item.level === difficulty);
  return pool[Math.floor(Math.random() * pool.length)].text;
};

const PREP_FRUITS = [
  { a: "Chuối", hints: ["tròn xoe", "vàng", "ruột ngọt", "bóc vỏ ăn"] },
  { a: "Cam", hints: ["có múi", "vị chua ngọt", "vắt nước uống", "thơm"] },
  { a: "Cherry", hints: ["đỏ chót", "nhỏ xinh", "thành chùm", "trên cây"] },
  { a: "Dưa hấu", hints: ["vỏ xanh", "ruột đỏ", "nhiều hạt đen", "ăn mát"] },
  { a: "Táo", hints: ["vỏ đỏ hoặc vàng", "ruột mềm", "ngọt thơm", "giòn"] },
  { a: "Sầu riêng", hints: ["có gai", "mùi thơm", "vua của các loại quả", "ruột vàng"] },
  { a: "Xoài", hints: ["màu vàng", "chua ngọt", "làm nước ép", "sinh tố"] },
  { a: "Nho", hints: ["nhỏ", "tròn", "mọc thành chùm", "ăn tươi"] },
  { a: "Dừa", hints: ["vỏ cứng", "cơm trắng", "nước ngọt", "quả dừa"] },
  { a: "Măng cụt", hints: ["màu tím", "nhiều hạt nhỏ", "ngọt thanh", "vỏ dày"] },
  { a: "Lê", hints: ["vỏ xanh", "ruột trắng", "mềm", "thơm"] },
  { a: "Dứa", hints: ["nhiều mắt", "ruột vàng", "chua ngọt", "thơm"] },
  { a: "Dâu tây", hints: ["hình trái tim nhỏ", "màu đỏ", "mọc thành chùm", "rất ngọt"] },
  { a: "Ổi", hints: ["màu xanh", "ruột trắng hoặc hồng", "hạt cứng", "ăn với muối"] },
  { a: "Mít", hints: ["vỏ dày", "thành từng múi", "ruột vàng", "rất thơm"] },
  { a: "Thanh long", hints: ["ruột trắng hoặc hồng", "vỏ có vảy", "mát", "ngọt"] }
];

const PREP_ANIMALS = [
  { a: "Mèo", hints: ["kêu meo meo", "thích bắt chuột", "lông mềm", "nhanh nhẹn"] },
  { a: "Chó", hints: ["sủa gâu gâu", "giữ nhà", "bạn của con người", "trung thành"] },
  { a: "Voi", hints: ["vòi dài", "tai to", "thân rất to", "phun nước"] },
  { a: "Chim", hints: ["bay trên trời", "có cánh", "hót líu lo", "nhỏ bé"] },
  { a: "Thỏ", hints: ["nhảy rất nhanh", "tai dài", "thích ăn cỏ", "hiền"] },
  { a: "Rùa", hints: ["mai cứng", "đi rất chậm", "sống lâu", "bò chậm"] },
  { a: "Heo", hints: ["kêu ụt ịt", "thích lăn bùn", "mũi to", "ăn khỏe"] },
  { a: "Gà trống", hints: ["ò ó o", "buổi sáng", "có mào đỏ", "gáy to"] },
  { a: "Sư tử", hints: ["bờm dài", "chúa sơn lâm", "sống ở thảo nguyên", "gầm to"] },
  { a: "Ngựa vằn", hints: ["sọc đen trắng", "chạy nhanh", "ở châu Phi", "thân đẹp"] },
  { a: "Hươu cao cổ", hints: ["cổ rất dài", "ăn lá trên cây cao", "cao lớn", "hiền"] },
  { a: "Cá", hints: ["sống dưới nước", "có vây", "có mang", "bơi bằng đuôi"] },
  { a: "Ếch", hints: ["oanh oanh", "sống ao hồ", "nhảy giỏi", "thích nước"] },
  { a: "Ngựa", hints: ["kéo xe", "bốn chân", "kêu hí", "chạy nhanh"] },
  { a: "Trâu", hints: ["kéo cày", "rất khỏe", "ở ruộng", "sừng cong"] },
  { a: "Khỉ", hints: ["leo trèo giỏi", "thích chuối", "mặt đỏ", "bắt chước người"] }
];

const DIFFICULTY_LEVELS = ["dễ", "trung bình", "cao", "đặc biệt"];
const MIN_ANSWER_TIME_MS = 2000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const readJsonMap = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
};

const VIET_LEVEL_NAMES = [
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

const getVietnameseLevelName = (level, maxLevel = 10) => {
  const index = Math.ceil((clamp(level, 1, maxLevel) / maxLevel) * VIET_LEVEL_NAMES.length) - 1;
  return VIET_LEVEL_NAMES[clamp(index, 0, VIET_LEVEL_NAMES.length - 1)];
};
const GRAMMAR_WORD_BANK = {
  nouns: ['cái bàn', 'quyển sách', 'bông hoa', 'con mèo', 'sân trường', 'dòng sông', 'chiếc cặp', 'ngôi nhà', 'cô giáo', 'bạn Nam', 'cây bàng', 'tiếng trống'],
  verbs: ['chạy', 'đọc', 'viết', 'nhảy', 'hát', 'vẽ', 'giúp đỡ', 'quan sát', 'chăm sóc', 'sắp xếp', 'lắng nghe', 'tưới cây'],
  adjectives: ['xanh biếc', 'chăm chỉ', 'hiền lành', 'rộng rãi', 'sạch sẽ', 'ấm áp', 'nhanh nhẹn', 'rực rỡ', 'gọn gàng', 'vui vẻ', 'yên tĩnh', 'cao lớn'],
  synonyms: [
    ['chăm chỉ', 'cần cù', 'lười biếng', 'ồn ào', 'vội vàng'],
    ['dũng cảm', 'gan dạ', 'nhút nhát', 'buồn bã', 'lạnh lẽo'],
    ['vui vẻ', 'hớn hở', 'tức giận', 'sạch sẽ', 'cao lớn'],
    ['giúp đỡ', 'hỗ trợ', 'trách móc', 'ngủ quên', 'trốn tránh'],
    ['yên tĩnh', 'tĩnh lặng', 'náo nhiệt', 'rực rỡ', 'gọn gàng']
  ],
  antonyms: [
    ['cao', 'thấp', 'rộng', 'xanh', 'đẹp'],
    ['nhanh', 'chậm', 'sáng', 'vui', 'gần'],
    ['sạch', 'bẩn', 'mới', 'ngoan', 'ấm'],
    ['dũng cảm', 'nhút nhát', 'thật thà', 'hiền hậu', 'chăm chỉ'],
    ['ồn ào', 'yên tĩnh', 'vội vàng', 'rực rỡ', 'ấm áp']
  ],
  misspellings: [
    ['sắp xếp', 'sắp sếp', 'sáp xếp', 'sắp xếp'],
    ['xuất sắc', 'suất sắc', 'xuất xắc', 'xuất sắc'],
    ['bổ sung', 'bổ xung', 'bỗ sung', 'bổ sung'],
    ['chân thành', 'trân thành', 'chân thàn', 'chân thành'],
    ['lãng mạn', 'lãn mạn', 'lãng mạng', 'lãng mạn'],
    ['xinh xắn', 'xinh xẻo', 'sinh xắn', 'xinh xắn']
  ]
};

const createGrammarQuestionByPattern = (level, index) => {
  const pattern = index % 10;
  const noun = GRAMMAR_WORD_BANK.nouns[(index + level) % GRAMMAR_WORD_BANK.nouns.length];
  const verb = GRAMMAR_WORD_BANK.verbs[(index * 2 + level) % GRAMMAR_WORD_BANK.verbs.length];
  const adj = GRAMMAR_WORD_BANK.adjectives[(index * 3 + level) % GRAMMAR_WORD_BANK.adjectives.length];

  if (pattern === 0) {
    const answerType = ['Danh từ', 'Động từ', 'Tính từ'][index % 3];
    const ans = answerType === 'Danh từ' ? noun : (answerType === 'Động từ' ? verb : adj);
    return {
      q: `Từ nào dưới đây là ${answerType.toLowerCase()}?`,
      ans,
      opts: [ans, noun, verb, adj].filter((item, pos, arr) => arr.indexOf(item) === pos).slice(0, 4),
      skill: 'Từ loại',
      explanation: `${answerType} là nhóm từ bé cần nhận biết trong câu.`
    };
  }
  if (pattern === 1) {
    const pair = GRAMMAR_WORD_BANK.synonyms[index % GRAMMAR_WORD_BANK.synonyms.length];
    return {
      q: `Từ nào đồng nghĩa với "${pair[0]}"?`,
      ans: pair[1],
      opts: [pair[1], pair[2], pair[3], pair[4]],
      skill: 'Từ đồng nghĩa',
      explanation: `"${pair[1]}" gần nghĩa với "${pair[0]}".`
    };
  }
  if (pattern === 2) {
    const pair = GRAMMAR_WORD_BANK.antonyms[index % GRAMMAR_WORD_BANK.antonyms.length];
    return {
      q: `Từ nào trái nghĩa với "${pair[0]}"?`,
      ans: pair[1],
      opts: [pair[1], pair[2], pair[3], pair[4]],
      skill: 'Từ trái nghĩa',
      explanation: `"${pair[1]}" có nghĩa ngược với "${pair[0]}".`
    };
  }
  if (pattern === 3) {
    const sentence = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} đang ${verb} trong sân.`;
    return {
      q: `Trong câu "${sentence}", bộ phận nào trả lời cho câu hỏi "làm gì?"`,
      ans: `đang ${verb}`,
      opts: [`đang ${verb}`, noun, 'trong sân', 'câu này không có hoạt động'],
      skill: 'Bộ phận câu',
      explanation: `Bộ phận "đang ${verb}" nói hoạt động của sự vật.`
    };
  }
  if (pattern === 4) {
    const sentence = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} thật ${adj}.`;
    return {
      q: `Câu "${sentence}" thuộc kiểu câu nào?`,
      ans: 'Ai thế nào?',
      opts: ['Ai thế nào?', 'Ai làm gì?', 'Ai là gì?', 'Câu hỏi'],
      skill: 'Kiểu câu',
      explanation: `Câu này nêu đặc điểm "${adj}" nên thuộc kiểu Ai thế nào.`
    };
  }
  if (pattern === 5) {
    const choices = [
      { q: 'Lan ơi, cho mình mượn bút nhé', ans: '?' },
      { q: 'Ôi bông hoa này đẹp quá', ans: '!' },
      { q: 'Sáng nay em đi học rất sớm', ans: '.' },
      { q: 'Bạn đã làm xong bài chưa', ans: '?' }
    ];
    const selected = choices[index % choices.length];
    return {
      q: `Cần đặt dấu câu nào ở cuối câu: "${selected.q}"`,
      ans: selected.ans,
      opts: [selected.ans, '.', '?', '!'].filter((item, pos, arr) => arr.indexOf(item) === pos),
      skill: 'Dấu câu',
      explanation: 'Dấu câu cuối câu giúp người đọc hiểu mục đích của câu.'
    };
  }
  if (pattern === 6) {
    const item = GRAMMAR_WORD_BANK.misspellings[index % GRAMMAR_WORD_BANK.misspellings.length];
    return {
      q: `Từ nào viết đúng chính tả?`,
      ans: item[0],
      opts: [item[0], item[1], item[2], 'không có từ đúng'],
      skill: 'Chính tả',
      explanation: `Từ đúng là "${item[0]}".`
    };
  }
  if (pattern === 7) {
    const ans = `Vì trời mưa, em mang áo mưa.`;
    return {
      q: 'Câu nào dùng từ nối hợp lý?',
      ans,
      opts: [ans, 'Nhưng trời mưa, em mang áo mưa.', 'Và trời mưa, em mang áo mưa.', 'Hoặc trời mưa, em mang áo mưa.'],
      skill: 'Từ nối',
      explanation: '"Vì" nêu nguyên nhân, phù hợp với việc trời mưa.'
    };
  }
  if (pattern === 8) {
    const ans = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${verb} rất ${adj}.`;
    return {
      q: 'Sắp xếp các từ thành câu có nghĩa.',
      ans,
      opts: [ans, `${verb} ${noun} rất ${adj}.`, `Rất ${noun} ${verb} ${adj}.`, `${adj} rất ${verb} ${noun}.`],
      skill: 'Sắp xếp câu',
      explanation: 'Câu đúng cần có sự vật, hoạt động hoặc đặc điểm theo trật tự rõ nghĩa.'
    };
  }

  const simile = level >= 6;
  return simile
    ? {
        q: `Câu nào có hình ảnh so sánh?`,
        ans: 'Mặt hồ sáng như chiếc gương lớn.',
        opts: ['Mặt hồ sáng như chiếc gương lớn.', 'Mặt hồ rất rộng.', 'Mặt hồ có nhiều cá.', 'Mặt hồ ở cuối làng.'],
        skill: 'So sánh',
        explanation: 'Từ "như" thường báo hiệu hình ảnh so sánh.'
      }
    : {
        q: `Chọn câu rõ nghĩa nhất.`,
        ans: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} đang ${verb}.`,
        opts: [`${noun.charAt(0).toUpperCase()}${noun.slice(1)} đang ${verb}.`, `Đang ${verb} ${adj}.`, `${adj} đang cái.`, `${verb} trong rất.`],
        skill: 'Câu rõ nghĩa',
        explanation: 'Câu rõ nghĩa cần đủ ý và sắp xếp tự nhiên.'
      };
};

const GRADE3_GRAMMAR_BANK = Array.from({ length: 10 }, (_, levelIndex) => {
  const grammarLevel = levelIndex + 1;
  return Array.from({ length: 120 }, (_, questionIndex) => ({
    ...createGrammarQuestionByPattern(grammarLevel, questionIndex),
    level: grammarLevel,
    key: `grammar-${grammarLevel}-${questionIndex + 1}`
  }));
}).flat();

const WRITING_TYPES = [
  'Viết câu',
  'Viết 3-5 câu',
  'Tả đồ vật',
  'Tả con vật',
  'Tả người',
  'Kể việc tốt',
  'Viết lời nhắn',
  'Đoạn văn có yêu cầu'
];

const WRITING_SUBJECTS = [
  { name: 'chiếc cặp sách', words: ['cặp', 'sách', 'ngăn', 'màu', 'giữ gìn'], type: 'Tả đồ vật' },
  { name: 'quyển vở em thích', words: ['vở', 'trang', 'bìa', 'viết', 'sạch'], type: 'Tả đồ vật' },
  { name: 'con mèo nhà em', words: ['mèo', 'lông', 'mắt', 'chạy', 'yêu'], type: 'Tả con vật' },
  { name: 'con chó trung thành', words: ['chó', 'đuôi', 'sủa', 'canh', 'thân'], type: 'Tả con vật' },
  { name: 'mẹ của em', words: ['mẹ', 'dịu dàng', 'nấu', 'chăm sóc', 'yêu'], type: 'Tả người' },
  { name: 'người bạn thân', words: ['bạn', 'giúp', 'vui', 'học', 'chơi'], type: 'Tả người' },
  { name: 'một lần giúp đỡ gia đình', words: ['giúp', 'nhà', 'vui', 'mẹ', 'việc'], type: 'Kể việc tốt' },
  { name: 'một việc tốt ở trường', words: ['trường', 'bạn', 'giúp', 'cô', 'vui'], type: 'Kể việc tốt' }
];

const createWritingTask = (level) => {
  const normalizedLevel = clamp(level, 1, 10);
  const minSentences = normalizedLevel <= 2 ? 2 : (normalizedLevel <= 5 ? 4 : (normalizedLevel <= 8 ? 6 : 8));
  const minWords = normalizedLevel <= 2 ? 18 : (normalizedLevel <= 5 ? 35 : (normalizedLevel <= 8 ? 55 : 80));
  const subject = WRITING_SUBJECTS[(normalizedLevel * 3 + Date.now()) % WRITING_SUBJECTS.length];
  const type = normalizedLevel <= 1 ? 'Viết câu' : (normalizedLevel <= 2 ? 'Viết 3-5 câu' : subject.type);
  const needsEmotion = normalizedLevel >= 4;
  const needsConnector = normalizedLevel >= 6;
  const needsComparison = normalizedLevel >= 8;
  const hints = [
    `Mở đầu: giới thiệu ${subject.name}.`,
    `Thân đoạn: viết 2-3 chi tiết cụ thể.`,
    needsEmotion ? 'Viết thêm cảm xúc hoặc suy nghĩ của em.' : 'Kết thúc bằng một câu ngắn gọn.',
    needsConnector ? 'Dùng ít nhất một từ nối: vì, nên, sau đó, cuối cùng.' : '',
    needsComparison ? 'Thử dùng một câu so sánh có từ "như".' : ''
  ].filter(Boolean);

  return {
    type,
    level: normalizedLevel,
    levelName: getVietnameseLevelName(normalizedLevel),
    topic: `Viết đoạn văn về ${subject.name}.`,
    prompt: `${type}: Em hãy viết ít nhất ${minSentences} câu về ${subject.name}.`,
    minSentences,
    minWords,
    keywords: subject.words,
    needsEmotion,
    needsConnector,
    needsComparison,
    hints,
    rewardMax: 10 + normalizedLevel
  };
};

const countVietnameseSentences = (text) => text.split(/[.!?。！？]+/).map(s => s.trim()).filter(Boolean).length;
const normalizeVietnameseText = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const evaluateWriting = (text, task) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentenceCount = countVietnameseSentences(text);
  const normalizedText = normalizeVietnameseText(text);
  const matchedKeywords = task.keywords.filter(word => normalizedText.includes(normalizeVietnameseText(word.split(' ')[0])));
  const hasEmotion = ['vui', 'yêu', 'thích', 'tự hào', 'biết ơn', 'hạnh phúc', 'ấm áp'].some(word => normalizedText.includes(normalizeVietnameseText(word)));
  const hasConnector = ['vì', 'nên', 'sau đó', 'cuối cùng', 'trước tiên', 'ngoài ra'].some(word => normalizedText.includes(normalizeVietnameseText(word)));
  const hasComparison = normalizedText.includes(' nhu ') || normalizedText.includes(' nhu la ');
  const punctuationCount = (text.match(/[.!?]/g) || []).length;

  const rubric = [
    { name: 'Đúng chủ đề', score: matchedKeywords.length > 0 ? 2 : 0, max: 2 },
    { name: 'Đủ độ dài', score: words.length >= task.minWords && sentenceCount >= task.minSentences ? 2 : (words.length >= Math.ceil(task.minWords * 0.65) ? 1 : 0), max: 2 },
    { name: 'Có chi tiết cụ thể', score: matchedKeywords.length >= 3 ? 2 : (matchedKeywords.length >= 2 ? 1 : 0), max: 2 },
    { name: 'Câu rõ nghĩa', score: sentenceCount >= task.minSentences ? 2 : 1, max: 2 },
    { name: 'Dấu câu', score: punctuationCount >= Math.max(1, task.minSentences - 1) ? 1 : 0, max: 1 },
    { name: 'Cảm xúc/từ nối/câu hay', score: ((task.needsEmotion ? hasEmotion : true) && (task.needsConnector ? hasConnector : true) && (task.needsComparison ? hasComparison : true)) ? 1 : 0, max: 1 }
  ];
  const score = rubric.reduce((sum, item) => sum + item.score, 0);
  const weakSkills = rubric.filter(item => item.score < item.max).map(item => item.name);
  return {
    score,
    wordCount: words.length,
    sentenceCount,
    matchedKeywords,
    hasEmotion,
    hasConnector,
    hasComparison,
    rubric,
    weakSkills
  };
};

const getVietnameseMistakeAdvice = (wrongItem = {}, catId = 'grammar') => {
  const skill = wrongItem.skill || '';
  if (skill.includes('Từ loại')) return 'Cách sửa: hỏi từ này gọi tên sự vật, hoạt động hay đặc điểm. Sau đó đặt từ vào một câu ngắn để kiểm tra.';
  if (skill.includes('đồng nghĩa') || skill.includes('trái nghĩa')) return 'Cách sửa: đọc nghĩa của từ trong câu, rồi thử thay bằng đáp án. Nếu câu vẫn gần nghĩa là đồng nghĩa, nếu ngược nghĩa là trái nghĩa.';
  if (skill.includes('Dấu câu')) return 'Cách sửa: đọc câu thành tiếng. Câu hỏi dùng dấu hỏi, câu bộc lộ cảm xúc dùng dấu chấm than, câu kể dùng dấu chấm.';
  if (skill.includes('Chính tả')) return 'Cách sửa: chép lại từ đúng 3 lần, đọc chậm từng âm đầu và vần dễ nhầm trước khi chọn.';
  if (skill.includes('Sắp xếp') || skill.includes('Câu rõ nghĩa')) return 'Cách sửa: tìm ai/cái gì trước, rồi tìm làm gì hoặc thế nào, cuối cùng đọc lại xem câu có tự nhiên không.';
  if (skill.includes('Từ nối')) return 'Cách sửa: xác định quan hệ giữa hai ý: nguyên nhân dùng "vì/nên", trình tự dùng "sau đó/cuối cùng".';
  if (skill.includes('So sánh')) return 'Cách sửa: tìm hai sự vật được đặt cạnh nhau và từ báo hiệu như "như", "tựa", "giống".';
  if (catId === 'reading') return 'Cách sửa: quay lại đoạn đọc, tìm câu chứa thông tin liên quan rồi gạch chân từ khóa trước khi trả lời.';
  if (catId === 'prep_riddle') return 'Cách sửa: đọc từng gợi ý, loại bỏ đáp án không khớp, chỉ chọn khi tất cả gợi ý đều đúng.';
  return wrongItem.explanation || 'Cách sửa: đọc lại câu hỏi, tìm từ khóa quan trọng, so sánh từng đáp án rồi chọn đáp án phù hợp nhất.';
};

const getWritingRubricAdvice = (rubricName) => {
  if (rubricName === 'Đúng chủ đề') return 'Đọc lại đề và nhắc tên sự vật/sự việc chính ngay từ câu đầu.';
  if (rubricName === 'Đủ độ dài') return 'Viết thêm 1-2 câu giải thích hoặc kể thêm một chi tiết cụ thể.';
  if (rubricName === 'Có chi tiết cụ thể') return 'Thêm màu sắc, hình dáng, hoạt động, thời gian, nơi chốn hoặc cảm xúc.';
  if (rubricName === 'Câu rõ nghĩa') return 'Mỗi câu nên có đủ ai/cái gì và làm gì/thế nào; đọc thành tiếng để phát hiện câu cụt.';
  if (rubricName === 'Dấu câu') return 'Sau mỗi ý trọn vẹn, đặt dấu chấm. Câu cảm xúc có thể dùng dấu chấm than.';
  if (rubricName === 'Cảm xúc/từ nối/câu hay') return 'Thêm từ nối như "sau đó", "vì vậy" hoặc một câu cảm xúc như "Em rất yêu...".';
  return 'Đọc lại bài, sửa từng câu ngắn trước rồi mới viết dài hơn.';
};

const QUESTION_VARIANTS = {
  "dễ": [
    (type, h) => `${type} nào ${h[0]}?`,
    (type, h) => `Bé chọn ${type.toLowerCase()} ${h[1]} nhé?`,
    (type, h) => `${type} nào có đặc điểm là ${h[2]}?`,
    (type, h) => `Đâu là ${type.toLowerCase()} ${h[3]}?`,
    (type, h) => `${type} nào nhận ra vì ${h[0]}?`,
    (type, h) => `Bé đoán nhanh: ${type.toLowerCase()} nào ${h[1]}?`,
    (type, h) => `Bé chọn nhé: ${type.toLowerCase()} nào ${h[2]}?`,
    (type, h) => `Trong các đáp án, đâu là ${type.toLowerCase()} ${h[3]}?`,
    (type, h) => `${type} nào thường được nhớ đến vì ${h[0]}?`,
    (type, h) => `Chọn đáp án đúng: ${type.toLowerCase()} nào ${h[1]}?`,
    (type, h) => `Bạn nhỏ thấy ${type.toLowerCase()} ${h[2]}, đó là gì?`,
    (type, h) => `${type} nào có dấu hiệu ${h[3]}?`,
    (type, h) => `Nếu nghe gợi ý "${h[0]}", bé chọn ${type.toLowerCase()} nào?`,
    (type, h) => `${type} nào phù hợp với gợi ý: ${h[1]}?`,
    (type, h) => `Gợi ý đầu tiên là ${h[2]}. Đó là ${type.toLowerCase()} nào?`,
    (type, h) => `Bé tìm ${type.toLowerCase()} có đặc điểm ${h[3]}.`,
    (type, h) => `Đố vui nhỏ: ${type.toLowerCase()} nào ${h[0]}?`,
    (type, h) => `Bé hãy chọn ${type.toLowerCase()} có gợi ý ${h[1]}.`,
    (type, h) => `Câu hỏi nhanh: đâu là ${type.toLowerCase()} ${h[2]}?`,
    (type, h) => `Bạn nhỏ cần tìm ${type.toLowerCase()} ${h[3]}.`,
    (type, h) => `Đáp án nào là ${type.toLowerCase()} có dấu hiệu ${h[0]}?`,
    (type, h) => `Bé nhớ xem: ${type.toLowerCase()} nào ${h[1]}?`,
    (type, h) => `Tìm nhanh ${type.toLowerCase()} được tả là ${h[2]}.`,
    (type, h) => `Một ${type.toLowerCase()} ${h[3]} là đáp án nào?`
  ],
  "trung bình": [
    (type, h) => `${type} nào ${h[0]} và ${h[1]}?`,
    (type, h) => `Đố bé: ${type.toLowerCase()} nào ${h[1]} và ${h[2]}?`,
    (type, h) => `${type} nào vừa ${h[2]}, vừa ${h[3]}?`,
    (type, h) => `Gợi ý có hai ý: ${h[0]}, ${h[2]}. Đó là ${type.toLowerCase()} nào?`,
    (type, h) => `${type} nào có đặc điểm ${h[1]}, lại còn ${h[3]}?`,
    (type, h) => `Bé chọn ${type.toLowerCase()} đúng với hai gợi ý: ${h[0]} và ${h[3]}.`,
    (type, h) => `${type} nào thường ${h[2]} và có vẻ ${h[1]}?`,
    (type, h) => `Câu đố vừa: ${type.toLowerCase()} nào ${h[3]} nhưng cũng ${h[0]}?`,
    (type, h) => `${type} nào khớp với gợi ý "${h[1]}, ${h[2]}"?`,
    (type, h) => `Nếu một ${type.toLowerCase()} ${h[0]} và ${h[2]}, bé chọn gì?`,
    (type, h) => `${type} nào được tả là ${h[1]}, ${h[3]}?`,
    (type, h) => `Tìm ${type.toLowerCase()} có hai dấu hiệu: ${h[0]} và ${h[1]}.`,
    (type, h) => `${type} nào vừa có dấu hiệu ${h[2]}, vừa có dấu hiệu ${h[3]}?`,
    (type, h) => `Đáp án nào là ${type.toLowerCase()} ${h[0]}, ${h[3]}?`,
    (type, h) => `Bé nối hai manh mối ${h[1]} và ${h[2]} để tìm ${type.toLowerCase()} nào?`,
    (type, h) => `${type} nào được nhắc tới với ${h[0]} và ${h[2]}?`
  ],
  "cao": [
    (type, h) => `${type} nào có đủ ba dấu hiệu: ${h[0]}, ${h[1]}, ${h[2]}?`,
    (type, h) => `Bé suy luận: ${type.toLowerCase()} nào ${h[1]}, ${h[2]} và ${h[3]}?`,
    (type, h) => `${type} nào được tả bằng ba manh mối ${h[0]}, ${h[2]}, ${h[3]}?`,
    (type, h) => `Chọn ${type.toLowerCase()} khớp nhất với: ${h[0]}, ${h[1]}, ${h[3]}.`,
    (type, h) => `${type} nào vừa ${h[0]}, vừa ${h[2]}, lại ${h[3]}?`,
    (type, h) => `Có một ${type.toLowerCase()} ${h[1]}, ${h[2]}, ${h[3]}. Đó là gì?`,
    (type, h) => `${type} nào không chỉ ${h[0]} mà còn ${h[1]} và ${h[2]}?`,
    (type, h) => `Bé tìm đáp án khi nghe ba gợi ý: ${h[1]}, ${h[2]}, ${h[3]}.`,
    (type, h) => `${type} nào có ba đặc điểm liên tiếp: ${h[0]}, ${h[2]}, ${h[1]}?`,
    (type, h) => `Đáp án đúng phải ${h[3]}, ${h[0]} và ${h[1]}. Là ${type.toLowerCase()} nào?`,
    (type, h) => `Tìm ${type.toLowerCase()} phù hợp nhất với ${h[2]}, ${h[0]}, ${h[3]}.`,
    (type, h) => `${type} nào được nhận ra nhờ ${h[1]}, ${h[3]}, ${h[0]}?`,
    (type, h) => `Nếu cô đọc ${h[2]}, ${h[3]}, ${h[1]}, bé chọn ${type.toLowerCase()} nào?`,
    (type, h) => `${type} nào có các dấu hiệu ${h[0]}, ${h[1]} và ${h[3]}?`,
    (type, h) => `Ba manh mối là ${h[3]}, ${h[2]}, ${h[0]}. Đáp án là ${type.toLowerCase()} nào?`,
    (type, h) => `${type} nào vừa được tả là ${h[1]}, vừa ${h[0]}, vừa ${h[2]}?`
  ],
  "đặc biệt": [
    (type, h) => `${type} nào có cả bốn dấu hiệu ${h[0]}, ${h[1]}, ${h[2]}, ${h[3]}?`,
    (type, h) => `Bé chọn đáp án chính xác nhất: ${h[0]}, ${h[1]}, ${h[2]}, ${h[3]}.`,
    (type, h) => `Nghe đủ bốn manh mối ${h[3]}, ${h[2]}, ${h[1]}, ${h[0]}, bé đoán ${type.toLowerCase()} nào?`,
    (type, h) => `${type} nào có đủ đặc điểm ${h[1]}, ${h[3]}, ${h[0]}, ${h[2]}?`,
    (type, h) => `Bé tìm ${type.toLowerCase()} vừa ${h[0]}, vừa ${h[1]}, vừa ${h[2]}, vừa ${h[3]}.`,
    (type, h) => `Đâu là đáp án đúng khi cả bốn gợi ý đều đúng: ${h[0]}, ${h[2]}, ${h[1]}, ${h[3]}?`,
    (type, h) => `Bé cần nhớ bốn ý ${h[1]}, ${h[0]}, ${h[3]}, ${h[2]} để chọn ${type.toLowerCase()} nào?`,
    (type, h) => `Câu suy luận: ${type.toLowerCase()} nào khớp với toàn bộ gợi ý ${h[2]}, ${h[3]}, ${h[0]}, ${h[1]}?`,
    (type, h) => `${type} nào vừa có dấu hiệu ${h[0]}, vừa có dấu hiệu ${h[1]}, vừa có dấu hiệu ${h[2]}, vừa có dấu hiệu ${h[3]}?`,
    (type, h) => `Trong các đáp án, chọn ${type.toLowerCase()} hợp với ${h[3]}, ${h[1]}, ${h[2]}, ${h[0]}.`,
    (type, h) => `Nếu bé ghép bốn manh mối ${h[0]}, ${h[3]}, ${h[2]}, ${h[1]}, đáp án là ${type.toLowerCase()} nào?`,
    (type, h) => `${type.toLowerCase()} nào được miêu tả bằng ${h[1]}, ${h[2]}, ${h[3]}, ${h[0]}?`,
    (type, h) => `${type} nào có bốn đặc điểm nổi bật: ${h[2]}, ${h[0]}, ${h[1]}, ${h[3]}?`,
    (type, h) => `Bé chọn thật kỹ: ${type.toLowerCase()} nào ${h[3]}, ${h[0]}, ${h[2]} và ${h[1]}?`,
    (type, h) => `Đáp án nào đúng nhất với chuỗi gợi ý ${h[0]} - ${h[1]} - ${h[2]} - ${h[3]}?`,
    (type, h) => `${type.toLowerCase()} nào có đủ ${h[2]}, ${h[1]}, ${h[0]}, ${h[3]}?`
  ]
};

const makePrepQuestion = (item, group, difficulty, variantIndex) => {
  const type = group === 'fruit' ? "Quả" : "Con";
  const base = QUESTION_VARIANTS[difficulty][variantIndex](type, item.hints);
  const pool = group === 'fruit' ? PREP_FRUITS : PREP_ANIMALS;
  const wrongs = pool
    .filter((x) => x.a !== item.a)
    .map((x) => x.a)
    .sort(() => Math.random() - 0.5);
  const options = [item.a];
  for (const wrong of wrongs) {
    if (options.length >= 4) break;
    options.push(wrong);
  }
  return { q: base, a: item.a, options: options.sort(() => Math.random() - 0.5), difficulty };
};

const PREP_RIDDLES = (() => {
  const byDifficulty = DIFFICULTY_LEVELS.reduce((acc, difficulty) => {
    acc[difficulty] = [];
    return acc;
  }, {});
  const seen = new Set();
  const sources = [
    { group: 'fruit', pool: PREP_FRUITS },
    { group: 'animal', pool: PREP_ANIMALS }
  ];

  for (const difficulty of DIFFICULTY_LEVELS) {
    for (const { group, pool } of sources) {
      for (const item of pool) {
        for (let variantIndex = 0; variantIndex < QUESTION_VARIANTS[difficulty].length; variantIndex++) {
          const question = makePrepQuestion(item, group, difficulty, variantIndex);
          if (!seen.has(question.q)) {
            byDifficulty[difficulty].push(question);
            seen.add(question.q);
          }
        }
      }
    }
  }

  return DIFFICULTY_LEVELS.flatMap((difficulty) => byDifficulty[difficulty].slice(0, 500));
})();

const buildPrepQuizRound = (currentLevel, schedule = []) => {
  const byDifficulty = DIFFICULTY_LEVELS.reduce((acc, difficulty) => {
    acc[difficulty] = shuffle(PREP_RIDDLES.filter((q) => q.difficulty === difficulty));
    return acc;
  }, {});
  const tierMap = { easy: 'dễ', medium: 'trung bình', hard: 'cao', special: 'đặc biệt' };
  if (schedule.length) return schedule.map((tier) => ({ ...byDifficulty[tierMap[tier]].shift(), difficultyTier: tier }));
  const currentDifficulty = DIFFICULTY_LEVELS[Math.min(Math.max(currentLevel - 1, 0), DIFFICULTY_LEVELS.length - 1)];
  return byDifficulty[currentDifficulty].slice(0, 10);
};

export default function ReadingTest() {
  const navigate = useNavigate();
  const currentUser = localStorage.getItem('currentUser') || 'vuanhduc';
  const isGrade3 = currentUser === 'vuanhduc';
  const childMaxLevel = getChildMaxLevel(currentUser);

  const moduleLevelKey = `vietnameseModuleLevels_${currentUser}`;
  const [moduleLevels, setModuleLevels] = useState(() => readJsonMap(moduleLevelKey));
  const [activeModuleLevel, setActiveModuleLevel] = useState(1);

  const [screen, setScreen] = useState('hub');
  const [category, setCategory] = useState(null);
  const [interventions, setInterventions] = useState({});
  const [usedQuestions, setUsedQuestions] = useState(new Set());
  
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, startTime: null });
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [fairPlayReminder, setFairPlayReminder] = useState(null);

  const [grammarIndex, setGrammarIndex] = useState(0);
  const [difficultySchedule, setDifficultySchedule] = useState([]);
  const [grammarQ, setGrammarQ] = useState(null);
  const [writingTopic, setWritingTopic] = useState('');
  const [writingTask, setWritingTask] = useState(null);
  const [writingContent, setWritingContent] = useState('');
  const [prepQuizIndex, setPrepQuizIndex] = useState(0);
  const [prepQuizQ, setPrepQuizQ] = useState(null);
  const [prepQuizQueue, setPrepQuizQueue] = useState([]);
  const [canAnswer, setCanAnswer] = useState(false);

  const [targetText, setTargetText] = useState("");
  const [currentPassage, setCurrentPassage] = useState(null);
  const [readingAnswers, setReadingAnswers] = useState({});
  const [readingSubmitted, setReadingSubmitted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [scoreData, setScoreData] = useState(null);
  const startTimeRef = useRef(null);
  const transcriptRef = useRef("");

  const [timeLeft, setTimeLeft] = useState(0);
  const [maxTime, setMaxTime] = useState(0);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const answerDelayRef = useRef(null);

  const beginAnswerDelay = () => {
    clearTimeout(answerDelayRef.current);
    setCanAnswer(false);
    answerDelayRef.current = setTimeout(() => setCanAnswer(true), MIN_ANSWER_TIME_MS);
  };

  const getModuleLevel = (moduleId) => clamp(parseInt(moduleLevels[moduleId] || '1', 10), 1, childMaxLevel);

  const saveModuleLevel = (moduleId, nextLevel) => {
    const normalized = clamp(nextLevel, 1, childMaxLevel);
    const nextLevels = { ...moduleLevels, [moduleId]: normalized };
    setModuleLevels(nextLevels);
    localStorage.setItem(moduleLevelKey, JSON.stringify(nextLevels));
    return normalized;
  };

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
            if (data.plays >= 4) newInterventions[k] = 'nerfed';
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
    const isTimedReadingFlow = screen === 'reading' && (
      isRecording || category === 'prep_riddle' || (Boolean(currentPassage) && !readingSubmitted)
    );
    if ((screen === 'grammar' || isTimedReadingFlow) && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timerRef.current);
    } else if ((screen === 'grammar' || (screen === 'reading' && category === 'prep_riddle')) && timeLeft === 0) {
      finishGrammar(stats, wrongAnswers, true);
    } else if (screen === 'reading' && isRecording && timeLeft === 0) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  }, [timeLeft, screen, isRecording, category, stats, wrongAnswers]);

  useEffect(() => () => clearTimeout(answerDelayRef.current), []);

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
    const normalizedLevel = clamp(currentLevel, 1, 10);
    const levelPool = GRADE3_GRAMMAR_BANK.filter(q => q.level === normalizedLevel);

    while (!foundUnique && attempts < 20) {
      const pool = levelPool.length ? levelPool : GRADE3_GRAMMAR_BANK;
      qObj = pool[Math.floor(Math.random() * pool.length)];
      if (!usedQuestions.has(qObj.key)) {
        foundUnique = true;
        const newUsed = new Set(usedQuestions);
        newUsed.add(qObj.key);
        setUsedQuestions(newUsed);
      }
      attempts++;
    }

    const fallbackOpts = ['Danh từ', 'Động từ', 'Tính từ', 'Dấu chấm', 'Dấu hỏi', 'Câu kể', 'Câu hỏi'];
    const completeOpts = [...new Set(qObj.opts)];
    fallbackOpts.forEach(opt => {
      if (completeOpts.length < 4 && !completeOpts.includes(opt) && opt !== qObj.ans) completeOpts.push(opt);
    });
    const shuffledOpts = completeOpts.slice(0, 4).sort(() => Math.random() - 0.5);
    setGrammarQ({ ...qObj, opts: shuffledOpts });
    beginAnswerDelay();
  };

  const setPrepQuestion = (question) => {
    const opts = shuffle(question.options);
    setPrepQuizQ({ q: question.q, ans: question.a, opts, difficulty: question.difficulty });
    beginAnswerDelay();
  };

  const getWritingTopic = () => {
    const topics = [
      "Viết 3-5 câu tả một đồ dùng học tập của em.",
      "Viết 3-5 câu kể về một việc em đã làm để giúp đỡ gia đình.",
      "Viết 3-5 câu giới thiệu về bản thân."
    ];
    return topics[Math.floor(Math.random() * topics.length)];
  };

  const calculateAndClaimReward = ({ moduleId = category, level, newLevel, decision, qualityPercent, rawAccuracyPercent, timeSpentSec, targetTimeSec, timed = true, skillBonus = null }) => {
    const progress = readRewardProgress(currentUser);
    const claimedMilestones = progress[getRewardProgressKey('vietnamese', moduleId)]?.claimedMilestones || [];
    const reward = calculateLearningReward({
      username: currentUser, level, nextLevel: newLevel, levelDecision: decision,
      qualityPercent, rawAccuracyPercent, timeSpentSec, targetTimeSec, timed, skillBonus,
      encouraged: interventions[moduleId] === 'boosted', claimedMilestones
    });
    if (reward.milestoneLevel) saveClaimedMilestone(currentUser, 'vietnamese', moduleId, reward.milestoneLevel);
    return reward;
  };

  const saveResults = (earnedPoints, timeSpentSec, specificStats = {}, levelUpMsg = "", wrongDetails = [], behaviorMsg = "") => {
    const finalPoints = Math.round(earnedPoints);

    const statsKey = `learningStats_${currentUser}`;
    const learningHistory = JSON.parse(localStorage.getItem(statsKey) || '[]');
    learningHistory.unshift({
      schemaVersion: 3,
      sessionId: globalThis.crypto?.randomUUID?.() || `viet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(),
      subject: 'reading',
      category: category,
      timeSpentSec: timeSpentSec,
      points: finalPoints,
      levelUpMsg,
      wrongDetails: wrongDetails,
      validForAssessment: !specificStats.randomClicking,
      ...specificStats
    });
    if (learningHistory.length > 1000) learningHistory.length = 1000;
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
    if (interventions[category] === 'nerfed') interventionMsg = "Bé đã luyện module này nhiều; hãy thử đổi module để học cân bằng nhé!\n";
    if (interventions[category] === 'boosted') interventionMsg = `Module này được khuyến khích (+${specificStats.rewardBreakdown?.encouragementBonus || 0}💎)!\n`;
    interventionMsg += behaviorMsg;

    setStats({ ...stats, ...specificStats, finalPoints, timeSpentSec, interventionMsg, levelUpMsg });
    setWrongAnswers(wrongDetails);
    syncToServer(currentUser);
    setScreen('result');
  };

  const startGame = (catId, skipReminder = false) => {
    const moduleLevel = getModuleLevel(catId);
    const timing = getLevelTiming(currentUser, 'vietnamese', catId, moduleLevel, catId === 'prep_passage' || catId === 'reading' ? 3 : 10);
    const previewTime = timing.timed ? timing.targetSeconds : null;
    const contentLevel = getModuleContentLevel(currentUser, 'vietnamese', catId, moduleLevel);
    const previewReward = `trần thưởng level ${getLevelRewardCap(currentUser, moduleLevel)} 💎, cộng thưởng kỹ năng nếu làm tốt`;
    if ((catId === 'grammar' || catId === 'prep_riddle' || catId === 'writing' || (isGrade3 && catId === 'reading')) && !skipReminder) {
      setFairPlayReminder({
        timeSec: previewTime,
        timeText: catId === 'writing'
          ? 'không giới hạn, bé viết xong rồi nộp'
          : undefined,
        rewardText: previewReward,
        hideSpeedRules: catId === 'writing',
        onConfirm: () => startGame(catId, true)
      });
      return;
    }
    setCategory(catId);
    setStats({ correct: 0, incorrect: 0, startTime: Date.now() });
    setUsedQuestions(new Set());
    setWrongAnswers([]);
    setCanAnswer(false);
    setActiveModuleLevel(moduleLevel);
    const schedule = buildDifficultySchedule(currentUser, moduleLevel);
    setDifficultySchedule(schedule);

    if (catId === 'grammar') {
      setScreen('grammar');
      setGrammarIndex(0);
      const calculatedMaxTime = getLevelTiming(currentUser, 'vietnamese', catId, moduleLevel, 10).targetSeconds;
      setMaxTime(calculatedMaxTime);
      setTimeLeft(calculatedMaxTime);
      generateUniqueGrammar(getTierContentLevel(currentUser, 'vietnamese', catId, moduleLevel, schedule[0]));
    } else if (catId === 'writing') {
      const task = createWritingTask(contentLevel);
      setScreen('writing');
      setWritingTask(task);
      setWritingTopic(task.prompt);
      setWritingContent('');
    } else {
      setScreen('reading');
      setTargetText('');
      setCurrentPassage(null);
      setReadingAnswers({});
      setReadingSubmitted(false);
      setTranscript("");
      setScoreData(null);
      if (catId === 'prep_riddle') {
        const round = buildPrepQuizRound(contentLevel, schedule);
        setPrepQuizIndex(0);
        setPrepQuizQueue(round);
        const calculatedMaxTime = getLevelTiming(currentUser, 'vietnamese', catId, moduleLevel, 10).targetSeconds;
        setMaxTime(calculatedMaxTime);
        setTimeLeft(calculatedMaxTime);
        setPrepQuestion(round[0]);
      } else if (catId === 'prep_passage') {
        setTargetText(getPrepPassage(contentLevel));
        const baseTime = contentLevel <= 1 ? 60 : (contentLevel === 2 ? 75 : (contentLevel === 3 ? 90 : 105));
        const calculatedTime = Math.round(baseTime * getLevelPhase(currentUser, moduleLevel).multiplier);
        setMaxTime(calculatedTime);
        setTimeLeft(calculatedTime);
      } else {
        const levelKey = getReadingLevelKey(contentLevel);
        const passages = GRADE3_READING_LIBRARY.filter((item) => item.level === levelKey);
        const selectedPassage = passages[Math.floor(Math.random() * passages.length)];
        const passage = { ...selectedPassage, questions: composeReadingQuestions(selectedPassage.questions) };
        setCurrentPassage(passage);
        setTargetText(passage.text);
        const wordCount = countWords(passage.text);
        const readingTime = Math.max(90, Math.ceil((wordCount / 70) * 60));
        const answerTime = getLevelTiming(currentUser, 'vietnamese', catId, moduleLevel, 5).targetSeconds;
        const calculatedTime = Math.round((readingTime + answerTime) * getLevelPhase(currentUser, moduleLevel).multiplier);
        setMaxTime(calculatedTime);
        setTimeLeft(calculatedTime);
      }
    }
  };

  const handlePrepAnswer = (ans) => {
    if (!canAnswer) return;
    const isCorrect = ans === prepQuizQ.ans;
    const newStats = {
      correct: stats.correct + (isCorrect ? 1 : 0),
      incorrect: stats.incorrect + (isCorrect ? 0 : 1),
      startTime: stats.startTime
    };
    const newWrongs = [...wrongAnswers];
    if (!isCorrect) {
      newWrongs.push({
        q: prepQuizQ.q,
        userAns: ans,
        correctAns: prepQuizQ.ans,
        skill: 'Đọc hiểu gợi ý',
        errorType: 'comprehension',
        misconceptionCode: 'vietnamese.prep_riddle.reading_clues',
        advice: getVietnameseMistakeAdvice({}, 'prep_riddle')
      });
    }

    setStats(newStats);
    setWrongAnswers(newWrongs);

    if (prepQuizIndex + 1 < 10) {
      const nextIndex = prepQuizIndex + 1;
      setPrepQuizIndex(nextIndex);
      setPrepQuestion(prepQuizQueue[nextIndex]);
    } else {
      finishGrammar(newStats, newWrongs);
    }
  };

  const handleGrammarAnswer = (ans) => {
    if (!canAnswer) return;
    const isCorrect = ans === grammarQ.ans;
    let newStats = { ...stats };
    let newWrongs = [...wrongAnswers];
    if (isCorrect) {
      newStats.correct += 1;
    } else {
      newStats.incorrect += 1;
      newWrongs.push({
        q: grammarQ.q,
        userAns: ans,
        correctAns: grammarQ.ans,
        skill: grammarQ.skill,
        explanation: grammarQ.explanation,
        errorType: grammarQ.errorType || 'concept',
        misconceptionCode: grammarQ.misconceptionCode || `vietnamese.grammar.${String(grammarQ.skill || 'general').toLowerCase().replace(/\s+/g, '_')}`,
        advice: getVietnameseMistakeAdvice(grammarQ, 'grammar')
      });
      setWrongAnswers(newWrongs);
    }
    setStats(newStats);

    if (grammarIndex + 1 < 10) {
      setGrammarIndex(grammarIndex + 1);
      generateUniqueGrammar(getTierContentLevel(currentUser, 'vietnamese', 'grammar', activeModuleLevel, difficultySchedule[grammarIndex + 1]));
    } else {
      finishGrammar(newStats, newWrongs);
    }
  };

  const finishGrammar = (finalStats, finalWrongs = [], isTimeout = false) => {
    clearTimeout(timerRef.current);
    const timeSpentSec = maxTime - timeLeft;
    const currentModuleLevel = activeModuleLevel;
    const fastAnswers = 0;
    const isRandomClicking = false;
    const weakSkillCounts = finalWrongs.reduce((acc, item) => {
      const skill = item.skill || 'Ôn tập';
      acc[skill] = (acc[skill] || 0) + 1;
      return acc;
    }, {});
    const weakSkills = Object.keys(weakSkillCounts).sort((a, b) => weakSkillCounts[b] - weakSkillCounts[a]);
    const progressMap = readProgressMap(currentUser);
    const progressKey = getProgressKey('vietnamese', category);
    const evaluation = evaluateAdaptiveLevel({
      username: currentUser,
      subject: 'vietnamese',
      moduleId: category,
      currentLevel: currentModuleLevel,
      correct: finalStats.correct,
      total: 10,
      timeSpentSec,
      targetTimeSec: maxTime,
      isTimeout,
      isRandomClicking,
      previousProgress: progressMap[progressKey]
    });
    const newLevel = saveModuleLevel(category, evaluation.nextLevel);
    saveAdaptiveProgress(currentUser, 'vietnamese', category, evaluation.progress);
    const levelMessage = evaluation.message;
    const qualityPercent = getGuessCorrectedQuality(finalStats.correct, 10, 4);
    const rewardBreakdown = calculateAndClaimReward({
      level: currentModuleLevel, newLevel, decision: evaluation.decision, qualityPercent,
      rawAccuracyPercent: finalStats.correct * 10, timeSpentSec, targetTimeSec: maxTime
    });

    const behaviorMsg = "";

    saveResults(
      rewardBreakdown.total,
      timeSpentSec,
      {
        correct: finalStats.correct,
        incorrect: finalStats.incorrect,
        fastAnswers,
        randomClicking: isRandomClicking,
        difficultyLevel: currentModuleLevel,
        nextDifficultyLevel: newLevel,
        levelName: getVietnameseLevelName(currentModuleLevel, childMaxLevel),
        levelDecision: evaluation.decision,
        accuracyPercent: evaluation.result.accuracy,
        guessCorrectedQuality: qualityPercent,
        rewardBreakdown,
        difficultySchedule,
        targetTimeSec: maxTime,
        timeRatio: evaluation.result.timeRatio,
        timeMet: evaluation.result.timeMet,
        masteryCount: evaluation.progress.masteryCount,
        contentLevel: getModuleContentLevel(currentUser, 'vietnamese', category, currentModuleLevel),
        weakSkills,
        skillBreakdown: weakSkillCounts,
        suggestedReview: weakSkills.length ? `Ôn lại: ${weakSkills.slice(0, 2).join(', ')}` : 'Bé làm rất chắc, có thể tăng độ khó.'
      },
      levelMessage,
      finalWrongs || [],
      behaviorMsg
    );
  };

  const submitWriting = () => {
    if (!writingTask) return;
    const result = evaluateWriting(writingContent, writingTask);
    if (result.wordCount < Math.max(8, Math.floor(writingTask.minWords * 0.45))) {
      alert('Bài viết còn quá ngắn. Bé hãy viết thêm theo các gợi ý nhé!');
      return;
    }
    const timeSpentSec = Math.round((Date.now() - stats.startTime) / 1000);
    const progressMap = readProgressMap(currentUser);
    const evaluation = evaluateAdaptiveLevel({
      username: currentUser,
      subject: 'vietnamese',
      moduleId: 'writing',
      currentLevel: activeModuleLevel,
      scorePercent: result.score * 10,
      timeSpentSec,
      targetTimeSec: 0,
      timeRequired: false,
      previousProgress: progressMap[getProgressKey('vietnamese', 'writing')]
    });
    const newLevel = saveModuleLevel('writing', evaluation.nextLevel);
    saveAdaptiveProgress(currentUser, 'vietnamese', 'writing', evaluation.progress);
    const levelMessage = evaluation.message;
    const skillBonus = Math.min(3,
      (result.wordCount >= writingTask.minWords ? 1 : 0)
      + (result.sentenceCount >= (writingTask.minSentences || 3) ? 1 : 0)
      + (result.weakSkills.length === 0 ? 1 : 0));
    const rewardBreakdown = calculateAndClaimReward({
      moduleId: 'writing', level: activeModuleLevel, newLevel, decision: evaluation.decision,
      qualityPercent: result.score * 10, rawAccuracyPercent: result.score * 10,
      timeSpentSec, targetTimeSec: 0, timed: false, skillBonus
    });
    saveResults(rewardBreakdown.total, timeSpentSec, {
      correct: result.score,
      incorrect: 10 - result.score,
      writingScore: result.score,
      difficultyLevel: activeModuleLevel,
      nextDifficultyLevel: newLevel,
      levelDecision: evaluation.decision,
      accuracyPercent: evaluation.result.accuracy,
      rewardBreakdown,
      masteryCount: evaluation.progress.masteryCount,
      contentLevel: getModuleContentLevel(currentUser, 'vietnamese', 'writing', activeModuleLevel),
      levelName: writingTask.levelName,
      writingType: writingTask.type,
      topic: writingTask.topic,
      wordCount: result.wordCount,
      sentenceCount: result.sentenceCount,
      rubric: result.rubric,
      weakSkills: result.weakSkills,
      suggestedReview: result.weakSkills.length ? `Bé cần luyện thêm: ${result.weakSkills.slice(0, 2).join(', ')}` : 'Bài viết đủ ý, rõ ràng. Lần sau thử dùng câu hay hơn.'
    }, levelMessage);
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
        transcriptRef.current = "";
        startTimeRef.current = Date.now();
      };
      
      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + " ";
        }
        transcriptRef.current = currentTranscript.trim();
        setTranscript(currentTranscript);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
        calculateScore(transcriptRef.current);
      };
      
      recognition.start();
    }
  };

  const calculateScore = (finalTranscript) => {
    const timeSpentMs = Date.now() - startTimeRef.current;
    const timeSpentSec = Math.max(1, Math.round(timeSpentMs / 1000));
    
    const targetWords = normalizeWords(targetText.toLowerCase());
    const spokenWords = normalizeWords((finalTranscript || '').toLowerCase());
    
    let correctWords = 0;
    targetWords.forEach(word => {
        if (spokenWords.includes(word)) correctWords++;
    });
    
    const wpm = Math.round((spokenWords.length / timeSpentSec) * 60);
    const accuracy = Math.round((correctWords / targetWords.length) * 100);
    const paceScore = wpm >= 70 && wpm <= 140 ? 100 : (wpm >= 50 && wpm <= 170 ? 80 : (wpm >= 35 && wpm <= 190 ? 60 : 40));
    const completion = Math.min(100, Math.round((spokenWords.length / targetWords.length) * 100));
    const fluency = Math.round((paceScore * 0.6) + (completion * 0.4));
    const readingScore = Math.round((accuracy * 0.7) + (fluency * 0.3));
    const readingPoints = Math.round(readingScore * 0.6 / 10);

    setScoreData({
      accuracy,
      wpm,
      fluency,
      readingScore,
      readingPoints,
      comprehensionScore: 0,
      comprehensionCorrect: 0,
      points: readingPoints,
      timeSpentSec
    });
  };

  const handleReadingAnswer = (questionIndex, option) => {
    setReadingAnswers({ ...readingAnswers, [questionIndex]: option });
  };

  const submitReadingAnswers = () => {
    if (!currentPassage) return;
    const unanswered = currentPassage.questions.some((_, index) => !readingAnswers[index]);
    if (unanswered) {
      alert("Bé hãy trả lời đủ 5 câu hỏi trước khi nộp nhé!");
      return;
    }

    const wrongDetails = [];
    let correct = 0;
    currentPassage.questions.forEach((question, index) => {
      const userAns = readingAnswers[index];
      if (userAns === question.a) {
        correct += 1;
      } else {
        wrongDetails.push({
          q: question.q,
          userAns,
          correctAns: question.a,
          skill: 'Đọc hiểu và tìm bằng chứng',
          errorType: 'comprehension',
          misconceptionCode: 'vietnamese.reading.find_evidence',
          advice: getVietnameseMistakeAdvice({}, 'reading')
        });
      }
    });

    const comprehensionScore = correct * 20;
    const comprehensionPoints = correct;
    const fastAnswers = 0;
    const fastMultiplier = 1;
    const totalPoints = Math.round(Math.min(10, (scoreData?.readingPoints || 0) + comprehensionPoints) * fastMultiplier);
    setWrongAnswers(wrongDetails);
    setReadingSubmitted(true);
    setScoreData({
      ...scoreData,
      comprehensionScore,
      comprehensionCorrect: correct,
      comprehensionPoints,
      points: totalPoints,
      fastAnswers,
      randomClicking: false
    });
  };

  const finishReading = () => {
    const currentLevel = activeModuleLevel;
    const totalTimeSpentSec = Math.max(scoreData.timeSpentSec || 0, Math.round((Date.now() - stats.startTime) / 1000));
    const progressMap = readProgressMap(currentUser);
    const scorePercent = category === 'prep_passage'
      ? (scoreData.readingScore || 0)
      : Math.round((scoreData.readingScore || 0) * 0.4 + (scoreData.comprehensionScore || 0) * 0.6);
    const evaluation = evaluateAdaptiveLevel({
      username: currentUser,
      subject: 'vietnamese',
      moduleId: category,
      currentLevel,
      scorePercent,
      timeSpentSec: totalTimeSpentSec,
      targetTimeSec: maxTime,
      isRandomClicking: scoreData.randomClicking,
      previousProgress: progressMap[getProgressKey('vietnamese', category)]
    });
    const newLevel = saveModuleLevel(category, evaluation.nextLevel);
    saveAdaptiveProgress(currentUser, 'vietnamese', category, evaluation.progress);
    const levelMessage = evaluation.message;
    const skillBonus = Math.min(3,
      ((scoreData.accuracy || 0) >= 80 ? 1 : 0)
      + ((scoreData.fluency || 0) >= 80 ? 1 : 0)
      + ((category === 'prep_passage' ? scoreData.readingScore : scoreData.comprehensionScore) >= 80 ? 1 : 0));
    const rewardBreakdown = calculateAndClaimReward({
      level: currentLevel, newLevel, decision: evaluation.decision,
      qualityPercent: scorePercent, rawAccuracyPercent: scorePercent,
      timeSpentSec: totalTimeSpentSec, targetTimeSec: maxTime, timed: false, skillBonus
    });

    saveResults(rewardBreakdown.total, totalTimeSpentSec, {
      wpm: scoreData.wpm, 
      accuracy: scoreData.accuracy, 
      fluency: scoreData.fluency,
      readingScore: scoreData.readingScore,
      comprehensionScore: scoreData.comprehensionScore,
      comprehensionCorrect: scoreData.comprehensionCorrect,
      fastAnswers: scoreData.fastAnswers || 0,
      randomClicking: scoreData.randomClicking || false,
      difficultyLevel: currentLevel,
      nextDifficultyLevel: newLevel,
      levelDecision: evaluation.decision,
      accuracyPercent: evaluation.result.accuracy,
      rewardBreakdown,
      targetTimeSec: maxTime,
      timeRatio: evaluation.result.timeRatio,
      timeMet: evaluation.result.timeMet,
      masteryCount: evaluation.progress.masteryCount,
      contentLevel: getModuleContentLevel(currentUser, 'vietnamese', category, currentLevel),
      passageId: currentPassage?.id,
      passageLevel: currentPassage?.level
    }, levelMessage, wrongAnswers, "");
  };

  if (screen === 'hub') {
    const categories = isGrade3 ? GRADE3_VIETNAMESE : PREP_VIETNAMESE;
    return (
      <>
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
              {isNerfed && <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#FF9800', color: 'white', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>⚠️ Nên đổi module</div>}
              {isBoosted && <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#4CAF50', color: 'white', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>⭐ Khuyến khích +10%</div>}
              
              <div style={{ fontSize: '2rem', marginBottom: '10px', filter: isLocked ? 'grayscale(100%)' : 'none' }}>{c.icon}</div>
              <div>{c.name}</div>
              <div style={{ marginTop: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                Level {getModuleLevel(c.id)}/{childMaxLevel} · {getLevelPhase(currentUser, getModuleLevel(c.id)).name}
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
          {grammarQ?.skill && <div style={{ fontSize: '0.95rem', color: '#558B2F', fontWeight: 'bold', marginBottom: '10px' }}>{grammarQ.skill}</div>}
          {grammarQ?.q}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {grammarQ?.opts.map((opt, i) => (
            <button key={i} onClick={() => handleGrammarAnswer(opt)} disabled={!canAnswer} style={{ fontSize: '1.2rem', padding: '15px', textAlign: 'left', backgroundColor: canAnswer ? '#FFF' : '#F5F5F5', color: canAnswer ? '#333' : '#999', border: '1px solid #CCC', cursor: canAnswer ? 'pointer' : 'not-allowed' }}>
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
        <div style={{ fontSize: '1.1rem', margin: '20px 0', padding: '15px', background: '#E3F2FD', borderRadius: '10px', borderLeft: '4px solid #1976D2', textAlign: 'left' }}>
          <div style={{ fontWeight: 'bold', color: '#0D47A1', marginBottom: '8px' }}>
            {writingTask?.type}
          </div>
          <div style={{ fontSize: '1.2rem', fontStyle: 'italic' }}>Đề bài: {writingTopic}</div>
          {writingTask && (
            <div style={{ marginTop: '10px', color: '#333' }}>
              <div>Yêu cầu: ít nhất {writingTask.minSentences} câu, khoảng {writingTask.minWords}+ từ.</div>
              <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                {writingTask.hints.map((hint) => <li key={hint}>{hint}</li>)}
              </ul>
            </div>
          )}
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
    if (!isGrade3 && category === 'prep_riddle') {
      return (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: '#2E7D32', margin: 0 }}>Đố vui hoa quả & con vật</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: timerColor }}>
              Câu {prepQuizIndex + 1}/10 · ⏱ {timeLeft}s
            </div>
          </div>
          <div style={{ fontSize: '1.3rem', margin: '30px 0', padding: '20px', background: '#FFF8E1', borderRadius: '10px', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {prepQuizQ?.q}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
            {prepQuizQ?.opts.map((opt, i) => (
              <button key={i} onClick={() => handlePrepAnswer(opt)} disabled={!canAnswer} style={{ fontSize: '1.2rem', padding: '15px', textAlign: 'left', cursor: canAnswer ? 'pointer' : 'not-allowed', opacity: canAnswer ? 1 : 0.65 }}>
                {opt}
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/student')} style={{ marginTop: '20px', width: '100%', backgroundColor: '#888' }}>
            Quay về trang chủ
          </button>
        </div>
      );
    }
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#2E7D32', margin: 0 }}>{category === 'prep_passage' ? 'Đọc đoạn văn' : 'Luyện Đọc'} 🎙️</h2>
          {isRecording && (
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: timerColor, padding: '5px 15px', border: `2px solid ${timerColor}`, borderRadius: '20px' }}>
              ⏱ {timeLeft}s
            </div>
          )}
        </div>
        {currentPassage && (
          <div style={{ marginTop: '12px', color: '#555', fontWeight: 'bold' }}>
            Bài đọc · {countWords(currentPassage.text)} từ
          </div>
        )}
        <div style={{ padding: '30px', margin: '20px 0', background: '#f5f5f5', borderRadius: '10px', fontSize: '1.5rem', lineHeight: '1.6', fontWeight: 'normal' }}>
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
              <div style={{ background: '#FFF', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: '#888' }}>Trôi chảy</div>
                <strong style={{ fontSize: '1.5rem', color: '#7B1FA2' }}>{scoreData.fluency}%</strong>
              </div>
              <div style={{ background: '#FFF', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: '#888' }}>Đọc hiểu</div>
                <strong style={{ fontSize: '1.5rem', color: '#E65100' }}>{scoreData.comprehensionCorrect}/5</strong>
              </div>
            </div>
            {currentPassage && !readingSubmitted && (
              <div style={{ background: '#FFF', padding: '15px', borderRadius: '10px', marginTop: '15px' }}>
                <h3 style={{ marginTop: 0, color: '#2E7D32' }}>Trả lời 5 câu hỏi sau khi đọc</h3>
                {currentPassage.questions.map((question, qIndex) => (
                  <div key={question.q} style={{ marginBottom: '16px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Câu {qIndex + 1}: {question.q}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                      {question.options.map((option) => (
                        <button
                          key={option}
                          onClick={() => handleReadingAnswer(qIndex, option)}
                          style={{
                            textAlign: 'left',
                            padding: '10px 12px',
                            backgroundColor: readingAnswers[qIndex] === option ? '#C8E6C9' : '#F7F7F7',
                            color: '#333',
                            border: readingAnswers[qIndex] === option ? '2px solid #4CAF50' : '1px solid #DDD'
                          }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={submitReadingAnswers} style={{ width: '100%', backgroundColor: '#1976D2' }}>Nộp câu trả lời</button>
              </div>
            )}
            {(!currentPassage || readingSubmitted) && (
              <>
                <h2 style={{ textAlign: 'center', color: '#E65100', margin: '20px 0' }}>Thưởng: {scoreData.points} 💎 (Điểm 10)</h2>
                <button onClick={finishReading} style={{ width: '100%' }}>Nhận Thưởng & Trở về</button>
              </>
            )}
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
          {category === 'writing' && <h3>Bài viết: {stats.writingScore}/10 điểm</h3>}
          <p>Thời gian: {stats.timeSpentSec}s</p>
          <p style={{ color: '#4CAF50', fontWeight: 'bold' }}>{stats.interventionMsg}</p>
          {stats.levelUpMsg && <p style={{ color: '#6A1B9A', fontWeight: 'bold' }}>{stats.levelUpMsg}</p>}
          {stats.suggestedReview && <p style={{ color: '#6A1B9A', fontWeight: 'bold' }}>{stats.suggestedReview}</p>}
          <p style={{ color: '#1976D2', fontSize: '1.2rem', fontWeight: 'bold' }}>Tổng thưởng: {stats.finalPoints} 💎</p>
        </div>

        {stats.rubric && (
          <div style={{ background: '#FFF8E1', padding: '15px', borderRadius: '10px', marginBottom: '20px', textAlign: 'left' }}>
            <h3 style={{ color: '#E65100', marginTop: 0 }}>Rubric bài viết</h3>
            {stats.rubric.map(item => (
              <div key={item.name} style={{ borderBottom: '1px solid #FFE0B2', padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.name}</span>
                  <strong>{item.score}/{item.max}</strong>
                </div>
                {item.score < item.max && (
                  <div style={{ marginTop: '5px', color: '#5D4037', background: '#FFF', padding: '6px', borderRadius: '5px' }}>
                    <strong>Cách sửa:</strong> {getWritingRubricAdvice(item.name)}
                  </div>
                )}
              </div>
            ))}
            <div style={{ marginTop: '10px', color: '#555' }}>
              Số từ: {stats.wordCount} · Số câu: {stats.sentenceCount}
            </div>
          </div>
        )}

        {wrongAnswers.length > 0 && (
          <div style={{ background: '#FFEBEE', padding: '15px', borderRadius: '10px', marginBottom: '20px', textAlign: 'left' }}>
            <h3 style={{ color: '#D32F2F', marginTop: 0 }}>Các câu cần ôn lại ({wrongAnswers.length}):</h3>
            {wrongAnswers.map((w, idx) => (
              <div key={idx} style={{ background: 'white', padding: '10px', borderRadius: '5px', marginBottom: '10px', borderLeft: '4px solid #F44336' }}>
                <div style={{ marginBottom: '5px' }}><strong>Câu hỏi:</strong> {w.q}</div>
                {w.skill && <div><strong>Kỹ năng:</strong> {w.skill}</div>}
                <div style={{ color: '#D32F2F' }}><strong>Bé chọn:</strong> {w.userAns} ❌</div>
                <div style={{ color: '#388E3C' }}><strong>Đáp án đúng:</strong> {w.correctAns} ✅</div>
                {w.explanation && <div style={{ color: '#555', marginTop: '5px' }}>{w.explanation}</div>}
                <div style={{ marginTop: '8px', color: '#5D4037', background: '#FFF8E1', padding: '8px', borderRadius: '6px' }}><strong>Cách sửa:</strong> {w.advice || getVietnameseMistakeAdvice(w, category)}</div>
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
