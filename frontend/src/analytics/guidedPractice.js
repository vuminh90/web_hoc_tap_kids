const step = (id, title, instruction, prompt, parentTip, placeholder = 'Bé nhập câu trả lời ở đây...') => ({
  id,
  title,
  instruction,
  prompt,
  parentTip,
  placeholder
});

const WORD_PROBLEM_STEPS = [
  step('restate', 'Đọc và kể lại đề', 'Bé đọc chậm đề hai lần, sau đó kể lại bằng lời của mình.', 'Đề bài đang nói về chuyện gì?', 'Chỉ hỏi lại nếu bé bỏ sót ý; chưa sửa và chưa nói phép tính.'),
  step('question', 'Xác định điều cần tìm', 'Khoanh hoặc viết lại đúng câu hỏi cuối của đề.', 'Bài toán yêu cầu tìm đại lượng nào?', 'Nếu bé trả lời bằng một con số ngay, hãy hỏi: “Con số đó nói về cái gì?”.'),
  step('facts', 'Tách các dữ kiện', 'Gạch chân từng số và ghi rõ mỗi số biểu thị điều gì.', 'Hãy liệt kê các dữ kiện quan trọng kèm đơn vị.', 'Giúp bé phân biệt dữ kiện cần dùng và thông tin không cần thiết.'),
  step('model', 'Vẽ sơ đồ hoặc mô hình', 'Dùng đoạn thẳng, nhóm đồ vật hoặc bảng ngắn để biểu diễn quan hệ giữa các dữ kiện.', 'Mô tả sơ đồ của con hoặc vẽ ra giấy rồi ghi “đã vẽ”.', 'Ưu tiên để bé tự chọn cách biểu diễn; sơ đồ không cần đẹp.'),
  step('operation', 'Chọn phép tính', 'Dựa vào câu hỏi và sơ đồ, chọn phép tính cho từng bước.', 'Con chọn phép tính nào? Vì sao?', 'Không chấp nhận chỉ ghi phép tính; yêu cầu bé giải thích “vì sao”.'),
  step('calculate', 'Thực hiện tính toán', 'Viết phép tính ra giấy, tính từng bước và giữ đúng đơn vị.', 'Kết quả tính của con là gì?', 'Nếu sai tính toán, quay lại đúng dòng bị sai thay vì làm lại toàn bộ.'),
  step('check', 'Kiểm tra và trả lời', 'Đọc lại câu hỏi, kiểm tra đơn vị và xem kết quả có hợp lý không.', 'Viết câu trả lời đầy đủ và nói cách con kiểm tra.', 'Hỏi “Nếu thay kết quả vào câu chuyện thì có hợp lý không?”.')
];

const CALCULATION_STEPS = [
  step('identify', 'Nhận diện phép tính', 'Đọc đúng dấu phép tính và nói tên các số trong bài.', 'Đây là phép tính gì?', 'Yêu cầu bé chỉ vào dấu phép tính trước khi bắt đầu.'),
  step('align', 'Đặt tính thẳng hàng', 'Viết các hàng đơn vị, chục, trăm thẳng cột với nhau.', 'Bé ghi “đã đặt tính” và nói cột nào làm trước.', 'Kiểm tra cách đặt tính, chưa kiểm tra kết quả.'),
  step('solve', 'Tính từng cột', 'Bắt đầu từ cột phù hợp, nói thành tiếng mỗi bước nhớ hoặc mượn.', 'Ghi kết quả từng bước hoặc kết quả cuối.', 'Khi bé sai, hỏi lại đúng cột đó thay vì nói đáp án.'),
  step('reverse', 'Kiểm tra bằng phép tính ngược', 'Dùng phép cộng để kiểm tra phép trừ, hoặc phép nhân để kiểm tra phép chia.', 'Phép tính kiểm tra của con là gì?', 'Khen việc tự kiểm tra, kể cả khi bé vừa phát hiện mình sai.'),
  step('final', 'Kết luận', 'So sánh kết quả kiểm tra và chốt đáp án.', 'Đáp án cuối cùng của con là gì?', 'Chỉ mở đáp án mẫu sau bước này.')
];

const GEOMETRY_STEPS = [
  step('observe', 'Quan sát toàn bộ hình', 'Nói tên các hình hoặc bộ phận con nhìn thấy, chưa đếm ngay.', 'Con nhìn thấy những loại hình nào?', 'Cho bé xoay hoặc chỉ vào hình nếu cần, nhưng chưa gợi số lượng.'),
  step('strategy', 'Chọn thứ tự đếm', 'Chọn đếm từ hình nhỏ đến hình lớn hoặc từ trái sang phải.', 'Con sẽ đếm theo thứ tự nào?', 'Một thứ tự cố định giúp tránh đếm trùng.'),
  step('small', 'Đếm hình đơn', 'Đánh dấu từng hình đơn đã đếm trên giấy.', 'Có bao nhiêu hình đơn?', 'Yêu cầu bé chỉ lại từng hình tương ứng với số đếm.'),
  step('combined', 'Tìm hình ghép', 'Ghép hai hoặc nhiều hình nhỏ để tìm các hình lớn hơn.', 'Con tìm thêm được bao nhiêu hình ghép?', 'Dùng màu khác để đánh dấu hình ghép.'),
  step('total', 'Cộng và kiểm tra', 'Cộng các nhóm, sau đó đếm lại theo một hướng khác.', 'Tổng cộng có bao nhiêu hình? Con đã kiểm tra thế nào?', 'Nếu hai lần đếm khác nhau, quay lại nhóm hình ghép.')
];

