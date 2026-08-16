import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGuidedPracticeSteps, parseArithmeticExpression, parseUnknownEquation, validateGuidedStep } from './guidedPractice.js';

test('word problems include understanding, operation and checking steps', () => {
  const steps = buildGuidedPracticeSteps({ category: 'logic' });
  assert.equal(steps[0].id, 'restate');
  assert.ok(steps.some(item => item.id === 'operation'));
  assert.equal(steps.at(-1).id, 'check');
});

test('geometry and grammar use distinct guided workflows', () => {
  const geometry = buildGuidedPracticeSteps({ category: 'geometry' });
  const grammar = buildGuidedPracticeSteps({ category: 'grammar' });
  assert.ok(geometry.some(item => item.id === 'combined'));
  assert.ok(grammar.some(item => item.id === 'grammar_rule'));
  assert.notDeepEqual(geometry.map(item => item.id), grammar.map(item => item.id));
});

test('rejects unrelated content and does not let paper checkbox bypass validation', () => {
  const step = buildGuidedPracticeSteps({ category: 'logic' })[0];
  const context = { step, completedOnPaper: true, mistake: { category: 'logic' }, example: { q: 'Mai có 10 quả táo và cho bạn 3 quả. Hỏi Mai còn bao nhiêu quả?' } };
  const unrelated = validateGuidedStep({ ...context, response: 'abc' });
  assert.equal(unrelated.valid, false);
  assert.equal(validateGuidedStep({ ...context, response: 'Con thích đi đá bóng cùng các bạn' }).valid, false);
});

test('requires important numeric facts for the data step', () => {
  const step = buildGuidedPracticeSteps({ category: 'logic' }).find(item => item.id === 'facts');
  const example = { q: 'Mai có 10 quả táo và cho bạn 3 quả. Hỏi Mai còn bao nhiêu quả?', correctAns: 7 };
  assert.equal(validateGuidedStep({ step, response: 'Mai có táo', mistake: { category: 'logic' }, example }).valid, false);
  assert.equal(validateGuidedStep({ step, response: 'Mai có 10 quả và cho bạn 3 quả', mistake: { category: 'logic' }, example }).valid, true);
});

test('keeps the final answer locked until the correct answer is supplied', () => {
  const step = buildGuidedPracticeSteps({ category: 'logic' }).find(item => item.id === 'calculate');
  const example = { q: 'Mai có 10 quả táo và cho bạn 3 quả.', correctAns: 7 };
  assert.equal(validateGuidedStep({ step, response: '9 quả', mistake: { category: 'logic' }, example }).valid, false);
  assert.equal(validateGuidedStep({ step, response: 'Kết quả là 7 quả', mistake: { category: 'logic' }, example }).valid, true);
});

test('parses the role and inverse operation for every unknown position', () => {
  assert.deepEqual(
    (({ unknownRole, inverseOperation, rearrangedExpression, solution }) => ({ unknownRole, inverseOperation, rearrangedExpression, solution }))(parseUnknownEquation('Tìm X: X + 207 = 689')),
    { unknownRole: 'số hạng', inverseOperation: 'phép trừ', rearrangedExpression: '689 - 207', solution: 482 }
  );
  assert.equal(parseUnknownEquation('900 - X = 250').unknownRole, 'số trừ');
  assert.equal(parseUnknownEquation('X - 250 = 650').inverseOperation, 'phép cộng');
  assert.equal(parseUnknownEquation('8 × X = 64').solution, 8);
  assert.equal(parseUnknownEquation('X : 4 = 8').solution, 32);
  assert.equal(parseUnknownEquation('32 : X = 8').unknownRole, 'số chia');
});

test('unknown equation workflow separates displayed and inverse operations', () => {
  const mistake = { category: 'algebra', skill: 'Tìm X' };
  const example = { q: 'Tìm X: X + 207 = 689', correctAns: 482 };
  const steps = buildGuidedPracticeSteps(mistake, example);
  assert.equal(steps.length, 6);
  assert.equal(validateGuidedStep({ step: steps[0], response: 'phép tính cộng', mistake, example }).valid, true);
  assert.equal(validateGuidedStep({ step: steps[2], response: 'phép cộng', mistake, example }).valid, false);
  assert.equal(validateGuidedStep({ step: steps[2], response: 'phép trừ', mistake, example }).valid, true);
  assert.equal(validateGuidedStep({ step: steps[3], response: '689 trừ 207', mistake, example }).valid, true);
  assert.equal(validateGuidedStep({ step: steps[3], response: '207 trừ 689', mistake, example }).valid, false);
  assert.equal(validateGuidedStep({ step: steps[4], response: 'X bằng 482', mistake, example }).valid, true);
  assert.equal(validateGuidedStep({ step: steps[5], response: '482 + 207 = 689', mistake, example }).valid, true);
});

test('direct arithmetic workflow checks components, result and inverse verification', () => {
  const parsed = parseArithmeticExpression('Đặt tính rồi tính: 689 - 207', 482);
  assert.equal(parsed.roles[0], 'số bị trừ');
  assert.equal(parsed.verification, '482 + 207 = 689');
  const mistake = { category: 'algebra', skill: 'Thực hiện phép tính' };
  const example = { q: 'Đặt tính rồi tính: 689 - 207', correctAns: 482 };
  const steps = buildGuidedPracticeSteps(mistake, example);
  assert.equal(validateGuidedStep({ step: steps[0], response: 'phép trừ', mistake, example }).valid, true);
  assert.equal(validateGuidedStep({ step: steps[1], response: '689 là số bị trừ, 207 là số trừ, kết quả là hiệu', mistake, example }).valid, true);
  assert.equal(validateGuidedStep({ step: steps[2], response: 'đặt tính thẳng cột và tính từ hàng đơn vị', mistake, example }).valid, true);
  assert.equal(validateGuidedStep({ step: steps[3], response: '482', mistake, example }).valid, true);
  assert.equal(validateGuidedStep({ step: steps[4], response: 'phép cộng', mistake, example }).valid, true);
  assert.equal(validateGuidedStep({ step: steps[5], response: '482 + 207 = 689', mistake, example }).valid, true);
});

test('grammar workflow requires rule, answer and explanation', () => {
  const mistake = { category: 'grammar', skill: 'Từ loại' };
  const example = { q: 'Từ nào là danh từ?', userAns: 'chạy', correctAns: 'bàn' };
  const steps = buildGuidedPracticeSteps(mistake, example);
  assert.equal(validateGuidedStep({ step: steps[1], response: 'Con thích đá bóng', mistake, example }).valid, false);
  assert.equal(validateGuidedStep({ step: steps[1], response: 'Danh từ là từ gọi tên sự vật', mistake, example }).valid, true);
  assert.equal(validateGuidedStep({ step: steps[3], response: 'bàn', mistake, example }).valid, true);
  assert.equal(validateGuidedStep({ step: steps[4], response: 'Bàn là danh từ vì gọi tên sự vật', mistake, example }).valid, true);
});
