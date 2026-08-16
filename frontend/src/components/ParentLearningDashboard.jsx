import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  buildCompetencyProfile,
  buildDailyTrend,
  buildLearningOverview,
  createInterventionPlan,
  analyzeMistakes
} from '../analytics/learningAnalytics';
import { buildGuidedPracticeSteps, getGuidedStepHints, validateGuidedStep } from '../analytics/guidedPractice';
import { syncToServer } from '../sync';

const panelStyle = { background: '#fff', border: '1px solid #E0E7EF', borderRadius: 12, padding: 18 };
const badgeColors = {
  'Chưa đủ dữ liệu': ['#ECEFF1', '#546E7A'],
  'Cần hỗ trợ': ['#FFEBEE', '#C62828'],
  'Đang hình thành': ['#FFF3E0', '#E65100'],
  'Đạt': ['#E3F2FD', '#1565C0'],
  'Vững': ['#E8F5E9', '#2E7D32']
};

const readArray = key => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const formatDate = value => value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa có';

function MetricCard({ label, value, detail, color = '#1976D2' }) {
  return (
    <div style={{ ...panelStyle, borderTop: `4px solid ${color}`, minWidth: 150 }}>
      <div style={{ color: '#607D8B', fontSize: '.88rem' }}>{label}</div>
      <div style={{ color, fontSize: '1.8rem', fontWeight: 800, margin: '6px 0' }}>{value}</div>
      <div style={{ color: '#78909C', fontSize: '.82rem' }}>{detail}</div>
    </div>
  );
}

function ConfidenceBadge({ value }) {
  const color = value === 'Cao' ? '#2E7D32' : value === 'Trung bình' ? '#EF6C00' : '#607D8B';
  return <span style={{ color, fontSize: '.78rem', fontWeight: 700 }}>Tin cậy: {value}</span>;
}

function OverviewSection({ overview, plans, onOpenMistakes, onOpenPlans }) {
  const { current, accuracyDelta, strengths, priorities, mistakes } = overview;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="grid-2-col" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))' }}>
        <MetricCard label="Ngày học" value={current.activeDays} detail="Trong khoảng đã chọn" color="#7B1FA2" />
        <MetricCard label="Phiên hợp lệ" value={`${current.validSessions}/${current.sessions}`} detail="Đã loại tín hiệu click bừa" color="#00838F" />
        <MetricCard label="Độ chính xác" value={current.accuracyPct === null ? '—' : `${current.accuracyPct}%`} detail={accuracyDelta === null ? 'Chưa đủ kỳ đối chiếu' : `${accuracyDelta >= 0 ? '+' : ''}${accuracyDelta} điểm % so với kỳ trước`} color="#2E7D32" />
        <MetricCard label="Thời gian học" value={`${current.minutes}′`} detail="Không dùng làm điểm năng lực" color="#EF6C00" />
      </div>

      <div className="grid-2-col">
        <div style={panelStyle}>
          <h3 style={{ marginTop: 0, color: '#2E7D32' }}>Điểm đang làm tốt</h3>
          {strengths.length === 0 ? <p style={{ color: '#78909C' }}>Chưa đủ dữ liệu trong kỳ này.</p> : strengths.map(item => (
            <div key={item.key} style={{ padding: '10px 0', borderBottom: '1px solid #ECEFF1' }}>
              <strong>{item.label}</strong> — {item.accuracyPct}%
              <div><ConfidenceBadge value={item.confidence} /></div>
            </div>
          ))}
        </div>
        <div style={panelStyle}>
          <h3 style={{ marginTop: 0, color: '#C62828' }}>Cần ưu tiên</h3>
          {priorities.length === 0 ? <p style={{ color: '#78909C' }}>Chưa có kỹ năng đủ bằng chứng để cảnh báo.</p> : priorities.map(item => (
            <div key={item.key} style={{ padding: '10px 0', borderBottom: '1px solid #ECEFF1' }}>
              <strong>{item.label}</strong> — {item.status}
              <div style={{ color: '#607D8B', fontSize: '.85rem' }}>{item.accuracyPct}% trên {item.attempts} bằng chứng</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...panelStyle, background: '#FFF8E1', borderColor: '#FFE082' }}>
        <h3 style={{ marginTop: 0, color: '#F57F17' }}>Việc bố mẹ nên làm tiếp theo</h3>
        {mistakes.length > 0 ? (
          <>
            <p><strong>Ưu tiên:</strong> cùng bé xử lý lỗi “{mistakes[0].skill}” ({mistakes[0].occurrences} lần ghi nhận).</p>
            <p style={{ color: '#5D4037' }}>{mistakes[0].advice}</p>
            <button onClick={onOpenMistakes} style={{ background: '#FB8C00' }}>Xem lỗi và cùng bé luyện</button>
          </>
        ) : (
          <p>Chưa có lỗi đủ bằng chứng. Hãy duy trì các buổi học ngắn và xem lại sau khi có thêm dữ liệu.</p>
        )}
        {plans.filter(plan => plan.status === 'active').length > 0 && (
          <button onClick={onOpenPlans} style={{ marginLeft: 10, background: '#1976D2' }}>Mở kế hoạch đang thực hiện</button>
        )}
      </div>
    </div>
  );
}