const READING_STEPS = [
  step('read', 'Đọc lại đoạn liên quan', 'Đọc chậm câu hỏi rồi đọc lại đoạn văn có thông tin liên quan.', 'Câu hỏi đang hỏi về ai, việc gì hoặc điều gì?', 'Không yêu cầu bé đọc lại toàn bài nếu chỉ cần một đoạn.'),
  step('keywords', 'Tìm từ khóa', 'Gạch chân từ khóa trong câu hỏi và tìm từ tương ứng trong bài.', 'Các từ khóa con tìm được là gì?', 'Nếu bé chọn quá nhiều, hỏi từ nào quyết định đáp án.'),
  step('evidence', 'Tìm bằng chứng', 'Chỉ ra câu hoặc ý trong bài hỗ trợ câu trả lời.', 'Hãy chép hoặc kể lại bằng chứng trong bài.', 'Yêu cầu bằng chứng trước khi xem các lựa chọn.'),
  step('compare', 'So sánh đáp án', 'Đọc từng lựa chọn và loại đáp án không khớp bằng chứng.', 'Vì sao các đáp án còn lại chưa phù hợp?', 'Bé cần giải thích ít nhất một đáp án sai.'),
  step('answer', 'Chọn và giải thích', 'Chọn đáp án phù hợp nhất rồi nói lại bằng câu đầy đủ.', 'Đáp án của con là gì và vì sao?', 'Chỉ mở đáp án mẫu khi bé đã nêu lý do.')
];

const WRITING_STEPS = [
  step('topic', 'Hiểu đề và chọn ý', 'Gạch từ khóa trong đề, sau đó nói điều con muốn kể hoặc miêu tả.', 'Chủ đề chính và ý con muốn viết là gì?', 'Giúp bé thu hẹp một ý cụ thể thay vì viết quá rộng.'),
  step('outline', 'Lập dàn ý ngắn', 'Ghi ba ý: mở đầu, chi tiết chính và kết thúc/cảm xúc.', 'Dàn ý ba phần của con là gì?', 'Chấp nhận từ khóa ngắn; chưa yêu cầu câu hoàn chỉnh.'),
  step('sentences', 'Viết từng câu rõ nghĩa', 'Mỗi câu cần có ai/cái gì và làm gì/thế nào.', 'Đọc một câu con vừa viết.', 'Hỏi “Ai/cái gì?” và “làm gì/thế nào?” nếu câu bị cụt.'),
  step('details', 'Thêm chi tiết', 'Thêm màu sắc, âm thanh, hành động, thời gian, nơi chốn hoặc cảm xúc.', 'Con đã thêm chi tiết cụ thể nào?', 'Chỉ cần một đến hai chi tiết có ý nghĩa.'),
  step('revise', 'Đọc lại và sửa', 'Đọc thành tiếng, kiểm tra đúng chủ đề, từ nối, chính tả và dấu câu.', 'Con đã tự sửa điều gì trong bài?', 'Khen việc phát hiện và tự sửa lỗi.')
];

const GENERIC_STEPS = [
  step('understand', 'Hiểu yêu cầu', 'Đọc lại câu hỏi và kể bằng lời của mình.', 'Bài yêu cầu con làm gì?', 'Chưa nói đáp án; chỉ giúp bé hiểu yêu cầu.'),
  step('recall', 'Nhớ lại kiến thức', 'Nói quy tắc, ví dụ hoặc điều đã học liên quan.', 'Con nhớ quy tắc hoặc ví dụ nào?', 'Nếu cần, đưa một ví dụ khác dạng tương tự.'),
  step('try', 'Tự thực hiện', 'Làm bài từng bước và nói thành tiếng cách nghĩ.', 'Ghi cách làm của con.', 'Chỉ gợi đúng bước bé đang vướng.'),
  step('check', 'Tự kiểm tra', 'Đọc lại yêu cầu và kiểm tra từng bước.', 'Con muốn sửa gì trước khi chốt?', 'Cho bé cơ hội tự sửa trước khi mở đáp án.'),
  step('final', 'Chốt câu trả lời', 'Nêu đáp án và giải thích ngắn gọn.', 'Đáp án của con là gì và vì sao?', 'Mở đáp án mẫu sau khi hoàn thành.')
];

const operationName = operator => ({ '+': 'phép cộng', '-': 'phép trừ', '*': 'phép nhân', 'x': 'phép nhân', '×': 'phép nhân', ':': 'phép chia', '/': 'phép chia' }[operator]);

