// standalone.js – Bộ chuyển đổi thông minh cho InfinityFree (caulongpro.lovestoblog.com) & Cloud Hosting
// - Khi chạy trên Node.js (localhost:4000 hoặc Render/Railway): gọi trực tiếp REST API + Socket.IO của server.
// - Khi chạy trên hosting tĩnh / PHP (InfinityFree htdocs): tự động kích hoạt CSDL trình duyệt (localStorage + BroadcastChannel)
//   giúp 100% tính năng (Đặt sân, VietQR, Phân quyền, Đối thủ ELO, Lịch sử BWF, HLV, CLB, Đan vợt, Live Score) hoạt động mượt mà!

(function () {
  const BC = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('caulongpro_sync') : null;
  const listeners = { changed: [], live: [], notify: [] };
  const emitLocal = (ev, data) => {
    (listeners[ev] || []).forEach(fn => { try { fn(data); } catch {} });
    if (BC) { try { BC.postMessage({ ev, data }); } catch {} }
  };
  if (BC) {
    BC.onmessage = e => {
      const { ev, data } = e.data || {};
      (listeners[ev] || []).forEach(fn => { try { fn(data); } catch {} });
    };
  }
  window.addEventListener('storage', e => {
    if (e.key === 'clp_db_v3') {
      (listeners.changed || []).forEach(fn => { try { fn(); } catch {} });
      (listeners.live || []).forEach(fn => { try { fn(); } catch {} });
    }
  });

  // Safe Socket.IO wrapper (không bao giờ lỗi nếu /socket.io/socket.io.js không tồn tại trên InfinityFree)
  const realIo = window.io;
  window.io = function () {
    let sock = null;
    if (typeof realIo === 'function' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || window.API_BASE)) {
      try { sock = realIo(window.API_BASE || undefined); } catch {}
    }
    return {
      on(ev, fn) {
        if (!listeners[ev]) listeners[ev] = [];
        listeners[ev].push(fn);
        if (sock) sock.on(ev, fn);
      }
    };
  };

  const KEY = 'clp_db_v3';
  const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x); };
  const tomorrow = addDays(iso(new Date()), 1);
  const today = iso(new Date());

  function defaultDB() {
    return {
      cfg: { courts: 6, off_price: 60000, peak_price: 80000, peak_from: 17, weekend_pct: 0, deposit_pct: 30 },
      users: [
        { id: 1, name: 'Chủ sân', phone: '0900000001', pass: 'admin123', role: 'OWNER', points: 120 },
        { id: 2, name: 'Quản lý', phone: '0900000002', pass: 'manager123', role: 'MANAGER', points: 80 },
        { id: 3, name: 'Thu ngân', phone: '0900000003', pass: 'cashier123', role: 'CASHIER', points: 40 }
      ],
      sessions: {},
      bookings: [
        { code: 'BKDEMO1', court: 1, date: tomorrow, from: 24, to: 28, name: 'CLB ĐH Hùng Vương', user_id: 2, status: 'CONFIRMED', amount: 200000, deposit: 60000, holdUntil: null, created: Date.now() - 3600000, items: [] },
        { code: 'BKDEMO2', court: 3, date: tomorrow, from: 22, to: 26, name: 'Nhóm K22-CNTT B', user_id: 2, status: 'CONFIRMED', amount: 200000, deposit: 60000, holdUntil: null, created: Date.now() - 1800000, items: [] },
        { code: 'BKDEMO3', court: 5, date: tomorrow, from: 24, to: 28, name: 'CLB Smash Việt Trì', user_id: 2, status: 'CONFIRMED', amount: 200000, deposit: 60000, holdUntil: null, created: Date.now() - 900000, items: [] }
      ],
      inventory: [
        { id: 1, name: 'Nước suối', price: 10000, stock: 50, low: 10 },
        { id: 2, name: 'Nước tăng lực', price: 20000, stock: 30, low: 8 },
        { id: 3, name: 'Ống cầu (Hải Yến)', price: 280000, stock: 12, low: 3 },
        { id: 4, name: 'Thuê vợt', price: 30000, stock: 10, low: 2 },
        { id: 5, name: 'Quấn cán', price: 15000, stock: 40, low: 10 }
      ],
      audit: [],
      contracts: [],
      posts: [
        { id: 1, user_id: 2, author: 'Ngô Đình Hậu', title: 'Tuyển 2 bạn nam/nữ giao lưu tối mai Sân 1 (bao cầu Hải Yến)', level: 'TB+', slots: 4, fee: 240000, play_at: `${tomorrow}T18:30`, created: Date.now(), joins: [] },
        { id: 2, user_id: 2, author: 'Trần Hồng Đức', title: 'Cần 3 bạn trình độ TB giao lưu vui vẻ chiều thứ 7 Sân 3', level: 'TB', slots: 3, fee: 180000, play_at: `${tomorrow}T17:30`, created: Date.now(), joins: [] }
      ],
      tournaments: [],
      notifications: [],
      referee_score: { games: [], winner: null },
      lives: [
        { id: 1, a: 'Ngô Đình Hậu / Trần Hồng Đức', b: 'Đinh Thanh Hải / Xuân Dương', court: 1, state: { games: [{ a: 21, b: 18 }, { a: 14, b: 12 }], winner: null }, updated: Date.now() }
      ],
      opponents: [
        { id: 1, user_id: null, name: 'Ngô Đình Hậu', avatar: 'HẬ', level: 'KHA', elo: 1760, rank_tier: 'Kim Cương', hand: 'Tay phải', style: 'Chuyên công / Smash', specialty: 'Đôi nam · Đơn nam', racket: 'Yonex Astrox 100ZZ Kurenai · BG80P 11.5kg', district: 'Việt Trì', lat: 21.3245, lng: 105.4018, wins: 42, losses: 14, streak: 4, form: 'W,W,W,W,L', avail: '17:30 – 20:30 (T2–CN)', bio: 'Thích đánh đôi tốc độ cao, đập cầu cuối sân và ép lưới. Nhận kèo giao lưu cầu Hải Yến.' },
        { id: 2, user_id: null, name: 'Trần Hồng Đức', avatar: 'ĐỨ', level: 'TB+', elo: 1610, rank_tier: 'Vàng', hand: 'Tay phải', style: 'Điều cầu / Phản tạt', specialty: 'Đôi nam · Đôi nam nữ', racket: 'Lining Halbertec 8000 · Exbolt 65 11kg', district: 'Việt Trì', lat: 21.3190, lng: 105.4080, wins: 31, losses: 16, streak: 2, form: 'W,W,L,W,L', avail: '18:00 – 21:00 (T3-5-7)', bio: 'Chuyên thủ phản tạt, điều cầu 4 góc và bắt lưới. Tìm bạn đứng lưới ăn ý.' },
        { id: 3, user_id: null, name: 'Đinh Thanh Hải', avatar: 'HẢ', level: 'TB', elo: 1485, rank_tier: 'Bạc', hand: 'Tay trái', style: 'Toàn diện', specialty: 'Đơn nam · Đôi nam', racket: 'Victor Thruster Ryuga II · BG65Ti 11kg', district: 'Lâm Thao', lat: 21.3215, lng: 105.3180, wins: 24, losses: 15, streak: 1, form: 'W,L,W,W,L', avail: '17:00 – 19:30 (Hằng ngày)', bio: 'Thuận tay trái, đường cầu chéo sân khó chịu. Luôn sẵn sàng giao lưu đơn hoặc đôi.' },
        { id: 4, user_id: null, name: 'Nguyễn Đinh Xuân Dương', avatar: 'DƯ', level: 'TB-', elo: 1390, rank_tier: 'Bạc', hand: 'Tay phải', style: 'Trên lưới / Bắt cầu', specialty: 'Đôi nam nữ · Đôi nam', racket: 'Yonex Nanoflare 800 Pro · Exbolt 63 10.5kg', district: 'Việt Trì', lat: 21.3280, lng: 105.3950, wins: 19, losses: 14, streak: 3, form: 'W,W,W,L,L', avail: '18:30 – 21:00 (T2-4-6)', bio: 'Tốc độ vung vợt nhanh, chuyên chụp lưới và bỏ nhỏ. Tìm đối thủ cùng tầm TB-/TB.' },
        { id: 5, user_id: null, name: 'Nguyễn Bảo Long', avatar: 'LO', level: 'TOT', elo: 1890, rank_tier: 'Cao Thủ', hand: 'Tay phải', style: 'Chuyên công / Smash', specialty: 'Đơn nam · Đôi nam', racket: 'Yonex Astrox 99 Pro · Aerobite 12kg', district: 'Phú Thọ', lat: 21.3980, lng: 105.2240, wins: 58, losses: 11, streak: 6, form: 'W,W,W,W,W', avail: '19:00 – 22:00 (T2–CN)', bio: 'VĐV giải phong trào mở rộng tỉnh Phú Thọ. Nhận kèo thách đấu Đơn nam & Đôi nam đỉnh cao.' },
        { id: 6, user_id: null, name: 'Lê Minh Ánh', avatar: 'ÁN', level: 'TB+', elo: 1565, rank_tier: 'Vàng', hand: 'Tay phải', style: 'Trên lưới / Bắt cầu', specialty: 'Đôi nữ · Đôi nam nữ', racket: 'Yonex Arcsaber 11 Pro · BG66UM 10.5kg', district: 'Việt Trì', lat: 21.3235, lng: 105.4050, wins: 29, losses: 12, streak: 2, form: 'W,W,L,W,W', avail: '17:30 – 19:30 (T3-5-CN)', bio: 'Đánh lưới chắc tay, di chuyển linh hoạt. Tìm cặp Đôi nam nữ hoặc Đôi nữ giao lưu vui vẻ.' },
        { id: 7, user_id: null, name: 'Phạm Quốc Khánh', avatar: 'KH', level: 'TBK', elo: 1675, rank_tier: 'Kim Cương', hand: 'Tay phải', style: 'Toàn diện', specialty: 'Đơn nam · Đôi nam', racket: 'Lining Axforce 90 Max · No.1 11.5kg', district: 'Việt Trì', lat: 21.3150, lng: 105.4120, wins: 35, losses: 18, streak: 1, form: 'W,L,W,L,W', avail: '06:00 – 08:00 & 18:00 – 20:00', bio: 'Thể lực bền bỉ, thích đánh đơn 3 set chuẩn BWF 21 điểm.' },
        { id: 8, user_id: null, name: 'Hoàng Thu Trang', avatar: 'TR', level: 'TB', elo: 1440, rank_tier: 'Bạc', hand: 'Tay phải', style: 'Điều cầu / Phản tạt', specialty: 'Đôi nữ · Đơn nữ', racket: 'Yonex Nanoflare 700 · BG65 10kg', district: 'Lâm Thao', lat: 21.3260, lng: 105.3320, wins: 21, losses: 16, streak: 0, form: 'L,W,W,L,W', avail: '17:30 – 20:00 (Cuối tuần)', bio: 'Chơi cầu lông 3 năm, mong muốn giao lưu nâng cao trình độ với các bạn khu vực Việt Trì – Lâm Thao.' }
      ],
      challenges: [
        { id: 1, challenger_id: null, challenger_name: 'Ngô Đình Hậu (1760 ELO)', opponent_id: 2, opponent_name: 'Trần Hồng Đức', match_type: 'Đôi nam', court: 1, play_date: tomorrow, slot_time: '18:30 – 20:00', shuttle_note: 'Giao lưu 2 ống cầu Hải Yến', message: 'Tối mai làm 3 set đôi nam chuẩn BWF nhé anh em!', status: 'OPEN', created: Date.now() - 3600000 },
        { id: 2, challenger_id: null, challenger_name: 'Nguyễn Bảo Long (1890 ELO)', opponent_id: 7, opponent_name: 'Phạm Quốc Khánh', match_type: 'Đơn nam', court: 2, play_date: tomorrow, slot_time: '19:30 – 21:00', shuttle_note: 'Kèo nước tăng lực + cầu thi đấu', message: 'Tái đấu đơn nam 3 ván 21 điểm!', status: 'OPEN', created: Date.now() - 1800000 }
      ],
      matches: [
        { id: 1, match_type: 'Đôi nam', mode: 'RANKED', court: 1, play_date: today, team_a: 'Ngô Đình Hậu / Trần Hồng Đức', team_b: 'Đinh Thanh Hải / Nguyễn Đinh Xuân Dương', level_a: 'KHA', level_b: 'TB+', scores: [{ a: 21, b: 17 }, { a: 18, b: 21 }, { a: 21, b: 19 }], winner: 'A', elo_delta: 16, shuttles: 3, duration_min: 52, verified: 1, created: Date.now() - 7200000 },
        { id: 2, match_type: 'Đơn nam', mode: 'RANKED', court: 2, play_date: addDays(today, -1), team_a: 'Nguyễn Bảo Long', team_b: 'Phạm Quốc Khánh', level_a: 'TOT', level_b: 'TBK', scores: [{ a: 21, b: 15 }, { a: 21, b: 18 }], winner: 'A', elo_delta: 14, shuttles: 2, duration_min: 38, verified: 1, created: Date.now() - 86400000 },
        { id: 3, match_type: 'Đôi nam nữ', mode: 'FRIENDLY', court: 3, play_date: addDays(today, -1), team_a: 'Trần Hồng Đức / Lê Minh Ánh', team_b: 'Nguyễn Đinh Xuân Dương / Hoàng Thu Trang', level_a: 'TB+', level_b: 'TB', scores: [{ a: 21, b: 16 }, { a: 21, b: 14 }], winner: 'A', elo_delta: 12, shuttles: 2, duration_min: 34, verified: 1, created: Date.now() - 95000000 }
      ],
      coaches: [
        { id: 1, name: 'HLV Nguyễn Trọng Tuấn', avatar: 'TU', title: 'HLV Trưởng CLB Hùng Vương', cert: 'BWF Coach Level 2 · Kiện tướng QG', level: 'TOT', exp_years: 9, specialty: 'Kỹ thuật Đập cầu & Chiến thuật Đôi', tags: ['Jump Smash', 'Bộ chân 6 góc', 'Chiến thuật Đôi nam', 'Luyện thi đấu giải'], price_1on1: 280000, price_group: 110000, rating: 4.9, reviews: 64, students: 210, racket: 'Yonex Astrox 100ZZ', district: 'Việt Trì', schedule: 'T2–T7 (06:00–11:00 & 16:00–20:00)', bio: '9 năm huấn luyện đội tuyển trẻ và phong trào nâng cao tại Phú Thọ. Chuyên chỉnh form đập cầu, di chuyển bộ chân chuẩn BWF và phối hợp đánh đôi.' },
        { id: 2, name: 'HLV Vũ Thị Mai Phương', avatar: 'MP', title: 'Cựu VĐV Tuyển Tỉnh', cert: 'Cử nhân TDTT Bắc Ninh · BWF Level 1', level: 'KHA', exp_years: 6, specialty: 'Cơ bản cho người mới & Bộ chân', tags: ['Cầm vợt chuẩn', 'Footwork cơ bản', 'Phông cầu & Bỏ nhỏ', 'Lớp thiếu nhi & Nữ'], price_1on1: 220000, price_group: 90000, rating: 4.9, reviews: 48, students: 165, racket: 'Yonex Arcsaber 11 Pro', district: 'Việt Trì', schedule: 'T3–CN (07:00–10:30 & 17:00–19:30)', bio: 'Tận tâm, chỉnh sửa từng động tác cầm vợt, mở vợt và bước chạy cho người mới bắt đầu hoặc người chơi muốn xóa tật sai kỹ thuật.' },
        { id: 3, name: 'HLV Đỗ Hoàng Nam', avatar: 'HN', title: 'HLV Chuyên Phản Tạt & Đánh Đôi', cert: 'HCV Giải Cầu Lông Mở Rộng Phú Thọ', level: 'TOT', exp_years: 7, specialty: 'Phòng thủ, Phản tạt & Bắt lưới', tags: ['Thủ phản tạt', 'Đè lưới', 'Giao cầu & Nhận giao cầu', 'Đôi nam nữ'], price_1on1: 250000, price_group: 100000, rating: 4.8, reviews: 39, students: 130, racket: 'Lining Halbertec 9000', district: 'Lâm Thao', schedule: 'T2–T6 (17:00–21:00) & Cuối tuần', bio: 'Chuyên đào tạo kỹ năng cổ tay, phản tạt tốc độ cao, phòng thủ biến hóa công và di chuyển xoay vòng trong đánh đôi.' }
      ],
      coach_bookings: [],
      clubs: [
        { id: 1, name: 'CLB Cầu Lông ĐH Hùng Vương (K22-CNTT)', badge: '🎓', court: 1, schedule: 'T3 – T5 – T7 · 18:00 – 20:00', level_range: 'TB- đến KHA', fee_note: '350.000đ/tháng (bao cầu Hải Yến)', members_count: 18, max_members: 24, leader: 'Ngô Đình Hậu', description: 'CLB sinh viên & giảng viên đam mê cầu lông, giao lưu sôi nổi, tổ chức giải nội bộ hằng quý.', joins: [] },
        { id: 2, name: 'CLB Smash Việt Trì – Kèo Tối Đỉnh Cao', badge: '🔥', court: 2, schedule: 'T2 – T4 – T6 · 19:00 – 21:30', level_range: 'TB+ đến TOT', fee_note: 'Chia đều tiền sân + cầu (~65k/buổi)', members_count: 14, max_members: 16, leader: 'Nguyễn Bảo Long', description: 'Chuyên kèo đôi nam chất lượng cao, tốc độ nhanh, dùng cầu Hải Yến S90 hoặc Thành Công.', joins: [] },
        { id: 3, name: 'Hội Cầu Lông Bình Minh Việt Trì', badge: '🌅', court: 3, schedule: 'Hằng ngày · 05:30 – 07:30', level_range: 'Mọi trình độ', fee_note: '250.000đ/tháng', members_count: 22, max_members: 30, leader: 'Trần Hồng Đức', description: 'Rèn luyện sức khỏe buổi sáng trước giờ làm việc, không khí thân thiện, hướng dẫn người mới.', joins: [] }
      ],
      stringing_orders: []
    };
  }

  const loadDB = () => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) return { ...defaultDB(), ...JSON.parse(s) };
    } catch {}
    const d = defaultDB();
    saveDB(d);
    return d;
  };
  const saveDB = db => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };

  const cleanName = s => String(s || '').replace(/\(.*?\)/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const samePerson = (a, b) => {
    const na = cleanName(a), nb = cleanName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    const wa = na.split(' '), wb = nb.split(' ');
    const [sh, lg] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
    return sh.length >= 2 && sh.every(w => lg.includes(w));
  };
  const tierOf = elo => elo >= 1800 ? 'Cao Thủ' : elo >= 1650 ? 'Kim Cương' : elo >= 1500 ? 'Vàng' : elo >= 1350 ? 'Bạc' : 'Đồng';
  const gameWinner = ({ a, b }) => {
    const hi = Math.max(a, b), lo = Math.min(a, b);
    if (hi >= 30) return a > b ? 'A' : 'B';
    if (hi >= 21 && hi - lo >= 2) return a > b ? 'A' : 'B';
    return null;
  };
  const calcMatchWinner = games => {
    const wins = { A: 0, B: 0 };
    games.forEach(g => { const w = gameWinner(g); if (w) wins[w]++; });
    return wins.A >= 2 ? 'A' : wins.B >= 2 ? 'B' : null;
  };
  const addPoint = (s, side) => {
    if (s.winner) throw new Error('Trận đã kết thúc');
    const games = s.games?.length ? s.games.map(g => ({ ...g })) : [{ a: 0, b: 0 }];
    let cur = games[games.length - 1];
    if (gameWinner(cur)) { cur = { a: 0, b: 0 }; games.push(cur); }
    side === 'A' ? cur.a++ : cur.b++;
    return { games, winner: calcMatchWinner(games) };
  };
  const subPoint = (s, side) => {
    if (!s.games?.length) return { games: [], winner: null };
    const games = s.games.map(g => ({ ...g }));
    let cur = games[games.length - 1];
    if (cur.a === 0 && cur.b === 0 && games.length > 1) { games.pop(); cur = games[games.length - 1]; }
    const k = side === 'A' ? 'a' : 'b';
    if (cur[k] > 0) cur[k]--;
    if (games.length === 1 && games[0].a === 0 && games[0].b === 0) return { games: [], winner: null };
    return { games, winner: calcMatchWinner(games) };
  };

  function rulesFor(db, date) {
    const wk = [0, 6].includes(new Date(date + 'T12:00:00').getDay()) ? 1 + db.cfg.weekend_pct / 100 : 1;
    return [
      { startMin: 0, endMin: db.cfg.peak_from * 60, perHour: db.cfg.off_price * wk },
      { startMin: db.cfg.peak_from * 60, endMin: 1440, perHour: db.cfg.peak_price * wk }
    ];
  }
  function calcPrice(db, date, from, to) {
    const rules = rulesFor(db, date);
    let sum = 0;
    for (let s = from; s < to; s++) {
      const m = 6 * 60 + s * 30;
      const r = rules.find(x => m >= x.startMin && m < x.endMin) || rules[0];
      sum += r.perHour / 2;
    }
    return Math.round(sum);
  }

  // Xử lý API cục bộ khi chạy trên InfinityFree
  function handleLocalApi(urlStr, opts = {}) {
    const db = loadDB();
    const uUrl = new URL(urlStr, location.origin);
    const path = uUrl.pathname;
    const method = (opts.method || 'GET').toUpperCase();
    const body = opts.body ? JSON.parse(opts.body) : {};
    const auth = (opts.headers?.Authorization || opts.headers?.authorization || '').replace('Bearer ', '');
    const uid = db.sessions[auth] || (auth ? (db.users.find(x => 'tok_' + x.id === auth)?.id) : null);
    const me = db.users.find(x => x.id === uid) || null;
    const RANK = { PLAYER: 0, CASHIER: 1, MANAGER: 2, OWNER: 3 };
    const res = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (path === '/api/config') return res(200, { bank: '970422', account: '0123456789', accountName: 'CAU LONG PRO', demoPay: true });
    if (path === '/api/stats') return res(200, { courts: db.cfg.courts, members: db.opponents.length + db.users.filter(u => u.role === 'PLAYER').length, bookings: db.bookings.filter(b => ['CONFIRMED', 'PLAYING', 'COMPLETED'].includes(b.status)).length, posts: db.posts.length });
    if (path === '/api/settings') {
      if (method === 'GET') return res(200, db.cfg);
      if (!me || RANK[me.role] < 2) return res(403, { message: 'Không có quyền' });
      Object.assign(db.cfg, body); saveDB(db); emitLocal('changed'); return res(200, db.cfg);
    }
    if (path === '/api/login') {
      const u = db.users.find(x => x.phone === body.phone && x.pass === body.password);
      if (!u) return res(401, { message: 'Sai SĐT hoặc mật khẩu' });
      const tok = 'tok_' + u.id; db.sessions[tok] = u.id; saveDB(db);
      return res(200, { token: tok, user: { id: u.id, name: u.name, phone: u.phone, role: u.role, points: u.points } });
    }
    if (path === '/api/register') {
      if (!body.name || !/^0\d{9}$/.test(body.phone || '') || (body.password || '').length < 6)
        return res(400, { message: 'Tên, SĐT 10 số và mật khẩu ≥ 6 ký tự là bắt buộc' });
      if (db.users.some(x => x.phone === body.phone)) return res(409, { message: 'SĐT đã được đăng ký' });
      const u = { id: Date.now(), name: body.name, phone: body.phone, pass: body.password, role: 'PLAYER', points: 0 };
      db.users.push(u); const tok = 'tok_' + u.id; db.sessions[tok] = u.id; saveDB(db);
      return res(201, { token: tok, user: { id: u.id, name: u.name, phone: u.phone, role: u.role, points: u.points } });
    }
    if (path === '/api/me') return me ? res(200, { id: me.id, name: me.name, phone: me.phone, role: me.role, points: me.points }) : res(401, {});
    if (path === '/api/logout') return res(204, null);

    if (path === '/api/state') {
      const date = uUrl.searchParams.get('date') || today;
      const courts = Array.from({ length: db.cfg.courts }, (_, i) => i + 1);
      const staff = me && RANK[me.role] >= 1;
      const bks = db.bookings.filter(b => b.date === date && ['PENDING', 'CONFIRMED', 'PLAYING'].includes(b.status))
        .map(b => staff ? { ...b, customerName: b.name } : { ...b, customerName: b.name, name: 'Đã đặt', items: [] });
      return res(200, { courts, startH: 6, slots: 34, now: Date.now(), rules: rulesFor(db, date), depositPct: db.cfg.deposit_pct, bookings: bks });
    }
    if (path === '/api/hold') {
      const { court, date, from, to, name } = body;
      const cName = me?.name || String(name || '').trim();
      if (!cName) return res(400, { message: 'Vui lòng nhập tên' });
      if (db.bookings.some(b => b.court === court && b.date === date && ['PENDING', 'CONFIRMED', 'PLAYING'].includes(b.status) && b.from < to && from < b.to))
        return res(409, { message: 'Khung giờ vừa có người đặt, vui lòng chọn lại' });
      const amount = calcPrice(db, date, from, to);
      const bk = { code: 'BK' + (Date.now() % 1e7).toString(36).toUpperCase(), court, date, from, to, name: cName, user_id: me?.id || null, status: 'PENDING', amount, deposit: Math.round(amount * db.cfg.deposit_pct / 100), holdUntil: Date.now() + 600000, created: Date.now(), items: [] };
      db.bookings.unshift(bk); saveDB(db); emitLocal('changed'); return res(201, bk);
    }
    if (path.startsWith('/api/booking/')) {
      const code = path.split('/').pop();
      const b = db.bookings.find(x => x.code === code);
      return b ? res(200, b) : res(404, {});
    }
    if (path.startsWith('/api/pay/')) {
      const code = path.split('/').pop();
      const b = db.bookings.find(x => x.code === code);
      if (!b || b.status !== 'PENDING') return res(409, { message: 'Đơn đã xử lý' });
      b.status = 'CONFIRMED'; b.holdUntil = null; saveDB(db); emitLocal('changed'); return res(200, b);
    }
    if (path === '/api/my') {
      if (!me) return res(401, { message: 'Vui lòng đăng nhập' });
      return res(200, { user: me, bookings: db.bookings.filter(b => b.user_id === me.id) });
    }
    if (path.startsWith('/api/my/cancel/')) {
      const code = path.split('/').pop();
      const b = db.bookings.find(x => x.code === code);
      if (b) { b.status = 'CANCELLED'; saveDB(db); emitLocal('changed'); }
      return res(200, { ok: true });
    }
    if (path === '/api/my/notifications') return res(200, db.notifications.filter(n => me && n.user_id === me.id));
    if (path === '/api/my/notifications/read') {
      db.notifications.forEach(n => { if (me && n.user_id === me.id) n.read = 1; }); saveDB(db); return res(200, { ok: true });
    }
    if (path === '/api/admin') return res(200, { bookings: db.bookings, inventory: db.inventory, audit: db.audit });
    if (path === '/api/report') {
      const ok = db.bookings.filter(b => ['CONFIRMED', 'PLAYING', 'COMPLETED'].includes(b.status));
      const court = ok.reduce((s, b) => s + b.amount, 0);
      const goods = ok.reduce((s, b) => s + (b.items || []).reduce((g, i) => g + i.qty * i.price, 0), 0);
      const heat = Array.from({ length: 34 }, (_, s) => ok.filter(b => s >= b.from && s < b.to).length);
      return res(200, { court, goods, total: court + goods, count: ok.length, fill: [{ date: tomorrow, pct: 32 }], heat, startH: 6 });
    }
    if (path === '/api/pos') {
      const b = db.bookings.find(x => x.code === body.code), it = db.inventory.find(x => x.id === body.itemId);
      if (!b || !it || it.stock < body.qty) return res(409, { message: 'Không đủ tồn kho' });
      it.stock -= body.qty; b.items.push({ name: it.name, qty: body.qty, price: it.price }); saveDB(db); emitLocal('changed');
      return res(200, { lowStock: it.stock <= it.low });
    }
    if (path.startsWith('/api/status/')) {
      const code = path.split('/').pop(), b = db.bookings.find(x => x.code === code);
      if (b) { b.status = body.status; saveDB(db); emitLocal('changed'); }
      return res(200, { ok: true });
    }
    if (path.startsWith('/api/move/')) {
      const code = path.split('/').pop(), b = db.bookings.find(x => x.code === code);
      if (!b) return res(404, {});
      const len = b.to - b.from, to = body.from + len;
      if (db.bookings.some(x => x.code !== code && x.court === body.court && x.date === b.date && ['PENDING', 'CONFIRMED', 'PLAYING'].includes(x.status) && x.from < to && body.from < x.to))
        return res(409, { message: 'Trùng lịch' });
      const amt = calcPrice(db, b.date, body.from, to), diff = amt - b.amount;
      b.court = body.court; b.from = body.from; b.to = to; b.amount = amt; saveDB(db); emitLocal('changed');
      return res(200, { diff });
    }
    if (path.startsWith('/api/invoice/')) {
      const code = decodeURIComponent(path.split('/').pop()), b = db.bookings.find(x => x.code === code);
      return b ? res(200, { ...b, cashier: me?.name || 'Thu ngân', printedAt: Date.now() }) : res(404, {});
    }
    if (path === '/api/contracts') {
      if (method === 'GET') return res(200, db.contracts);
      const c = { id: db.contracts.length + 1, name: body.name, court: body.court, weekdays: body.weekdays, from_s: body.from, to_s: body.to, valid_from: body.validFrom, valid_to: body.validTo, deposit: body.deposit, paid_until: body.validFrom, status: 'ACTIVE', sessions: 12, dueSoon: false };
      db.contracts.unshift(c); saveDB(db); return res(201, { id: c.id, created: 12, skipped: [] });
    }
    if (path === '/api/posts') {
      if (method === 'GET') return res(200, db.posts.map(p => ({ ...p, joined: (p.joins || []).length, left: p.slots - (p.joins || []).length, perHead: Math.ceil(p.fee / Math.max(1, (p.joins || []).length + 1)), mine: !!me && (p.joins || []).includes(me.id) })));
      if (!me) return res(401, { message: 'Vui lòng đăng nhập' });
      const p = { id: Date.now(), user_id: me.id, author: me.name, title: body.title, level: body.level, slots: body.slots, fee: body.fee, play_at: body.playAt, created: Date.now(), joins: [] };
      db.posts.unshift(p); saveDB(db); return res(201, { id: p.id });
    }
    if (path.endsWith('/join') && path.startsWith('/api/posts/')) {
      if (!me) return res(401, { message: 'Vui lòng đăng nhập' });
      const id = +path.split('/')[3], p = db.posts.find(x => x.id === id);
      if (!p) return res(404, {});
      if (p.user_id === me.id) return res(409, { message: 'Bạn là người đăng bài này' });
      p.joins = p.joins || [];
      if (p.joins.includes(me.id)) return res(409, { message: 'Bạn đã tham gia rồi' });
      if (p.joins.length >= p.slots) return res(409, { message: 'Đã đủ người' });
      p.joins.push(me.id); saveDB(db); return res(200, { ok: true });
    }
    if (path === '/api/score') {
      if (method === 'GET') return res(200, db.referee_score || { games: [], winner: null });
      const action = body.action || 'add';
      if (action === 'reset') { db.referee_score = { games: [], winner: null }; saveDB(db); return res(200, db.referee_score); }
      try {
        const base = Array.isArray(body.games) ? { games: body.games, winner: body.winner ?? null } : (db.referee_score || { games: [], winner: null });
        db.referee_score = action === 'sub' ? subPoint(base, body.side) : addPoint(base, body.side);
        saveDB(db); return res(200, db.referee_score);
      } catch (e) { return res(409, { message: e.message }); }
    }
    if (path === '/api/live') {
      if (method === 'GET') return res(200, db.lives);
      const l = { id: Date.now(), a: body.a, b: body.b, court: body.court || 1, state: { games: [], winner: null }, updated: Date.now() };
      db.lives.unshift(l); saveDB(db); emitLocal('live'); return res(201, l);
    }
    if (path.startsWith('/api/live/') && path.endsWith('/point')) {
      const id = +path.split('/')[3], l = db.lives.find(x => x.id === id);
      if (!l) return res(404, {});
      try {
        l.state = body.action === 'sub' ? subPoint(l.state, body.side) : addPoint(l.state, body.side);
        l.updated = Date.now(); saveDB(db); emitLocal('live'); return res(200, l);
      } catch (e) { return res(409, { message: e.message }); }
    }
    if (path === '/api/tournament') {
      const N = Math.min(Math.max(+body.n || 6, 2), 16), C = Math.min(Math.max(+body.courts || 2, 1), 6);
      const matches = []; let r = 1;
      for (let i = 1; i <= N; i++) for (let j = i + 1; j <= N; j++) matches.push({ a: i, b: j, round: ((r - 1) % (N - 1)) + 1, court: ((r - 1) % C) + 1, time: `${String(8 + Math.floor((r - 1) / C / 2)).padStart(2, '0')}:${Math.floor((r - 1) / C) % 2 ? '30' : '00'}` }), r++;
      if (body.format === 'knockout') {
        const p2 = 1 << Math.ceil(Math.log2(N)), m = []; let id = 1;
        for (let i = 0; i < p2 / 2; i++) m.push({ id: 'M' + (id++), round: 1, a: i + 1 <= N ? i + 1 : null, b: p2 - i <= N ? p2 - i : null, next: 'M' + (p2 / 2 + 1 + Math.floor(i / 2)) });
        let cur = p2 / 4, rd = 2;
        while (cur >= 1) { for (let i = 0; i < cur; i++) m.push({ id: 'M' + (id++), round: rd, a: null, b: null, next: cur > 1 ? 'M' + (id + cur - i - 1) : null }); cur /= 2; rd++; }
        return res(200, { format: 'knockout', matches: m });
      }
      if (body.format === 'group') return res(200, { format: 'group', groups: [{ teams: [1, 2, 3], matches: [{ round: 1, a: 1, b: 2 }, { round: 2, a: 2, b: 3 }, { round: 3, a: 1, b: 3 }] }] });
      return res(200, { format: 'roundrobin', total: matches.length, expected: N * (N - 1) / 2, matches });
    }
    if (path === '/api/tournaments') return res(200, db.tournaments);
    if (path === '/api/matchmaking') {
      const ps = (body.players || []).slice(0, 4);
      return res(200, { teams: [[{ id: ps[0]?.name || 'A', level: ps[0]?.level || 'TB' }, { id: ps[3]?.name || 'D', level: ps[3]?.level || 'TB' }], [{ id: ps[1]?.name || 'B', level: ps[1]?.level || 'TB' }, { id: ps[2]?.name || 'C', level: ps[2]?.level || 'TB' }]], diff: 0.5 });
    }
    if (path === '/api/opponents') {
      return res(200, db.opponents.map(o => ({ ...o, isMe: !!me && ((o.user_id != null && o.user_id === me.id) || samePerson(me.name, o.name)) })));
    }
    if (path === '/api/challenges') {
      if (method === 'GET') {
        return res(200, db.challenges.map(c => {
          const op = db.opponents.find(x => x.id === c.opponent_id);
          const isChallenger = !!me && ((c.challenger_id != null && c.challenger_id === me.id) || samePerson(me.name, c.challenger_name));
          const isOpponent = !!me && !isChallenger && ((op?.user_id != null && op.user_id === me.id) || samePerson(me.name, c.opponent_name));
          return { ...c, isChallenger, isOpponent, canAccept: c.status === 'OPEN' && isOpponent, canCancel: c.status === 'OPEN' && isChallenger };
        }));
      }
      if (!me) return res(401, { message: 'Vui lòng đăng nhập' });
      const op = db.opponents.find(x => x.id === +body.opponentId);
      if (!op) return res(400, { message: 'Đối thủ không hợp lệ' });
      if ((op.user_id != null && op.user_id === me.id) || samePerson(me.name, op.name))
        return res(400, { message: 'Bạn không thể tự gửi lời thách đấu cho chính mình!' });
      const ch = { id: Date.now(), challenger_id: me.id, challenger_name: me.name, opponent_id: op.id, opponent_name: op.name, match_type: body.matchType || 'Đôi nam', court: body.court || 1, play_date: body.playDate || tomorrow, slot_time: body.slotTime || '18:30 – 20:00', shuttle_note: body.shuttleNote || 'Chia tiền sân & cầu', message: body.message || '', status: 'OPEN', created: Date.now() };
      db.challenges.unshift(ch); saveDB(db); emitLocal('changed'); return res(201, ch);
    }
    if (path.startsWith('/api/challenges/')) {
      if (!me) return res(401, { message: 'Vui lòng đăng nhập' });
      const parts = path.split('/'), id = +parts[3], act = parts[4];
      const ch = db.challenges.find(x => x.id === id);
      if (!ch) return res(404, {});
      const isChallenger = (ch.challenger_id != null && ch.challenger_id === me.id) || samePerson(me.name, ch.challenger_name);
      const op = db.opponents.find(x => x.id === ch.opponent_id);
      const isOpponent = !isChallenger && ((op?.user_id != null && op.user_id === me.id) || samePerson(me.name, ch.opponent_name));
      if (act === 'accept') {
        if (isChallenger) return res(403, { message: 'Bạn là người tạo lời thách đấu này, không thể tự chấp nhận!' });
        if (!isOpponent) return res(403, { message: `Chỉ ${ch.opponent_name} mới có quyền chấp nhận lời thách đấu này!` });
        ch.status = 'ACCEPTED'; saveDB(db); emitLocal('changed'); return res(200, { ok: true });
      }
      if (act === 'decline') {
        if (!isOpponent) return res(403, { message: `Chỉ ${ch.opponent_name} mới có quyền từ chối!` });
        ch.status = 'DECLINED'; saveDB(db); emitLocal('changed'); return res(200, { ok: true });
      }
      if (act === 'cancel') {
        if (!isChallenger) return res(403, { message: 'Chỉ người tạo kèo mới được hủy!' });
        db.challenges = db.challenges.filter(x => x.id !== id); saveDB(db); emitLocal('changed'); return res(200, { ok: true });
      }
    }
    if (path === '/api/matches') {
      if (method === 'GET') return res(200, db.matches);
      let wa = 0, wb = 0; (body.scores || []).forEach(s => { if (s.a > s.b) wa++; else if (s.b > s.a) wb++; });
      if (wa === wb) return res(400, { message: 'Trận đấu phải có đội thắng' });
      const winner = wa > wb ? 'A' : 'B', delta = body.mode === 'RANKED' ? 16 : 10;
      const m = { id: Date.now(), match_type: body.matchType, mode: body.mode, court: body.court, play_date: today, team_a: body.teamA, team_b: body.teamB, level_a: 'TB+', level_b: 'TB+', scores: body.scores, winner, elo_delta: delta, shuttles: body.shuttles || 2, duration_min: 42, verified: 1, created: Date.now() };
      db.matches.unshift(m);
      db.opponents.forEach(op => {
        const inA = m.team_a.toLowerCase().includes(op.name.toLowerCase());
        const inB = m.team_b.toLowerCase().includes(op.name.toLowerCase());
        if (inA || inB) {
          const won = (inA && winner === 'A') || (inB && winner === 'B');
          op.elo += won ? delta : -delta; op.rank_tier = tierOf(op.elo);
          won ? op.wins++ : op.losses++;
        }
      });
      saveDB(db); return res(201, { id: m.id, winner, eloDelta: delta });
    }
    if (path === '/api/leaderboard') return res(200, [...db.opponents].sort((a, b) => b.elo - a.elo));
    if (path === '/api/coaches') return res(200, db.coaches);
    if (path === '/api/coaches/bookings') return res(200, db.coach_bookings);
    if (path === '/api/coaches/book') {
      const c = db.coaches.find(x => x.id === +body.coachId);
      if (!c) return res(400, { message: 'Chọn HLV' });
      const price = body.classType === '1ON1' ? c.price_1on1 : c.price_group;
      const cb = { id: Date.now(), coach_id: c.id, coach_name: c.name, student_name: body.studentName, class_type: body.classType, date: body.date, time_slot: body.timeSlot, price, status: 'CONFIRMED', created: Date.now() };
      db.coach_bookings.unshift(cb); saveDB(db); return res(201, cb);
    }
    if (path === '/api/clubs') return res(200, db.clubs.map(c => ({ ...c, joined: !!me && (c.joins || []).includes(me.id) })));
    if (path.startsWith('/api/clubs/') && path.endsWith('/join')) {
      if (!me) return res(401, { message: 'Vui lòng đăng nhập' });
      const id = +path.split('/')[3], c = db.clubs.find(x => x.id === id);
      if (!c) return res(404, {});
      c.joins = c.joins || [];
      if (c.joins.includes(me.id)) return res(409, { message: 'Bạn đã là thành viên CLB này' });
      c.joins.push(me.id); c.members_count++; saveDB(db); return res(200, { ok: true });
    }
    if (path === '/api/stringing') {
      if (method === 'GET') return res(200, { orders: db.stringing_orders });
      const PRICES = { 'Yonex BG65': 140000, 'Yonex BG65 Titanium': 160000, 'Yonex BG80 Power': 195000, 'Yonex Exbolt 63': 210000, 'Yonex Exbolt 65': 210000, 'Yonex Aerobite': 230000, 'Lining No.1': 165000 };
      const ord = { id: Date.now(), customer_name: body.customerName, racket_model: body.racketModel, string_name: body.stringName, tension_kg: body.tensionKg, pattern: body.pattern, price: PRICES[body.stringName] || 160000, created: Date.now() };
      db.stringing_orders.unshift(ord); saveDB(db); return res(201, ord);
    }
    if (path === '/api/nhom3/book') {
      const c = +body.court, sH = +body.startH, eH = +body.endH, date = body.date;
      if (eH <= sH) return res(400, { message: `Lỗi thứ tự giờ (T5): Giờ kết thúc (${eH}h) phải lớn hơn giờ bắt đầu (${sH}h)!` });
      if (sH < 6 || eH > 22) return res(400, { message: `Ngoài giờ mở cửa (T5): Sân chỉ mở từ 6h đến 22h!` });
      if (!date || date < today) return res(400, { message: `Lỗi thời gian quá khứ (T4): Không thể đặt ngày/giờ đã qua!` });
      const from = (sH - 6) * 2, to = (eH - 6) * 2;
      const conf = db.bookings.find(b => b.court === c && b.date === date && ['PENDING', 'CONFIRMED', 'PLAYING'].includes(b.status) && b.from < to && from < b.to);
      if (conf) return res(409, { message: `Báo trùng lịch (T3): Sân ${c} ngày ${date} đã có lịch ${6 + conf.from/2}h – ${6 + conf.to/2}h!` });
      const amount = calcPrice(db, date, from, to);
      const bk = { code: 'BK' + (Date.now() % 1e7).toString(36).toUpperCase(), court: c, date, from, to, name: body.name || me?.name || 'Sinh viên HVU', user_id: me?.id || null, status: 'CONFIRMED', amount, deposit: Math.round(amount * db.cfg.deposit_pct / 100), holdUntil: null, created: Date.now(), items: [] };
      db.bookings.unshift(bk); saveDB(db); emitLocal('changed'); return res(201, bk);
    }
    if (path.startsWith('/api/nhom3/move/')) {
      const code = path.split('/').pop(), b = db.bookings.find(x => x.code === code);
      if (!b) return res(404, {});
      const len = b.to - b.from, to = body.from + len;
      if (db.bookings.some(x => x.code !== code && x.court === body.court && x.date === b.date && ['PENDING', 'CONFIRMED', 'PLAYING'].includes(x.status) && x.from < to && body.from < x.to))
        return res(409, { message: 'Không thể chuyển: khung giờ đích đã có người đặt!' });
      const amt = calcPrice(db, b.date, body.from, to), diff = amt - b.amount;
      b.court = body.court; b.from = body.from; b.to = to; b.amount = amt; saveDB(db); emitLocal('changed');
      return res(200, { diff, amount: amt });
    }
    if (path.startsWith('/api/nhom3/cancel/')) {
      const code = path.split('/').pop(), b = db.bookings.find(x => x.code === code);
      if (b) { b.status = 'CANCELLED'; saveDB(db); emitLocal('changed'); }
      return res(200, { ok: true });
    }
    if (path === '/api/nhom3/reset') {
      if (body.date) db.bookings = db.bookings.filter(b => b.date !== body.date);
      else db.bookings = [];
      saveDB(db); emitLocal('changed'); return res(200, { ok: true });
    }
    return res(200, {});
  }

  // Intercept fetch('/api/...')
  const origFetch = window.fetch.bind(window);
  let useLocalEngine = false;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input.url;
    if (url && url.startsWith('/api/')) {
      if (window.API_BASE) {
        return origFetch(window.API_BASE.replace(/\/$/, '') + url, init);
      }
      if (useLocalEngine) {
        return handleLocalApi(url, init);
      }
      try {
        const r = await origFetch(input, init);
        const ct = r.headers.get('content-type') || '';
        // Trên InfinityFree khi không có Node.js backend, /api/... trả về 404 hoặc trang HTML lỗi của InfinityFree
        if (r.status === 404 && !ct.includes('application/json')) {
          useLocalEngine = true;
          return handleLocalApi(url, init);
        }
        return r;
      } catch {
        useLocalEngine = true;
        return handleLocalApi(url, init);
      }
    }
    return origFetch(input, init);
  };
})();
