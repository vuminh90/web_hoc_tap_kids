import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import './index.css';
import StudentDashboard from './components/StudentDashboard';
import GameArea from './components/GameArea';
import ReadingTest from './components/ReadingTest';
import RewardShop from './components/RewardShop';
import AdminDashboard from './components/AdminDashboard';
import PlayZone from './components/PlayZone';
import PlaySession from './components/PlaySession';
import PlayLocked from './components/PlayLocked';

import { pullFromServer } from './sync';

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const loginAs = async (username) => {
    setLoading(true);
    await pullFromServer(username);
    localStorage.setItem('currentUser', username);
    setLoading(false);
    navigate('/student');
  };

  return (
    <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1>🚀 Chào mừng đến Lớp Học Vui Nhộn!</h1>
      <p>Bé hãy chọn tài khoản của mình nhé:</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
        <button disabled={loading} onClick={() => loginAs('vuanhduc')}>{loading ? 'Đang tải...' : 'Anh Đức (Lớp 4)'}</button>
        <button disabled={loading} onClick={() => loginAs('vuanhthu')}>{loading ? 'Đang tải...' : 'Anh Thư (Lớp 1)'}</button>
      </div>
      <div style={{ marginTop: '30px' }}>
        <button style={{ backgroundColor: '#aaa', boxShadow: '0 6px 0 #888' }} onClick={() => navigate('/admin')}>Khu vực Bố Mẹ</button>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('kiosk') === '1') {
      localStorage.setItem('kidsKioskMode', 'true');
    }
  }, []);
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/math" element={<GameArea />} />
        <Route path="/play" element={<PlayZone />} />
        <Route path="/play/session/:siteId" element={<PlaySession />} />
        <Route path="/play/locked" element={<PlayLocked />} />
        <Route path="/read" element={<ReadingTest />} />
        <Route path="/shop" element={<RewardShop />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
