# HỆ THỐNG HỌC TẬP THÔNG MINH CHO TRẺ EM (Kids Learning App)
## BẢN LƯU TRỮ KIẾN TRÚC & CHỨC NĂNG (Memory Bank)

### 1. Tổng quan Dự án
- **Mục tiêu:** Tạo ra một môi trường học tập trên máy tính/điện thoại chỉ dành riêng cho mục đích học Toán và Tiếng Việt. Giúp hạn chế việc trẻ chơi game, thay vào đó học tập để kiếm "Kim cương" và đổi lấy phần thưởng từ Phụ huynh.
- **Đối tượng:** Trẻ em (Lớp 1 và Lớp 3).
- **Mô hình triển khai:** LAN Client-Server (chạy tại nhà) hoặc kết nối qua Cloudflare Tunnel để học ở mọi nơi.

### 2. Kiến trúc Công nghệ
- **Frontend:** React + Vite (Port 3000). 
  - Routing: `react-router-dom`.
  - State/Lưu trữ: Sử dụng `localStorage` để lưu trữ tiến độ Offline, kết hợp với cơ chế Đồng bộ (`sync.js`) lên Server.
  - Giao diện: Responsive cho Desktop và Mobile (CSS Flexbox/Grid). Thiết kế thân thiện, màu sắc bắt mắt.
- **Backend:** Python + FastAPI (Port 8000).
  - Nhiệm vụ: Xử lý file, nhận diện giọng nói, lưu trữ tập trung dữ liệu vào file `.json` hoặc database.
- **Kết nối Mạng:** 
  - `vite.config.js` sử dụng `proxy` chuyển tiếp request `/api` sang backend `localhost:8000`.
  - Hỗ trợ Cloudflare Tunnel (`allowedHosts: true`) để cho phép tên miền bên ngoài (ví dụ: `study.vuminh90.click`) truy cập vào mạng cục bộ, giữ nguyên chứng chỉ HTTPS giúp tính năng Microphone hoạt động bình thường trên các trình duyệt bảo mật cao.

### 3. Cấu trúc Thư mục Chính
- `frontend/`: Toàn bộ mã nguồn giao diện
  - `src/components/`:
    - `StudentDashboard.jsx`: Màn hình chính của học sinh.
    - `GameArea.jsx`: Khu vực học Toán (Sinh câu hỏi tự động, chấm điểm, phần thưởng).
    - `ReadingTest.jsx`: Khu vực học Tiếng Việt (Tập đọc chữ/từ, chấm điểm dựa trên tự đánh giá hoặc AI Voice).
    - `RewardShop.jsx`: Cửa hàng đổi thưởng (Sử dụng kim cương để đổi quà).
    - `AdminDashboard.jsx`: Màn hình Quản lý dành cho Phụ huynh.
- `backend/`: Mã nguồn máy chủ (FastAPI).

### 4. Các tính năng cốt lõi

#### 4.1. Dành cho Học sinh (Student Interface)
- **Học Toán:** 
  - Lớp 1: Phép toán cộng trừ trong phạm vi 20, KHÔNG có nhớ/mượn.
  - Lớp 3: Toán đại số phức tạp hơn, bảng cửu chương.
  - Tự động sinh vô hạn câu hỏi. Chế độ tính giờ lùi (Time Pressure). Hết giờ tự động nộp bài và cảnh báo.
- **Học Tiếng Việt:**
  - Lớp 1: Đọc bảng chữ cái in thường (a, b, c) và từ ghép đơn giản. Hiển thị 10 chữ cùng lúc để bé đọc liên tục.
  - Tự động sinh câu ngẫu nhiên để tránh học vẹt.
- **Hệ thống Phần thưởng (Gamification):**
  - Trả lời đúng được Kim cương (💎). Tốc độ nhanh được thưởng thêm điểm.
  - Có vòng quay may mắn (Gacha) tiêu hao Kim cương.

#### 4.2. Dành cho Phụ huynh (Admin / Parent Dashboard)
- **Quản lý Năng lực học tập (Analytics):**
  - Thống kê Tỷ lệ chính xác, Số câu đã làm, Tốc độ làm bài.
  - **AI Trợ lý:** Phân tích dữ liệu học tập và đưa ra nhận xét/đề xuất tự động.
  - **Lọc lịch sử:** Xem lịch sử làm bài chi tiết theo thời gian (Hôm nay, Hôm qua, 7 ngày, 1 tháng...). Xem lại những câu bé làm sai để ôn tập.
- **Kiểm soát Nền kinh tế:**
  - Điều chỉnh giá tiền của Vòng quay may mắn.
  - Thay đổi phần thưởng và Tỷ lệ trúng thưởng (%).
  - Cộng/Trừ kim cương thủ công (Kèm ghi chú).
- **Can thiệp Giáo dục (Interventions):**
  - **Chống học lệch:** Hệ thống tự động khóa môn học mà bé chơi quá nhiều, hoặc giảm thưởng 50%, ép bé phải học bù môn yếu hơn. Phụ huynh có thể Bật/Tắt tính năng này.

### 5. Ghi chú & Lịch sử Cập nhật Quan trọng
- **Fix lỗi Gray Screen Timeout:** Xử lý lỗi sập giao diện khi hết giờ do thiếu mảng truyền `wrongAnswers` vào hệ thống đánh giá.
- **Mobile Responsive:** Đã điều chỉnh CSS và Layout toàn bộ các trang (Admin, GameArea, Reading, Shop, Dashboard) để hiển thị mượt mà thành 1 cột trên giao diện Điện thoại/Tablet, tránh lỗi hiển thị lệch nội dung.
- **Bypass SSL cho Cloudflare:** Tắt `basicSsl` trong Vite, bổ sung `allowedHosts: true` để cho phép chạy qua Tunnel mà không bị chặn, giải quyết bài toán Microphone trên iOS thông qua chứng chỉ HTTPS công cộng.
