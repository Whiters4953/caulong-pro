# CầuLông Pro – Smash Club

Hệ thống **Đặt lịch sân cầu lông trực tuyến, Quản lý vận hành cụm sân & Kết nối cộng đồng VĐV** (E-Booking, POS, Giải đấu BWF, Xếp hạng ELO & Trợ lý AI gợi ý lịch).

> **Đồ án / Bài thực hành – Nhóm 3 · K22-CNTT B**  
> Khoa Kỹ thuật – Công nghệ, Trường Đại học Hùng Vương (Phú Thọ)  
> **Thành viên:** Ngô Đình Hậu · Trần Hồng Đức · Đinh Thanh Hải · Nguyễn Đinh Xuân Dương · Nguyễn Bảo Long

---

## Tính năng nổi bật

### 1. Đặt sân thời gian thực & Đồng bộ hóa 2 chế độ
- **Quy chuẩn vận hành & giá sân:** 6 sân tiêu chuẩn BWF, mở cửa **06:00 – 22:00**, tự động tách đơn giá theo giờ lúc 17h (**Trước 17h: `60.000đ/giờ`** · **Từ 17h: `80.000đ/giờ`**).
- **Đồng bộ 2 bảng đặt lịch:** Bảng đặt lịch theo giờ tròn (chuẩn kiểm thử **T1–T5**) và Sơ đồ sân theo slot 30 phút dùng chung dữ liệu từ SQLite (`/api/state`) & Socket.IO.
- **Thao tác kéo thả trực quan:**
  - Nhấn giữ chuột (hoặc chạm) và kéo qua các ô trống để chọn nhiều giờ liên tiếp trên cùng sân.
  - Kéo thả ca đã đặt sang ô trống khác để đổi sân/đổi giờ và tự động tính lại chênh lệch tiền.
- **Khóa nguyên tử & Thanh toán VietQR:** Chống đặt trùng chồng lấn một phần và khi nhiều người đặt cùng lúc; giữ chỗ 10 phút kèm mã VietQR động đúng số tiền cọc.
- **Kiểm thử tự động T1–T5 & Bản 1 file thuần:** Hỗ trợ chạy nhanh bộ kịch bản T1–T5 trực tiếp trên web hoặc tại `/kiem-thu.html` (file độc lập chạy không cần Internet).

### 2. Cộng đồng cầu lông & Dịch vụ (Smash Club)
- **Tìm đối thủ & Thách đấu ELO (`/opponents.html`):** Tìm VĐV lân cận, gửi lời thách đấu (chặn tự thách đấu, chỉ đối thủ được mời mới có quyền chấp nhận/từ chối).
- **Lịch sử thi đấu BWF & Bảng xếp hạng (`/history.html`):** Lưu kết quả 3 set BWF 21 điểm và tự động cập nhật điểm ELO.
- **Huấn luyện viên (`/coaches.html`):** Tra cứu hồ sơ HLV, chứng chỉ, học phí 1 kèm 1 / nhóm và đặt lịch học.
- **CLB Giao lưu & Đan cước vợt (`/social.html`):** Đăng tin tìm người đánh giao lưu tự chia tiền đầu người, gia nhập CLB và đặt lịch đan cước vợt điện tử.

### 3. Giải đấu, Bảng điểm trực tiếp & Quản trị sân (POS)
- **Tổ chức giải đấu (`/tournaments.html` & `/live.html`):** Xếp lịch vòng tròn Berger, chia bảng/nhánh đấu loại trực tiếp, ghép cặp đôi cân bằng trình độ; chấm điểm trực tiếp có nút `+1` / `-1` lưu bền vững vào SQLite.
- **Quản trị & Thu ngân (`/admin.html` & `/invoice.html`):** Hợp đồng khách cố định theo thứ, POS bán hàng trừ kho tự động, in hóa đơn, xuất CSV (UTF-8 BOM), cấu hình giá/sân động, nhật ký thao tác.
- **Thiết kế đa trang & Giao diện chuyên nghiệp:** Mỗi phân hệ là một trang riêng giữ nguyên trạng thái khi `F5`, sử dụng bộ icon SVG đơn sắc nét mảnh (`icons.js`), hỗ trợ Dark Mode và chế độ chạy tĩnh không cần backend (`standalone.js`).
- **Liên hệ nhanh & Trợ lý AI (`assistant.js`):** Nút nổi Zalo (`0353154185`), Facebook, Gọi điện và Trợ lý AI giới thiệu dịch vụ, kiểm tra lịch trống thực tế và gợi ý khung giờ đặt sân phù hợp.

---

## Cấu trúc thư mục

