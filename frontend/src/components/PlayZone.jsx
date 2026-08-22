import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPlayTime, getGameSites, getPlayWallet, startPlaySession } from '../playApi';

export default function PlayZone() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [loadingSite, setLoadingSite] = useState('');
  const username = localStorage.getItem('currentUser') || 'vuanhduc';
  const kioskMode = localStorage.getItem('kidsKioskMode') === 'true';
  const childName = username === 'vuanhduc' ? 'Anh Đức' : 'Anh Thư';

  useEffect(() => {
    Promise.all([getPlayWallet(), getGameSites()]).then(([walletData, siteData]) => {
      setWallet(walletData);
      setSites(siteData);
      if (walletData.session?.status === 'active') {
        const activeSite = siteData.find(site => site.id === walletData.session.site_id);
        if (activeSite && kioskMode) window.location.replace(activeSite.url);
        else if (activeSite?.open_mode === 'iframe') navigate(`/play/session/${activeSite.id}`, { replace: true });
      }
    }).catch(err => setError(err.message));
  }, [navigate]);

  const play = async (site) => {
    setLoadingSite(site.id);
    setError('');
    const useIframe = !kioskMode && site.open_mode === 'iframe';
    if (!useIframe && !kioskMode) {
      setLoadingSite('');
      return setError('Website này cần chế độ kiosk. Hãy mở ứng dụng bằng start_kiosk.bat.');
    }
    try {
      await startPlaySession(site.id);
      if (useIframe) navigate(`/play/session/${site.id}`);
      else window.location.assign(site.url);
    } catch (err) {
      setError(err.message);
      setLoadingSite('');
    }
  };

  return <div className="card play-zone">
    <div className="play-zone-header"><button className="secondary-button" onClick={() => navigate('/student')}>← Khu học tập</button><div><h2>🎮 Khu vui chơi của {childName}</h2><div className={`play-balance ${(wallet?.balanceSeconds || 0) <= 0 ? 'empty' : ''}`}>⏱ Thời gian còn lại: <strong>{formatPlayTime(wallet?.balanceSeconds || 0)}</strong></div></div></div>
    {error && <p className="play-error">{error}</p>}
    {!wallet ? <p>Đang tải khu vui chơi...</p> : wallet.balanceSeconds <= 0 ? <div className="play-empty"><div className="play-empty-icon">🔒</div><h3>Bé chưa có thời gian chơi</h3><p>Hãy dùng kim cương ở cửa hàng đổi thưởng để nhận thêm thời gian nhé.</p><button onClick={() => navigate('/shop')}>🎁 Đến Đổi thưởng</button></div> : sites.length === 0 ? <div className="play-empty"><h3>Chưa có trang game nào</h3><p>Bố mẹ hãy thêm website game trong trang quản lý.</p></div> : <><h3 className="play-section-title">Chọn trò chơi</h3><div className="game-site-grid">{sites.map(site => <article className="game-site-card" key={site.id}><div className="game-site-image" style={site.thumbnail_url ? { backgroundImage: `url(${site.thumbnail_url})` } : {}}>{!site.thumbnail_url && <span>🕹️</span>}</div><div className="game-site-info"><h3>{site.name}</h3><p>{site.description || 'Trang trò chơi được bố mẹ cho phép.'}</p><button disabled={loadingSite === site.id} onClick={() => play(site)}>{loadingSite === site.id ? 'Đang mở...' : 'Chơi ngay'}</button></div></article>)}</div></>}
  </div>;
}
