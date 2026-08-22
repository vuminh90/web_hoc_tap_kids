# Hệ thống level theo module

Tài liệu này mô tả thiết kế, dữ liệu, thuật toán và quy trình nâng cấp hệ thống level của ứng dụng học tập. Đây là nguồn tham chiếu chính khi sửa cơ chế phân loại trình độ.

## 1. Mục tiêu

Hệ thống cần đồng thời:

1. Phân loại đúng trình độ của từng bé theo từng kỹ năng.
2. Tạo các bước tiến nhỏ để tránh bài học đột ngột quá khó.
3. Rèn cả độ chính xác, tư duy logic và tốc độ.
4. Không đánh đồng tốc độ với năng lực ở các bài đọc và viết.
5. Lưu dữ liệu tập trung trong SQLite, đồng thời tiếp tục hỗ trợ học offline bằng `localStorage`.

## 2. Nguyên tắc bắt buộc

- Mỗi module có level độc lập.
- Anh Thư dùng thang 1–20 cho mọi module.
- Anh Đức dùng thang 1–50 cho mọi module.
- Mỗi lần chỉ tăng hoặc giảm một level.
- Không tăng level chỉ từ một lượt làm tốt.
- Chỉ đánh giá tốc độ sau khi đã đánh giá độ chính xác.
- Không trừ điểm và không chặn tăng level vì một câu được trả lời dưới 3 giây; tốc độ chỉ được đánh giá bằng tổng thời gian của cả lượt học.
- Tập làm văn không có thời gian khóa cứng.
- Khi nội dung chuyển sang chặng khó hơn, thời gian phải được nới lại.

## 3. Danh sách module

### Anh Thư – Lớp 1

| Môn | ID database | Tên hiển thị | Level tối đa |
|---|---|---|---:|
| Toán | `basic_math` | Cộng trừ | 20 |
| Toán | `visual_math` | Đếm hình | 20 |
| Tiếng Việt | `prep_passage` | Đọc đoạn văn | 20 |
| Tiếng Việt | `prep_riddle` | Đố vui | 20 |

### Anh Đức – Lớp 4

| Môn | ID database | Tên hiển thị | Level tối đa |
|---|---|---|---:|
| Toán | `algebra` | Số và phép tính | 50 |
| Toán | `geometry` | Hình học | 50 |
| Toán | `logic` | Toán có lời văn | 50 |
| Toán | `all` | Toán tổng hợp | 50 |
| Tiếng Việt | `grammar` | Luyện từ và câu | 50 |
| Tiếng Việt | `writing` | Tập làm văn | 50 |
| Tiếng Việt | `reading` | Đọc hiểu | 50 |

Không được thêm module chỉ ở giao diện. Khi thêm module mới phải cập nhật cả cấu hình frontend và cấu hình migration backend.

## 4. Chu kỳ level

### Anh Thư

20 level được chia thành 5 chặng, mỗi chặng 4 level:

1. Làm quen – hệ số thời gian 1,15.
2. Luyện đúng – hệ số 1,00.
3. Luyện nhanh – hệ số 0,90.
4. Làm chủ – hệ số 0,85.

Độ khó nội dung được giữ ổn định trong 4 level. Khi bước sang chặng kế tiếp, nội dung tăng độ khó và thời gian quay lại pha làm quen.

### Anh Đức

50 level được chia thành 10 chặng, mỗi chặng 5 level:

1. Khám phá – hệ số thời gian 1,15.
2. Luyện đúng – hệ số 1,00.
3. Luyện nhanh – hệ số 0,90.
4. Vận dụng – hệ số 1,05.
5. Làm chủ – hệ số 0,87.

Pha Vận dụng có thời gian rộng hơn Luyện nhanh vì cách hỏi có thể thay đổi hoặc đòi hỏi thêm suy luận.

## 5. Quy đổi level hiển thị sang độ khó nội dung

Level hiển thị và `contentLevel` là hai khái niệm khác nhau:

- Level hiển thị là tiến độ 1–20 hoặc 1–50.
- `contentLevel` là thang mà bộ sinh bài cũ đang hiểu, ví dụ 1–8, 1–10, 1–20 hoặc 1–100.

Hàm `getModuleContentLevel()` quy đổi theo chặng, không quy đổi tuyến tính từng level. Vì vậy các level trong cùng một chu kỳ dùng chung độ khó nội dung và chỉ thay đổi nhịp thời gian.

Ví dụ Anh Thư:

