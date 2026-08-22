# Quy tắc cập nhật chương trình trên NUC

Đây là quy trình chuẩn phải ưu tiên khi hướng dẫn cập nhật bản mới trên NUC.

## Lệnh cập nhật chuẩn

```bash
cd /home/nuc/web_hoc_tap_kids

cp backend/data_store.json /home/nuc/data_store.before-update.json
cp backend/learning_app.db /home/nuc/learning_app.before-update.db

git pull --ff-only origin main

docker compose up -d --build
```

Kiểm tra sau cập nhật:

```bash
docker compose ps
```

Sau đó tải lại trang bằng `Ctrl + Shift + R` hoặc đăng xuất rồi đăng nhập lại.

## Quy tắc bắt buộc

1. Luôn dùng đúng thư mục `/home/nuc/web_hoc_tap_kids`.
2. Luôn sao lưu cả `backend/data_store.json` và `backend/learning_app.db` trước khi pull.
3. Luôn pull từ `main` bằng `git pull --ff-only origin main`.
4. Dùng `docker compose up -d --build`; không cần chạy `docker compose down` trong quy trình thông thường.
5. Không xóa hoặc ghi đè database.
6. Không dùng `git reset --hard`.
7. Không hướng dẫn thêm các bước phức tạp nếu quy trình chuẩn chạy thành công.
8. Chỉ mở rộng chẩn đoán khi một trong các lệnh chuẩn báo lỗi.

## Khi lệnh chuẩn báo lỗi

Không tự động sửa hoặc xóa dữ liệu. Giữ nguyên thông báo lỗi và kiểm tra lần lượt:

```bash
cd /home/nuc/web_hoc_tap_kids
git status
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```

Gửi nguyên kết quả các lệnh trên để phân tích trước khi thực hiện thao tác tiếp theo.

## Phạm vi

Quy trình này áp dụng cho việc cập nhật phiên bản đã được merge vào nhánh `main`. Nếu thay đổi chưa có trên `main`, phải merge và kiểm thử trước; không pull trực tiếp nhánh tính năng trên NUC.
