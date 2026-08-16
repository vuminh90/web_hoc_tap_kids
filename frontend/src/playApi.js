const studentHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Student': localStorage.getItem('currentUser') || 'vuanhduc'
});

const parseResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Không thể kết nối máy chủ.');
  return data;
};

export const getPlayWallet = () => fetch('/api/play/wallet', { headers: studentHeaders() }).then(parseResponse);
export const getGameSites = () => fetch('/api/play/sites', { headers: studentHeaders() }).then(parseResponse);
export const addPlayReward = (minutes, rewardName) => fetch('/api/play/reward', {
  method: 'POST', headers: studentHeaders(), body: JSON.stringify({ minutes, reward_name: rewardName })
}).then(parseResponse);
export const startPlaySession = (siteId) => fetch('/api/play/sessions/start', {
  method: 'POST', headers: studentHeaders(), body: JSON.stringify({ site_id: siteId })
}).then(parseResponse);
export const stopPlaySession = () => fetch('/api/play/sessions/stop', { method: 'POST', headers: studentHeaders() }).then(parseResponse);

export const formatPlayTime = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
};

export const getPlayMinutesFromReward = (reward) => {
  if (reward?.type === 'play_time') return Math.max(0, Number(reward.value) || 0);
  const match = String(reward?.name || '').match(/(\d+)\s*(?:phút|phut)\s*(?:chơi|choi)\s*game/i);
  return match ? Number(match[1]) : 0;
};
