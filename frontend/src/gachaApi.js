const parseResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Không thể tải cấu hình vòng quay.');
  return data;
};

const parentHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${sessionStorage.getItem('parentAuthToken')}`
});

export const getGachaSettings = () => fetch('/api/gacha/settings').then(parseResponse);

export const getParentGachaSettings = () => fetch('/api/parent/gacha', {
  headers: parentHeaders()
}).then(parseResponse);

export const saveParentGachaSettings = (settings) => fetch('/api/parent/gacha', {
  method: 'PUT',
  headers: parentHeaders(),
  body: JSON.stringify(settings)
}).then(parseResponse);
