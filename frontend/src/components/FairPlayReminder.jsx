const buildFairPlayLines = ({ timeSec, timeText, rewardText, hideSpeedRules } = {}) => [
  timeText ? `Thời gian làm bài: ${timeText}.` : (timeSec ? `Thời gian làm bài: ${timeSec} giây.` : null),
  rewardText ? `Điểm thưởng: ${rewardText}.` : null,
  'Bé hãy nhìn kỹ câu hỏi rồi mới chọn đáp án.',
  hideSpeedRules ? null : 'Nếu có 1-2 câu chọn dưới 3 giây, điểm thưởng sẽ giảm 50%.',
  hideSpeedRules ? null : 'Nếu có từ 3 câu chọn dưới 3 giây, bài đó sẽ không được cộng điểm và không tăng độ khó.'
].filter(Boolean);

export default function FairPlayReminder({ reminder, onCancel, onConfirm }) {
  if (!reminder) return null;

  return (
    <div className="fair-play-overlay" role="dialog" aria-modal="true" aria-labelledby="fair-play-title">
      <div className="fair-play-modal">
        <h2 id="fair-play-title">Quy định trước khi làm bài</h2>
        <div className="fair-play-content">
          {buildFairPlayLines(reminder).map((line) => (
            <div className="fair-play-rule" key={line}>
              <span aria-hidden="true">✓</span>
              <p>{line}</p>
            </div>
          ))}
        </div>
        <p className="fair-play-question">Bé đã sẵn sàng làm bài cẩn thận chưa?</p>
        <div className="fair-play-actions">
          <button type="button" className="fair-play-cancel" onClick={onCancel}>Chưa</button>
          <button type="button" className="fair-play-confirm" onClick={onConfirm}>Sẵn sàng</button>
        </div>
      </div>
    </div>
  );
}
