import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { pullFromServer, syncToServer } from '../sync';
import ParentLearningDashboard from './ParentLearningDashboard';
import GameSiteAdmin from './GameSiteAdmin';
import { getParentGachaSettings, saveParentGachaSettings } from '../gachaApi';
import { getChildLevelProfile, getLevelPhase, getLevelStage, getLevelTiming } from '../learningLevels';

const DEFAULT_SETTINGS = {
  costPerSpin: 200,
  rewards: [
    { id: 1, name: "Trượt rồi hihi 🤪", color: "#FF5252", probability: 35 },
    { id: 2, name: "20 phút chơi game 🎮", color: "#00ACC1", probability: 20 },
    { id: 3, name: "5,000 VND 💵", color: "#4CAF50", probability: 15 },
    { id: 4, name: "Được ăn kem 🍦", color: "#FF9800", probability: 15 },
    { id: 5, name: "30 phút chơi game 🎮", color: "#2196F3", probability: 10 },
    { id: 6, name: "20,000 VND 💰", color: "#9C27B0", probability: 5 },
  ]
};

const parseDate = (dateString) => {
  try {
    if (dateString.includes('T') || dateString.includes('-')) {
      const d = new Date(dateString);
      if (!isNaN(d.getTime())) return d;
    }
    const parts = dateString.split(/[\s,]+/);
    let datePart = parts.find(p => p.includes('/'));
    let timePart = parts.find(p => p.includes(':'));
    if (!datePart) return null;
    const [day, month, year] = datePart.split('/');
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart || '00:00:00'}`);
  } catch {
    return null;
  }
};

const readJsonMap = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
};

const levelNames = ['Mới bắt đầu', 'Rất dễ', 'Dễ', 'Dễ+', 'Trung bình', 'Trung bình+', 'Khó', 'Khó+', 'Rất khó', 'Thử thách'];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const getLevelName = (level, maxLevel = 10) => {
  const index = Math.ceil((clamp(level || 1, 1, maxLevel) / maxLevel) * levelNames.length) - 1;
  return levelNames[clamp(index, 0, levelNames.length - 1)];
};

const getLearningLevelRows = (childId) => {
  const profile = getChildLevelProfile(childId);
  const mathDifficulty = readJsonMap(`mathDifficultyLevels_${childId}`);
  const vietnamese = readJsonMap(`vietnameseModuleLevels_${childId}`);
  const progress = readJsonMap(`learningLevelProgress_${childId}`);
  const buildRows = (subject, modules, levels) => modules.map(module => {
    const currentLevel = clamp(parseInt(levels[module.id] || '1', 10), 1, profile.maxLevel);
    const stage = getLevelStage(childId, currentLevel);
    const phase = getLevelPhase(childId, currentLevel);
    const itemCount = module.assessmentMode === 'reading' ? 3 : 10;
    const timing = getLevelTiming(childId, subject, module.id, currentLevel, itemCount);
    const moduleProgress = progress[`${subject}:${module.id}`] || {};
    return {
      id: `${subject}:${module.id}`,
      subject,
      module: module.name,
      currentLevel,
      maxLevel: profile.maxLevel,
      difficulty: getLevelName(currentLevel, profile.maxLevel),
      stage,
      phase,
      targetSeconds: timing.targetSeconds,
      timed: timing.timed,
      accuracy: moduleProgress.lastAccuracy,
      timeRatio: moduleProgress.lastTimeRatio,
      masteryCount: moduleProgress.masteryCount || 0,
      decision: moduleProgress.lastDecision || 'new'
    };
  });
  const mathRows = buildRows('math', profile.math, mathDifficulty);
  const vietRows = buildRows('vietnamese', profile.vietnamese, vietnamese);
  return [...mathRows, ...vietRows];
};

const formatSeconds = (seconds) => {
  if (!seconds) return 'Không giới hạn cứng';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes} phút ${remainder ? `${remainder} giây` : ''}`.trim() : `${remainder} giây`;
};