- Level 1–4 cùng một chặng nội dung.
- Level 5 bắt đầu chặng nội dung tiếp theo.
- Level 5 được nới thời gian dù nội dung khó hơn level 4.

Không truyền trực tiếp level 50 vào bộ sinh nội dung chỉ hỗ trợ 10 cấp. Luôn đi qua `getModuleContentLevel()`.

## 6. Công thức thời gian

Với bài trắc nghiệm:

```text
targetSeconds = secondsPerItem
              × itemCount
              × complexityMultiplier
              × phaseMultiplier
```

Trong đó:

```text
complexityMultiplier = 1 + (band - 1) × complexityGrowth
```

- `secondsPerItem`: thời gian cơ sở của module.
- `itemCount`: số câu thực tế.
- `band`: chặng nội dung hiện tại.
- `complexityGrowth`: phần thời gian cộng thêm khi nội dung phức tạp hơn.
- `phaseMultiplier`: hệ số làm quen/luyện đúng/luyện nhanh/vận dụng/làm chủ.

Tham số hiện tại nằm trong `frontend/src/learningLevels.js`.

### Đọc thành tiếng và đọc hiểu

Thời gian đọc được tính theo:

```text
thời gian đọc văn bản theo số từ
+ thời gian trả lời câu hỏi
× hệ số pha level
```

Kết quả phân loại kết hợp độ chính xác, độ trôi chảy, tốc độ đọc và điểm đọc hiểu. Không tăng level nếu chỉ đọc nhanh nhưng sai.

### Tập làm văn

`assessmentMode = soft-time`. Thời gian được ghi vào lịch sử để phụ huynh theo dõi nhưng không khóa bài và không bắt buộc để tăng level. Việc phân loại dựa trên rubric bài viết.

## 7. Thuật toán thích nghi

Mỗi lượt tạo một kết quả chuẩn hóa:

```json
{
  "level": 10,
  "accuracy": 90,
  "timeRatio": 0.88,
  "timeMet": true,
  "mastered": true,
  "proficient": true,
  "weak": false,
  "at": "ISO-8601"
}
```

Định nghĩa:

- `mastered`: hợp lệ, chính xác từ 90% và đạt thời gian.
- `proficient`: hợp lệ và chính xác từ 80%.
- `weak`: hợp lệ và chính xác dưới 60%.
- `timeRatio`: thời gian thực tế chia thời gian mục tiêu; nhỏ hơn hoặc bằng 1 là đạt.

Quy tắc:

1. Tăng một level nếu lượt hiện tại đạt chuẩn và có ít nhất 2 lượt `mastered` trong 3 lượt gần nhất tại cùng level.
2. Giảm một level nếu hai lượt liên tiếp đều `weak`.
3. Đúng từ 90% nhưng quá thời gian: giữ level và chuyển trạng thái `train_speed`.
4. Đúng từ 80%: giữ level để tăng ổn định nếu chưa đủ hai lượt đạt chuẩn.
5. Dưới 60% lần đầu: giữ level và tăng hỗ trợ.
6. Khi level thay đổi, cửa sổ kết quả tại level cũ được xóa.

## 8. Dữ liệu lưu trữ

Nguồn dữ liệu trung tâm là bảng `app_state` trong `backend/learning_app.db`. Giá trị key `main` chứa JSON toàn ứng dụng.

Dữ liệu mỗi học sinh có dạng:

```json
{
  "mathDifficultyLevels": {
    "algebra": 7,
    "geometry": 3,
    "logic": 5,
    "all": 4
  },
  "vietnameseModuleLevels": {
    "grammar": 2,
    "writing": 1,
    "reading": 3
  },
  "learningLevelProgress": {
    "math:algebra": {
      "level": 7,
      "recentResults": [],
      "lastDecision": "hold",
      "lastAccuracy": 80,
      "lastTimeRatio": 1.04,
      "masteryCount": 0,
      "updatedAt": "ISO-8601"
    }
  },
  "learningLevelSchemaVersion": 4
}
```

`mathLevel`, `vietLevel` và `mathTimeLevels` là trường tương thích dữ liệu cũ. Không dùng chúng để xác định level hiện tại trong tính năng mới.

## 9. Đồng bộ và migration

Frontend tiếp tục dùng `localStorage` để hỗ trợ offline. Các key mới đã được thêm vào `sync.js`:

- `learningLevelProgress`
- `learningLevelSchemaVersion`

Khi gọi `GET /api/sync/{username}`, backend chạy `ensure_learning_level_data()`:

