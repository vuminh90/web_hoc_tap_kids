import { useNavigate } from 'react-router-dom';

export default function PlayLocked() {
  const navigate = useNavigate();
  return <div className="card play-empty"><div className="play-empty-icon">🔒</div><h2>Đã hết giờ chơi</h2><p>Hẹn gặp lại lần sau! Bé có thể học để kiếm kim cương và đổi thêm thời gian.</p><button onClick={() => navigate('/student', { replace: true })}>Quay lại khu học tập</button></div>;
}
