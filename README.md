# 🏸 CầuLông Pro – Hệ thống Đặt lịch & Quản lý Sân Cầu lông Trực tuyến

> **Đồ án môn học – K22-CNTT B, Khoa Kỹ thuật – Công nghệ, Trường Đại học Hùng Vương (Phú Thọ)**
> Nhóm thực hiện: **Ngô Đình Hậu · Trần Hồng Đức · Đinh Thanh Hải · Nguyễn Đinh Xuân Dương · Nguyễn Bảo Long**

---

## 1. Kiến trúc thư mục

```text
├── backend/            # Server Node.js 24 + Express + Socket.IO + node:sqlite (TypeScript)
│   └── src/
│       ├── server.ts           # API chính, Auth, RBAC, Đặt sân, POS, Hợp đồng, Giải đấu, Webhook
│       ├── booking/pricing.ts  # Tính giá theo khung giờ thường / cao điểm / cuối tuần
│       └── tournament/         # Thuật toán Berger, Knockout, BWF 21 điểm, Ghép cặp cân bằng
├── web/                # Giao diện Web (Design System v2 teal+cam, responsive, dark mode)
│   ├── index.html      # Trang chính (Hero, Bản đồ, Sơ đồ sân, Quản trị, Giải đấu, Giao lưu)
│   ├── style.css       # Hệ thiết kế CSS biến màu, nút, thẻ, nhánh đấu, mobile-first
│   ├── app.js          # Logic cốt lõi (Auth, Đặt sân real-time, VietQR, POS, Kho, Báo cáo)
│   ├── extra.js        # Hợp đồng cố định, Tuyển giao lưu, Lưu giải, Cấu hình, Thông báo, Live
│   ├── invoice.html    # Hóa đơn in nhiệt / A5 cho thu ngân
│   └── live.html       # Màn hình bảng điểm trực tiếp BWF cho khán giả
├── scratch/            # Bộ kiểm thử E2E tự động (e2e.py, e2e2.py, e2e3.py)
├── db/                 # Schema PostgreSQL tham khảo (schema.sql)
├── docs/               # Tài liệu nghiệp vụ, ERD, Scrum backlog
├── Dockerfile & docker-compose.yml
└── DEPLOY.md           # Hướng dẫn triển khai Production, VietQR & Webhook ngân hàng
```

## 2. Chạy ứng dụng nhanh (SQLite – không cần cài DB rời)

```powershell
cd backend
npm install
node --experimental-strip-types src/server.ts
```

Mở trình duyệt tại: **http://localhost:4000**
- Màn hình khán giả trực tiếp: **http://localhost:4000/live.html**
- Hóa đơn in: **http://localhost:4000/invoice.html?code=MÃ_ĐƠN**

### Tài khoản demo được tạo sẵn
| Vai trò | Số điện thoại | Mật khẩu | Quyền hạn |
|---|---|---|---|
| **Chủ sân (`OWNER`)** | `0900000001` | `admin123` | Toàn quyền + Cấu hình giá/sân, Hợp đồng, Báo cáo, Nhật ký |
| **Quản lý (`MANAGER`)** | `0900000002` | `manager123` | Cấu hình, Hợp đồng, Nhập kho, Hủy đơn, Báo cáo, Lưu giải |
| **Thu ngân (`CASHIER`)** | `0900000003` | `cashier123` | Sơ đồ kéo-thả đổi lịch, Check-in, POS bán hàng, Chấm điểm live |
| **Hội viên (`PLAYER`)** | Tự đăng ký | `≥ 6 ký tự` | Đặt sân, Giữ chỗ VietQR, Hủy trước 2h, Đăng/tham gia giao lưu |

## 3. Tính năng đã hoàn thiện (5 Đợt)

| Hạng mục | Trạng thái |
|---|---|
| **Đợt 1 – Nền tảng & Bảo mật**: SQLite WAL bền vững, mã hóa mật khẩu `scrypt`, phiên đăng nhập, phân quyền RBAC 4 cấp, Rate Limit, Security Headers | ✅ Hoàn tất |
| **Đợt 2 – Đặt sân & Thanh toán**: Ma trận 6 sân × 34 slot (06:00–23:00), khóa nguyên tử chống trùng khi 30 người đặt cùng lúc, giữ chỗ 10 phút, VietQR động, tự nhả slot quá hạn | ✅ Hoàn tất |
| **Đợt 3 – Vận hành cụm sân**: Kéo-thả đổi sân/giờ tự tính chênh lệch, Hợp đồng khách cố định theo thứ trong tuần, POS bán nước/cầu/thuê vợt trừ kho tự động, Hóa đơn in, Xuất CSV (UTF-8 BOM), Tích điểm | ✅ Hoàn tất |
| **Đợt 4 – Cộng đồng & Giải đấu**: Bảng tin tuyển giao lưu vãng lai (tự chia tiền/người), Ghép cặp đôi cân bằng trình độ, Xếp lịch vòng tròn Berger, Nhánh đấu loại trực tiếp tương tác, Bảng điểm BWF 21 điểm | ✅ Hoàn tất |
| **Đợt 5 – Production & Giao diện v2**: Cấu hình động (số sân, giá thường/cao điểm, phụ thu cuối tuần, % cọc), Webhook ngân hàng HMAC-SHA256, Thông báo chuông + Web Notification + nhắc lịch, Giao diện Teal/Cam responsive + Dark Mode | ✅ Hoàn tất |

## 4. Kiểm thử tự động

Chạy kiểm thử thuật toán (Unit test):
```powershell
cd backend
npm test
npm run typecheck
```

Chạy 3 bộ kiểm thử tích hợp đầu-cuối (E2E – hơn 70 kịch bản API, đồng thời, phân quyền, webhook):
```powershell
# Khởi động lại server với DB sạch trước mỗi bộ test:
python scratch/e2e.py
python scratch/e2e2.py
python scratch/e2e3.py
```

Chi tiết triển khai Docker, cấu hình biến môi trường (`.env`) và kết nối Webhook ngân hàng thực tế: xem [DEPLOY.md](file:///c:/Users/0965.599.434/Downloads/Documents/%E1%BA%A0I%202026/DEPLOY.md).