1. Đọc level tổng cũ làm giá trị dự phòng.
2. Giữ nguyên level riêng đã tồn tại.
3. Bổ sung module còn thiếu.
4. Giới hạn level trong 1–20 hoặc 1–50.
5. Khởi tạo tiến độ thích nghi nếu chưa có.
6. Ghi schema level version 4 vào database.

Schema 4 là mốc reset level về 1. Backend bỏ qua các trường level từ thiết bị vẫn mang schema cũ, nhờ đó một trang đang mở trước thời điểm reset không thể ghi level cũ trở lại database. Thiết bị chỉ cần tải lại hoặc đăng nhập lại để nhận schema và level mới.

Endpoint phụ huynh `GET /api/parent/levels` trả về toàn bộ level của hai bé và yêu cầu token phụ huynh.

## 10. Ghi lịch sử làm bài

Các bản ghi mới dùng `schemaVersion: 3` và nên có:

- `difficultyLevel`
- `nextDifficultyLevel`
- `contentLevel`
- `levelDecision`
- `accuracyPercent`
- `targetTimeSec`
- `timeSpentSec`
- `timeRatio`
- `timeMet`
- `masteryCount`
- `validForAssessment`

Không xóa trường lịch sử cũ vì màn hình phân tích vẫn cần đọc được dữ liệu trước migration.

## 11. Khu vực phụ huynh

Tab **Level từng module** hiển thị:

- Level hiện tại và level tối đa.
- Thanh tiến độ.
- Chặng kiến thức.
- Pha hiện tại.
- Thời gian mục tiêu.
- Độ chính xác gần nhất.
- Số lượt đạt chuẩn trên hai lượt cần thiết.

Dữ liệu được kéo từ server sau khi phụ huynh đăng nhập, sau đó hiển thị từ bản sao local đã đồng bộ.

## 12. Các file quan trọng

- `frontend/src/learningLevels.js`: hồ sơ bé, module, chu kỳ, thời gian và quy đổi nội dung.
- `frontend/src/adaptiveLevel.js`: thuật toán tăng/giảm level và lưu cửa sổ đánh giá.
- `frontend/src/components/GameArea.jsx`: tích hợp Toán.
- `frontend/src/components/ReadingTest.jsx`: tích hợp Tiếng Việt.
- `frontend/src/components/AdminDashboard.jsx`: giao diện phụ huynh.
- `frontend/src/sync.js`: danh sách key đồng bộ.
- `backend/main.py`: migration, lưu SQLite và endpoint phụ huynh.
- `frontend/src/adaptiveLevel.test.js`: kiểm thử thuật toán.
- `backend/test_learning_levels.py`: kiểm thử migration.

## 13. Quy trình thêm module mới

1. Thêm module vào đúng hồ sơ trong `CHILD_LEVEL_PROFILES`.
2. Chọn `contentMax`, `secondsPerItem`, `complexityGrowth` và `assessmentMode`.
3. Thêm ID module vào `LEARNING_LEVEL_PROFILES` ở backend.
4. Tích hợp bộ sinh nội dung qua `getModuleContentLevel()`.
5. Khi kết thúc bài, gọi `evaluateAdaptiveLevel()`.
6. Lưu level vào đúng map môn học.
7. Gọi `saveAdaptiveProgress()` trước `syncToServer()`.
8. Thêm kiểm thử cho level tối đa, thời gian, tăng/giảm và migration.
9. Kiểm tra module xuất hiện đúng ở tab phụ huynh.
10. Cập nhật tài liệu này.

## 14. Hiệu chỉnh sau khi có dữ liệu thật

Không thay thời gian chỉ dựa trên cảm giác. Sau tối thiểu 20–30 lượt hợp lệ/module:

1. Lấy trung vị thời gian của các lượt có độ chính xác từ 80%.
2. So sánh với `targetSeconds`.
3. Nếu hơn 70% lượt đúng vẫn vượt thời gian, tăng `secondsPerItem` từ 5–10%.
4. Nếu hơn 80% lượt đạt thời gian quá dễ, giảm tối đa 5% mỗi lần.
5. Theo dõi riêng từng module; không dùng tốc độ cộng trừ để đặt thời gian cho toán có lời văn.
6. Không hạ thời gian tập làm văn thành giới hạn cứng.

## 15. Lệnh kiểm tra

Từ thư mục `frontend`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Từ thư mục `backend`:

```powershell
python -m unittest test_learning_levels.py
python -m py_compile main.py
```

Mọi thay đổi thuật toán level phải vượt các kiểm thử này trước khi sử dụng.
