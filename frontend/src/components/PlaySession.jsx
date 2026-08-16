import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatPlayTime, getGameSites, getPlayWallet, startPlaySession, stopPlaySession } from '../playApi';

export default function PlaySession() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([getGameSites(), startPlaySession(siteId)]).then(([sites, data]) => {
      if (!alive) return;
      const selected = sites.find(item => item.id === siteId);
      if (!selected) throw new Error('Trang game không còn được cho phép.');
      setSite(selected); setSeconds(data.balanceSeconds);
    }).catch(err => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [siteId]);

  useEffect(() => {
    if (!site) return undefined;
    const timer = setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    const heartbeat = setInterval(async () => {
      try {
        const data = await getPlayWallet();
        setSeconds(data.balanceSeconds);
        if (data.balanceSeconds <= 0 || !data.session) navigate('/play/locked', { replace: true });
      } catch { navigate('/play/locked', { replace: true }); }
    }, 10000);
    return () => { clearInterval(timer); clearInterval(heartbeat); };
  }, [site, navigate]);

  useEffect(() => { if (site && seconds <= 0) navigate('/play/locked', { replace: true }); }, [seconds, site, navigate]);
  const stop = async () => { try { await stopPlaySession(); } finally { navigate('/play', { replace: true }); } };

  if (error) return <div className="card play-empty"><h2>🔒 Không thể mở trò chơi</h2><p>{error}</p><button onClick={() => navigate('/play')}>Quay lại</button></div>;
  if (!site) return <div className="card"><p>Đang chuẩn bị trò chơi...</p></div>;
  return <div className="play-session-shell"><header className="play-session-bar"><strong>🎮 {site.name}</strong><span className={seconds <= 60 ? 'timer-danger' : ''}>⏱ {formatPlayTime(seconds)}</span><button onClick={stop}>Kết thúc</button></header>{site.open_mode === 'iframe' ? <iframe className="play-game-frame" src={site.url} title={site.name} allow="fullscreen; autoplay; gamepad" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock" /> : <div className="play-external-control"><h2>Website này cần chạy trong chế độ kiosk</h2><p>Hãy mở ứng dụng bằng start_kiosk.bat.</p></div>}</div>;
}
