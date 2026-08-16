import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPlayTime, getPlayWallet } from '../playApi';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [points, setPoints] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLog, setHistoryLog] = useState([]);
  const [weeklyGoals, setWeeklyGoals] = useState([]);
  const [activePlans, setActivePlans] = useState([]);
  const [playSeconds, setPlaySeconds] = useState(0);
  const [activePlaySession, setActivePlaySession] = useState(false);
  
  const currentUser = localStorage.getItem('currentUser') || 'vuanhduc';
  const pointKey = `points_${currentUser}`;
  const historyKey = `pointsHistory_${currentUser}`;
  const displayName = currentUser === 'vuanhduc' ? 'Anh Đức' : 'Anh Thư';

  useEffect(() => {
    if (!localStorage.getItem(pointKey)) {
      localStorage.setItem(pointKey, '0');
    }
    setPoints(parseInt(localStorage.getItem(pointKey), 10));

    const log = JSON.parse(localStorage.getItem(historyKey) || '[]');
    setHistoryLog(log);
    setWeeklyGoals(JSON.parse(localStorage.getItem(`weeklyGoals_${currentUser}`) || '[]').filter(goal => goal.status === 'active'));
    setActivePlans(JSON.parse(localStorage.getItem(`interventionPlans_${currentUser}`) || '[]').filter(plan => plan.status === 'active'));
  }, [pointKey, historyKey, currentUser]);

  useEffect(() => {
    getPlayWallet().then(data => {
      setPlaySeconds(data.balanceSeconds || 0);
      setActivePlaySession(data.session?.status === 'active');
    }).catch(() => {});
  }, [currentUser]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Chào mừng bé {displayName}! 🌟</h2>
        <button onClick={() => navigate('/')} style={{ padding: '5px 10px', backgroundColor: '#ccc', color: '#333' }}>Thoát</button>
      </div>
      
      <p style={{ fontSize: '1.5rem', margin: '20px 0' }}>
        Điểm thưởng của bé: <strong style={{ color: '#E65100', fontSize: '2rem' }}>{points} 💎</strong>
      </p>
      
      <button 
        onClick={() => setShowHistory(!showHistory)}
        style={{ backgroundColor: 'transparent', color: '#1976D2', border: '1px solid #1976D2', padding: '5px 10px', marginBottom: '20px' }}
      >
        {showHistory ? 'Ẩn lịch sử' : '📜 Xem lịch sử nhận/trừ điểm'}
      </button>

      {showHistory && (
        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '10px', textAlign: 'left', marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' }}>
          {historyLog.length === 0 ? <p style={{ color: '#888', margin: 0 }}>Chưa có lịch sử nào.</p> : (
            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
              {historyLog.map((log, idx) => (
                <li key={idx} style={{ borderBottom: '1px solid #ddd', padding: '8px 0', fontSize: '0.9rem' }}>
                  <div style={{ color: '#666', fontSize: '0.8rem' }}>{log.date}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                    <span>{log.reason}</span>
                    <strong style={{ color: log.amount > 0 ? '#4CAF50' : '#FF5252' }}>
                      {log.amount > 0 ? '+' : ''}{log.amount} 💎
                    </strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(weeklyGoals.length > 0 || activePlans.length > 0) && (
        <div style={{ background: '#FFF8E1', border: '2px solid #FFD54F', borderRadius: 12, padding: 15, marginBottom: 20, textAlign: 'left' }}>
          <h3 style={{ color: '#F57F17', marginTop: 0 }}>🎯 Nhiệm vụ tuần của bé</h3>
          {weeklyGoals.map(goal => (
            <div key={goal.id} style={{ marginBottom: 10 }}>
              <strong>{goal.title}</strong>
              <div style={{ color: '#6D4C41', fontSize: '.9rem' }}>Đã làm {goal.completedSessions}/{goal.targetSessions} buổi</div>
            </div>
          ))}
          {activePlans.map(plan => (
            <div key={plan.id} style={{ background: '#FFF', borderRadius: 8, padding: 10, marginTop: 8 }}>
              <strong>{plan.title}</strong>
              <div style={{ color: '#6D4C41', fontSize: '.9rem' }}>{plan.sessionsCompleted}/{plan.sessionsTarget} buổi · Mỗi buổi khoảng {plan.durationMinutes} phút</div>
            </div>
          ))}
          <div style={{ color: '#795548', fontSize: '.85rem', marginTop: 8 }}>Bé có thể chọn Toán hoặc Tiếng Việt phù hợp với nhiệm vụ nhé.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <button onClick={() => navigate('/math')}>
          Bài tập Toán ➕
        </button>
        <button style={{ backgroundColor: '#77DD77', boxShadow: '0 6px 0 #388E3C' }} onClick={() => navigate('/read')}>
          Bài tập Tiếng Việt 📖
        </button>
        <button style={{ backgroundColor: '#9C27B0', boxShadow: '0 6px 0 #7B1FA2' }} onClick={() => navigate('/shop')}>
          🎁 Vào cửa hàng đổi quà
        </button>
        <button style={{ backgroundColor: '#00ACC1', boxShadow: '0 6px 0 #006064' }} onClick={() => navigate('/play')}>
          🎮 {activePlaySession ? 'Tiếp tục chơi' : 'Khu vui chơi'} · {formatPlayTime(playSeconds)}
        </button>
      </div>
    </div>
  );
}
