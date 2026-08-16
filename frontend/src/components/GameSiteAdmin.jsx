import { useEffect, useState } from 'react';
import { formatPlayTime } from '../playApi';

const newSite = () => ({ id: `site-${Date.now()}`, name: '', url: '', description: '', thumbnail_url: '', open_mode: 'kiosk', enabled: true, allowed_for: ['vuanhduc', 'vuanhthu'] });
const parentHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('parentAuthToken')}` });
const apiError = (status, data, action) => {
  if (status === 401) return 'Phiên bố mẹ đã hết hạn. Hãy đăng xuất rồi đăng nhập lại.';
  if (status === 404) return 'Backend chưa nạp tính năng Khu vui chơi. Hãy khởi động lại máy chủ.';
  return data?.detail || `${action} (lỗi ${status}).`;
};

export default function GameSiteAdmin({ selectedChild }) {
  const [sites, setSites] = useState([]);
  const [wallets, setWallets] = useState({});
  const [minutes, setMinutes] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    try {
      const response = await fetch('/api/parent/play', { headers: parentHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(apiError(response.status, data, 'Không thể tải dữ liệu'));
      setSites(data.sites || []); setWallets(data.wallets || {}); setMessage('');
    } catch { setMessage('Không kết nối được backend. Hãy kiểm tra máy chủ cổng 8000.'); }
  };
  useEffect(() => { load(); }, []);
  const update = (index, field, value) => setSites(all => all.map((site, i) => i === index ? { ...site, [field]: value } : site));
  const toggleChild = (index, username) => setSites(all => all.map((site, i) => {
    if (i !== index) return site;
    const allowed = site.allowed_for || [];
    return { ...site, allowed_for: allowed.includes(username) ? allowed.filter(value => value !== username) : [...allowed, username] };
  }));
  const save = async () => {
    const completedSites = sites.filter(site => site.name.trim() || site.url.trim());
    const incompleteSite = completedSites.find(site => !site.name.trim() || !site.url.trim());
    if (incompleteSite) {
      return setMessage('Mỗi website cần có đủ Tên trò chơi và URL. Có thể bấm Xóa nếu không muốn lưu dòng này.');
    }
    try {
      const response = await fetch('/api/parent/play/sites', { method: 'PUT', headers: parentHeaders(), body: JSON.stringify(completedSites) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(apiError(response.status, data, 'Không thể lưu danh sách'));
      setSites(data); setMessage('Đã lưu danh sách website trò chơi.');
    } catch { setMessage('Không kết nối được backend. Hãy kiểm tra máy chủ cổng 8000.'); }
  };
  const adjust = async () => {
    const value = Number(minutes);
    if (!Number.isInteger(value) || value === 0) return setMessage('Hãy nhập số phút hợp lệ, ví dụ 10 hoặc -5.');
    try {
      const response = await fetch('/api/parent/play/adjust', { method: 'POST', headers: parentHeaders(), body: JSON.stringify({ username: selectedChild, minutes: value, note: 'Phụ huynh điều chỉnh' }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(apiError(response.status, data, 'Không thể điều chỉnh thời gian'));
      setWallets(all => ({ ...all, [selectedChild]: data })); setMinutes(''); setMessage(`Đã cập nhật. Thời gian còn lại: ${formatPlayTime(data.balanceSeconds)}.`);
    } catch { setMessage('Không kết nối được backend. Hãy kiểm tra máy chủ cổng 8000.'); }
  };
  return <section className="game-admin-panel">
    <h3>🎮 Quản lý website trò chơi</h3>
    <div className="play-wallet-admin"><strong>{selectedChild === 'vuanhduc' ? 'Anh Đức' : 'Anh Thư'}: {formatPlayTime(wallets[selectedChild]?.balanceSeconds || 0)}</strong><input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="+10 hoặc -5 phút" /><button onClick={adjust}>Điều chỉnh</button></div>
    <p className="admin-help">Website đang bật sẽ xuất hiện trong Khu vui chơi và cần cho phép nhúng bằng iframe.</p>
    {sites.map((site, index) => <div className="game-site-editor" key={site.id}>
      <div className="game-site-editor-main"><input value={site.name} onChange={e => update(index, 'name', e.target.value)} placeholder="Tên trò chơi" /><input value={site.url} onChange={e => update(index, 'url', e.target.value)} placeholder="https://website-game.com" /><input value={site.description} onChange={e => update(index, 'description', e.target.value)} placeholder="Mô tả ngắn" /><input value={site.thumbnail_url} onChange={e => update(index, 'thumbnail_url', e.target.value)} placeholder="URL ảnh đại diện (không bắt buộc)" /></div>
      <div className="game-site-editor-options"><select value={site.open_mode === 'iframe' ? 'iframe' : 'kiosk'} onChange={e => update(index, 'open_mode', e.target.value)}><option value="kiosk">Cùng cửa sổ kiosk (khuyến nghị)</option><option value="iframe">Nhúng trong ứng dụng</option></select><label><input type="checkbox" checked={site.enabled} onChange={e => update(index, 'enabled', e.target.checked)} /> Hiển thị</label><label><input type="checkbox" checked={(site.allowed_for || []).includes('vuanhduc')} onChange={() => toggleChild(index, 'vuanhduc')} /> Anh Đức</label><label><input type="checkbox" checked={(site.allowed_for || []).includes('vuanhthu')} onChange={() => toggleChild(index, 'vuanhthu')} /> Anh Thư</label><button className="danger-button" onClick={() => setSites(all => all.filter((_, i) => i !== index))}>Xóa</button></div>
    </div>)}
    <div className="game-admin-actions"><button onClick={() => setSites(all => [...all, newSite()])}>＋ Thêm website</button><button className="save-button" onClick={save}>💾 Lưu danh sách game</button></div>
    {message && <p className="admin-message">{message}</p>}
  </section>;
}
