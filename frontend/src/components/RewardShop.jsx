import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncToServer } from '../sync';
import { addPlayReward, getPlayMinutesFromReward } from '../playApi';
import { getGachaSettings } from '../gachaApi';

const DEFAULT_REWARDS = [
  { id: 1, name: "Trượt rồi hihi 🤪", color: "#FF5252", probability: 35 },
  { id: 2, name: "20 phút chơi game 🎮", color: "#00ACC1", probability: 20 },
  { id: 3, name: "5,000 VND 💵", color: "#4CAF50", probability: 15 },
  { id: 4, name: "Được ăn kem 🍦", color: "#FF9800", probability: 15 },
  { id: 5, name: "30 phút chơi game 🎮", color: "#2196F3", probability: 10 },
  { id: 6, name: "20,000 VND 💰", color: "#9C27B0", probability: 5 },
];

export default function RewardShop() {
  const navigate = useNavigate();
  const [points, setPoints] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [gachaSettings, setGachaSettings] = useState(null);
  const [playRewardMinutes, setPlayRewardMinutes] = useState(0);

  const currentUser = localStorage.getItem('currentUser') || 'vuanhduc';
  const pointKey = `points_${currentUser}`;
  const invKey = `inventory_${currentUser}`;

  useEffect(() => {
    const savedPoints = parseInt(localStorage.getItem(pointKey) || '0', 10);
    setPoints(savedPoints);
    
    let savedInv = JSON.parse(localStorage.getItem(invKey) || '[]');
    if (savedInv.length > 0 && typeof savedInv[0] === 'string') {
      const grouped = {};
      savedInv.forEach(item => {
        grouped[item] = (grouped[item] || 0) + 1;
      });
      savedInv = Object.keys(grouped).map(k => ({ name: k, count: grouped[k] }));
      localStorage.setItem(invKey, JSON.stringify(savedInv));
    }
    setInventory(savedInv);

    const fallbackSettings = localStorage.getItem('gachaSettings');
    setGachaSettings(fallbackSettings ? JSON.parse(fallbackSettings) : {
      costPerSpin: 200,
      rewards: DEFAULT_REWARDS
    });
    getGachaSettings().then(data => {
      setGachaSettings(data);
      localStorage.setItem('gachaSettings', JSON.stringify(data));
    }).catch(() => {});
  }, [pointKey, invKey]);

  const spin = () => {
    if (!gachaSettings) return;
    const cost = gachaSettings.costPerSpin;

    if (points < cost) {
      alert(`Bé không đủ điểm rồi! Cần ${cost} 💎 để quay. Hãy chăm chỉ học bài nhé!`);
      return;
    }
    
    const newPoints = points - cost;
    setPoints(newPoints);
    localStorage.setItem(pointKey, newPoints.toString());

    // Lưu lịch sử
    const historyKey = `pointsHistory_${currentUser}`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    history.unshift({
      date: new Date().toLocaleString('vi-VN'),
      amount: -cost,
      reason: 'Quay Vòng Quay May Mắn'
    });
    localStorage.setItem(historyKey, JSON.stringify(history));

    setIsSpinning(true);
    setResult(null);
    setPlayRewardMinutes(0);

    let rand = Math.random() * 100;
    let cumulative = 0;
    const rewards = gachaSettings.rewards;
    let selectedReward = rewards[0];

    for (let r of rewards) {
      cumulative += r.probability;
      if (rand <= cumulative) {
        selectedReward = r;
        break;
      }
    }

    setTimeout(async () => {
      setIsSpinning(false);
      setResult(selectedReward);
      
      const minutes = getPlayMinutesFromReward(selectedReward);
      if (minutes > 0) {
        try {
          await addPlayReward(minutes, selectedReward.name);
          setPlayRewardMinutes(minutes);
        } catch (error) {
          alert(`Chưa thể cộng thời gian chơi: ${error.message}`);
        }
      } else if (selectedReward.id !== 1) {
        let newInv = [...inventory];
        const existingItemIndex = newInv.findIndex(i => i.name === selectedReward.name);
        
        if (existingItemIndex >= 0) {
          newInv[existingItemIndex].count += 1;
        } else {
          newInv.push({ name: selectedReward.name, count: 1 });
        }
        
        setInventory(newInv);
        localStorage.setItem(invKey, JSON.stringify(newInv));
      }
      
      syncToServer(currentUser);
    }, 3000);
  };

  return (
    <div className="card">
      <h2>🎁 Cửa Hàng May Mắn</h2>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate('/student')} style={{ padding: '10px 20px', backgroundColor: '#888', boxShadow: '0 4px 0 #555' }}>
          🔙 Quay lại
        </button>
        <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#E65100' }}>
          Của bé: {points} 💎
        </span>
      </div>

      <div style={{ 
        height: '200px', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '20px', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        margin: '20px 0',
        overflow: 'hidden',
        border: '6px dashed #FF9800',
        position: 'relative'
      }}>
        {isSpinning ? (
          <h1 style={{ animation: 'spinText 0.1s infinite', fontSize: '3rem', margin: 0, textShadow: '2px 2px 0 #FFF' }}>
            🎰 ĐANG QUAY...
          </h1>
        ) : result ? (
          <div style={{ animation: 'pulse 0.5s', textAlign: 'center' }}>
            <h1 style={{ color: result.color, margin: 0, fontSize: '2.5rem' }}>{result.name}</h1>
            {result.id !== 1 && <p style={{ fontSize: '1.5rem', margin: '5px 0', color: '#E65100' }}>🎉 Chúc mừng bé! 🎉</p>}
          </div>
        ) : (
          <h1 style={{ color: '#aaa', margin: 0 }}>Nhấn nút để thử vận may!</h1>
        )}
      </div>

      {playRewardMinutes > 0 && (
        <button onClick={() => navigate('/play')} style={{ width: '100%', marginBottom: 15, backgroundColor: '#00ACC1', boxShadow: '0 6px 0 #006064' }}>
          🎮 Đã cộng {playRewardMinutes} phút — Đến Khu vui chơi
        </button>
      )}

      <button 
        onClick={spin} 
        disabled={isSpinning || !gachaSettings}
        style={{ 
          backgroundColor: isSpinning ? '#ccc' : '#4CAF50',
          width: '100%',
          fontSize: '1.5rem',
          boxShadow: isSpinning ? 'none' : '0 6px 0 #388E3C'
        }}
      >
        {isSpinning ? 'Đang chờ...' : `🎯 QUAY NGAY (${gachaSettings ? gachaSettings.costPerSpin : 200} 💎)`}
      </button>

      <div style={{ marginTop: '30px', textAlign: 'left', background: '#FFF9C4', padding: '15px', borderRadius: '15px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>🎒 Kho đồ của bé:</h3>
        {inventory.length === 0 ? (
          <p style={{ color: '#888', margin: 0 }}>Chưa có gì, hãy quay thật nhiều nhé!</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {inventory.map((item, idx) => (
              <li key={idx} style={{ 
                  fontSize: '1.2rem', 
                  marginBottom: '8px', 
                  fontWeight: 'bold', 
                  color: '#2196F3', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  borderBottom: '1px solid #FFE082', 
                  paddingBottom: '5px' 
                }}>
                <span>{item.name}</span>
                <span style={{ color: '#E65100', backgroundColor: '#FFF', padding: '2px 10px', borderRadius: '10px' }}>
                  x{item.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