const LearningLevelsPanel = ({ childId, childName }) => {
  const rows = getLearningLevelRows(childId);
  const profile = getChildLevelProfile(childId);
  return (
    <div style={{ background: '#FFF', padding: '20px', borderRadius: '12px', border: '2px solid #1976D2' }}>
      <h3 style={{ margin: 0, color: '#1565C0' }}>Level theo từng module: {childName}</h3>
      <p style={{ color: '#546E7A', lineHeight: 1.5 }}>
        Mỗi module có level độc lập trong database. Level điều khiển đồng thời độ khó nội dung và thời gian mục tiêu.
        Bé cần đạt chuẩn 2 trong 3 lượt gần nhất mới tăng một level.
      </p>
      <div style={{ padding: '12px', background: '#E3F2FD', borderRadius: '8px', marginBottom: '16px' }}>
        <strong>Thang level: 1–{profile.maxLevel}</strong> · Chương trình {profile.grade}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {rows.map(row => {
          const percent = Math.round((row.currentLevel / row.maxLevel) * 100);
          return (
            <div key={row.id} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #CFD8DC', borderLeft: `5px solid ${row.subject === 'math' ? '#1976D2' : '#43A047'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <strong style={{ color: '#263238' }}>{row.module}</strong>
                <strong style={{ color: '#E65100', whiteSpace: 'nowrap' }}>Lv {row.currentLevel}/{row.maxLevel}</strong>
              </div>
              <div style={{ height: '9px', background: '#ECEFF1', borderRadius: '99px', overflow: 'hidden', margin: '10px 0' }}>
                <div style={{ height: '100%', width: `${percent}%`, background: row.subject === 'math' ? '#42A5F5' : '#66BB6A' }} />
              </div>
              <div style={{ color: '#37474F', fontWeight: 'bold' }}>{row.stage.name} · {row.phase.name}</div>
              <div style={{ color: '#607D8B', fontSize: '0.92rem', marginTop: '5px' }}>{row.stage.focus}</div>
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #CFD8DC', fontSize: '0.92rem', lineHeight: 1.55 }}>
                <div>Thời gian mục tiêu: <strong>{formatSeconds(row.targetSeconds)}</strong></div>
                <div>Kết quả gần nhất: <strong>{row.accuracy === undefined ? 'Chưa có' : `${row.accuracy}% chính xác`}</strong></div>
                <div>Tiến độ lên level: <strong>{row.masteryCount}/2 lượt đạt chuẩn</strong></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('learning');
  const [ducPoints, setDucPoints] = useState(0);
  const [thuPoints, setThuPoints] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const [selectedChild, setSelectedChild] = useState('vuanhduc');
  const [pointChange, setPointChange] = useState('');
  const [pointReason, setPointReason] = useState('');
  const [childInventory, setChildInventory] = useState([]);
  
  // Analytics State
  const [reportType, setReportType] = useState('week'); // 'today' | 'week' | 'month'
  const [historyFilter, setHistoryFilter] = useState('all');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [advancedStats, setAdvancedStats] = useState(null);

  const loadPoints = () => {
    setDucPoints(parseInt(localStorage.getItem('points_vuanhduc') || '0', 10));
    setThuPoints(parseInt(localStorage.getItem('points_vuanhthu') || '0', 10));
  };

  const loadSyncedParentData = async () => {
    setIsSyncing(true);
    await Promise.all([
      pullFromServer('vuanhduc'),
      pullFromServer('vuanhthu'),
      getParentGachaSettings().then(data => {
        const localSettings = localStorage.getItem('gachaSettings');
        if (localSettings) {
          setSettings(JSON.parse(localSettings));
          setSettingsMessage('Đang dùng cấu hình vòng quay đã lưu trên máy này. Bấm Lưu Cấu Hình để đưa lên máy chủ.');
        } else {
          setSettings(data);
          localStorage.setItem('gachaSettings', JSON.stringify(data));
        }
      }).catch(() => {})
    ]);
    loadPoints();
    setIsSyncing(false);
  };

  const handleParentLogin = async () => {
    if (!passwordInput) return;
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const response = await fetch('/api/parent/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });
      if (!response.ok) throw new Error('Mật khẩu không đúng hoặc máy chủ chưa sẵn sàng.');
      const data = await response.json();
      sessionStorage.setItem('parentAuthToken', data.token);
      setIsAuthenticated(true);
      setPasswordInput('');
      await loadSyncedParentData();
    } catch (error) {
      setLoginError(error.message || 'Không thể đăng nhập.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const processAnalyticsData = (history, filterType) => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let mathPoints = 0;
    let readingPoints = 0;
    
    let currentPeriodTotal = 0;
    let prevPeriodTotal = 0;
    const chartDataMap = {};

    history.forEach(log => {
      const d = parseDate(log.date);
      if (!d) return;

      let subj = log.subject;
      if (!subj) {
        if (log.reason.includes('Toán')) subj = 'math';
        else if (log.reason.includes('Đọc')) subj = 'reading';
        else subj = 'other';
      }

      if (log.amount <= 0 && subj !== 'other') return;
      const pts = log.amount > 0 ? log.amount : 0;

      const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const daysDiff = Math.floor((todayMidnight - dMidnight) / (1000 * 3600 * 24));

      let includeInChart = false;
      let chartKey = '';

      if (filterType === 'today') {
        if (daysDiff === 0) {
          includeInChart = true;
          chartKey = `${d.getHours()}h`;
          currentPeriodTotal += pts;
        } else if (daysDiff === 1) {
          prevPeriodTotal += pts;
        }
      } else if (filterType === 'week') {
        if (daysDiff < 7 && daysDiff >= 0) {
          includeInChart = true;
          chartKey = d.toLocaleDateString('vi-VN', { weekday: 'short' });
          currentPeriodTotal += pts;
        } else if (daysDiff >= 7 && daysDiff < 14) {
          prevPeriodTotal += pts;
        }
      } else if (filterType === 'month') {
        if (daysDiff < 30 && daysDiff >= 0) {
          includeInChart = true;
          chartKey = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
          currentPeriodTotal += pts;
        } else if (daysDiff >= 30 && daysDiff < 60) {
          prevPeriodTotal += pts;
        }
      }

      if (includeInChart) {
        if (!chartDataMap[chartKey]) chartDataMap[chartKey] = { name: chartKey, math: 0, reading: 0 };
        if (subj === 'math') {
          chartDataMap[chartKey].math += pts;
          mathPoints += pts;
        } else if (subj === 'reading') {
          chartDataMap[chartKey].reading += pts;
          readingPoints += pts;
        }
      }
    });

    let chartData = Object.values(chartDataMap);
    if (filterType === 'today') {
      chartData = chartData.sort((a,b) => parseInt(a.name) - parseInt(b.name));
    } else if (filterType === 'month') {
      chartData = chartData.reverse(); 
    }

    let progressPct = 0;
    if (prevPeriodTotal === 0) {
      progressPct = currentPeriodTotal > 0 ? 100 : 0;
    } else {
      progressPct = Math.round(((currentPeriodTotal - prevPeriodTotal) / prevPeriodTotal) * 100);
    }

    let remarks = [];
    if (currentPeriodTotal === 0) {
      remarks.push("💤 Chưa có hoạt động học tập nào. Hãy nhắc bé vào làm bài nhé!");
    } else {
      if (progressPct >= 20) {
        remarks.push(`🚀 Tiến bộ vượt bậc! Bé đã kiếm nhiều hơn ${progressPct}% điểm so với kỳ trước.`);
      } else if (progressPct <= -20) {
        remarks.push(`⚠️ Phong độ đang giảm (${progressPct}%). Bố mẹ nên động viên và nhắc nhở bé học đều đặn hơn.`);
      } else {
        remarks.push(`👍 Phong độ học tập đang duy trì ổn định so với kỳ trước.`);
      }

      if (mathPoints > readingPoints * 2 && readingPoints > 0) {
        remarks.push(`📐 Bé đang cày môn Toán rất nhiều. Hãy khuyến khích bé làm thêm bài Tập Đọc để cân bằng.`);
      } else if (readingPoints > mathPoints * 2 && mathPoints > 0) {
        remarks.push(`📖 Bé rất thích Tập Đọc. Hãy thử thách bé thêm vài bài Toán để rèn tư duy logic.`);
      } else if (mathPoints === 0 && readingPoints > 0) {
        remarks.push(`📐 Bé chưa đụng đến môn Toán chút nào. Cần giao nhiệm vụ Toán cho bé.`);
      } else if (readingPoints === 0 && mathPoints > 0) {
        remarks.push(`📖 Bé chưa làm bài Tập Đọc nào. Khả năng ngôn ngữ rất quan trọng, bố mẹ nhắc bé nhé!`);
      } else if (mathPoints > 0 && readingPoints > 0) {
        remarks.push(`🌟 Phân bổ 2 môn khá đồng đều. Bé đang phát triển rất toàn diện!`);
      }
    }

    return { chartData, mathPoints, readingPoints, currentPeriodTotal, progressPct, remarks };
  };

  const loadChildData = () => {
    let inv = JSON.parse(localStorage.getItem(`inventory_${selectedChild}`) || '[]');
    setChildInventory(inv);

    const historyKey = `pointsHistory_${selectedChild}`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    setAnalyticsData(processAnalyticsData(history, reportType));

    // Process advanced learning stats
    const statsKey = `learningStats_${selectedChild}`;
    const learningStats = JSON.parse(localStorage.getItem(statsKey) || '[]');
    
    let totalMathCorrect = 0;
    let totalMathQuestions = 0;
    let totalMathSecs = 0;

    let totalReadingAccuracy = 0;
    let totalReadingWpm = 0;
    let readingSessions = 0;
    
    let totalVietCorrect = 0;
    let totalVietQuestions = 0;

    learningStats.forEach(stat => {
      if (stat.subject === 'math') {
        totalMathCorrect += stat.correct || 0;
        totalMathQuestions += (stat.correct || 0) + (stat.incorrect || 0);
        totalMathSecs += stat.timeSpentSec || 0;
      } else if (stat.subject === 'reading') {
        if (stat.category === 'grammar') {
          totalVietCorrect += stat.correct || 0;
          totalVietQuestions += (stat.correct || 0) + (stat.incorrect || 0);
        } else if (stat.category === 'writing') {
          // Writing task completed
        } else {
          if (stat.accuracy !== undefined) {
             totalReadingAccuracy += stat.accuracy;
             totalReadingWpm += stat.wpm || 0;
             readingSessions += 1;
          }
        }
      }
    });

    const mathAccuracy = totalMathQuestions > 0 ? Math.round((totalMathCorrect / totalMathQuestions) * 100) : 0;
    const mathSpeed = totalMathQuestions > 0 ? (totalMathSecs / totalMathQuestions).toFixed(1) : 0;
    const avgReadingAccuracy = readingSessions > 0 ? Math.round(totalReadingAccuracy / readingSessions) : 0;
    const avgReadingWpm = readingSessions > 0 ? Math.round(totalReadingWpm / readingSessions) : 0;
    const grammarAccuracy = totalVietQuestions > 0 ? Math.round((totalVietCorrect / totalVietQuestions) * 100) : 0;
    
    // Compute breakdown for Talent Radar
    const mathCatData = {};
    learningStats.forEach(s => {
      if (s.subject === 'math' && s.category !== 'all') {
        if (!mathCatData[s.category]) mathCatData[s.category] = { correct: 0, total: 0 };
        mathCatData[s.category].correct += (s.correct || 0);
        mathCatData[s.category].total += 10;
      }
    });
    const breakdownData = Object.keys(mathCatData).map(k => {
      const names = { algebra: 'Đại số', geometry: 'Hình học', logic: 'Toán Logic', probability: 'Xác suất', basic_math: 'Cộng Trừ', visual_math: 'Đếm Hình' };
      return {
        name: names[k] || k,
        accuracy: Math.round((mathCatData[k].correct / mathCatData[k].total) * 100)
      };
    });

    setAdvancedStats({ 
      mathAccuracy, mathSpeed, mathTotal: totalMathQuestions,
      avgReadingAccuracy, avgReadingWpm, readingSessions,
      grammarAccuracy, grammarTotal: totalVietQuestions,
      breakdownData
    });
  };

  const [autoIntervention, setAutoIntervention] = useState(localStorage.getItem('autoInterventionEnabled') !== 'false');
  const toggleIntervention = () => {
    const newVal = !autoIntervention;
    setAutoIntervention(newVal);
    localStorage.setItem('autoInterventionEnabled', newVal.toString());
  };

  useEffect(() => {
    const savedSettings = localStorage.getItem('gachaSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    const token = sessionStorage.getItem('parentAuthToken');
    if (token) {
      fetch('/api/parent/verify', { headers: { Authorization: `Bearer ${token}` } })
        .then(response => {
          if (!response.ok) throw new Error('Phiên hết hạn');
          setIsAuthenticated(true);
          return loadSyncedParentData();
        })
        .catch(() => sessionStorage.removeItem('parentAuthToken'));
    }
  }, []);

  useEffect(() => {
    if (!isSyncing) loadChildData();
  }, [selectedChild, reportType, isSyncing]);

  // Cài đặt Vòng quay
  const handleSaveSettings = async () => {
    const totalProb = settings.rewards.reduce((acc, r) => acc + r.probability, 0);
    if (totalProb !== 100) {
      alert(`Tổng tỷ lệ trúng thưởng phải đúng bằng 100%. Hiện tại đang là ${totalProb}%`);
      return;
    }
    try {
      const saved = await saveParentGachaSettings(settings);
      setSettings(saved);
      localStorage.setItem('gachaSettings', JSON.stringify(saved));
      setSettingsMessage('Đã lưu cấu hình vòng quay lên máy chủ.');
      alert('Đã lưu cấu hình Vòng Quay thành công!');
      return;
    } catch (error) {
      const message = error.message || 'Không thể lưu cấu hình vòng quay.';
      setSettingsMessage(message);
      alert(message);
      return;
    }
  };

  const updateReward = (index, field, value) => {
    const newRewards = [...settings.rewards];
    newRewards[index][field] = field === 'probability' ? parseInt(value) || 0 : value;
    setSettings({ ...settings, rewards: newRewards });
  };

  const addReward = () => {
    const newRewards = [...settings.rewards, {
      id: Date.now(),
      name: "Phần thưởng mới",
      color: "#" + Math.floor(Math.random()*16777215).toString(16),
      probability: 0
    }];
    setSettings({ ...settings, rewards: newRewards });
  };

  const removeReward = (index) => {
    if (settings.rewards.length <= 1) {
      alert("Phải có ít nhất 1 phần thưởng trong vòng quay!");
      return;
    }
    const newRewards = settings.rewards.filter((_, i) => i !== index);
    setSettings({ ...settings, rewards: newRewards });
  };

  // Quản lý Điểm & Kho đồ
  const handleAdjustPoints = () => {
    const amount = parseInt(pointChange);
    if (!amount || amount === 0) return alert('Vui lòng nhập số điểm hợp lệ (VD: 50, -20)');
    if (!pointReason.trim()) return alert('Vui lòng nhập lý do để bé biết!');

    const pointKey = `points_${selectedChild}`;
    const currentPoints = parseInt(localStorage.getItem(pointKey) || '0', 10);
    const newPoints = Math.max(0, currentPoints + amount); 
    localStorage.setItem(pointKey, newPoints.toString());

    const historyKey = `pointsHistory_${selectedChild}`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    history.unshift({
      date: new Date().toLocaleString('vi-VN'),
      amount: amount,
      reason: pointReason,
      subject: 'other' // Manual points
    });
    localStorage.setItem(historyKey, JSON.stringify(history));

    loadPoints();
    loadChildData(); 
    syncToServer(selectedChild);
    setPointChange('');
    setPointReason('');
    alert('Đã cập nhật điểm và ghi vào lịch sử!');
  };

  const handleClearData = () => {
    if (window.confirm(`Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu của ${childName} không? (Kim cương, Lịch sử, Kho đồ, Tiến độ bài học)`)) {
      localStorage.removeItem(`points_${selectedChild}`);
      localStorage.removeItem(`pointsHistory_${selectedChild}`);
      localStorage.removeItem(`inventory_${selectedChild}`);
      localStorage.removeItem(`learningStats_${selectedChild}`);
      localStorage.removeItem(`mathLevel_${selectedChild}`);
      localStorage.removeItem(`mathDifficultyLevels_${selectedChild}`);
      localStorage.removeItem(`mathTimeLevels_${selectedChild}`);
      localStorage.removeItem(`vietLevel_${selectedChild}`);
      localStorage.removeItem(`vietnameseModuleLevels_${selectedChild}`);
      localStorage.removeItem(`learningLevelProgress_${selectedChild}`);
      localStorage.removeItem(`learningLevelSchemaVersion_${selectedChild}`);
      loadPoints();
      loadChildData();
      syncToServer(selectedChild);
      alert(`Đã xoá toàn bộ dữ liệu của ${childName}!`);
    }
  };

  const handleAdjustInventory = (itemName, change) => {
    let newInv = [...childInventory];
    const index = newInv.findIndex(i => i.name === itemName);
    if (index >= 0) {
      newInv[index].count += change;
      if (newInv[index].count <= 0) {
        newInv.splice(index, 1);
      }
    } else if (change > 0) {
      newInv.push({ name: itemName, count: change });
    }
    setChildInventory(newInv);
    localStorage.setItem(`inventory_${selectedChild}`, JSON.stringify(newInv));
    syncToServer(selectedChild);
  };

  const childName = selectedChild === 'vuanhduc' ? 'Anh Đức (Lớp 4)' : 'Anh Thư (Lớp 1)';

  if (isSyncing) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}><h2>Đang đồng bộ dữ liệu từ máy chủ... 🔄</h2></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ color: '#1976D2' }}>Khu Vực Phụ Huynh 🔐</h2>
        <p>Vui lòng nhập mật khẩu để truy cập.</p>
        <input 
          type="password" 
          value={passwordInput} 
          onChange={(e) => setPasswordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleParentLogin();
          }}
          placeholder="Nhập mật khẩu..." 
          style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        <button 
          disabled={isLoggingIn}
          onClick={handleParentLogin}
          style={{ width: '100%', backgroundColor: '#1976D2', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          {isLoggingIn ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        {loginError && <p style={{ color: '#C62828' }}>{loginError}</p>}
        <button onClick={() => navigate('/student')} style={{ marginTop: '15px', background: 'none', color: '#888', border: 'none', textDecoration: 'underline', cursor: 'pointer', width: '100%', boxShadow: 'none' }}>
          Quay về trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ color: '#2196F3', margin: 0 }}>👨‍💻 Khu Vực Phụ Huynh</h2>
        <button onClick={() => { sessionStorage.removeItem('parentAuthToken'); setIsAuthenticated(false); setPasswordInput(''); navigate('/'); }} style={{ padding: '8px 15px', backgroundColor: '#888', boxShadow: '0 4px 0 #555' }}>
          Đăng xuất
        </button>
      </div>

      {/* TỔNG QUAN KIM CƯƠNG */}
      <div className="grid-2-col" style={{ margin: '20px 0' }}>
        <div 
          onClick={() => setSelectedChild('vuanhduc')}
          style={{ 
            flex: 1, background: '#E3F2FD', padding: '15px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer',
            border: selectedChild === 'vuanhduc' ? '4px solid #1976D2' : '2px solid #90CAF9',
            boxShadow: selectedChild === 'vuanhduc' ? '0 0 10px rgba(25,118,210,0.5)' : 'none',
            transform: selectedChild === 'vuanhduc' ? 'scale(1.02)' : 'scale(1)', transition: 'all 0.2s'
          }}
        >
          <h3 style={{ margin: '0 0 10px 0', color: '#1565C0' }}>Anh Đức (Lớp 4)</h3>
          <strong style={{ color: '#E65100', fontSize: '2rem' }}>{ducPoints} 💎</strong>
        </div>

        <div 
          onClick={() => setSelectedChild('vuanhthu')}
          style={{ 
            flex: 1, background: '#FCE4EC', padding: '15px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer',
            border: selectedChild === 'vuanhthu' ? '4px solid #C2185B' : '2px solid #F48FB1',
            boxShadow: selectedChild === 'vuanhthu' ? '0 0 10px rgba(194,24,91,0.5)' : 'none',
            transform: selectedChild === 'vuanhthu' ? 'scale(1.02)' : 'scale(1)', transition: 'all 0.2s'
          }}
        >
          <h3 style={{ margin: '0 0 10px 0', color: '#AD1457' }}>Anh Thư (Lớp 1)</h3>
          <strong style={{ color: '#E65100', fontSize: '2rem' }}>{thuPoints} 💎</strong>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #ccc', marginBottom: '20px', overflowX: 'auto' }}>
        <button 
          onClick={() => setActiveTab('overview')}
          style={{ 
            flex: 1, background: 'none', color: activeTab === 'overview' ? '#1976D2' : '#888', 
            borderBottom: activeTab === 'overview' ? '4px solid #1976D2' : 'none', borderRadius: 0, padding: '10px'
          }}>
          🛠 Quản lý & Cấu hình
        </button>
        <button 
          onClick={() => setActiveTab('learning')}
          style={{ 
            flex: 1, background: 'none', color: activeTab === 'learning' ? '#1976D2' : '#888',
            borderBottom: activeTab === 'learning' ? '4px solid #1976D2' : 'none', borderRadius: 0, padding: '10px'
          }}>
          📊 Trung tâm học tập
        </button>
        <button
          onClick={() => setActiveTab('levels')}
          style={{
            flex: 1, background: 'none', color: activeTab === 'levels' ? '#1976D2' : '#888',
            borderBottom: activeTab === 'levels' ? '4px solid #1976D2' : 'none', borderRadius: 0, padding: '10px'
          }}>
          🎯 Level từng module
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{ 
            flex: 1, background: 'none', color: activeTab === 'history' ? '#1976D2' : '#888', 
            borderBottom: activeTab === 'history' ? '4px solid #1976D2' : 'none', borderRadius: 0, padding: '10px'
          }}>
          📖 Lịch sử Làm bài
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div style={{ background: '#E8F5E9', padding: '20px', borderRadius: '10px', border: '2px solid #81C784', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#2E7D32' }}>Hành trang: {childName}</h3>
            
            <div style={{ background: '#FFF', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Thưởng / Phạt Kim cương</h4>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input 
                  type="number" placeholder="Số điểm (VD: 50, -20)" value={pointChange} onChange={e => setPointChange(e.target.value)}
                  style={{ padding: '8px', width: '150px' }}
                />
                <input 
                  type="text" placeholder="Ghi chú lý do..." value={pointReason} onChange={e => setPointReason(e.target.value)}
                  style={{ padding: '8px', flex: 1 }}
                />
                <button onClick={handleAdjustPoints} style={{ backgroundColor: '#FF9800', padding: '8px 15px' }}>Cập nhật</button>
              </div>
            </div>

            <div style={{ background: '#FFF', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Kho đồ hiện tại</h4>
              {childInventory.length === 0 ? <p style={{ margin: 0, color: '#888' }}>Chưa có vật phẩm nào.</p> : (
                <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                  {childInventory.map((item, idx) => (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '8px 0', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.1rem' }}>{item.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button onClick={() => handleAdjustInventory(item.name, -1)} style={{ padding: '2px 10px', backgroundColor: '#FF5252' }}>-</button>
                        <strong style={{ fontSize: '1.2rem', minWidth: '20px', textAlign: 'center' }}>{item.count}</strong>
                        <button onClick={() => handleAdjustInventory(item.name, 1)} style={{ padding: '2px 10px', backgroundColor: '#4CAF50' }}>+</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button onClick={handleClearData} style={{ backgroundColor: '#D32F2F', color: 'white', padding: '10px 20px', borderRadius: '5px', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 0 #B71C1C', cursor: 'pointer' }}>
                ⚠️ Xóa toàn bộ dữ liệu của {childName}
              </button>
            </div>
          </div>

          <div style={{ background: '#FFF9C4', padding: '20px', borderRadius: '10px', border: '2px dashed #FBC02D' }}>
            <h3 style={{ marginTop: 0, color: '#F57F17' }}>⚙️ Cấu hình quay thưởng</h3>
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <label style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>Giá lượt quay (💎): </label>
              <input 
                type="number" value={settings.costPerSpin} onChange={e => setSettings({...settings, costPerSpin: parseInt(e.target.value) || 0})}
                style={{ padding: '10px', fontSize: '1.2rem', width: '100px', borderRadius: '5px', border: '2px solid #ccc' }}
              />
            </div>

            <h4 style={{ margin: '15px 0 10px 0', color: '#333' }}>Danh sách phần thưởng & Tỷ lệ trúng (%)</h4>
            {settings.rewards.map((r, idx) => (
              <div key={r.id} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input 
                  value={r.name} onChange={e => updateReward(idx, 'name', e.target.value)}
                  style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
                <input 
                  type="number" value={r.probability} onChange={e => updateReward(idx, 'probability', e.target.value)}
                  style={{ width: '80px', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', textAlign: 'center' }}
                /> %
                <button onClick={() => removeReward(idx)} style={{ padding: '10px', backgroundColor: '#FF5252', borderRadius: '5px', border: 'none', color: '#FFF' }}>❌</button>
              </div>
            ))}
            <button onClick={addReward} style={{ backgroundColor: '#2196F3', padding: '10px', marginTop: '10px', display: 'block' }}>➕ Thêm phần thưởng</button>
            <button onClick={handleSaveSettings} style={{ backgroundColor: '#4CAF50', width: '100%', marginTop: '20px', boxShadow: '0 6px 0 #388E3C' }}>💾 Lưu Cấu Hình</button>
            {settingsMessage && <div style={{ marginTop: '10px', color: '#00695C', background: '#FFFFFF', padding: '10px', borderRadius: '8px' }}>{settingsMessage}</div>}
          </div>
          <GameSiteAdmin selectedChild={selectedChild} />
        </>
      )}

      {activeTab === 'learning' && (
        <ParentLearningDashboard childId={selectedChild} childName={childName} />
      )}

      {activeTab === 'levels' && (
        <LearningLevelsPanel childId={selectedChild} childName={childName} />
      )}

      {activeTab === 'analytics' && analyticsData && (
        <div style={{ background: '#FFF', padding: '20px', borderRadius: '10px', border: '2px solid #2196F3' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, color: '#1976D2' }}>Phân tích năng lực: {childName}</h3>
            <select 
              value={reportType} 
              onChange={(e) => setReportType(e.target.value)}
              style={{ padding: '8px', fontSize: '1rem', borderRadius: '5px', border: '2px solid #1976D2' }}
            >
              <option value="today">Hôm nay</option>
              <option value="week">Tuần này (7 ngày qua)</option>
              <option value="month">Tháng này (30 ngày qua)</option>
            </select>
          </div>

          {/* Bảng nhận xét */}
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, background: '#E3F2FD', padding: '15px', borderRadius: '8px', minWidth: '250px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1565C0' }}>Tổng quan Điểm thu thập</h4>
              <p style={{ margin: '5px 0' }}>Tổng cộng: <strong>{analyticsData.currentPeriodTotal} 💎</strong></p>
              <p style={{ margin: '5px 0' }}>- Môn Toán: <strong style={{ color: '#2196F3' }}>{analyticsData.mathPoints}</strong></p>
              <p style={{ margin: '5px 0' }}>- Tiếng Việt: <strong style={{ color: '#4CAF50' }}>{analyticsData.readingPoints}</strong></p>
            </div>
            <div style={{ flex: 2, background: '#FFF3E0', padding: '15px', borderRadius: '8px', minWidth: '250px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#E65100' }}>💡 Trợ lý AI Nhận xét & Đề xuất</h4>
              <ul style={{ paddingLeft: '20px', margin: 0, color: '#424242', lineHeight: '1.6' }}>
                {analyticsData.remarks.map((rm, idx) => (
                  <li key={idx} style={{ marginBottom: '5px' }}>{rm}</li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ background: '#F8F9FA', padding: '15px', borderRadius: '8px', border: '1px solid #E0E0E0', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#37474F' }}>Trình độ hiện tại theo module</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {getLearningLevelRows(selectedChild).map(row => (
                <div key={row.module} style={{ background: '#FFF', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #1976D2' }}>
                  <div style={{ fontWeight: 'bold', color: '#263238' }}>{row.module}</div>
                  <div style={{ color: '#1976D2', fontWeight: 'bold', marginTop: '4px' }}>{row.difficulty}</div>
                  <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '4px' }}>{row.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Biểu đồ */}
          {advancedStats && (
            <div className="grid-2-col" style={{ marginBottom: '20px' }}>
              <div style={{ background: '#E0F7FA', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #00BCD4' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#00838F' }}>Độ chính xác (Toán)</h4>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#006064' }}>{advancedStats.mathAccuracy}%</div>
                <div style={{ fontSize: '0.9rem', color: '#0097A7' }}>Dựa trên {advancedStats.mathTotal} câu hỏi</div>
              </div>
              <div style={{ background: '#F3E5F5', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #9C27B0' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#6A1B9A' }}>Tốc độ giải Toán</h4>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#4A148C' }}>{advancedStats.mathSpeed}s</div>
                <div style={{ fontSize: '0.9rem', color: '#8E24AA' }}>Trung bình mỗi câu</div>
              </div>
              <div style={{ background: '#F1F8E9', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #4CAF50' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#2E7D32' }}>Đọc thành tiếng</h4>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1B5E20' }}>{advancedStats.avgReadingAccuracy}% <span style={{ fontSize: '1rem', color: '#388E3C' }}>({advancedStats.avgReadingWpm} WPM)</span></div>
                <div style={{ fontSize: '0.9rem', color: '#4CAF50' }}>Dựa trên {advancedStats.readingSessions} bài đọc</div>
              </div>
              <div style={{ background: '#FFF3E0', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #FF9800' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#E65100' }}>Ngữ pháp Tiếng Việt</h4>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#BF360C' }}>{advancedStats.grammarAccuracy}%</div>
                <div style={{ fontSize: '0.9rem', color: '#FF9800' }}>Dựa trên {advancedStats.grammarTotal} câu hỏi</div>
              </div>
            </div>
          )}

          {analyticsData.chartData.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#888', background: '#F5F5F5', borderRadius: '8px' }}>
              Không có dữ liệu biểu đồ cho khoảng thời gian này.
            </div>
          ) : (
            <div style={{ height: '350px', width: '100%', marginTop: '20px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                  <Legend />
                  <Bar dataKey="math" name="Toán Học" fill="#2196F3" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="reading" name="Tiếng Việt (Đọc)" fill="#4CAF50" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ background: '#FFF3E0', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #FF9800' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#E65100' }}>Can thiệp Giáo dục AI 🤖</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', background: '#FFF', borderRadius: '8px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <strong>Chế độ Cân bằng học tập mềm</strong>
                <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.9rem' }}>Hệ thống gợi ý module chưa học và có thể giảm thưởng khi một module được lặp quá nhiều. Hệ thống không tự động khóa môn bé yêu thích.</p>
              </div>
              <button 
                onClick={toggleIntervention}
                style={{ backgroundColor: autoIntervention ? '#4CAF50' : '#888', padding: '10px 20px', fontSize: '1.1rem' }}
              >
                {autoIntervention ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'history' && (
        <div style={{ background: '#FFF', padding: '20px', borderRadius: '10px', border: '1px solid #CCC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, color: '#1976D2' }}>Lịch sử làm bài chi tiết của {childName}</h3>
            <select 
              value={historyFilter} 
              onChange={(e) => setHistoryFilter(e.target.value)}
              style={{ padding: '8px', fontSize: '1rem', borderRadius: '5px', border: '2px solid #1976D2' }}
            >
              <option value="all">Tất cả thời gian</option>
              <option value="today">Hôm nay</option>
              <option value="yesterday">Hôm qua</option>
              <option value="3days">3 ngày qua</option>
              <option value="7days">7 ngày qua</option>
              <option value="month">1 tháng qua</option>
            </select>
          </div>
          
          {(() => {
            const allStats = JSON.parse(localStorage.getItem(`learningStats_${selectedChild}`) || '[]');
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
            const startOf3Days = new Date(startOfToday.getTime() - 3 * 24 * 60 * 60 * 1000);
            const startOf7Days = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
            const startOf30Days = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

            const filteredStats = allStats.filter(stat => {
              const d = parseDate(stat.date) || new Date(stat.date);
              if (!d) return true;
              if (historyFilter === 'today') return d >= startOfToday;
              if (historyFilter === 'yesterday') return d >= startOfYesterday && d < startOfToday;
              if (historyFilter === '3days') return d >= startOf3Days;
              if (historyFilter === '7days') return d >= startOf7Days;
              if (historyFilter === 'month') return d >= startOf30Days;
              return true; // all
            });

            if (filteredStats.length === 0) {
              return <p style={{ color: '#888' }}>Không có bài làm nào trong khoảng thời gian này.</p>;
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {filteredStats.map((stat, idx) => (
                  <div key={idx} style={{ background: '#F5F5F5', padding: '15px', borderRadius: '8px', borderLeft: `5px solid ${stat.subject === 'math' ? '#FF9800' : '#4CAF50'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <strong>{stat.subject === 'math' ? '🧮 Toán' : '📚 Tiếng Việt'} ({new Date(stat.date).toLocaleString('vi-VN')})</strong>
                      <span style={{ color: '#E65100', fontWeight: 'bold' }}>+{stat.points || 0} 💎</span>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <span>Đúng: <strong style={{ color: '#4CAF50' }}>{stat.correct}</strong></span> | 
                      <span> Sai: <strong style={{ color: '#F44336' }}>{stat.incorrect}</strong></span> | 
                      <span> Thời gian: {stat.timeSpentSec}s</span>
                    </div>
                    
                    {stat.wrongDetails && stat.wrongDetails.length > 0 && (
                      <details style={{ background: '#FFF', padding: '10px', borderRadius: '5px', border: '1px solid #E0E0E0' }}>
                        <summary style={{ cursor: 'pointer', color: '#D32F2F', fontWeight: 'bold' }}>Xem chi tiết câu sai ({stat.wrongDetails.length})</summary>
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {stat.wrongDetails.map((w, widx) => (
                            <div key={widx} style={{ padding: '8px', background: '#FFEBEE', borderRadius: '5px' }}>
                              <div style={{ marginBottom: '5px' }}><strong>Hỏi:</strong> {w.q}</div>
                              {w.svg && <div dangerouslySetInnerHTML={{ __html: w.svg }} />}
                              <div><strong>Bé chọn:</strong> <span style={{ color: '#D32F2F' }}>{w.userAns}</span></div>
                              <div><strong>Đáp án:</strong> <span style={{ color: '#388E3C' }}>{w.correctAns}</span></div>
                              {w.skill && <div><strong>Kỹ năng:</strong> {w.skill}</div>}
                              {w.explanation && <div style={{ color: '#555', marginTop: '4px' }}>{w.explanation}</div>}
                              {w.advice && <div style={{ marginTop: '6px', color: '#5D4037', background: '#FFF8E1', padding: '6px', borderRadius: '5px' }}><strong>Cách sửa:</strong> {w.advice}</div>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
