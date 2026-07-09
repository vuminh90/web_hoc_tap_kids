import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [points, setPoints] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLog, setHistoryLog] = useState([]);
  
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
  }, [pointKey, historyKey]);

  return (
    <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <button onClick={() => navigate('/play')}>
          Bắt đầu bài tập Toán ➕
        </button>
        <button style={{ backgroundColor: '#77DD77', boxShadow: '0 6px 0 #388E3C' }} onClick={() => navigate('/read')}>
          Kiểm tra Tập Đọc 📖
        </button>
        <button style={{ backgroundColor: '#9C27B0', boxShadow: '0 6px 0 #7B1FA2' }} onClick={() => navigate('/shop')}>
          🎁 Vào cửa hàng đổi quà
        </button>
      </div>
    </div>
  );
}