function CompetencySection({ competencies }) {
  return (
    <div style={{ ...panelStyle, display: 'grid', gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, color: '#1565C0' }}>Hồ sơ năng lực theo module</h3>
        <p style={{ color: '#607D8B' }}>Năng lực được tách khỏi kim cương và luôn hiển thị số bằng chứng.</p>
      </div>
      {competencies.length === 0 ? <p>Chưa có dữ liệu.</p> : competencies.map(item => {
        const [background, color] = badgeColors[item.status] || badgeColors['Chưa đủ dữ liệu'];
        return (
          <div key={item.key} style={{ border: '1px solid #E0E0E0', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ color: '#263238', fontSize: '1.05rem' }}>{item.subjectLabel} · {item.label}</strong>
                <div style={{ color: '#607D8B', marginTop: 4 }}>Level gần nhất: {item.latestLevel} · {item.sessions} buổi · {item.attempts} bằng chứng</div>
              </div>
              <span style={{ background, color, borderRadius: 999, padding: '6px 12px', fontWeight: 700 }}>{item.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12 }}>
              <span>Chính xác: <strong>{item.accuracyPct === null ? '—' : `${item.accuracyPct}%`}</strong></span>
              <span>Thời gian/câu: <strong>{item.averageSeconds}s</strong></span>
              <ConfidenceBadge value={item.confidence} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrendSection({ trend }) {
  const hasData = trend.some(row => row.sessions > 0);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={panelStyle}>
        <h3 style={{ marginTop: 0, color: '#1565C0' }}>Xu hướng 14 ngày</h3>
        <p style={{ color: '#607D8B' }}>Đường chính xác chỉ dùng các phiên có số câu đúng/sai; thời lượng được hiển thị riêng.</p>
        {!hasData ? <p>Chưa có dữ liệu trong 14 ngày.</p> : (
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis yAxisId="percent" domain={[0, 100]} />
                <YAxis yAxisId="count" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="percent" type="monotone" dataKey="accuracy" name="Độ chính xác (%)" stroke="#2E7D32" strokeWidth={3} connectNulls />
                <Line yAxisId="count" type="monotone" dataKey="sessions" name="Số phiên" stroke="#1976D2" strokeWidth={2} />
                <Line yAxisId="count" type="monotone" dataKey="minutes" name="Phút học" stroke="#FB8C00" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div style={{ ...panelStyle, background: '#E8EAF6' }}>
        <strong>Cách đọc:</strong> học nhiều hơn không đồng nghĩa với tiến bộ. Hãy ưu tiên đường độ chính xác, level bài và khả năng làm lại sau một tuần.
      </div>
    </div>
  );
}

function PracticeWorkspace({ mistake, childId, onClose, onCreatePlan }) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [responses, setResponses] = useState({});
  const [paperSteps, setPaperSteps] = useState({});
  const [completedSteps, setCompletedSteps] = useState([]);
  const [stepError, setStepError] = useState('');
  const [validationResults, setValidationResults] = useState({});
  const [hintLevels, setHintLevels] = useState({});
  const [attemptCounts, setAttemptCounts] = useState({});
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef(null);
  const example = mistake.examples[exampleIndex];
  const guidedSteps = useMemo(() => buildGuidedPracticeSteps(mistake, example), [mistake, example]);
  const currentStep = guidedSteps[activeStep];
  const currentHints = useMemo(() => getGuidedStepHints(currentStep, mistake), [currentStep, mistake]);
  const allCompleted = completedSteps.length === guidedSteps.length;

  const resetPractice = nextExampleIndex => {
    setExampleIndex(nextExampleIndex);
    setRevealed(false);
    setActiveStep(0);
    setResponses({});
    setPaperSteps({});
    setCompletedSteps([]);
    setStepError('');
    setValidationResults({});
    setHintLevels({});
    setAttemptCounts({});
    setVoiceError('');
  };

  const updateResponse = value => {
    setResponses(items => ({ ...items, [currentStep.id]: value }));
    setValidationResults(items => ({ ...items, [currentStep.id]: null }));
    setStepError('');
  };

  const checkCurrentStep = () => {
    setAttemptCounts(items => ({ ...items, [currentStep.id]: (items[currentStep.id] || 0) + 1 }));
    const result = validateGuidedStep({
      step: currentStep,
      response: responses[currentStep.id],
      mistake,
      example,
      completedOnPaper: paperSteps[currentStep.id]
    });
    setValidationResults(items => ({ ...items, [currentStep.id]: result }));
    setStepError(result.valid ? '' : result.feedback);
  };

  const confirmUnderstanding = () => {
    if (!validationResults[currentStep.id]?.valid) {
      setStepError('Bé cần kiểm tra và trả lời đúng trước khi xác nhận đã hiểu.');
      return;
    }
    setCompletedSteps(items => items.includes(currentStep.id) ? items : [...items, currentStep.id]);
    if (activeStep < guidedSteps.length - 1) setActiveStep(index => index + 1);
  };

  const readCurrentInstruction = () => {
    if (!('speechSynthesis' in window)) {
      setVoiceError('Trình duyệt này chưa hỗ trợ đọc hướng dẫn thành tiếng.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${currentStep.title}. ${currentStep.instruction}. ${currentStep.prompt}`);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
    setVoiceError('');
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Trình duyệt này chưa hỗ trợ nhập giọng nói. Hãy dùng Chrome/Edge và cho phép microphone.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'vi-VN';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => { setIsListening(true); setVoiceError(''); };
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0].transcript).join(' ').trim();
      const existing = String(responses[currentStep.id] || '').trim();
      updateResponse(existing ? `${existing} ${transcript}` : transcript);
    };
    recognition.onerror = event => {
      setVoiceError(event.error === 'not-allowed' ? 'Microphone chưa được cấp quyền.' : 'Không nhận được giọng nói rõ ràng. Bé hãy thử lại.');
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const revealAndSave = () => {
    if (!allCompleted) return;
    setRevealed(true);
    const key = `guidedPracticeLogs_${childId}`;
    let logs = [];
    try { logs = JSON.parse(localStorage.getItem(key) || '[]'); } catch { logs = []; }
    logs.unshift({
      id: `practice-${Date.now()}`,
      mistakeId: mistake.id,
      skill: mistake.skill,
      category: mistake.category,
      question: example?.q,
      completedAt: new Date().toISOString(),
      steps: guidedSteps.map(item => ({
        id: item.id,
        title: item.title,
        response: responses[item.id] || '',
        completedOnPaper: Boolean(paperSteps[item.id]),
        supportLevel: hintLevels[item.id] || 0,
        attempts: attemptCounts[item.id] || 1,
        independence: (hintLevels[item.id] || 0) === 0 ? 'Tự làm đúng' : `Đúng sau gợi ý cấp ${hintLevels[item.id]}`
      }))
    });
    if (logs.length > 200) logs.length = 200;
    localStorage.setItem(key, JSON.stringify(logs));
    syncToServer(childId);
  };

  return (
    <div style={{ ...panelStyle, border: '2px solid #FFB74D', background: '#FFFDF8' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, color: '#E65100' }}>Cùng bé khắc phục: {mistake.skill}</h3>
          <p style={{ color: '#6D4C41' }}>{mistake.advice}</p>
        </div>
        <button onClick={onClose} style={{ background: '#78909C', alignSelf: 'flex-start' }}>Đóng</button>
      </div>
      {example ? (
        <div style={{ background: '#FFF', borderRadius: 10, padding: 16, border: '1px solid #FFE0B2' }}>
          <div style={{ color: '#78909C', marginBottom: 8 }}>Ví dụ {exampleIndex + 1}/{mistake.examples.length}</div>
          <div style={{ fontSize: '1.1rem' }}><strong>Câu hỏi:</strong> {example.q}</div>
          {example.svg && <div dangerouslySetInnerHTML={{ __html: example.svg }} />}

          <div style={{ margin: '18px 0 12px', display: 'flex', gap: 6, alignItems: 'center' }}>
            {guidedSteps.map((item, index) => (
              <div key={item.id} title={item.title} style={{ flex: 1, height: 8, borderRadius: 99, background: completedSteps.includes(item.id) ? '#43A047' : index === activeStep ? '#FB8C00' : '#ECEFF1' }} />
            ))}
          </div>
          <div style={{ color: '#607D8B', fontSize: '.85rem', marginBottom: 12 }}>Đã hoàn thành {completedSteps.length}/{guidedSteps.length} bước</div>

          {!revealed && !allCompleted && currentStep && (
            <div style={{ border: '2px solid #90CAF9', borderRadius: 12, padding: 16, background: '#F7FBFF' }}>
              <div style={{ color: '#1565C0', fontWeight: 800 }}>BƯỚC {activeStep + 1}/{guidedSteps.length}</div>
              <h3 style={{ color: '#0D47A1', margin: '6px 0 10px' }}>{currentStep.title}</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <button type="button" onClick={readCurrentInstruction} style={{ background: '#5C6BC0', padding: '7px 12px' }}>🔊 Nghe hướng dẫn</button>
                <button type="button" onClick={toggleVoiceInput} style={{ background: isListening ? '#C62828' : '#00838F', padding: '7px 12px' }}>{isListening ? '⏹ Dừng ghi âm' : '🎤 Bé trả lời bằng giọng nói'}</button>
              </div>
              {voiceError && <p style={{ color: '#C62828', margin: '6px 0' }}>{voiceError}</p>}
              <div style={{ background: '#FFF', padding: 12, borderRadius: 8, fontSize: '1.05rem' }}>
                <strong>Bé cần làm:</strong> {currentStep.instruction}
              </div>
              <label style={{ display: 'block', marginTop: 12, fontWeight: 700 }}>
                {currentStep.prompt}
                <textarea
                  value={responses[currentStep.id] || ''}
                  onChange={event => updateResponse(event.target.value)}
                  placeholder={currentStep.placeholder}
                  rows="3"
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 10, borderRadius: 7, border: '1px solid #90A4AE', fontFamily: 'inherit' }}
                />
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                <input type="checkbox" checked={Boolean(paperSteps[currentStep.id])} onChange={event => setPaperSteps({ ...paperSteps, [currentStep.id]: event.target.checked })} />
                Bé đã thực hiện bước này trên giấy
              </label>
              <details style={{ marginTop: 12, background: '#FFF8E1', padding: 10, borderRadius: 8 }}>
                <summary style={{ cursor: 'pointer', color: '#E65100', fontWeight: 700 }}>Gợi ý dành cho bố mẹ</summary>
                <div style={{ marginTop: 8, color: '#5D4037' }}>{currentStep.parentTip}</div>
              </details>
              <div style={{ marginTop: 10 }}>
                {(hintLevels[currentStep.id] || 0) < currentHints.length && (
                  <button
                    type="button"
                    onClick={() => setHintLevels(items => ({ ...items, [currentStep.id]: (items[currentStep.id] || 0) + 1 }))}
                    style={{ background: '#8D6E63', padding: '7px 12px' }}
                  >
                    💡 Xem gợi ý cấp {(hintLevels[currentStep.id] || 0) + 1}
                  </button>
                )}
                {(hintLevels[currentStep.id] || 0) > 0 && (
                  <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
                    {currentHints.slice(0, hintLevels[currentStep.id]).map((hint, index) => (
                      <div key={`${currentStep.id}-hint-${index}`} style={{ background: '#FFF3E0', color: '#6D4C41', padding: 9, borderRadius: 7 }}>
                        <strong>Gợi ý {index + 1}:</strong> {hint}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {validationResults[currentStep.id]?.valid && (
                <div style={{ background: '#E8F5E9', color: '#1B5E20', padding: 10, borderRadius: 8, marginTop: 12, fontWeight: 700 }}>
                  ✓ {validationResults[currentStep.id].feedback}
                </div>
              )}
              {stepError && <p style={{ background: '#FFEBEE', color: '#C62828', padding: 10, borderRadius: 8, fontWeight: 700 }}>{stepError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button disabled={activeStep === 0} onClick={() => { setActiveStep(index => index - 1); setStepError(''); }} style={{ background: '#78909C' }}>Quay lại bước trước</button>
                <button onClick={checkCurrentStep} style={{ background: '#FB8C00' }}>Kiểm tra câu trả lời</button>
                {validationResults[currentStep.id]?.valid && (
                  <button onClick={confirmUnderstanding} style={{ background: '#2E7D32' }}>{activeStep === guidedSteps.length - 1 ? 'Xác nhận bé đã hiểu — hoàn thành' : 'Xác nhận bé đã hiểu — sang bước tiếp'}</button>
                )}
              </div>
            </div>
          )}

          {!revealed && allCompleted && (
            <div style={{ background: '#E8F5E9', padding: 14, borderRadius: 10, marginTop: 14 }}>
              <strong>Bé đã hoàn thành tất cả các bước.</strong>
              <div style={{ marginTop: 8 }}><button onClick={revealAndSave} style={{ background: '#2E7D32' }}>Đối chiếu đáp án và lưu buổi luyện</button></div>
            </div>
          )}

          {revealed && (
            <div style={{ background: '#E8F5E9', padding: 12, borderRadius: 8 }}>
              <h3 style={{ marginTop: 0, color: '#2E7D32' }}>Đối chiếu kết quả</h3>
              <div>Bé đã chọn: <strong style={{ color: '#C62828' }}>{String(example.userAns)}</strong></div>
              <div>Đáp án đúng: <strong style={{ color: '#2E7D32' }}>{String(example.correctAns)}</strong></div>
              {example.explanation && <div style={{ marginTop: 6 }}>{example.explanation}</div>}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #A5D6A7' }}>
                <strong>Mức độ tự lập:</strong>{' '}
                {Math.max(0, ...Object.values(hintLevels)) === 0
                  ? 'Tự làm đúng, không cần gợi ý'
                  : `Hoàn thành với gợi ý tối đa cấp ${Math.max(0, ...Object.values(hintLevels))}`}
                <div style={{ fontSize: '.88rem', color: '#33691E' }}>Tổng số lần kiểm tra: {Object.values(attemptCounts).reduce((sum, value) => sum + value, 0)}</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button disabled={exampleIndex === 0} onClick={() => resetPractice(exampleIndex - 1)} style={{ background: '#78909C' }}>Câu trước</button>
            <button disabled={exampleIndex >= mistake.examples.length - 1} onClick={() => resetPractice(exampleIndex + 1)} style={{ background: '#1976D2' }}>Câu tiếp</button>
            <button onClick={() => onCreatePlan(mistake)} style={{ background: '#2E7D32' }}>Tạo kế hoạch 7 ngày</button>
          </div>
        </div>
      ) : <p>Chưa có câu mẫu.</p>}
    </div>
  );
}

function MistakeSection({ mistakes, childId, onCreatePlan }) {
  const [subject, setSubject] = useState('all');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const filtered = mistakes.filter(item => (subject === 'all' || item.subject === subject) && (status === 'all' || item.status === status));

  if (selected) return <PracticeWorkspace mistake={selected} childId={childId} onClose={() => setSelected(null)} onCreatePlan={onCreatePlan} />;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={panelStyle}>
        <h3 style={{ marginTop: 0, color: '#C62828' }}>Lỗi sai thường gặp</h3>
        <p style={{ color: '#607D8B' }}>Lỗi chỉ được gắn “Cần ưu tiên” khi lặp ít nhất 3 lần trong tối thiểu 2 buổi.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={subject} onChange={event => setSubject(event.target.value)} style={{ padding: 8 }}>
            <option value="all">Tất cả môn</option>
            <option value="math">Toán</option>
            <option value="reading">Tiếng Việt</option>
          </select>
          <select value={status} onChange={event => setStatus(event.target.value)} style={{ padding: 8 }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="Cần ưu tiên">Cần ưu tiên</option>
            <option value="Đang theo dõi">Đang theo dõi</option>
            <option value="Mới phát hiện">Mới phát hiện</option>
          </select>
        </div>
      </div>
      {filtered.length === 0 ? <div style={panelStyle}>Không có lỗi phù hợp bộ lọc.</div> : filtered.map(item => (
        <div key={item.id} style={{ ...panelStyle, borderLeft: `5px solid ${item.recurring ? '#C62828' : '#FB8C00'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#78909C', fontSize: '.82rem' }}>{item.subjectLabel} · {item.categoryLabel}</div>
              <h3 style={{ margin: '4px 0' }}>{item.skill}</h3>
              <span style={{ color: '#6D4C41' }}>{item.errorTypeLabel}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ color: item.recurring ? '#C62828' : '#EF6C00' }}>{item.status}</strong>
              <div>{item.occurrences} lần · {item.sessions} buổi</div>
              <ConfidenceBadge value={item.confidence} />
            </div>
          </div>
          <p style={{ background: '#FFF8E1', padding: 10, borderRadius: 8 }}>{item.advice}</p>
          <div style={{ color: '#607D8B', fontSize: '.85rem' }}>Gần nhất: {formatDate(item.lastSeen)}</div>
          <button onClick={() => setSelected(item)} style={{ marginTop: 12, background: '#E65100' }}>Cùng bé luyện ngay</button>
          <button onClick={() => onCreatePlan(item)} style={{ marginTop: 12, marginLeft: 8, background: '#2E7D32' }}>Tạo kế hoạch</button>
        </div>
      ))}
    </div>
  );
}

function PlansSection({ plans, setPlans, childId }) {
  const [recheckScores, setRecheckScores] = useState({});
  const save = next => {
    setPlans(next);
    localStorage.setItem(`interventionPlans_${childId}`, JSON.stringify(next));
    syncToServer(childId);
  };
  const completeSession = plan => {
    const next = plans.map(item => item.id === plan.id
      ? { ...item, sessionsCompleted: Math.min(item.sessionsTarget, item.sessionsCompleted + 1), updatedAt: new Date().toISOString() }
      : item);
    save(next);
  };
  const setStatus = (plan, status) => save(plans.map(item => item.id === plan.id ? { ...item, status, updatedAt: new Date().toISOString() } : item));
  const saveRecheck = plan => {
    const score = Math.max(0, Math.min(100, Number(recheckScores[plan.id])));
    if (!Number.isFinite(score)) return;
    const status = score >= 80 ? 'resolved' : 'needs_adjustment';
    save(plans.map(item => item.id === plan.id ? {
      ...item,
      status,
      recheckResult: { score, measuredAt: new Date().toISOString(), conclusion: score >= 80 ? 'Đã khắc phục' : 'Cần đổi cách luyện' },
      updatedAt: new Date().toISOString()
    } : item));
  };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={panelStyle}>
        <h3 style={{ marginTop: 0, color: '#2E7D32' }}>Kế hoạch khắc phục và đo lại</h3>
        <p style={{ color: '#607D8B' }}>Mỗi kế hoạch gồm các buổi ngắn, tiêu chí thành công và ngày đo lại.</p>
      </div>
      {plans.length === 0 ? <div style={panelStyle}>Chưa có kế hoạch. Hãy tạo từ một lỗi trong mục “Lỗi sai”.</div> : plans.map(plan => {
        const progress = Math.round((plan.sessionsCompleted / plan.sessionsTarget) * 100);
        return (
          <div key={plan.id} style={{ ...panelStyle, opacity: plan.status === 'archived' ? .65 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, color: '#1565C0' }}>{plan.title}</h3>
              <strong>{plan.status === 'active' ? 'Đang thực hiện' : plan.status === 'ready_recheck' ? 'Cần đo lại' : plan.status === 'resolved' ? 'Đã khắc phục' : plan.status === 'needs_adjustment' ? 'Cần đổi cách luyện' : 'Đã lưu trữ'}</strong>
            </div>
            <p><strong>Bằng chứng:</strong> {plan.evidence}</p>
            <p><strong>Mục tiêu:</strong> {plan.target}</p>
            <div style={{ height: 10, background: '#ECEFF1', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#43A047' }} />
            </div>
            <div style={{ marginTop: 6 }}>{plan.sessionsCompleted}/{plan.sessionsTarget} buổi · {plan.durationMinutes} phút/buổi · Đo lại: {formatDate(plan.recheckAt)}</div>
            <ol>{plan.activities.map(activity => <li key={activity} style={{ marginBottom: 6 }}>{activity}</li>)}</ol>
            {plan.status === 'active' && <button onClick={() => completeSession(plan)} disabled={plan.sessionsCompleted >= plan.sessionsTarget} style={{ background: '#2E7D32' }}>Đánh dấu hoàn thành một buổi</button>}
            {plan.sessionsCompleted >= plan.sessionsTarget && plan.status === 'active' && <button onClick={() => setStatus(plan, 'ready_recheck')} style={{ marginLeft: 8, background: '#FB8C00' }}>Chuyển sang đo lại</button>}
            {plan.status === 'ready_recheck' && (
              <div style={{ background: '#FFF8E1', padding: 12, borderRadius: 8, marginTop: 12 }}>
                <strong>Kết quả bài đo lại</strong>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <input type="number" min="0" max="100" value={recheckScores[plan.id] ?? ''} onChange={event => setRecheckScores({ ...recheckScores, [plan.id]: event.target.value })} placeholder="% đúng" style={{ width: 100, padding: 8 }} />
                  <button onClick={() => saveRecheck(plan)} style={{ background: '#2E7D32' }}>Lưu và đánh giá hiệu quả</button>
                </div>
              </div>
            )}
            {plan.recheckResult && <p style={{ color: plan.recheckResult.score >= 80 ? '#2E7D32' : '#C62828' }}><strong>{plan.recheckResult.conclusion}:</strong> {plan.recheckResult.score}%</p>}
            {plan.status === 'needs_adjustment' && <button onClick={() => save(plans.map(item => item.id === plan.id ? { ...item, status: 'active', sessionsCompleted: 0, updatedAt: new Date().toISOString() } : item))} style={{ background: '#E65100' }}>Luyện lại với phương pháp khác</button>}
            {plan.status !== 'archived' && <button onClick={() => setStatus(plan, 'archived')} style={{ marginLeft: 8, background: '#78909C' }}>Lưu trữ</button>}
          </div>
        );
      })}
    </div>
  );
}

function GoalsSection({ childId, goals, setGoals, preferences, setPreferences }) {
  const [title, setTitle] = useState('');
  const [targetSessions, setTargetSessions] = useState(4);
  const saveGoals = next => {
    setGoals(next);
    localStorage.setItem(`weeklyGoals_${childId}`, JSON.stringify(next));
    syncToServer(childId);
  };
  const savePreferences = next => {
    setPreferences(next);
    localStorage.setItem(`learningPreferences_${childId}`, JSON.stringify(next));
    syncToServer(childId);
  };
  const addGoal = () => {
    if (!title.trim()) return;
    saveGoals([{
      id: `goal-${Date.now()}`,
      title: title.trim(),
      targetSessions: Math.max(1, Number(targetSessions) || 1),
      completedSessions: 0,
      createdAt: new Date().toISOString(),
      status: 'active'
    }, ...goals]);
    setTitle('');
  };
  const completeGoalSession = goal => saveGoals(goals.map(item => item.id === goal.id ? {
    ...item,
    completedSessions: Math.min(item.targetSessions, item.completedSessions + 1),
    status: item.completedSessions + 1 >= item.targetSessions ? 'completed' : 'active'
  } : item));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={panelStyle}>
        <h3 style={{ marginTop: 0, color: '#6A1B9A' }}>Mục tiêu tuần</h3>
        <p style={{ color: '#607D8B' }}>Đặt mục tiêu nhỏ, đo được và cho bé cùng chọn nội dung.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={title} onChange={event => setTitle(event.target.value)} placeholder="VD: Luyện Toán lời văn 4 buổi" style={{ flex: 1, minWidth: 230, padding: 9 }} />
          <input type="number" min="1" max="14" value={targetSessions} onChange={event => setTargetSessions(event.target.value)} style={{ width: 75, padding: 9 }} />
          <button onClick={addGoal} style={{ background: '#7B1FA2' }}>Thêm mục tiêu</button>
        </div>
      </div>
      {goals.filter(goal => goal.status !== 'archived').map(goal => {
        const progress = Math.round((goal.completedSessions / goal.targetSessions) * 100);
        return (
          <div key={goal.id} style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <strong>{goal.title}</strong>
              <span>{goal.status === 'completed' ? 'Hoàn thành' : `${goal.completedSessions}/${goal.targetSessions} buổi`}</span>
            </div>
            <div style={{ height: 9, background: '#ECEFF1', borderRadius: 99, overflow: 'hidden', margin: '12px 0' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#8E24AA' }} />
            </div>
            {goal.status !== 'completed' && <button onClick={() => completeGoalSession(goal)} style={{ background: '#7B1FA2' }}>Ghi nhận một buổi</button>}
            <button onClick={() => saveGoals(goals.map(item => item.id === goal.id ? { ...item, status: 'archived' } : item))} style={{ marginLeft: 8, background: '#78909C' }}>Lưu trữ</button>
          </div>
        );
      })}
      <div style={{ ...panelStyle, background: '#F3E5F5' }}>
        <h3 style={{ marginTop: 0, color: '#6A1B9A' }}>Hứng thú và giới hạn lành mạnh</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            Chủ đề bé yêu thích
            <input value={preferences.interests || ''} onChange={event => savePreferences({ ...preferences, interests: event.target.value })} placeholder="Động vật, bóng đá, khoa học..." style={{ width: '100%', boxSizing: 'border-box', padding: 9, marginTop: 4 }} />
          </label>
          <label>
            Thời lượng tối đa mỗi ngày: <strong>{preferences.maxDailyMinutes || 30} phút</strong>
            <input type="range" min="10" max="60" step="5" value={preferences.maxDailyMinutes || 30} onChange={event => savePreferences({ ...preferences, maxDailyMinutes: Number(event.target.value) })} style={{ width: '100%' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={preferences.flexibleStreak !== false} onChange={event => savePreferences({ ...preferences, flexibleStreak: event.target.checked })} />
            Dùng mục tiêu linh hoạt theo tuần thay vì bắt buộc liên tục từng ngày
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={preferences.rewardStrategies !== false} onChange={event => savePreferences({ ...preferences, rewardStrategies: event.target.checked })} />
            Ưu tiên thưởng cho nỗ lực, sửa lỗi và tự kiểm tra
          </label>
        </div>
      </div>
    </div>
  );
}

export default function ParentLearningDashboard({ childId, childName }) {
  const [section, setSection] = useState('overview');
  const [period, setPeriod] = useState('week');
  const [plans, setPlans] = useState(() => readArray(`interventionPlans_${childId}`));
  const [goals, setGoals] = useState(() => readArray(`weeklyGoals_${childId}`));
  const [preferences, setPreferences] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`learningPreferences_${childId}`) || '{}'); } catch { return {}; }
  });
  const stats = useMemo(() => readArray(`learningStats_${childId}`), [childId]);
  const overview = useMemo(() => buildLearningOverview(stats, period), [stats, period]);
  const allCompetencies = useMemo(() => buildCompetencyProfile(stats), [stats]);
  const allMistakes = useMemo(() => analyzeMistakes(stats), [stats]);
  const trend = useMemo(() => buildDailyTrend(stats, 14), [stats]);

  useEffect(() => {
    setPlans(readArray(`interventionPlans_${childId}`));
    setGoals(readArray(`weeklyGoals_${childId}`));
    try { setPreferences(JSON.parse(localStorage.getItem(`learningPreferences_${childId}`) || '{}')); } catch { setPreferences({}); }
    setSection('overview');
  }, [childId]);

  const createPlan = mistake => {
    const exists = plans.some(plan => plan.mistakeId === mistake.id && plan.status !== 'archived');
    if (exists) {
      setSection('plans');
      return;
    }
    const next = [createInterventionPlan(mistake, childId), ...plans];
    setPlans(next);
    localStorage.setItem(`interventionPlans_${childId}`, JSON.stringify(next));
    syncToServer(childId);
    setSection('plans');
  };

  const sections = [
    ['overview', 'Tổng quan'],
    ['competencies', 'Năng lực'],
    ['trends', 'Xu hướng'],
    ['mistakes', `Lỗi sai (${allMistakes.length})`],
    ['plans', `Kế hoạch (${plans.filter(plan => plan.status !== 'archived').length})`],
    ['goals', 'Mục tiêu & hứng thú']
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ ...panelStyle, background: 'linear-gradient(135deg, #E3F2FD, #F3E5F5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: '#0D47A1' }}>Trung tâm học tập · {childName}</h2>
            <div style={{ color: '#546E7A', marginTop: 5 }}>Đánh giá → phát hiện lỗi → cùng bé luyện → đo lại</div>
          </div>
          <select value={period} onChange={event => setPeriod(event.target.value)} style={{ padding: 9, borderRadius: 6 }}>
            <option value="today">Hôm nay</option>
            <option value="week">7 ngày gần nhất</option>
            <option value="month">30 ngày gần nhất</option>
            <option value="quarter">90 ngày gần nhất</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {sections.map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)} style={{ whiteSpace: 'nowrap', background: section === id ? '#1976D2' : '#ECEFF1', color: section === id ? '#FFF' : '#455A64', boxShadow: 'none' }}>{label}</button>
        ))}
      </div>
      {section === 'overview' && <OverviewSection overview={overview} plans={plans} onOpenMistakes={() => setSection('mistakes')} onOpenPlans={() => setSection('plans')} />}
      {section === 'competencies' && <CompetencySection competencies={allCompetencies} />}
      {section === 'trends' && <TrendSection trend={trend} />}
      {section === 'mistakes' && <MistakeSection mistakes={allMistakes} childId={childId} onCreatePlan={createPlan} />}
      {section === 'plans' && <PlansSection plans={plans} setPlans={setPlans} childId={childId} />}
      {section === 'goals' && <GoalsSection childId={childId} goals={goals} setGoals={setGoals} preferences={preferences} setPreferences={setPreferences} />}
    </div>
  );
}