export const parseUnknownEquation = question => {
  const source = String(question || '').replace(/,/g, '.');
  const match = source.match(/(X|-?\d+(?:\.\d+)?)\s*([+\-*:×x/])\s*(X|-?\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const [, leftRaw, operatorRaw, rightRaw, resultRaw] = match;
  const operator = operatorRaw === '×' || operatorRaw.toLowerCase() === 'x' ? '*' : operatorRaw;
  const unknownOnLeft = leftRaw.toUpperCase() === 'X';
  const unknownOnRight = rightRaw.toUpperCase() === 'X';
  if (unknownOnLeft === unknownOnRight) return null;
  const known = Number(unknownOnLeft ? rightRaw : leftRaw);
  const result = Number(resultRaw);
  let role;
  let inverseOperator;
  let expressionLeft;
  let expressionRight;
  let solution;

  if (operator === '+') {
    role = 'số hạng';
    inverseOperator = '-';
    expressionLeft = result;
    expressionRight = known;
    solution = result - known;
  } else if (operator === '-' && unknownOnLeft) {
    role = 'số bị trừ';
    inverseOperator = '+';
    expressionLeft = result;
    expressionRight = known;
    solution = result + known;
  } else if (operator === '-') {
    role = 'số trừ';
    inverseOperator = '-';
    expressionLeft = known;
    expressionRight = result;
    solution = known - result;
  } else if (operator === '*') {
    role = 'thừa số';
    inverseOperator = ':';
    expressionLeft = result;
    expressionRight = known;
    solution = result / known;
  } else if ((operator === ':' || operator === '/') && unknownOnLeft) {
    role = 'số bị chia';
    inverseOperator = '*';
    expressionLeft = result;
    expressionRight = known;
    solution = result * known;
  } else {
    role = 'số chia';
    inverseOperator = ':';
    expressionLeft = known;
    expressionRight = result;
    solution = known / result;
  }

  return {
    operator,
    displayedOperation: operationName(operator),
    unknownRole: role,
    inverseOperator,
    inverseOperation: operationName(inverseOperator),
    known,
    result,
    expressionLeft,
    expressionRight,
    rearrangedExpression: `${expressionLeft} ${inverseOperator} ${expressionRight}`,
    solution
  };
};

const buildUnknownEquationSteps = equation => [
  { ...step('equation_operator', 'Nhận diện phép tính đang hiển thị', 'Nhìn dấu đứng giữa X và số đã biết. Chỉ gọi tên phép tính đang có trong đề, chưa chọn phép tính tìm X.', 'Phép tính đang hiển thị là phép tính gì?', 'Yêu cầu bé chỉ vào dấu phép tính. Đây chưa phải câu hỏi tìm X.', 'VD: phép cộng'), expectedAnswer: equation.displayedOperation },
  { ...step('unknown_role', 'X là thành phần gì?', 'Gọi đúng tên các thành phần của phép tính rồi xác định vai trò của X.', 'Trong phép tính này, X là thành phần gì?', 'Nhắc lại tên thành phần nhưng để bé tự đối chiếu vị trí của X.', 'VD: số hạng'), expectedAnswer: equation.unknownRole },
  { ...step('inverse_operator', 'Chọn phép tính để tìm X', 'Dùng quy tắc tìm thành phần chưa biết, không chỉ nhìn dấu đang hiển thị.', `Muốn tìm ${equation.unknownRole} X, con phải thực hiện phép tính gì?`, `Quy tắc đúng dẫn tới ${equation.inverseOperation}; hỏi bé giải thích bằng tên thành phần.`, 'VD: phép trừ'), expectedAnswer: equation.inverseOperation },
  { ...step('rearrange_equation', 'Lập phép tính tìm X', 'Chọn đúng số đứng trước, số đứng sau và dấu phép tính ngược.', 'Lấy số nào tính với số nào? Hãy viết phép tính chưa cần ghi kết quả.', 'Kiểm tra cả thứ tự hai số; thứ tự đặc biệt quan trọng với phép trừ và phép chia.', `VD: ${equation.rearrangedExpression}`), expectedAnswer: equation.rearrangedExpression },
  { ...step('equation_calculate', 'Tính giá trị của X', `Thực hiện phép tính ${equation.rearrangedExpression}, sau đó viết X bằng kết quả.`, 'X bằng bao nhiêu?', 'Cho bé tự tính trên giấy và kiểm tra từng hàng trước khi nhập.', 'VD: X = ...'), expectedAnswer: equation.solution },
  { ...step('verify_equation', 'Thay X vào đề để kiểm tra', 'Thay giá trị vừa tìm được vào đúng vị trí X trong phép tính ban đầu và tính lại.', 'Hãy viết phép tính kiểm tra đầy đủ.', 'Kết quả vế trái phải bằng đúng số ở vế phải của đề.', 'VD: giá trị X + số đã biết = kết quả'), expectedAnswer: equation.solution, expectedResult: equation.result, expectedKnown: equation.known, expectedOperator: equation.operator }
];

export const parseArithmeticExpression = (question, correctAnswer) => {
  const source = String(question || '').replace(/,/g, '.');
  if (/\bX\b/i.test(source)) return null;
  const match = source.match(/(-?\d+(?:\.\d+)?)\s*([+\-*:×x/])\s*(-?\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const [, firstRaw, operatorRaw, secondRaw] = match;
  const operator = operatorRaw === '×' || operatorRaw.toLowerCase() === 'x' ? '*' : operatorRaw;
  const first = Number(firstRaw);
  const second = Number(secondRaw);
  const calculated = operator === '+' ? first + second
    : operator === '-' ? first - second
      : operator === '*' ? first * second
        : first / second;
  const answerNumber = numbers(correctAnswer)[0];
  const result = answerNumber === undefined ? calculated : Number(answerNumber);
  const roles = operator === '+' ? ['số hạng', 'số hạng', 'tổng']
    : operator === '-' ? ['số bị trừ', 'số trừ', 'hiệu']
      : operator === '*' ? ['thừa số', 'thừa số', 'tích']
        : ['số bị chia', 'số chia', 'thương'];
  const inverseOperator = operator === '+' ? '-' : operator === '-' ? '+' : operator === '*' ? ':' : '*';
  const verification = operator === '+' ? `${result} - ${second} = ${first}`
    : operator === '-' ? `${result} + ${second} = ${first}`
      : operator === '*' ? `${result} : ${second} = ${first}`
        : `${result} * ${second} = ${first}`;
  return { first, second, operator, result, roles, inverseOperator, verification, displayedOperation: operationName(operator), inverseOperation: operationName(inverseOperator) };
};

const buildArithmeticSteps = arithmetic => [
  { ...step('arithmetic_operator', 'Nhận diện phép tính', 'Nhìn dấu giữa hai số và gọi đúng tên phép tính.', 'Đây là phép tính gì?', 'Yêu cầu bé chỉ vào dấu; chưa thực hiện tính.', 'VD: phép trừ'), expectedAnswer: arithmetic.displayedOperation },
  { ...step('arithmetic_components', 'Gọi tên các thành phần', 'Gọi tên số thứ nhất, số thứ hai và kết quả theo đúng phép tính.', `${arithmetic.first}, ${arithmetic.second} và kết quả lần lượt gọi là gì?`, 'Tên thành phần thay đổi theo phép cộng, trừ, nhân, chia.', 'VD: ... là số bị trừ, ... là số trừ, kết quả là hiệu'), expectedNumbers: [arithmetic.first, arithmetic.second], expectedRoles: arithmetic.roles },
  { ...step('arithmetic_method', 'Chọn cách thực hiện', 'Nói cách đặt tính hoặc thứ tự cần tính; nếu đặt tính, các hàng phải thẳng cột.', 'Con sẽ thực hiện phép tính theo các bước nào?', 'Với số nhiều chữ số, yêu cầu bé nói bắt đầu từ hàng nào và có nhớ/mượn hay không.', 'VD: đặt các hàng thẳng cột và tính từ hàng đơn vị'), expectedOperation: arithmetic.operator },
  { ...step('arithmetic_calculate', 'Thực hiện phép tính', 'Tính cẩn thận từng bước rồi nhập kết quả.', `${arithmetic.first} ${arithmetic.operator} ${arithmetic.second} bằng bao nhiêu?`, 'Nếu sai, tìm đúng hàng hoặc bước bắt đầu sai; không đọc đáp án.', 'Nhập kết quả'), expectedAnswer: arithmetic.result },
  { ...step('arithmetic_inverse', 'Chọn phép tính kiểm tra', 'Chọn phép tính ngược phù hợp để kiểm tra kết quả.', 'Cần dùng phép tính gì để kiểm tra?', 'Phép cộng kiểm tra phép trừ; phép trừ kiểm tra phép cộng; nhân và chia kiểm tra lẫn nhau.', 'VD: phép cộng'), expectedAnswer: arithmetic.inverseOperation },
  { ...step('arithmetic_verify', 'Lập phép tính kiểm tra', 'Dùng kết quả vừa tìm và một số trong đề để quay lại số còn lại.', 'Hãy viết đầy đủ phép tính kiểm tra.', `Phép tính kiểm tra mẫu có dạng: kết quả ${arithmetic.inverseOperator} một số đã biết = số còn lại.`, 'Nhập phép tính có dấu bằng'), expectedAnswer: arithmetic.verification }
];

const grammarRuleKeywords = skill => {
  const value = normalize(skill);
  if (value.includes('tu loai')) return ['danh từ', 'động từ', 'tính từ', 'sự vật', 'hoạt động', 'đặc điểm'];
  if (value.includes('dong nghia')) return ['cùng nghĩa', 'gần nghĩa', 'thay thế'];
  if (value.includes('trai nghia')) return ['ngược nghĩa', 'đối lập'];
  if (value.includes('bo phan cau')) return ['chủ ngữ', 'vị ngữ', 'ai', 'làm gì', 'thế nào'];
  if (value.includes('kieu cau')) return ['câu kể', 'câu hỏi', 'câu khiến', 'câu cảm'];
  if (value.includes('dau cau')) return ['dấu chấm', 'dấu hỏi', 'dấu chấm than', 'ngữ điệu'];
  if (value.includes('chinh ta')) return ['âm đầu', 'vần', 'thanh', 'chính tả'];
  if (value.includes('tu noi')) return ['nguyên nhân', 'kết quả', 'trình tự', 'từ nối'];
  if (value.includes('sap xep') || value.includes('cau ro nghia')) return ['ai', 'cái gì', 'làm gì', 'thế nào', 'trật tự'];
  if (value.includes('so sanh')) return ['như', 'giống', 'tựa', 'so sánh'];
  return [skill || 'quy tắc'];
};

const buildGrammarSteps = (mistake, example) => {
  const skill = mistake.skill || example.skill || 'Ngữ pháp';
  const keywords = grammarRuleKeywords(skill);
  return [
    { ...step('grammar_skill', 'Xác định dạng ngữ pháp', 'Đọc yêu cầu và gọi tên đúng kỹ năng đang được kiểm tra.', 'Bài này yêu cầu con dùng kiến thức gì?', 'Không nói đáp án; chỉ giúp bé phân biệt dạng bài.', `VD: ${skill}`), expectedAnswer: skill },
    { ...step('grammar_rule', 'Nhắc lại quy tắc', 'Nói quy tắc nhận diện và cho một ví dụ khác với câu đang làm.', `Quy tắc của “${skill}” là gì?`, 'Nếu bé quên, dùng câu hỏi gợi nhớ thay vì đọc toàn bộ quy tắc.', 'Nói quy tắc và một ví dụ'), expectedKeywords: keywords },
    { ...step('grammar_compare', 'Phân tích các lựa chọn', 'Thử áp dụng quy tắc vào từng đáp án và loại những đáp án không phù hợp.', 'Con loại được đáp án nào và vì sao?', 'Yêu cầu bé dùng quy tắc ở bước trước trong lời giải thích.', 'Nêu ít nhất một đáp án bị loại và lý do'), expectedKeywords: keywords, wrongAnswer: example.userAns },
    { ...step('grammar_answer', 'Chọn đáp án', 'Chọn đáp án phù hợp nhất sau khi đã phân tích.', 'Đáp án đúng là gì?', 'Không hiện đáp án trước khi bé tự chọn.', 'Nhập hoặc nói đáp án'), expectedAnswer: example.correctAns },
    { ...step('grammar_explain', 'Giải thích lại', 'Nói đáp án đúng và quy tắc chứng minh đáp án đó.', 'Vì sao đáp án này đúng?', 'Bé chỉ được coi là hiểu khi nêu được cả đáp án và lý do.', 'Nêu đáp án kèm quy tắc'), expectedAnswer: example.correctAns, expectedKeywords: keywords }
  ];
};

export const buildGuidedPracticeSteps = (mistake = {}, example = {}) => {
  const equation = parseUnknownEquation(example.q);
  if ((mistake.category === 'algebra' || mistake.category === 'basic_math') && equation) return buildUnknownEquationSteps(equation);
  const arithmetic = parseArithmeticExpression(example.q, example.correctAns);
  if ((mistake.category === 'algebra' || mistake.category === 'basic_math') && arithmetic) return buildArithmeticSteps(arithmetic);
  if (mistake.category === 'grammar') return buildGrammarSteps(mistake, example);
  if (mistake.category === 'logic') return WORD_PROBLEM_STEPS;
  if (mistake.category === 'algebra' || mistake.category === 'basic_math') return CALCULATION_STEPS;
  if (mistake.category === 'geometry' || mistake.category === 'visual_math') return GEOMETRY_STEPS;
  if (mistake.category === 'reading' || mistake.category === 'prep_passage' || mistake.category === 'prep_riddle') return READING_STEPS;
  if (mistake.category === 'writing') return WRITING_STEPS;
  return GENERIC_STEPS;
};

const STOP_WORDS = new Set(['bé', 'con', 'của', 'có', 'là', 'và', 'hoặc', 'được', 'cho', 'một', 'những', 'các', 'trong', 'để', 'với', 'nào', 'gì', 'bao', 'nhiêu', 'hãy', 'đang', 'bài', 'hỏi']);

const normalize = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('vi-VN')
  .replace(/[^a-z0-9+\-×x*:/.\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const words = value => normalize(value).split(' ').filter(word => word.length > 1 && !STOP_WORDS.has(word));
const numbers = value => String(value ?? '').match(/-?\d+(?:[.,]\d+)?/g) || [];
const overlapCount = (left, right) => {
  const rightSet = new Set(words(right));
  return [...new Set(words(left))].filter(word => rightSet.has(word)).length;
};

const looksMeaningless = value => {
  const text = normalize(value);
  if (text.length < 2) return true;
  if (/^(abc|abcd|asdf|qwerty|test|thu|khong biet|khong hieu|linh tinh|bla|blah|xxx|zzz)$/.test(text)) return true;
  if (/^(.)\1{2,}$/.test(text.replace(/\s/g, ''))) return true;
  return false;
};

const answerMatches = (response, expected) => {
  const normalizedResponse = normalize(response);
  const normalizedExpected = normalize(expected);
  if (!normalizedExpected) return false;
  if (normalizedResponse === normalizedExpected || normalizedResponse.includes(normalizedExpected)) return true;
  const expectedNumbers = numbers(expected);
  const responseNumbers = numbers(response);
  return expectedNumbers.length > 0 && expectedNumbers.every(number => responseNumbers.includes(number));
};

const semanticMatches = (response, expected) => {
  const left = normalize(response);
  const right = normalize(expected);
  if (left === right || left.includes(right)) return true;
  const generic = new Set(['phep', 'tinh', 'so', 'x', 'la']);
  const expectedCore = words(expected).filter(word => !generic.has(word));
  const responseWords = new Set(words(response));
  return expectedCore.length > 0 && expectedCore.every(word => responseWords.has(word));
};

const canonicalExpression = value => normalize(value)
  .replace(/phep cong|cong/g, '+')
  .replace(/phep tru|tru/g, '-')
  .replace(/phep nhan|nhan|×/g, '*')
  .replace(/phep chia|chia/g, ':')
  .replace(/\s+/g, '');

const inferOperation = question => {
  const text = normalize(question);
  if (/con lai|bot di|cho di|da dung|da ban|hieu|it hon/.test(text)) return ['trừ', '-', 'tru'];
  if (/tong|tat ca|ca hai|them vao|nhieu hon/.test(text)) return ['cộng', '+', 'cong'];
  if (/chia deu|moi .* bao nhieu|xep deu/.test(text)) return ['chia', ':', '/'];
  if (/moi .* co|gap .* lan|nhom .* bang nhau/.test(text)) return ['nhân', 'x', '*', 'nhan'];
  return [];
};

const success = feedback => ({ valid: true, feedback });
const failure = feedback => ({ valid: false, feedback });

export const validateGuidedStep = ({ step: currentStep, response, mistake = {}, example = {}, completedOnPaper = false }) => {
  const text = String(response || '').trim();
  if (!text) return failure(completedOnPaper
    ? 'Bé đã làm trên giấy; hãy nói bằng microphone hoặc nhập ngắn gọn kết quả/cách làm để chương trình kiểm tra.'
    : 'Bé cần nhập hoặc nói câu trả lời trước khi kiểm tra.');
  if (looksMeaningless(text)) return failure('Nội dung chưa liên quan đến bài. Bé hãy đọc lại yêu cầu của bước này và trả lời bằng một câu có nghĩa.');

  const question = example.q || '';
  const expected = example.correctAns;
  const responseWordCount = words(text).length;
  const stepId = currentStep.id;

  if (stepId === 'grammar_skill') {
    if (!semanticMatches(text, currentStep.expectedAnswer)) return failure(`Dạng bài chưa đúng. Bé hãy đọc lại yêu cầu và xác định bài đang kiểm tra “${mistake.skill}” hay một kỹ năng khác.`);
    return success(`Chính xác: đây là dạng “${currentStep.expectedAnswer}”.`);
  }

  if (stepId === 'grammar_rule') {
    const matched = currentStep.expectedKeywords.some(keyword => normalize(text).includes(normalize(keyword)));
    if (!matched || responseWordCount < 3) return failure('Quy tắc chưa đúng hoặc chưa đủ rõ. Bé hãy nêu dấu hiệu nhận biết và một ví dụ ngắn liên quan đến dạng bài.');
    return success('Bé đã nhớ được quy tắc hoặc dấu hiệu nhận biết phù hợp.');
  }

  if (stepId === 'grammar_compare') {
    const mentionsOption = semanticMatches(text, currentStep.wrongAnswer) || semanticMatches(text, example.correctAns);
    const usesRule = currentStep.expectedKeywords.some(keyword => normalize(text).includes(normalize(keyword)));
    if (responseWordCount < 4 || (!mentionsOption && !usesRule)) return failure('Bé cần nêu ít nhất một lựa chọn bị loại và dùng quy tắc ở bước trước để giải thích vì sao.');
    return success('Bé đã biết áp dụng quy tắc để phân tích và loại lựa chọn chưa phù hợp.');
  }

  if (stepId === 'grammar_answer') {
    if (!answerMatches(text, currentStep.expectedAnswer)) return failure('Đáp án chưa đúng. Bé hãy quay lại quy tắc và phần phân tích lựa chọn; đáp án mẫu vẫn được giữ kín.');
    return success(`Đáp án “${currentStep.expectedAnswer}” chính xác.`);
  }

  if (stepId === 'grammar_explain') {
    const hasAnswer = answerMatches(text, currentStep.expectedAnswer);
    const hasRule = currentStep.expectedKeywords.some(keyword => normalize(text).includes(normalize(keyword)));
    if (!hasAnswer || !hasRule || responseWordCount < 4) return failure('Bé cần nói cả đáp án đúng và quy tắc/dấu hiệu chứng minh đáp án đó.');
    return success('Bé đã nêu đúng đáp án và giải thích được quy tắc, thể hiện đã hiểu bài.');
  }

  if (stepId === 'arithmetic_operator') {
    if (!semanticMatches(text, currentStep.expectedAnswer)) return failure('Tên phép tính chưa đúng. Bé hãy nhìn dấu nằm giữa hai số và gọi đúng tên phép tính đó.');
    return success(`Chính xác: đây là ${currentStep.expectedAnswer}.`);
  }

  if (stepId === 'arithmetic_components') {
    const suppliedNumbers = numbers(text).map(Number);
    const hasNumbers = currentStep.expectedNumbers.every(value => suppliedNumbers.includes(Number(value)));
    const hasRoles = currentStep.expectedRoles.every(role => semanticMatches(text, role));
    if (!hasNumbers || !hasRoles) return failure('Bé chưa gọi đủ hoặc chưa đúng tên các thành phần. Hãy ghi rõ tên của số thứ nhất, số thứ hai và tên của kết quả.');
    return success(`Bé đã gọi đúng các thành phần: ${currentStep.expectedRoles.join(' – ')}.`);
  }

  if (stepId === 'arithmetic_method') {
    const normalizedResponse = normalize(text);
    const hasMethod = /dat tinh|thang cot|don vi|chuc|tram|tinh tu|trai sang|phai sang|nho|muon/.test(normalizedResponse);
    if (!hasMethod || responseWordCount < 3) return failure('Cách làm chưa đủ rõ. Bé hãy nói cách đặt các hàng và bắt đầu tính từ hàng nào; nếu có nhớ/mượn cũng cần nói ra.');
    return success('Bé đã nêu được cách thực hiện phép tính theo thứ tự.');
  }

  if (stepId === 'arithmetic_calculate') {
    if (!answerMatches(text, currentStep.expectedAnswer)) return failure('Kết quả chưa đúng. Bé hãy kiểm tra lại từng hàng hoặc từng bước tính; đáp án vẫn được giữ kín.');
    return success(`Kết quả chính xác: ${currentStep.expectedAnswer}.`);
  }

  if (stepId === 'arithmetic_inverse') {
    if (!semanticMatches(text, currentStep.expectedAnswer)) return failure('Phép tính kiểm tra chưa phù hợp. Hãy nhớ phép cộng và trừ kiểm tra lẫn nhau; phép nhân và chia kiểm tra lẫn nhau.');
    return success(`Chính xác: dùng ${currentStep.expectedAnswer} để kiểm tra.`);
  }

  if (stepId === 'arithmetic_verify') {
    if (canonicalExpression(text) !== canonicalExpression(currentStep.expectedAnswer)) return failure('Phép tính kiểm tra chưa đúng hoặc các số đặt sai vị trí. Hãy dùng kết quả vừa tìm và một số đã biết để quay lại số còn lại.');
    return success(`Phép kiểm tra đúng: ${currentStep.expectedAnswer}.`);
  }

  if (stepId === 'equation_operator') {
    if (!semanticMatches(text, currentStep.expectedAnswer)) return failure(`Đây chưa đúng. Bé hãy nhìn dấu trong phép tính đang hiển thị và gọi tên dấu đó; chưa dùng phép tính ngược ở bước này.`);
    return success(`Chính xác: phép tính đang hiển thị là ${currentStep.expectedAnswer}.`);
  }

  if (stepId === 'unknown_role') {
    if (!semanticMatches(text, currentStep.expectedAnswer)) return failure('Vai trò của X chưa đúng. Bé hãy gọi tên các thành phần theo đúng phép tính rồi nhìn vị trí của X.');
    return success(`Chính xác: X là ${currentStep.expectedAnswer}.`);
  }

  if (stepId === 'inverse_operator') {
    if (!semanticMatches(text, currentStep.expectedAnswer)) return failure(`Phép tính tìm X chưa đúng. Hãy dùng quy tắc tìm ${mistake.category === 'algebra' ? 'thành phần chưa biết' : 'X'}, không dùng ngay dấu đang hiển thị.`);
    return success(`Chính xác: cần dùng ${currentStep.expectedAnswer} để tìm X.`);
  }

  if (stepId === 'rearrange_equation') {
    if (canonicalExpression(text) !== canonicalExpression(currentStep.expectedAnswer)) return failure('Phép tính lập chưa đúng hoặc hai số đang đặt sai thứ tự. Bé hãy dựa vào quy tắc ở bước trước và viết lại “số nào tính với số nào”.');
    return success(`Lập phép tính đúng: ${currentStep.expectedAnswer}.`);
  }

  if (stepId === 'equation_calculate') {
    if (!answerMatches(text, currentStep.expectedAnswer)) return failure(`Giá trị X chưa đúng. Bé hãy tính lại phép tính ở bước trước; đáp án đúng vẫn được giữ kín.`);
    return success(`Chính xác: X = ${currentStep.expectedAnswer}.`);
  }

  if (stepId === 'verify_equation') {
    const suppliedNumbers = numbers(text).map(Number);
    const requiredNumbers = [currentStep.expectedAnswer, currentStep.expectedKnown, currentStep.expectedResult].map(Number);
    const hasAllNumbers = requiredNumbers.every(value => suppliedNumbers.includes(value));
    const operator = currentStep.expectedOperator === '*' ? ['*', 'x', 'nhan'] : currentStep.expectedOperator === ':' || currentStep.expectedOperator === '/' ? [':', '/', 'chia'] : [currentStep.expectedOperator, currentStep.expectedOperator === '+' ? 'cong' : 'tru'];
    const hasOperator = operator.some(value => normalize(text).includes(value));
    if (!hasAllNumbers || !hasOperator || !String(text).includes('=')) return failure('Phép kiểm tra chưa đầy đủ. Bé cần thay giá trị X vào phép tính ban đầu, giữ đúng dấu và viết cả kết quả sau dấu bằng.');
    return success('Phép kiểm tra đầy đủ và khớp với đề. Bé đã hiểu cách tìm X.');
  }

  if (['calculate', 'solve', 'total', 'answer', 'final'].includes(stepId)) {
    if (!answerMatches(text, expected)) return failure('Kết quả này chưa đúng. Bé hãy kiểm tra lại phép tính hoặc bằng chứng rồi thử lại; đáp án mẫu vẫn được giữ kín.');
    return success('Kết quả chính xác. Bé đã hoàn thành đúng bước tính/chọn đáp án.');
  }

  const referenceText = `${question} ${mistake.skill || ''} ${currentStep.title} ${currentStep.instruction} ${currentStep.prompt} ${expected || ''}`;
  const hasRelevantVocabulary = overlapCount(text, referenceText) > 0;
  const hasMathWork = numbers(text).length > 0 || /[+*x:/=-]/.test(normalize(text));
  if (!hasRelevantVocabulary && !hasMathWork) {
    return failure('Nội dung chưa liên quan đến yêu cầu của bước này. Bé hãy dùng dữ kiện, từ khóa hoặc quy tắc xuất hiện trong bài và giải thích lại.');
  }

  if (stepId === 'facts') {
    const expectedNumbers = numbers(question);
    const suppliedNumbers = numbers(text);
    const matched = expectedNumbers.filter(number => suppliedNumbers.includes(number));
    if (expectedNumbers.length && matched.length < Math.max(1, Math.ceil(expectedNumbers.length / 2))) {
      return failure(`Bé còn thiếu dữ kiện số trong đề. Hãy tìm lại các số quan trọng và ghi kèm ý nghĩa, đơn vị của từng số.`);
    }
    if (responseWordCount < 2) return failure('Bé đã tìm thấy số nhưng cần nói rõ mỗi số biểu thị điều gì và có đơn vị nào.');
    return success('Bé đã xác định được các dữ kiện cần thiết.');
  }

  if (stepId === 'question') {
    const questionTail = String(question).split(/hỏi|\?/i).filter(Boolean).at(-1) || question;
    if (overlapCount(text, questionTail) < 1 || responseWordCount < 2) {
      return failure('Bé chưa nêu đúng đại lượng cần tìm. Hãy đọc lại câu bắt đầu bằng “Hỏi…” và trả lời cần tìm cái gì, kèm đơn vị.');
    }
    return success('Bé đã xác định đúng điều bài toán yêu cầu tìm.');
  }

  if (stepId === 'restate' || stepId === 'understand' || stepId === 'read') {
    if (overlapCount(text, question) < 2 || responseWordCount < 4) {
      return failure('Phần kể lại chưa bám sát đề. Bé hãy nhắc đến nhân vật/sự vật chính, dữ kiện hoặc hành động trong câu hỏi.');
    }
    return success('Bé đã kể lại đúng trọng tâm và thể hiện đã hiểu yêu cầu.');
  }

  if (stepId === 'operation') {
    const expectedOperations = inferOperation(question);
    const normalizedResponse = normalize(text);
    const hasOperation = /cong|tru|nhan|chia|[+*x:/-]/.test(normalizedResponse);
    if (!hasOperation) return failure('Bé cần ghi rõ phép cộng, trừ, nhân hoặc chia và giải thích vì sao chọn phép tính đó.');
    if (expectedOperations.length && !expectedOperations.some(operation => normalizedResponse.includes(normalize(operation)))) {
      return failure('Phép tính bé chọn chưa phù hợp với quan hệ trong đề. Hãy nhìn lại sơ đồ và từ chỉ “còn lại”, “tất cả”, “chia đều” hoặc “mỗi nhóm”.');
    }
    if (responseWordCount < 2 && !/[+\-*:x/].*\d|\d.*[+\-*:x/]/.test(normalizedResponse)) {
      return failure('Bé đã nêu phép tính nhưng cần nói thêm lý do hoặc viết phép tính cụ thể.');
    }
    return success('Bé đã chọn phép tính phù hợp và có giải thích.');
  }

  if (stepId === 'check') {
    if (!answerMatches(text, expected) || responseWordCount < 2) {
      return failure('Bé cần ghi đáp án cuối cùng kèm đơn vị và nói đã kiểm tra bằng cách nào.');
    }
    return success('Bé đã trả lời đúng và biết tự kiểm tra kết quả.');
  }

  if (stepId === 'keywords' || stepId === 'evidence') {
    if (responseWordCount < 3 || overlapCount(text, question) < 1) {
      return failure('Câu trả lời chưa có từ khóa hoặc bằng chứng liên quan. Bé hãy dùng từ trong câu hỏi/đoạn đọc và nói rõ ý hỗ trợ đáp án.');
    }
    return success('Bé đã nêu được từ khóa hoặc bằng chứng liên quan.');
  }

  if (stepId === 'rule') {
    const skillOverlap = overlapCount(text, mistake.skill || '');
    const ruleWords = /danh tu|dong tu|tinh tu|dau|cau|chinh ta|chu ngu|vi ngu|tu noi|so sanh/.test(normalize(text));
    if (responseWordCount < 3 || (!ruleWords && skillOverlap < 1)) {
      return failure(`Quy tắc chưa liên quan đến kỹ năng “${mistake.skill}”. Bé hãy nói quy tắc và kèm một ví dụ ngắn.`);
    }
    return success('Quy tắc bé nêu phù hợp với dạng bài.');
  }

  if (['small', 'combined'].includes(stepId)) {
    const supplied = numbers(text);
    if (!supplied.length) return failure('Bé cần nhập hoặc nói một số lượng sau khi đã đánh dấu các hình trên giấy.');
    const finalNumbers = numbers(expected).map(Number);
    if (finalNumbers.length && Number(supplied[0]) > finalNumbers[0]) return failure('Số lượng ở nhóm này lớn hơn cả tổng đáp án. Bé hãy kiểm tra xem có đếm trùng không.');
    return success('Bé đã ghi nhận số lượng cho nhóm hình này. Hãy giữ dấu đánh dấu để kiểm tra ở bước cuối.');
  }

  if (['align', 'strategy', 'model', 'reverse', 'compare', 'sentence', 'identify', 'apply', 'topic', 'outline', 'sentences', 'details', 'revise', 'recall', 'try'].includes(stepId)) {
    if (responseWordCount < 2 && numbers(text).length === 0) {
      return failure('Câu trả lời còn quá ngắn để xác nhận bé đã hiểu. Bé hãy mô tả cách làm hoặc kết quả của bước này.');
    }
    if (['topic', 'outline', 'sentences', 'details', 'revise'].includes(stepId) && responseWordCount < 4) {
      return failure('Bé hãy viết hoặc nói rõ hơn bằng một câu đầy đủ để chương trình kiểm tra nội dung bài viết.');
    }
    return success('Nội dung phù hợp với yêu cầu của bước này. Bé có thể xác nhận đã hiểu để tiếp tục.');
  }

  if (responseWordCount < 2 && numbers(text).length === 0) return failure('Bé hãy trả lời rõ hơn bằng một câu có nghĩa.');
  return success('Câu trả lời phù hợp. Bé có thể xác nhận đã hiểu để tiếp tục.');
};

export const getGuidedStepHints = (currentStep = {}, mistake = {}) => {
  const first = currentStep.parentTip || 'Đọc lại yêu cầu và chỉ gợi đúng phần bé đang vướng.';
  let second = `Tách yêu cầu thành hai phần: “${currentStep.title}” và “${currentStep.prompt}”.`;
  let third = 'Cho bé xem một ví dụ khác cùng dạng, sau đó quay lại tự trả lời câu này.';

  if (currentStep.id.includes('operator')) {
    second = 'Cho bé lựa chọn giữa: phép cộng, phép trừ, phép nhân hoặc phép chia.';
    third = currentStep.expectedAnswer
      ? `Yêu cầu bé tìm dấu hoặc nhắc quy tắc dẫn tới “${currentStep.expectedAnswer}”, rồi tự nói lại bằng câu đầy đủ.`
      : third;
  } else if (currentStep.id === 'unknown_role') {
    second = 'Nhắc tên các thành phần của phép tính, nhưng chưa chỉ ngay X thuộc thành phần nào.';
    third = `Cho bé lựa chọn có kiểm soát và yêu cầu giải thích: X là ${currentStep.expectedAnswer || 'thành phần nào'}?`;
  } else if (currentStep.id === 'rearrange_equation') {
    second = 'Nhắc bé viết số ở vế phải trước, sau đó dùng phép tính ngược với số đã biết.';
    third = 'Che một phần phép tính mẫu và để bé tự điền dấu hoặc số còn thiếu.';
  } else if (currentStep.id.includes('calculate') || ['solve', 'total', 'answer', 'final'].includes(currentStep.id)) {
    second = 'Yêu cầu bé làm lại trên giấy và chỉ ra bước đầu tiên khác với lần trước.';
    third = 'Giảm độ khó bằng một ví dụ cùng dạng có số nhỏ hơn; không đọc đáp án của câu hiện tại.';
  } else if (currentStep.id.includes('verify') || currentStep.id === 'check') {
    second = 'Nhắc bé dùng phép tính ngược hoặc thay kết quả vào đề ban đầu.';
    third = 'Viết sẵn khung “… phép tính … = …” và để bé tự điền các số.';
  } else if (mistake.category === 'reading' || mistake.category === 'prep_passage') {
    second = 'Chỉ vị trí đoạn có khả năng chứa câu trả lời, nhưng chưa đọc thay bé.';
    third = 'Cho bé chọn giữa hai câu bằng chứng và yêu cầu nói câu nào khớp câu hỏi hơn.';
  } else if (mistake.category === 'grammar') {
    second = `Nhắc lại câu hỏi nhận diện của kỹ năng “${mistake.skill}”.`;
    third = 'Đưa hai lựa chọn, yêu cầu bé thử đặt từng lựa chọn vào câu và giải thích.';
  } else if (mistake.category === 'writing') {
    second = 'Cho bé nói ý bằng lời trước, rồi mới viết thành câu.';
    third = 'Đưa một khung câu có chỗ trống để bé tự hoàn thiện.';
  }
  return [first, second, third];
};