### Cấu trúc triển khai trên GitHub / Render (`github_upload/`)
```text
├── server.ts           # Backend gộp 1 file (Node.js >= 22.6, Express, Socket.IO, node:sqlite)
├── package.json        # Khai báo dependencies & script khởi chạy
├── Dockerfile          # Đóng gói container Node 24-slim phục vụ tại PORT 4000
├── render.yaml         # Cấu hình Blueprint triển khai tự động trên Render.com
├── README.md           # Tài liệu dự án
└── web/                # Giao diện Front-end & các trang con
    ├── index.html      # Trang chủ & Đặt lịch sân (đồng bộ giờ tròn + sơ đồ 30 phút)
    ├── opponents.html  # Tìm đối thủ & Thách đấu ELO
    ├── history.html    # Lịch sử thi đấu BWF & Bảng xếp hạng ELO
    ├── coaches.html    # Tìm Huấn luyện viên
    ├── social.html     # Giao lưu CLB & Đan cước vợt
    ├── tournaments.html# Giải đấu Berger / Knockout & Ghép cặp
    ├── my.html         # Lịch đặt sân của tôi
    ├── admin.html      # Quản trị cụm sân, POS, Kho, Hợp đồng, Báo cáo
    ├── kiem-thu.html   # Bản 1 file HTML/CSS/JS thuần chạy offline (T1–T5)
    ├── live.html       # Màn hình bảng điểm trực tiếp cho khán giả
    ├── invoice.html    # Hóa đơn in cho thu ngân
    ├── style.css       # Design System (Teal/Cam, Responsive, Dark Mode)
    ├── app.js          # Logic cốt lõi: Auth, Đặt sân, VietQR, POS, Giải đấu
    ├── extra.js        # Cộng đồng, Đặt lịch Nhóm 3 đồng bộ & kéo thả, Cấu hình
    ├── assistant.js    # Nút liên hệ Zalo/Facebook/Hotline & Trợ lý AI gợi ý sân
    ├── icons.js        # Bộ 75 icon SVG đơn sắc, nét mảnh
    └── standalone.js   # Bộ giả lập API trên trình duyệt cho host tĩnh (InfinityFree)
```

*(Trong mã nguồn phát triển đầy đủ còn có thư mục `backend/src/` tách module TypeScript, `nop_bai_nhom3/` chứa file nộp độc lập và hồ sơ báo cáo, `db/schema.sql`, `docs/`, `scratch/` chứa script kiểm thử E2E).*

---

## Hướng dẫn cài đặt & Chạy trên máy (Local)

**Yêu cầu:** Node.js **>= 22.6** (khuyến nghị Node 24 LTS để chạy trực tiếp TypeScript với `--experimental-strip-types` và SQLite tích hợp `node:sqlite`).

### Cách 1: Chạy từ thư mục triển khai phẳng (gốc repo hoặc `github_upload/`)
```bash
npm install --omit=dev
node --experimental-strip-types server.ts
```

### Cách 2: Chạy từ mã nguồn phát triển (`backend/`)
```bash
cd backend
npm install
node --experimental-strip-types src/server.ts
```

Truy cập ứng dụng tại: **http://localhost:4000**

---

## Triển khai miễn phí trên Render.com

1. Đẩy mã nguồn (từ `github_upload/` hoặc nhánh `main`) lên GitHub.
2. Trên [Render.com](https://render.com), chọn **New + → Web Service** (hoặc **Blueprint**) và kết nối tới repository GitHub.
3. Render tự động nhận diện `Dockerfile` và `render.yaml`:
   - **Runtime:** `Docker`
   - **Port:** `4000`
   - **Biến môi trường:** `NODE_ENV=production`, `PORT=4000`, `DB_FILE=/data/data.sqlite`

---

## Tài khoản Demo mặc định

| Vai trò | Số điện thoại | Mật khẩu | Quyền hạn chính |
|---|---|---|---|
| **Chủ sân (`OWNER`)** | `0900000001` | `admin123` | Toàn quyền + Cấu hình giá/sân, Hợp đồng, Báo cáo, Nhật ký |
| **Quản lý (`MANAGER`)** | `0900000002` | `manager123` | Cấu hình, Hợp đồng, Nhập kho, Hủy đơn, Báo cáo, Lưu giải |
| **Thu ngân (`CASHIER`)** | `0900000003` | `cashier123` | Đổi sân/giờ, Check-in, POS bán hàng, Chấm điểm trực tiếp |
| **Hội viên (`PLAYER`)** | Tự đăng ký | `>= 6 ký tự` | Đặt sân, VietQR, Hủy trước 2h, Thách đấu, CLB, Đặt HLV |

---

## Kiểm thử

```bash
# Kiểm tra TypeScript & Unit Test (thuật toán tính giá, giải đấu, tính điểm BWF)
cd backend
npm run typecheck
npm test
```

Kiểm thử API tích hợp đầu-cuối (cần khởi động server tại `http://localhost:4000`):
```bash
python scratch/e2e.py
python scratch/e2e2.py
python scratch/e2e3.py
python scratch/e2e4.py
```

---

## Liên hệ hỗ trợ
- **Zalo / Hotline:** `0353154185` (`https://zalo.me/0353154185`)
- **Đơn vị:** Nhóm 3 – K22-CNTT B, Trường Đại học Hùng Vương
