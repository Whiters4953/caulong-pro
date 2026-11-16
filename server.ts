import fs from 'node:fs';
// Tính tiền động: tách đoạn giờ theo từng khung giá (thường -> cao điểm), block 15 phút
export interface Rule { startMin: number; endMin: number; perHour: number }

export function priceRange(start: Date, end: Date, rules: Rule[]) {
  let total = 0;
  for (let t = start.getTime(); t < end.getTime(); t += 15 * 60000) {
    const d = new Date(t);
    const m = d.getHours() * 60 + d.getMinutes();
    const r = rules.find(x => m >= x.startMin && m < x.endMin);
    if (!r) throw new Error('Thiếu bảng giá cho ' + d.toISOString());
    total += r.perHour / 4;
  }
  return Math.round(total);
}

// Vòng tròn Berger (circle method): N đội -> N-1 lượt (N chẵn), tổng M = N(N-1)/2 trận.
export interface Pairing { round: number; a: number | null; b: number | null }

export function berger(teams: number[]): Pairing[] {
  const list: (number | null)[] = [...teams];
  if (list.length % 2) list.push(null);           // null = bye
  const n = list.length;
  const out: Pairing[] = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      let a = list[i], b = list[n - 1 - i];
      if (i === 0 && r % 2 === 1) [a, b] = [b, a]; // cân bằng sân nhà/thứ tự
      if (a !== null && b !== null) out.push({ round: r + 1, a, b });
    }
    // xoay: giữ phần tử đầu, dời phần tử cuối lên vị trí 1
    list.splice(1, 0, list.pop()!);
  }
  return out;
}

// Xếp trận lên nhiều sân; VĐV (có thể thuộc nhiều nội dung) không bị trùng khung giờ.
export interface M { id: string; players: string[]; round: number }
export function schedule(matches: M[], courts: number, slotMin: number, start: Date) {
  const res: { id: string; court: number; start: Date }[] = [];
  const busy = new Map<string, Set<number>>();      // player -> các slot đã bận
  const used = new Map<number, number>();           // slot -> số sân đã dùng
  for (const m of [...matches].sort((x, y) => x.round - y.round)) {
    let s = 0;
    while (true) {
      const free = (used.get(s) ?? 0) < courts &&
        m.players.every(p => !busy.get(p)?.has(s) && !busy.get(p)?.has(s - 1)); // s-1: bắt buộc nghỉ 1 slot
      if (free) break;
      s++;
    }
    const court = used.get(s) ?? 0;
    used.set(s, court + 1);
    m.players.forEach(p => (busy.get(p) ?? busy.set(p, new Set()).get(p)!).add(s));
    res.push({ id: m.id, court: court + 1, start: new Date(start.getTime() + s * slotMin * 60000) });
  }
  return res;
}


// Single elimination + hạt giống + chia bảng + ghép cặp trình độ
export interface Match { id: string; round: number; a: number | null; b: number | null; next?: string }

const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(n, 2)));

// Thứ tự vị trí chuẩn để hạt giống 1 và 2 chỉ gặp nhau ở chung kết
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap(s => [s, n + 1 - s]);
  }
  return order;
}

// entries đã sắp theo hạt giống (index 0 = hạt giống 1). Slot thiếu = bye (null).
export function knockout(entries: number[]): Match[] {
  const size = nextPow2(entries.length);
  const pos = seedOrder(size).map(s => entries[s - 1] ?? null);
  const matches: Match[] = [];
  const rounds = Math.log2(size);
  for (let r = 1; r <= rounds; r++) {
    const cnt = size / 2 ** r;
    for (let i = 0; i < cnt; i++) {
      matches.push({
        id: `R${r}M${i + 1}`, round: r,
        a: r === 1 ? pos[2 * i] : null, b: r === 1 ? pos[2 * i + 1] : null,
        next: r < rounds ? `R${r + 1}M${Math.floor(i / 2) + 1}` : undefined,
      });
    }
  }
  return matches;
}

// Chia bảng kiểu rắn (snake) theo hạt giống
export function groups(entries: number[], g: number): number[][] {
  const res: number[][] = Array.from({ length: g }, () => []);
  entries.forEach((e, i) => {
    const row = Math.floor(i / g), col = i % g;
    res[row % 2 === 0 ? col : g - 1 - col].push(e);
  });
  return res;
}

// ---- Ghép cặp vãng lai ----
export const LEVELS = ['Y', 'TB-', 'TB', 'TB+', 'TBK', 'KHA', 'TOT'];
export interface P { id: string; level: string; played: number; lastEnd: number }

// Chia 4 người thành 2 đội cân bằng: thử 3 cách chia, chọn chênh lệch trình độ nhỏ nhất
export function balanceDoubles(p: [P, P, P, P]) {
  const lv = (x: P) => LEVELS.indexOf(x.level);
  const opts: [[P, P], [P, P]][] = [
    [[p[0], p[1]], [p[2], p[3]]], [[p[0], p[2]], [p[1], p[3]]], [[p[0], p[3]], [p[1], p[2]]]];
  return opts
    .map(o => ({ teams: o, diff: Math.abs(lv(o[0][0]) + lv(o[0][1]) - lv(o[1][0]) - lv(o[1][1])) }))
    .sort((x, y) => x.diff - y.diff)[0];
}

// Chọn 4 người cho trận kế tiếp: ưu tiên ít trận nhất, nghỉ lâu nhất
export function pickNextFour(pool: P[]): [P, P, P, P] {
  if (pool.length < 4) throw new Error('Cần ít nhất 4 người');
  return [...pool].sort((a, b) => a.played - b.played || a.lastEnd - b.lastEnd).slice(0, 4) as [P, P, P, P];
}

// Live score luật BWF: tới 21, hơn 2 điểm, chạm trần 30 (29-29 thì ai ăn điểm thứ 30 thắng); thắng 2/3 ván.
export interface Game { a: number; b: number }
export interface ScoreState { games: Game[]; winner: 'A' | 'B' | null }

export const gameWinner = ({ a, b }: Game): 'A' | 'B' | null => {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (hi >= 30) return a > b ? 'A' : 'B';
  if (hi >= 21 && hi - lo >= 2) return a > b ? 'A' : 'B';
  return null;
};

const calcMatchWinner = (games: Game[]): 'A' | 'B' | null => {
  const wins = { A: 0, B: 0 };
  for (const g of games) {
    const w = gameWinner(g);
    if (w) wins[w]++;
  }
  return wins.A >= 2 ? 'A' : wins.B >= 2 ? 'B' : null;
};

export function addPoint(s: ScoreState, side: 'A' | 'B'): ScoreState {
  if (s.winner) throw new Error('Trận đã kết thúc');
  const games = s.games.length ? s.games.map(g => ({ ...g })) : [{ a: 0, b: 0 }];
  let cur = games[games.length - 1];
  if (gameWinner(cur)) { cur = { a: 0, b: 0 }; games.push(cur); }
  side === 'A' ? cur.a++ : cur.b++;
  return { games, winner: calcMatchWinner(games) };
}

export function subPoint(s: ScoreState, side: 'A' | 'B'): ScoreState {
  if (!s.games.length) return { games: [], winner: null };
  const games = s.games.map(g => ({ ...g }));
  let cur = games[games.length - 1];
  // Nếu ván hiện tại đang 0-0 và có ván trước đó thì lùi về ván trước
  if (cur.a === 0 && cur.b === 0 && games.length > 1) {
    games.pop();
    cur = games[games.length - 1];
  }
  const key = side === 'A' ? 'a' : 'b';
  if (cur[key] > 0) cur[key]--;
  if (games.length === 1 && games[0].a === 0 && games[0].b === 0) {
    return { games: [], winner: null };
  }
  return { games, winner: calcMatchWinner(games) };
}

// Server hoàn thiện: SQLite bền vững + đăng nhập + phân quyền + đặt sân + POS + giải đấu.
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { DatabaseSync } from 'node:sqlite';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(process.env.DB_FILE ?? path.join(DIR, 'data.sqlite'));
db.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, phone TEXT UNIQUE, pass TEXT, role TEXT DEFAULT 'PLAYER', points INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER, created INTEGER);
CREATE TABLE IF NOT EXISTS bookings(code TEXT PRIMARY KEY, court INTEGER, date TEXT, from_s INTEGER, to_s INTEGER, name TEXT, user_id INTEGER,
  status TEXT, amount INTEGER, deposit INTEGER, hold_until INTEGER, created INTEGER);
CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, code TEXT, name TEXT, qty INTEGER, price INTEGER);
CREATE TABLE IF NOT EXISTS inventory(id INTEGER PRIMARY KEY, name TEXT, price INTEGER, stock INTEGER, low INTEGER);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at INTEGER, who TEXT, action TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS ix_b ON bookings(date, court);
`);

// ---- Seed ----
const hash = (p: string) => { const s = randomBytes(16).toString('hex'); return s + ':' + scryptSync(p, s, 32).toString('hex'); };
const verify = (p: string, h: string) => { const [s, k] = h.split(':'); return timingSafeEqual(scryptSync(p, s, 32), Buffer.from(k, 'hex')); };
if (!db.prepare('SELECT 1 FROM users').get()) {
  const u = db.prepare('INSERT INTO users(name,phone,pass,role) VALUES (?,?,?,?)');
  u.run('Chủ sân', '0900000001', hash('admin123'), 'OWNER');
  u.run('Quản lý', '0900000002', hash('manager123'), 'MANAGER');
  u.run('Thu ngân', '0900000003', hash('cashier123'), 'CASHIER');
  const i = db.prepare('INSERT INTO inventory(name,price,stock,low) VALUES (?,?,?,?)');
  [['Nước suối', 10000, 50, 10], ['Nước tăng lực', 20000, 30, 8], ['Ống cầu (Hải Yến)', 280000, 12, 3],
   ['Thuê vợt', 30000, 10, 2], ['Quấn cán', 15000, 40, 10]].forEach(r => i.run(...r as [string, number, number, number]));
}

db.exec('CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT)');
const DEFAULTS: Record<string, number> = { courts: 6, off_price: 60000, peak_price: 100000, peak_from: 17, weekend_pct: 20, deposit_pct: 30 };
const CFG: Record<string, number> = { ...DEFAULTS };
for (const r of db.prepare('SELECT * FROM settings').all() as any[]) CFG[r.key] = Number(r.value);
const COURTS: number[] = [];
const syncCourts = () => { COURTS.length = 0; for (let i = 1; i <= CFG.courts; i++) COURTS.push(i); };
syncCourts();
const START_H = 6, SLOTS = 34, HOLD_MS = 10 * 60 * 1000;
const RANK: Record<string, number> = { PLAYER: 0, CASHIER: 1, MANAGER: 2, OWNER: 3 };
const ACTIVE = `('PENDING','CONFIRMED','PLAYING')`;

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => { // header bảo mật cơ bản + CORS cho tên miền ngoài (VD: caulongpro.lovestoblog.com)
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return void res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '200kb', verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
const hits = new Map<string, { n: number; t: number }>();
const limit = (name: string, max: number): express.RequestHandler => (req, res, next) => {
  const k = name + ':' + req.ip, now = Date.now(), h = hits.get(k);
  if (!h || now - h.t > 60000) { hits.set(k, { n: 1, t: now }); return next(); }
  if (++h.n > max) return void res.status(429).json({ message: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút' });
  next();
};
app.use('/api/login', limit('login', Number(process.env.RATE_LOGIN ?? 40)));
app.use('/api/register', limit('register', Number(process.env.RATE_LOGIN ?? 40)));
app.use('/api/hold', limit('hold', Number(process.env.RATE_HOLD ?? 200)));
const http = createServer(app);
const io = new Server(http);
app.use(express.static((fs.existsSync(path.join(DIR, 'web')) ? path.join(DIR, 'web') : path.join(DIR, '../../web')), { extensions: ['html'] }));
const push = () => io.emit('changed');

const slotDate = (date: string, s: number) =>
  new Date(`${date}T${String(START_H + Math.floor(s / 2)).padStart(2, '0')}:${s % 2 ? '30' : '00'}:00`);
const rulesFor = (date: string) => {
  const wk = [0, 6].includes(new Date(date + 'T12:00:00').getDay()) ? 1 + CFG.weekend_pct / 100 : 1;
  return [{ startMin: 0, endMin: CFG.peak_from * 60, perHour: CFG.off_price * wk }, { startMin: CFG.peak_from * 60, endMin: 1440, perHour: CFG.peak_price * wk }];
};
const expire = () => db.prepare(`UPDATE bookings SET status='EXPIRED' WHERE status='PENDING' AND hold_until < ?`).run(Date.now()).changes > 0;
setInterval(() => expire() && push(), 5000);
const log = (who: string, action: string, detail: string) =>
  db.prepare('INSERT INTO audit(at,who,action,detail) VALUES (?,?,?,?)').run(Date.now(), who, action, detail);

type U = { id: number; name: string; phone: string; role: string; points: number };
const userOf = (req: express.Request): U | null => {
  const t = (req.headers.authorization ?? '').replace('Bearer ', '');
  if (!t) return null;
  return (db.prepare('SELECT u.id,u.name,u.phone,u.role,u.points FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?').get(t) as U) ?? null;
};
const need = (min: string): express.RequestHandler => (req, res, next) => {
  const u = userOf(req);
  if (!u) return void res.status(401).json({ message: 'Vui lòng đăng nhập' });
  if (RANK[u.role] < RANK[min]) return void res.status(403).json({ message: 'Bạn không có quyền thực hiện' });
  (req as any).user = u; next();
};

const toB = (r: any) => ({ code: r.code, court: r.court, date: r.date, from: r.from_s, to: r.to_s, name: r.name, status: r.status,
  amount: r.amount, deposit: r.deposit, holdUntil: r.hold_until,
  items: db.prepare('SELECT name,qty,price FROM items WHERE code=?').all(r.code) });

// ---- Auth ----
const session = (id: number) => { const t = randomBytes(24).toString('hex'); db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(t, id, Date.now()); return t; };
const pub = (u: any) => ({ id: u.id, name: u.name, phone: u.phone, role: u.role, points: u.points });
app.post('/api/register', (req, res) => {
  const { name, phone, password } = req.body ?? {};
  if (!name || !/^0\d{9}$/.test(phone ?? '') || (password ?? '').length < 6)
    return res.status(400).json({ message: 'Tên, SĐT 10 số và mật khẩu ≥ 6 ký tự là bắt buộc' });
  if (db.prepare('SELECT 1 FROM users WHERE phone=?').get(phone)) return res.status(409).json({ message: 'SĐT đã được đăng ký' });
  const id = Number(db.prepare('INSERT INTO users(name,phone,pass) VALUES (?,?,?)').run(name, phone, hash(password)).lastInsertRowid);
  res.status(201).json({ token: session(id), user: pub(db.prepare('SELECT * FROM users WHERE id=?').get(id)) });
});
app.post('/api/login', (req, res) => {
  const { phone, password } = req.body ?? {};
  const u: any = db.prepare('SELECT * FROM users WHERE phone=?').get(phone ?? '');
  if (!u || !verify(String(password ?? ''), u.pass)) return res.status(401).json({ message: 'Sai SĐT hoặc mật khẩu' });
  res.json({ token: session(u.id), user: pub(u) });
});
app.get('/api/me', (req, res) => { const u = userOf(req); u ? res.json(u) : res.sendStatus(401); });
app.post('/api/logout', (req, res) => { db.prepare('DELETE FROM sessions WHERE token=?').run((req.headers.authorization ?? '').replace('Bearer ', '')); res.sendStatus(204); });

// ---- Đặt sân ----
app.get('/api/state', (req, res) => {
  expire();
  const date = String(req.query.date);
  const rows = db.prepare(`SELECT * FROM bookings WHERE date=? AND status IN ${ACTIVE}`).all(date);
  const u = userOf(req);
  const staff = !!u && RANK[u.role] >= 1;
  res.json({ courts: COURTS, startH: START_H, slots: SLOTS, now: Date.now(), rules: rulesFor(date), depositPct: CFG.deposit_pct,
    bookings: rows.map((r: any) => { const b = toB(r); return staff ? b : { ...b, name: 'Đã đặt', items: [] }; }) });
});

const overlap = db.prepare(`SELECT 1 FROM bookings WHERE status IN ${ACTIVE} AND court=? AND date=? AND code<>? AND from_s<? AND ?<to_s`);
app.post('/api/hold', (req, res) => {
  expire();
  const { court, date, from, to } = req.body ?? {};
  const u = userOf(req);
  const name = u?.name ?? String(req.body?.name ?? '').trim();
  if (!COURTS.includes(court) || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !(from >= 0 && to > from && to <= SLOTS) || !name)
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
  if (slotDate(date, from).getTime() < Date.now() - 30 * 60000) return res.status(400).json({ message: 'Không thể đặt giờ đã qua' });
  // node:sqlite đồng bộ => kiểm tra + ghi nguyên tử (tương đương transaction/lock)
  if (overlap.get(court, date, '', to, from)) return res.status(409).json({ message: 'Khung giờ vừa có người đặt, vui lòng chọn lại' });
  const amount = priceRange(slotDate(date, from), slotDate(date, to), rulesFor(date));
  const code = 'BK' + (Date.now() % 1e8).toString(36).toUpperCase() + randomBytes(1).toString('hex').toUpperCase();
  db.prepare('INSERT INTO bookings(code,court,date,from_s,to_s,name,user_id,status,amount,deposit,hold_until,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(code, court, date, from, to, name, u?.id ?? null, 'PENDING', amount, Math.round(amount * CFG.deposit_pct / 100), Date.now() + HOLD_MS, Date.now());
  push(); res.status(201).json(toB(db.prepare('SELECT * FROM bookings WHERE code=?').get(code)));
});

app.get('/api/booking/:code', (req, res) => {
  expire();
  const r = db.prepare('SELECT * FROM bookings WHERE code=?').get(req.params.code);
  r ? res.json(toB(r)) : res.sendStatus(404);
});

// Webhook thanh toán. Khi triển khai thật: bắt buộc header x-webhook-secret; ở demo, nút mô phỏng gọi qua đây.
app.post('/api/pay/:code', (req, res) => {
  expire();
  // Chế độ demo: nút "mô phỏng chuyển khoản". Khi đặt WEBHOOK_SECRET (production) endpoint này bị tắt,
  // chỉ webhook có chữ ký (/api/webhooks/payment) mới được xác nhận thanh toán.
  if (process.env.WEBHOOK_SECRET) return res.status(403).json({ message: 'Thanh toán chỉ được xác nhận qua webhook ngân hàng' });
  const ch = db.prepare(`UPDATE bookings SET status='CONFIRMED', hold_until=NULL WHERE code=? AND status='PENDING'`).run(req.params.code).changes;
  if (!ch) return res.status(409).json({ message: 'Đơn đã hết hạn hoặc đã xử lý' });
  const nb: any = db.prepare('SELECT * FROM bookings WHERE code=?').get(req.params.code);
  notify(nb.user_id, `Đặt sân ${nb.code} đã được xác nhận: sân ${nb.court}, ${nb.date}`);
  push(); res.json(toB(nb));
});

app.get('/api/my', need('PLAYER'), (req, res) => {
  const u = (req as any).user as U;
  res.json({ user: u, bookings: db.prepare('SELECT * FROM bookings WHERE user_id=? ORDER BY created DESC').all(u.id).map(toB) });
});
app.post('/api/my/cancel/:code', need('PLAYER'), (req, res) => {
  const u = (req as any).user as U;
  const r: any = db.prepare('SELECT * FROM bookings WHERE code=? AND user_id=?').get(req.params.code, u.id);
  if (!r || !['PENDING', 'CONFIRMED'].includes(r.status)) return res.status(409).json({ message: 'Không thể hủy đơn này' });
  if (slotDate(r.date, r.from_s).getTime() - Date.now() < 2 * 3600e3 && r.status === 'CONFIRMED')
    return res.status(409).json({ message: 'Chỉ được hủy trước giờ chơi 2 tiếng (mất cọc nếu hủy muộn)' });
  db.prepare(`UPDATE bookings SET status='CANCELLED' WHERE code=?`).run(r.code);
  log(u.name, 'KHÁCH HỦY', r.code); push(); res.json({ ok: true });
});

// ---- Quản trị (CASHIER+) ----
app.post('/api/status/:code', need('CASHIER'), (req, res) => {
  const u = (req as any).user as U;
  const st = String(req.body.status);
  if (!['PLAYING', 'COMPLETED', 'CANCELLED'].includes(st)) return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
  if (st === 'CANCELLED' && RANK[u.role] < RANK.MANAGER) return res.status(403).json({ message: 'Chỉ Quản lý/Chủ sân được hủy đơn' });
  const r: any = db.prepare('SELECT * FROM bookings WHERE code=?').get(req.params.code);
  if (!r) return res.sendStatus(404);
  db.prepare('UPDATE bookings SET status=? WHERE code=?').run(st, r.code);
  if (st === 'CANCELLED') log(u.name, 'HỦY ĐƠN', `${r.code} - ${r.name}`);
  if (st === 'COMPLETED' && r.user_id) {
    const goods = (db.prepare('SELECT COALESCE(SUM(qty*price),0) t FROM items WHERE code=?').get(r.code) as any).t;
    db.prepare('UPDATE users SET points=points+? WHERE id=?').run(Math.floor((r.amount + goods) / 10000), r.user_id);
  }
  push(); res.json({ ok: true });
});

app.post('/api/move/:code', need('CASHIER'), (req, res) => {
  const u = (req as any).user as U;
  expire();
  const b: any = db.prepare('SELECT * FROM bookings WHERE code=?').get(req.params.code);
  if (!b) return res.sendStatus(404);
  const { court, from } = req.body; const to = from + (b.to_s - b.from_s);
  if (!COURTS.includes(court) || from < 0 || to > SLOTS || overlap.get(court, b.date, b.code, to, from))
    return res.status(409).json({ message: 'Không thể chuyển: trùng lịch' });
  const amt = priceRange(slotDate(b.date, from), slotDate(b.date, to), rulesFor(b.date));
  db.prepare('UPDATE bookings SET court=?, from_s=?, to_s=?, amount=? WHERE code=?').run(court, from, to, amt, b.code);
  log(u.name, 'ĐỔI SÂN/GIỜ', `${b.code}: sân ${b.court}→${court}, chênh ${amt - b.amount} đ`);
  push(); res.json({ diff: amt - b.amount });
});

app.get('/api/admin', need('CASHIER'), (req, res) => {
  expire();
  const u = (req as any).user as U;
  res.json({ bookings: db.prepare('SELECT * FROM bookings ORDER BY created DESC LIMIT 100').all().map(toB),
    inventory: db.prepare('SELECT * FROM inventory').all(),
    audit: RANK[u.role] >= 2 ? db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 30').all() : null });
});

app.post('/api/pos', need('CASHIER'), (req, res) => {
  const qty = Number(req.body.qty);
  const b: any = db.prepare('SELECT * FROM bookings WHERE code=?').get(req.body.code);
  const it: any = db.prepare('SELECT * FROM inventory WHERE id=?').get(req.body.itemId);
  if (!b || !it || !(qty > 0)) return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
  if (it.stock < qty) return res.status(409).json({ message: `Kho chỉ còn ${it.stock}` });
  db.prepare('UPDATE inventory SET stock=stock-? WHERE id=?').run(qty, it.id);
  db.prepare('INSERT INTO items(code,name,qty,price) VALUES (?,?,?,?)').run(b.code, it.name, qty, it.price);
  push(); res.json({ lowStock: it.stock - qty <= it.low });
});

app.post('/api/inventory/:id/restock', need('MANAGER'), (req, res) => {
  const q = Number(req.body.qty);
  if (!(q > 0)) return res.status(400).json({ message: 'Số lượng không hợp lệ' });
  db.prepare('UPDATE inventory SET stock=stock+? WHERE id=?').run(q, req.params.id);
  log((req as any).user.name, 'NHẬP KHO', `#${req.params.id} +${q}`); push(); res.json({ ok: true });
});

app.get('/api/report', need('MANAGER'), (_req, res) => {
  const ok = `status IN ('CONFIRMED','PLAYING','COMPLETED')`;
  const court = (db.prepare(`SELECT COALESCE(SUM(amount),0) t FROM bookings WHERE ${ok}`).get() as any).t;
  const goods = (db.prepare(`SELECT COALESCE(SUM(i.qty*i.price),0) t FROM items i JOIN bookings b ON b.code=i.code WHERE b.status IN ('CONFIRMED','PLAYING','COMPLETED')`).get() as any).t;
  const count = (db.prepare(`SELECT COUNT(*) c FROM bookings WHERE ${ok}`).get() as any).c;
  const fill = (db.prepare(`SELECT date, SUM(to_s-from_s) u FROM bookings WHERE ${ok} GROUP BY date ORDER BY date DESC LIMIT 7`).all() as any[])
    .map(r => ({ date: r.date, pct: Math.round(r.u / (COURTS.length * SLOTS) * 100) })).reverse();
  const hours = (db.prepare(`SELECT from_s, to_s FROM bookings WHERE ${ok}`).all() as any[]);
  const heat = Array.from({ length: SLOTS }, (_, s) => hours.filter(h => s >= h.from_s && s < h.to_s).length);
  res.json({ court, goods, total: court + goods, count, fill, heat, startH: START_H });
});

// ---- Giải đấu / ghép cặp (công khai) ----
app.post('/api/tournament', (req, res) => {
  const { format, n, courts = 2, slotMin = 30 } = req.body;
  const N = Math.min(Math.max(Number(n), 2), 16);
  const ids = Array.from({ length: N }, (_, i) => i + 1);
  if (format === 'knockout') return res.json({ format, matches: knockout(ids) });
  if (format === 'group') return res.json({ format, groups: groups(ids, N >= 8 ? 2 : 1).map(t => ({ teams: t, matches: berger(t) })) });
  const pairs = berger(ids);
  const sch = schedule(pairs.map((p, i) => ({ id: String(i), players: ['T' + p.a, 'T' + p.b], round: p.round })),
    Math.min(Math.max(Number(courts), 1), 6), Number(slotMin), new Date('2026-01-01T08:00:00'));
  res.json({ format: 'roundrobin', total: pairs.length, expected: N * (N - 1) / 2,
    matches: pairs.map((p, i) => ({ ...p, court: sch[i].court, time: sch[i].start.toTimeString().slice(0, 5) })) });
});
db.exec('CREATE TABLE IF NOT EXISTS score_state(key TEXT PRIMARY KEY, value TEXT)');
const getSavedScore = (): ScoreState => {
  const r: any = db.prepare(`SELECT value FROM score_state WHERE key='referee'`).get();
  if (!r) return { games: [], winner: null };
  try { return JSON.parse(r.value); } catch { return { games: [], winner: null }; }
};
const saveScore = (st: ScoreState) => {
  db.prepare(`INSERT INTO score_state(key,value) VALUES ('referee',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(JSON.stringify(st));
};
app.get('/api/score', (_req, res) => res.json(getSavedScore()));
app.post('/api/score', (req, res) => {
  try {
    const action = req.body?.action ?? 'add';
    if (action === 'reset') {
      const empty: ScoreState = { games: [], winner: null };
      saveScore(empty);
      return res.json(empty);
    }
    const base: ScoreState = Array.isArray(req.body?.games) ? { games: req.body.games, winner: req.body.winner ?? null } : getSavedScore();
    const next = action === 'sub' ? subPoint(base, req.body.side) : addPoint(base, req.body.side);
    saveScore(next);
    res.json(next);
  } catch (e: any) { res.status(409).json({ message: e.message }); }
});
app.post('/api/matchmaking', (req, res) => {
  const pool: P[] = (req.body.players as { name: string; level: string; played: number }[])
    .map((p, i) => ({ id: p.name, level: LEVELS.includes(p.level) ? p.level : 'TB', played: p.played, lastEnd: i }));
  try { res.json(balanceDoubles(pickNextFour(pool))); } catch (e: any) { res.status(400).json({ message: e.message }); }
});

// ================= Đợt 3: hợp đồng cố định, hóa đơn, xuất CSV =================
db.exec(`
CREATE TABLE IF NOT EXISTS contracts(id INTEGER PRIMARY KEY, name TEXT, phone TEXT, court INTEGER, weekdays TEXT, from_s INTEGER, to_s INTEGER,
  valid_from TEXT, valid_to TEXT, deposit INTEGER, paid_until TEXT, status TEXT DEFAULT 'ACTIVE', created INTEGER);
CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY, user_id INTEGER, author TEXT, title TEXT, level TEXT, slots INTEGER, fee INTEGER, play_at TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS post_joins(post_id INTEGER, user_id INTEGER, PRIMARY KEY(post_id,user_id));
CREATE TABLE IF NOT EXISTS tournaments(id INTEGER PRIMARY KEY, name TEXT, format TEXT, n INTEGER, data TEXT, created INTEGER);
`);
try { db.exec('ALTER TABLE bookings ADD COLUMN contract_id INTEGER'); } catch { /* đã có cột */ }

const addDays = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

app.post('/api/contracts', need('MANAGER'), (req, res) => {
  const u = (req as any).user as U;
  const { name, phone = '', court, weekdays, from, to, validFrom, validTo, deposit = 0 } = req.body ?? {};
  const days: number[] = Array.isArray(weekdays) ? weekdays.map(Number).filter(x => x >= 0 && x <= 6) : [];
  if (!name || !COURTS.includes(court) || !days.length || !(from >= 0 && to > from && to <= SLOTS) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(validFrom ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(validTo ?? '') || validTo < validFrom)
    return res.status(400).json({ message: 'Thông tin hợp đồng không hợp lệ' });
  if (addDays(validFrom, 190) < validTo) return res.status(400).json({ message: 'Hợp đồng tối đa 6 tháng' });
  const cid = Number(db.prepare('INSERT INTO contracts(name,phone,court,weekdays,from_s,to_s,valid_from,valid_to,deposit,paid_until,created) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(name, phone, court, days.join(','), from, to, validFrom, validTo, Number(deposit), validFrom, Date.now()).lastInsertRowid);
  let created = 0; const skipped: string[] = [];
  const ins = db.prepare(`INSERT INTO bookings(code,court,date,from_s,to_s,name,user_id,status,amount,deposit,hold_until,created,contract_id) VALUES (?,?,?,?,?,?,NULL,'CONFIRMED',?,0,NULL,?,?)`);
  for (let d = validFrom; d <= validTo; d = addDays(d, 1)) {
    if (!days.includes(new Date(d + 'T12:00:00').getDay())) continue;
    if (overlap.get(court, d, '', to, from)) { skipped.push(d); continue; }
    ins.run(`CT${cid}-${d.replaceAll('-', '')}`, court, d, from, to, name, priceRange(slotDate(d, from), slotDate(d, to), rulesFor(d)), Date.now(), cid);
    created++;
  }
  log(u.name, 'TẠO HỢP ĐỒNG', `#${cid} ${name}: ${created} buổi, bỏ qua ${skipped.length} buổi trùng`);
  push(); res.status(201).json({ id: cid, created, skipped });
});
app.get('/api/contracts', need('CASHIER'), (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  res.json((db.prepare('SELECT * FROM contracts ORDER BY id DESC').all() as any[]).map(c => ({
    ...c, weekdays: c.weekdays.split(',').map(Number),
    sessions: (db.prepare(`SELECT COUNT(*) n FROM bookings WHERE contract_id=? AND status<>'CANCELLED'`).get(c.id) as any).n,
    dueSoon: c.status === 'ACTIVE' && c.paid_until < addDays(today, 7) })));
});
app.post('/api/contracts/:id/paid', need('MANAGER'), (req, res) => {
  const until = String(req.body?.until ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return res.status(400).json({ message: 'Ngày không hợp lệ' });
  db.prepare('UPDATE contracts SET paid_until=? WHERE id=?').run(until, req.params.id);
  log((req as any).user.name, 'THU TIỀN HỢP ĐỒNG', `#${req.params.id} đến ${until}`); res.json({ ok: true });
});
app.post('/api/contracts/:id/cancel', need('MANAGER'), (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const n = db.prepare(`UPDATE bookings SET status='CANCELLED' WHERE contract_id=? AND date>=? AND status='CONFIRMED'`).run(req.params.id, today).changes;
  db.prepare(`UPDATE contracts SET status='ENDED' WHERE id=?`).run(req.params.id);
  log((req as any).user.name, 'HỦY HỢP ĐỒNG', `#${req.params.id}, hủy ${n} buổi tương lai`); push(); res.json({ cancelled: n });
});

app.get('/api/invoice/:code', need('CASHIER'), (req, res) => {
  const b: any = db.prepare('SELECT * FROM bookings WHERE code=?').get(req.params.code);
  if (!b) return res.sendStatus(404);
  res.json({ ...toB(b), cashier: (req as any).user.name, printedAt: Date.now() });
});

app.get('/api/export.csv', need('MANAGER'), (_req, res) => {
  const rows = db.prepare(`SELECT b.code,b.date,b.court,b.from_s,b.to_s,b.name,b.status,b.amount,
    COALESCE((SELECT SUM(qty*price) FROM items i WHERE i.code=b.code),0) goods FROM bookings b ORDER BY b.date DESC`).all() as any[];
  const q = (v: any) => `"${String(v).replaceAll('"', '""')}"`;
  const lines = ['Mã,Ngày,Sân,Giờ bắt đầu,Giờ kết thúc,Khách,Trạng thái,Tiền giờ,Hàng hóa,Tổng'].concat(rows.map(r =>
    [r.code, r.date, r.court, lab(r.from_s), lab(r.to_s), r.name, r.status, r.amount, r.goods, r.amount + r.goods].map(q).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bao-cao.csv"');
  res.send('\uFEFF' + lines.join('\r\n'));
});
const lab = (s: number) => `${String(START_H + Math.floor(s / 2)).padStart(2, '0')}:${s % 2 ? '30' : '00'}`;

// ================= Đợt 4: giao lưu vãng lai + lưu giải đấu =================
app.get('/api/posts', (req, res) => {
  const u = userOf(req);
  const rows = db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM post_joins j WHERE j.post_id=p.id) joined FROM posts p WHERE p.play_at >= ? ORDER BY p.play_at`)
    .all(new Date(Date.now() - 3600e3).toISOString().slice(0, 16)) as any[];
  res.json(rows.map(p => ({ ...p, left: p.slots - p.joined, perHead: Math.ceil(p.fee / Math.max(1, p.joined + 1)),
    mine: !!u && !!db.prepare('SELECT 1 FROM post_joins WHERE post_id=? AND user_id=?').get(p.id, u.id) })));
});
app.post('/api/posts', need('PLAYER'), (req, res) => {
  const u = (req as any).user as U;
  const { title, level, slots, fee, playAt } = req.body ?? {};
  if (!String(title ?? '').trim() || !LEVELS.includes(level) || !(slots >= 1 && slots <= 20) || !(fee >= 0) || !playAt)
    return res.status(400).json({ message: 'Thông tin bài đăng không hợp lệ' });
  const id = db.prepare('INSERT INTO posts(user_id,author,title,level,slots,fee,play_at,created) VALUES (?,?,?,?,?,?,?,?)')
    .run(u.id, u.name, String(title).slice(0, 120), level, slots, Number(fee), String(playAt), Date.now()).lastInsertRowid;
  res.status(201).json({ id: Number(id) });
});
app.post('/api/posts/:id/join', need('PLAYER'), (req, res) => {
  const u = (req as any).user as U;
  const p: any = db.prepare('SELECT p.*, (SELECT COUNT(*) FROM post_joins j WHERE j.post_id=p.id) joined FROM posts p WHERE id=?').get(req.params.id);
  if (!p) return res.sendStatus(404);
  if (p.user_id === u.id) return res.status(409).json({ message: 'Bạn là người đăng bài này' });
  if (p.joined >= p.slots) return res.status(409).json({ message: 'Bài đăng đã đủ người' });
  const r = db.prepare('INSERT OR IGNORE INTO post_joins VALUES (?,?)').run(p.id, u.id);
  if (!r.changes) return res.status(409).json({ message: 'Bạn đã tham gia rồi' });
  res.json({ ok: true });
});

app.post('/api/tournaments', need('MANAGER'), (req, res) => {
  const { name, format, n, data } = req.body ?? {};
  if (!String(name ?? '').trim() || !data) return res.status(400).json({ message: 'Thiếu tên giải hoặc dữ liệu' });
  const id = db.prepare('INSERT INTO tournaments(name,format,n,data,created) VALUES (?,?,?,?,?)').run(String(name).slice(0, 80), format, n, JSON.stringify(data), Date.now()).lastInsertRowid;
  res.status(201).json({ id: Number(id) });
});
app.get('/api/tournaments', (_req, res) => res.json((db.prepare('SELECT id,name,format,n,created FROM tournaments ORDER BY id DESC').all())));
app.get('/api/tournaments/:id', (req, res) => {
  const t: any = db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.params.id);
  t ? res.json({ ...t, data: JSON.parse(t.data) }) : res.sendStatus(404);
});

// ================= Đợt 5: cấu hình, webhook thanh toán, thông báo, trực tiếp =================
import { createHmac } from 'node:crypto';

// ---- Cấu hình sân & bảng giá (Quản lý/Chủ sân) ----
const LIMITS: Record<string, [number, number]> = { courts: [1, 12], off_price: [0, 5e6], peak_price: [0, 5e6], peak_from: [6, 22], weekend_pct: [0, 200], deposit_pct: [0, 100] };
app.get('/api/settings', (_req, res) => res.json(CFG));
app.post('/api/settings', need('MANAGER'), (req, res) => {
  const body = req.body ?? {}; const next = { ...CFG };
  for (const k of Object.keys(LIMITS)) if (k in body) {
    const v = Number(body[k]);
    if (!Number.isFinite(v) || v < LIMITS[k][0] || v > LIMITS[k][1]) return res.status(400).json({ message: `Giá trị "${k}" phải từ ${LIMITS[k][0]} đến ${LIMITS[k][1]}` });
    next[k] = Math.round(v);
  }
  if (next.courts < CFG.courts && db.prepare(`SELECT 1 FROM bookings WHERE status IN ${ACTIVE} AND court>? AND date>=?`).get(next.courts, new Date().toISOString().slice(0, 10)))
    return res.status(409).json({ message: 'Không thể giảm số sân: còn lịch đặt trên các sân bị bỏ' });
  const up = db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for (const k of Object.keys(LIMITS)) { up.run(k, String(next[k])); CFG[k] = next[k]; }
  syncCourts(); log((req as any).user.name, 'ĐỔI CẤU HÌNH', JSON.stringify(next)); push(); res.json(CFG);
});

// ---- Cấu hình VietQR công khai (tài khoản nhận tiền đặt trong biến môi trường) ----
app.get('/api/config', (_req, res) => res.json({
  bank: process.env.BANK_BIN ?? '970422', account: process.env.BANK_ACCOUNT ?? '0123456789',
  accountName: process.env.BANK_ACCOUNT_NAME ?? 'CAU LONG PRO', demoPay: !process.env.WEBHOOK_SECRET }));

// ---- Webhook thanh toán có chữ ký HMAC-SHA256 (header x-signature = hex(HMAC(rawBody))) ----
app.post('/api/webhooks/payment', (req: any, res) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ message: 'Chưa cấu hình WEBHOOK_SECRET' });
  const sig = Buffer.from(String(req.headers['x-signature'] ?? ''), 'hex');
  const mac = createHmac('sha256', secret).update(req.rawBody ?? Buffer.alloc(0)).digest();
  if (sig.length !== mac.length || !timingSafeEqual(sig, mac)) return res.status(401).json({ message: 'Sai chữ ký' });
  expire();
  const m = /BK[0-9A-Z]+/.exec(String(req.body?.content ?? '').toUpperCase());
  const amount = Number(req.body?.amount);
  const b: any = m && db.prepare('SELECT * FROM bookings WHERE code=?').get(m[0]);
  if (!b) return res.status(404).json({ message: 'Không tìm thấy mã đặt sân trong nội dung chuyển khoản' });
  if (b.status !== 'PENDING') return res.status(409).json({ message: 'Đơn đã hết hạn hoặc đã xử lý (cần hoàn tiền thủ công)' });
  if (!(amount >= b.deposit)) return res.status(402).json({ message: `Thiếu tiền cọc: cần ${b.deposit}` });
  db.prepare(`UPDATE bookings SET status='CONFIRMED', hold_until=NULL WHERE code=?`).run(b.code);
  notify(b.user_id, `Đã nhận cọc ${amount}đ. Đặt sân ${b.code} xác nhận: sân ${b.court}, ${b.date}`);
  push(); res.json({ confirmed: b.code });
});

// ---- Thông báo (in-app + webhook Zalo/Email tùy chọn) & nhắc lịch ----
db.exec(`CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER, msg TEXT, created INTEGER, read INTEGER DEFAULT 0)`);
try { db.exec('ALTER TABLE bookings ADD COLUMN notified INTEGER DEFAULT 0'); } catch { /* đã có */ }
function notify(userId: number | null, msg: string) {
  if (!userId) return;
  db.prepare('INSERT INTO notifications(user_id,msg,created) VALUES (?,?,?)').run(userId, msg, Date.now());
  io.emit('notify', { userId });
  const url = process.env.NOTIFY_WEBHOOK_URL; // VD: Zalo OA gateway / n8n / email relay
  if (url) fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, msg }) }).catch(() => { });
}
app.get('/api/my/notifications', need('PLAYER'), (req, res) => {
  const u = (req as any).user as U;
  res.json(db.prepare('SELECT id,msg,created,read FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 30').all(u.id));
});
app.post('/api/my/notifications/read', need('PLAYER'), (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(((req as any).user as U).id); res.json({ ok: true });
});
export function remindNow(now = Date.now()) {
  let n = 0;
  for (const b of db.prepare(`SELECT * FROM bookings WHERE status='CONFIRMED' AND user_id IS NOT NULL AND notified=0`).all() as any[]) {
    const left = slotDate(b.date, b.from_s).getTime() - now;
    if (left > 0 && left <= 60 * 60000) {
      notify(b.user_id, `Nhắc lịch: còn ${Math.ceil(left / 60000)} phút nữa đến giờ chơi (sân ${b.court}, ${b.date} ${String(START_H + Math.floor(b.from_s / 2)).padStart(2, '0')}:${b.from_s % 2 ? '30' : '00'})`);
      db.prepare('UPDATE bookings SET notified=1 WHERE code=?').run(b.code); n++;
    }
  }
  return n;
}
setInterval(remindNow, 60000);
app.post('/api/admin/run-reminders', need('MANAGER'), (_req, res) => res.json({ sent: remindNow() }));

// ---- Live score cho khán giả (Lưu bền vững trong SQLite, không bị mất khi F5 hoặc khởi động lại) ----
interface Live { id: number; a: string; b: string; court: number; state: ScoreState; updated: number }
db.exec(`CREATE TABLE IF NOT EXISTS live_matches(id INTEGER PRIMARY KEY, a TEXT, b TEXT, court INTEGER, state TEXT, updated INTEGER)`);
const lives = new Map<number, Live>();
let liveSeq = 1;
for (const r of db.prepare('SELECT * FROM live_matches ORDER BY id').all() as any[]) {
  try {
    lives.set(r.id, { id: r.id, a: r.a, b: r.b, court: r.court, state: JSON.parse(r.state), updated: r.updated });
    if (r.id >= liveSeq) liveSeq = r.id + 1;
  } catch {}
}
const syncLiveDb = (l: Live) => {
  db.prepare(`INSERT INTO live_matches(id,a,b,court,state,updated) VALUES (?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET a=excluded.a, b=excluded.b, court=excluded.court, state=excluded.state, updated=excluded.updated`)
    .run(l.id, l.a, l.b, l.court, JSON.stringify(l.state), l.updated);
};
app.get('/api/live', (_req, res) => res.json([...lives.values()].sort((x, y) => y.updated - x.updated)));
app.post('/api/live', need('CASHIER'), (req, res) => {
  const { a, b, court } = req.body ?? {};
  if (!String(a ?? '').trim() || !String(b ?? '').trim()) return res.status(400).json({ message: 'Thiếu tên đội' });
  const l: Live = { id: liveSeq++, a: String(a).slice(0, 40), b: String(b).slice(0, 40), court: Number(court) || 1, state: { games: [], winner: null }, updated: Date.now() };
  lives.set(l.id, l); syncLiveDb(l); io.emit('live'); res.status(201).json(l);
});
app.post('/api/live/:id/point', need('CASHIER'), (req, res) => {
  const l = lives.get(Number(req.params.id));
  if (!l) return res.sendStatus(404);
  const action = req.body?.action ?? 'add';
  if (action === 'reset') {
    l.state = { games: [], winner: null };
    l.updated = Date.now(); syncLiveDb(l); io.emit('live'); return res.json(l);
  }
  if (!['A', 'B'].includes(req.body?.side)) return res.status(400).json({ message: 'side phải là A hoặc B' });
  try {
    l.state = action === 'sub' ? subPoint(l.state, req.body.side) : addPoint(l.state, req.body.side);
    l.updated = Date.now(); syncLiveDb(l); io.emit('live'); res.json(l);
  } catch (e: any) { res.status(409).json({ message: e.message }); }
});
setInterval(() => {
  for (const [id, l] of lives) if (Date.now() - l.updated > 6 * 3600e3) {
    lives.delete(id); db.prepare('DELETE FROM live_matches WHERE id=?').run(id);
  }
}, 600000);

app.get('/api/stats', (_req, res) => {
  const n = (sql: string) => (db.prepare(sql).get() as any).c as number;
  const players = n(`SELECT COUNT(*) c FROM users WHERE role='PLAYER'`) + n('SELECT COUNT(*) c FROM opponents');
  res.json({ courts: COURTS.length, members: players,
    bookings: n(`SELECT COUNT(*) c FROM bookings WHERE status IN ('CONFIRMED','PLAYING','COMPLETED')`),
    posts: n('SELECT COUNT(*) c FROM posts'),
    matches: n('SELECT COUNT(*) c FROM matches'),
    coaches: n('SELECT COUNT(*) c FROM coaches') });
});

// ================= Đợt 6 (Smash Club Badminton Edition): Đối thủ, Lịch sử & ELO, HLV, CLB, Đan vợt =================
db.exec(`
CREATE TABLE IF NOT EXISTS opponents(
  id INTEGER PRIMARY KEY, name TEXT, avatar TEXT, level TEXT, elo INTEGER, rank_tier TEXT,
  hand TEXT, style TEXT, specialty TEXT, racket TEXT, district TEXT, lat REAL, lng REAL,
  wins INTEGER, losses INTEGER, streak INTEGER, form TEXT, avail TEXT, bio TEXT
);
CREATE TABLE IF NOT EXISTS challenges(
  id INTEGER PRIMARY KEY, challenger_id INTEGER, challenger_name TEXT, opponent_id INTEGER, opponent_name TEXT,
  match_type TEXT, court INTEGER, play_date TEXT, slot_time TEXT, shuttle_note TEXT, message TEXT,
  status TEXT DEFAULT 'OPEN', created INTEGER
);
CREATE TABLE IF NOT EXISTS matches(
  id INTEGER PRIMARY KEY, match_type TEXT, mode TEXT, court INTEGER, play_date TEXT,
  team_a TEXT, team_b TEXT, level_a TEXT, level_b TEXT, scores TEXT, winner TEXT,
  elo_delta INTEGER, shuttles INTEGER, duration_min INTEGER, verified INTEGER DEFAULT 1, created INTEGER
);
CREATE TABLE IF NOT EXISTS coaches(
  id INTEGER PRIMARY KEY, name TEXT, avatar TEXT, title TEXT, cert TEXT, level TEXT, exp_years INTEGER,
  specialty TEXT, tags TEXT, price_1on1 INTEGER, price_group INTEGER, rating REAL, reviews INTEGER,
  students INTEGER, racket TEXT, district TEXT, schedule TEXT, bio TEXT
);
CREATE TABLE IF NOT EXISTS coach_bookings(
  id INTEGER PRIMARY KEY, coach_id INTEGER, coach_name TEXT, user_id INTEGER, student_name TEXT,
  student_phone TEXT, class_type TEXT, date TEXT, time_slot TEXT, price INTEGER, note TEXT,
  status TEXT DEFAULT 'CONFIRMED', created INTEGER
);
CREATE TABLE IF NOT EXISTS clubs(
  id INTEGER PRIMARY KEY, name TEXT, badge TEXT, court INTEGER, schedule TEXT, level_range TEXT,
  fee_note TEXT, members_count INTEGER, max_members INTEGER, leader TEXT, description TEXT
);
CREATE TABLE IF NOT EXISTS club_joins(club_id INTEGER, user_id INTEGER, PRIMARY KEY(club_id, user_id));
CREATE TABLE IF NOT EXISTS stringing_orders(
  id INTEGER PRIMARY KEY, user_id INTEGER, customer_name TEXT, phone TEXT, racket_model TEXT,
  string_name TEXT, tension_kg REAL, pattern TEXT, price INTEGER, pickup_date TEXT, status TEXT DEFAULT 'PROCESSING', created INTEGER
);
`);

// Làm sạch dữ liệu lỗi mã hóa (nếu từng nạp từ PowerShell cũ)
db.exec(`DELETE FROM posts WHERE title LIKE '%?%' OR title LIKE '%\uFFFD%'`);
db.exec(`DELETE FROM bookings WHERE name LIKE '%?%' OR name LIKE '%\uFFFD%'`);

const tierOf = (elo: number) => elo >= 1800 ? 'Cao Thủ' : elo >= 1650 ? 'Kim Cương' : elo >= 1500 ? 'Vàng' : elo >= 1350 ? 'Bạc' : 'Đồng';

if (!db.prepare('SELECT 1 FROM opponents').get()) {
  const insOp = db.prepare(`INSERT INTO opponents(name,avatar,level,elo,rank_tier,hand,style,specialty,racket,district,lat,lng,wins,losses,streak,form,avail,bio)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  [
    ['Ngô Đình Hậu', 'HẬ', 'KHA', 1760, 'Kim Cương', 'Tay phải', 'Chuyên công / Smash', 'Đôi nam · Đơn nam', 'Yonex Astrox 100ZZ Kurenai · BG80P 11.5kg', 'Việt Trì', 21.3245, 105.4018, 42, 14, 4, 'W,W,W,W,L', '17:30 – 20:30 (T2–CN)', 'Thích đánh đôi tốc độ cao, đập cầu cuối sân và ép lưới. Nhận kèo giao lưu cầu Hải Yến.'],
    ['Trần Hồng Đức', 'ĐỨ', 'TB+', 1610, 'Vàng', 'Tay phải', 'Điều cầu / Phản tạt', 'Đôi nam · Đôi nam nữ', 'Lining Halbertec 8000 · Exbolt 65 11kg', 'Việt Trì', 21.3190, 105.4080, 31, 16, 2, 'W,W,L,W,L', '18:00 – 21:00 (T3-5-7)', 'Chuyên thủ phản tạt, điều cầu 4 góc và bắt lưới. Tìm bạn đứng lưới ăn ý.'],
    ['Đinh Thanh Hải', 'HẢ', 'TB', 1485, 'Bạc', 'Tay trái', 'Toàn diện', 'Đơn nam · Đôi nam', 'Victor Thruster Ryuga II · BG65Ti 11kg', 'Lâm Thao', 21.3215, 105.3180, 24, 15, 1, 'W,L,W,W,L', '17:00 – 19:30 (Hằng ngày)', 'Thuận tay trái, đường cầu chéo sân khó chịu. Luôn sẵn sàng giao lưu đơn hoặc đôi.'],
    ['Nguyễn Đinh Xuân Dương', 'DƯ', 'TB-', 1390, 'Bạc', 'Tay phải', 'Trên lưới / Bắt cầu', 'Đôi nam nữ · Đôi nam', 'Yonex Nanoflare 800 Pro · Exbolt 63 10.5kg', 'Việt Trì', 21.3280, 105.3950, 19, 14, 3, 'W,W,W,L,L', '18:30 – 21:00 (T2-4-6)', 'Tốc độ vung vợt nhanh, chuyên chụp lưới và bỏ nhỏ. Tìm đối thủ cùng tầm TB-/TB.'],
    ['Nguyễn Bảo Long', 'LO', 'TOT', 1890, 'Cao Thủ', 'Tay phải', 'Chuyên công / Smash', 'Đơn nam · Đôi nam', 'Yonex Astrox 99 Pro · Aerobite 12kg', 'Phú Thọ', 21.3980, 105.2240, 58, 11, 6, 'W,W,W,W,W', '19:00 – 22:00 (T2–CN)', 'VĐV giải phong trào mở rộng tỉnh Phú Thọ. Nhận kèo thách đấu Đơn nam & Đôi nam đỉnh cao.'],
    ['Lê Minh Ánh', 'ÁN', 'TB+', 1565, 'Vàng', 'Tay phải', 'Trên lưới / Bắt cầu', 'Đôi nữ · Đôi nam nữ', 'Yonex Arcsaber 11 Pro · BG66UM 10.5kg', 'Việt Trì', 21.3235, 105.4050, 29, 12, 2, 'W,W,L,W,W', '17:30 – 19:30 (T3-5-CN)', 'Đánh lưới chắc tay, di chuyển linh hoạt. Tìm cặp Đôi nam nữ hoặc Đôi nữ giao lưu vui vẻ.'],
    ['Phạm Quốc Khánh', 'KH', 'TBK', 1675, 'Kim Cương', 'Tay phải', 'Toàn diện', 'Đơn nam · Đôi nam', 'Lining Axforce 90 Max · No.1 11.5kg', 'Việt Trì', 21.3150, 105.4120, 35, 18, 1, 'W,L,W,L,W', '06:00 – 08:00 & 18:00 – 20:00', 'Thể lực bền bỉ, thích đánh đơn 3 set chuẩn BWF 21 điểm.'],
    ['Hoàng Thu Trang', 'TR', 'TB', 1440, 'Bạc', 'Tay phải', 'Điều cầu / Phản tạt', 'Đôi nữ · Đơn nữ', 'Yonex Nanoflare 700 · BG65 10kg', 'Lâm Thao', 21.3260, 105.3320, 21, 16, 0, 'L,W,W,L,W', '17:30 – 20:00 (Cuối tuần)', 'Chơi cầu lông 3 năm, mong muốn giao lưu nâng cao trình độ với các bạn khu vực Việt Trì – Lâm Thao.']
  ].forEach(r => insOp.run(...(r as [string, string, string, number, string, string, string, string, string, string, number, number, number, number, number, string, string, string])));
}

if (!db.prepare('SELECT 1 FROM matches').get()) {
  const insM = db.prepare(`INSERT INTO matches(match_type,mode,court,play_date,team_a,team_b,level_a,level_b,scores,winner,elo_delta,shuttles,duration_min,verified,created)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`);
  const d0 = new Date().toISOString().slice(0, 10);
  const d1 = addDays(d0, -1), d2 = addDays(d0, -2), d3 = addDays(d0, -3);
  [
    ['Đôi nam', 'RANKED', 1, d0, 'Ngô Đình Hậu / Trần Hồng Đức', 'Đinh Thanh Hải / Nguyễn Đinh Xuân Dương', 'KHA', 'TB+', JSON.stringify([{ a: 21, b: 17 }, { a: 18, b: 21 }, { a: 21, b: 19 }]), 'A', 16, 3, 52, Date.now() - 7200e3],
    ['Đơn nam', 'RANKED', 2, d1, 'Nguyễn Bảo Long', 'Phạm Quốc Khánh', 'TOT', 'TBK', JSON.stringify([{ a: 21, b: 15 }, { a: 21, b: 18 }]), 'A', 14, 2, 38, Date.now() - 86400e3],
    ['Đôi nam nữ', 'FRIENDLY', 3, d1, 'Trần Hồng Đức / Lê Minh Ánh', 'Nguyễn Đinh Xuân Dương / Hoàng Thu Trang', 'TB+', 'TB', JSON.stringify([{ a: 21, b: 16 }, { a: 21, b: 14 }]), 'A', 12, 2, 34, Date.now() - 95000e3],
    ['Đôi nam', 'TOURNAMENT', 1, d2, 'Nguyễn Bảo Long / Ngô Đình Hậu', 'Phạm Quốc Khánh / Đinh Thanh Hải', 'TOT', 'KHA', JSON.stringify([{ a: 20, b: 22 }, { a: 21, b: 16 }, { a: 21, b: 18 }]), 'A', 18, 4, 58, Date.now() - 172800e3],
    ['Đơn nữ', 'FRIENDLY', 4, d3, 'Lê Minh Ánh', 'Hoàng Thu Trang', 'TB+', 'TB', JSON.stringify([{ a: 21, b: 19 }, { a: 21, b: 17 }]), 'A', 11, 2, 35, Date.now() - 259200e3]
  ].forEach(r => insM.run(...(r as [string, string, number, string, string, string, string, string, string, string, number, number, number, number])));
}

if (!db.prepare('SELECT 1 FROM coaches').get()) {
  const insC = db.prepare(`INSERT INTO coaches(name,avatar,title,cert,level,exp_years,specialty,tags,price_1on1,price_group,rating,reviews,students,racket,district,schedule,bio)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  [
    ['HLV Nguyễn Trọng Tuấn', 'TU', 'HLV Trưởng CLB Hùng Vương', 'BWF Coach Level 2 · Kiện tướng QG', 'TOT', 9, 'Kỹ thuật Đập cầu & Chiến thuật Đôi', 'Jump Smash,Bộ chân 6 góc,Chiến thuật Đôi nam,Luyện thi đấu giải', 280000, 110000, 4.9, 64, 210, 'Yonex Astrox 100ZZ', 'Việt Trì', 'T2–T7 (06:00–11:00 & 16:00–20:00)', '9 năm huấn luyện đội tuyển trẻ và phong trào nâng cao tại Phú Thọ. Chuyên chỉnh form đập cầu, di chuyển bộ chân chuẩn BWF và phối hợp đánh đôi.'],
    ['HLV Vũ Thị Mai Phương', 'MP', 'Cựu VĐV Tuyển Tỉnh', 'Cử nhân TDTT Bắc Ninh · BWF Level 1', 'KHA', 6, 'Cơ bản cho người mới & Bộ chân', 'Cầm vợt chuẩn,Footwork cơ bản,Phông cầu & Bỏ nhỏ,Lớp thiếu nhi & Nữ', 220000, 90000, 4.9, 48, 165, 'Yonex Arcsaber 11 Pro', 'Việt Trì', 'T3–CN (07:00–10:30 & 17:00–19:30)', 'Tận tâm, chỉnh sửa từng động tác cầm vợt, mở vợt và bước chạy cho người mới bắt đầu hoặc người chơi muốn xóa tật sai kỹ thuật.'],
    ['HLV Đỗ Hoàng Nam', 'HN', 'HLV Chuyên Phản Tạt & Đánh Đôi', 'HCV Giải Cầu Lông Mở Rộng Phú Thọ', 'TOT', 7, 'Phòng thủ, Phản tạt & Bắt lưới', 'Thủ phản tạt,Đè lưới,Giao cầu & Nhận giao cầu,Đôi nam nữ', 250000, 100000, 4.8, 39, 130, 'Lining Halbertec 9000', 'Lâm Thao', 'T2–T6 (17:00–21:00) & Cuối tuần', 'Chuyên đào tạo kỹ năng cổ tay, phản tạt tốc độ cao, phòng thủ biến hóa công và di chuyển xoay vòng trong đánh đôi.']
  ].forEach(r => insC.run(...(r as [string, string, string, string, string, number, string, string, number, number, number, number, number, string, string, string, string])));
}

if (!db.prepare('SELECT 1 FROM clubs').get()) {
  const insCl = db.prepare(`INSERT INTO clubs(name,badge,court,schedule,level_range,fee_note,members_count,max_members,leader,description)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  [
    ['CLB Cầu Lông ĐH Hùng Vương (K22-CNTT)', '🎓', 1, 'T3 – T5 – T7 · 18:00 – 20:00', 'TB- đến KHA', '350.000đ/tháng (bao cầu Hải Yến)', 18, 24, 'Ngô Đình Hậu', 'CLB sinh viên & giảng viên đam mê cầu lông, giao lưu sôi nổi, tổ chức giải nội bộ hằng quý.'],
    ['CLB Smash Việt Trì – Kèo Tối Đỉnh Cao', '🔥', 2, 'T2 – T4 – T6 · 19:00 – 21:30', 'TB+ đến TOT', 'Chia đều tiền sân + cầu (~65k/buổi)', 14, 16, 'Nguyễn Bảo Long', 'Chuyên kèo đôi nam chất lượng cao, tốc độ nhanh, dùng cầu Hải Yến S90 hoặc Thành Công.'],
    ['Hội Cầu Lông Bình Minh Việt Trì', '🌅', 3, 'Hằng ngày · 05:30 – 07:30', 'Mọi trình độ', '250.000đ/tháng', 22, 30, 'Trần Hồng Đức', 'Rèn luyện sức khỏe buổi sáng trước giờ làm việc, không khí thân thiện, hướng dẫn người mới.']
  ].forEach(r => insCl.run(...(r as [string, string, number, string, string, string, number, number, string, string])));
}

if (!db.prepare('SELECT 1 FROM challenges').get()) {
  const tomorrow = addDays(new Date().toISOString().slice(0, 10), 1);
  const insCh = db.prepare(`INSERT INTO challenges(challenger_id,challenger_name,opponent_id,opponent_name,match_type,court,play_date,slot_time,shuttle_note,message,status,created)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  insCh.run(null, 'Ngô Đình Hậu (1760 ELO)', 2, 'Trần Hồng Đức', 'Đôi nam', 1, tomorrow, '18:30 – 20:00', 'Giao lưu 2 ống cầu Hải Yến', 'Tối mai làm 3 set đôi nam chuẩn BWF nhé anh em!', 'OPEN', Date.now() - 3600e3);
  insCh.run(null, 'Nguyễn Bảo Long (1890 ELO)', 7, 'Phạm Quốc Khánh', 'Đơn nam', 2, tomorrow, '19:30 – 21:00', 'Kèo nước tăng lực + cầu thi đấu', 'Tái đấu đơn nam 3 ván 21 điểm!', 'OPEN', Date.now() - 1800e3);
}

if (!db.prepare('SELECT 1 FROM posts').get()) {
  const tomorrow = addDays(new Date().toISOString().slice(0, 10), 1);
  const insP = db.prepare('INSERT INTO posts(user_id,author,title,level,slots,fee,play_at,created) VALUES (?,?,?,?,?,?,?,?)');
  insP.run(2, 'Ngô Đình Hậu', 'Tuyển 2 bạn nam/nữ giao lưu tối mai Sân 1 (bao cầu Hải Yến)', 'TB+', 4, 240000, `${tomorrow}T18:30`, Date.now());
  insP.run(2, 'Trần Hồng Đức', 'Cần 3 bạn trình độ TB giao lưu vui vẻ chiều thứ 7 Sân 3', 'TB', 3, 180000, `${tomorrow}T17:30`, Date.now());
}

if (!lives.size) {
  const initLive: Live = {
    id: liveSeq++, a: 'Ngô Đình Hậu / Trần Hồng Đức', b: 'Đinh Thanh Hải / Xuân Dương',
    court: 1, state: { games: [{ a: 21, b: 18 }, { a: 14, b: 12 }], winner: null }, updated: Date.now()
  };
  lives.set(initLive.id, initLive);
  syncLiveDb(initLive);
}

try { db.exec('ALTER TABLE opponents ADD COLUMN user_id INTEGER'); } catch { /* đã có */ }

const cleanName = (s: string) => String(s || '').replace(/\(.*?\)/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const samePerson = (a: string, b: string) => {
  const na = cleanName(a), nb = cleanName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wa = na.split(' '), wb = nb.split(' ');
  const [sh, lg] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  return sh.length >= 2 && sh.every(w => lg.includes(w));
};

// ---- API: Tìm kiếm đối thủ cầu lông gần đây & Thách đấu (Chỉ đúng đối thủ được thách đấu mới có quyền nhận) ----
app.get('/api/opponents', (req, res) => {
  const u = userOf(req);
  const rows = db.prepare('SELECT * FROM opponents ORDER BY elo DESC').all() as any[];
  res.json(rows.map(o => ({
    ...o,
    isMe: !!u && ((o.user_id != null && o.user_id === u.id) || samePerson(u.name, o.name))
  })));
});

app.get('/api/challenges', (req, res) => {
  const u = userOf(req);
  const rows = db.prepare('SELECT * FROM challenges ORDER BY id DESC LIMIT 20').all() as any[];
  res.json(rows.map(c => {
    const op: any = db.prepare('SELECT user_id, name FROM opponents WHERE id=?').get(c.opponent_id);
    const isChallenger = !!u && ((c.challenger_id != null && c.challenger_id === u.id) || samePerson(u.name, c.challenger_name));
    const isOpponent = !!u && !isChallenger && ((op?.user_id != null && op.user_id === u.id) || samePerson(u.name, c.opponent_name));
    return {
      ...c,
      isChallenger,
      isOpponent,
      canAccept: c.status === 'OPEN' && isOpponent,
      canCancel: c.status === 'OPEN' && (isChallenger || (!!u && RANK[u.role] >= 2))
    };
  }));
});

app.post('/api/challenges', need('PLAYER'), (req, res) => {
  const u = (req as any).user as U;
  const { opponentId, matchType = 'Đôi nam', court = 1, playDate, slotTime = '18:30 – 20:00', shuttleNote = 'Chia tiền sân & cầu', message = '' } = req.body ?? {};
  const op: any = db.prepare('SELECT * FROM opponents WHERE id=?').get(Number(opponentId));
  if (!op || !playDate) return res.status(400).json({ message: 'Vui lòng chọn đối thủ và ngày thách đấu' });
  if ((op.user_id != null && op.user_id === u.id) || samePerson(u.name, op.name))
    return res.status(400).json({ message: 'Bạn không thể tự gửi lời thách đấu cho chính mình!' });
  const id = Number(db.prepare(`INSERT INTO challenges(challenger_id,challenger_name,opponent_id,opponent_name,match_type,court,play_date,slot_time,shuttle_note,message,status,created)
    VALUES (?,?,?,?,?,?,?,?,?,?,'OPEN',?)`).run(u.id, u.name, op.id, op.name, String(matchType), Number(court) || 1, String(playDate), String(slotTime), String(shuttleNote), String(message).slice(0, 160), Date.now()).lastInsertRowid);
  push(); res.status(201).json(db.prepare('SELECT * FROM challenges WHERE id=?').get(id));
});

app.post('/api/challenges/:id/accept', need('PLAYER'), (req, res) => {
  const u = (req as any).user as U;
  const ch: any = db.prepare('SELECT * FROM challenges WHERE id=?').get(req.params.id);
  if (!ch) return res.sendStatus(404);
  if (ch.status !== 'OPEN') return res.status(409).json({ message: 'Kèo thách đấu này đã được xử lý' });
  const isChallenger = (ch.challenger_id != null && ch.challenger_id === u.id) || samePerson(u.name, ch.challenger_name);
  if (isChallenger) return res.status(403).json({ message: 'Bạn là người tạo lời thách đấu này, không thể tự chấp nhận!' });
  const op: any = db.prepare('SELECT user_id, name FROM opponents WHERE id=?').get(ch.opponent_id);
  const isOpponent = (op?.user_id != null && op.user_id === u.id) || samePerson(u.name, ch.opponent_name);
  if (!isOpponent) return res.status(403).json({ message: `Kèo thách đấu này gửi riêng cho ${ch.opponent_name}. Chỉ ${ch.opponent_name} mới có quyền chấp nhận!` });
  db.prepare(`UPDATE challenges SET status='ACCEPTED' WHERE id=?`).run(ch.id);
  if (ch.challenger_id) notify(ch.challenger_id, `🤝 ${u.name} đã chấp nhận lời thách đấu ${ch.match_type} (${ch.play_date} · ${ch.slot_time})!`);
  push(); res.json({ ok: true });
});

app.post('/api/challenges/:id/decline', need('PLAYER'), (req, res) => {
  const u = (req as any).user as U;
  const ch: any = db.prepare('SELECT * FROM challenges WHERE id=?').get(req.params.id);
  if (!ch) return res.sendStatus(404);
  if (ch.status !== 'OPEN') return res.status(409).json({ message: 'Kèo thách đấu này đã được xử lý' });
  const op: any = db.prepare('SELECT user_id, name FROM opponents WHERE id=?').get(ch.opponent_id);
  const isOpponent = (op?.user_id != null && op.user_id === u.id) || samePerson(u.name, ch.opponent_name);
  if (!isOpponent) return res.status(403).json({ message: `Chỉ ${ch.opponent_name} mới có quyền từ chối lời thách đấu này!` });
  db.prepare(`UPDATE challenges SET status='DECLINED' WHERE id=?`).run(ch.id);
  if (ch.challenger_id) notify(ch.challenger_id, `✕ ${u.name} đã từ chối lời thách đấu ${ch.match_type} ngày ${ch.play_date}.`);
  push(); res.json({ ok: true });
});

app.post('/api/challenges/:id/cancel', need('PLAYER'), (req, res) => {
  const u = (req as any).user as U;
  const ch: any = db.prepare('SELECT * FROM challenges WHERE id=?').get(req.params.id);
  if (!ch) return res.sendStatus(404);
  const isChallenger = (ch.challenger_id != null && ch.challenger_id === u.id) || samePerson(u.name, ch.challenger_name);
  if (!isChallenger && RANK[u.role] < 2) return res.status(403).json({ message: 'Chỉ người tạo kèo mới có quyền hủy lời thách đấu này' });
  db.prepare('DELETE FROM challenges WHERE id=?').run(ch.id);
  push(); res.json({ ok: true });
});

// ---- API: Lịch sử thi đấu BWF & Bảng xếp hạng ELO ----
app.get('/api/matches', (_req, res) => {
  const rows = db.prepare('SELECT * FROM matches ORDER BY id DESC LIMIT 50').all() as any[];
  res.json(rows.map(m => ({ ...m, scores: JSON.parse(m.scores || '[]') })));
});

app.get('/api/leaderboard', (_req, res) => {
  res.json(db.prepare('SELECT id,name,avatar,level,elo,rank_tier,specialty,racket,wins,losses,streak,form,district FROM opponents ORDER BY elo DESC').all());
});

app.post('/api/matches', (req, res) => {
  const { matchType = 'Đôi nam', mode = 'RANKED', court = 1, playDate, teamA, teamB, levelA = 'TB+', levelB = 'TB+', scores, shuttles = 2, durationMin = 40 } = req.body ?? {};
  const a = String(teamA ?? '').trim(), b = String(teamB ?? '').trim();
  const sets: { a: number; b: number }[] = Array.isArray(scores) ? scores.map((s: any) => ({ a: Number(s.a) || 0, b: Number(s.b) || 0 })).filter(s => s.a > 0 || s.b > 0) : [];
  if (!a || !b || !sets.length) return res.status(400).json({ message: 'Vui lòng nhập tên 2 đội và tỉ số ít nhất 1 ván' });
  let wa = 0, wb = 0;
  sets.forEach(s => { if (s.a > s.b) wa++; else if (s.b > s.a) wb++; });
  if (wa === wb) return res.status(400).json({ message: 'Trận đấu cầu lông phải có đội thắng chung cuộc' });
  const winner = wa > wb ? 'A' : 'B';
  const delta = mode === 'RANKED' ? 16 : mode === 'TOURNAMENT' ? 22 : 8;
  const dateStr = String(playDate || new Date().toISOString().slice(0, 10));
  const id = Number(db.prepare(`INSERT INTO matches(match_type,mode,court,play_date,team_a,team_b,level_a,level_b,scores,winner,elo_delta,shuttles,duration_min,verified,created)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`).run(String(matchType), String(mode), Number(court) || 1, dateStr, a, b, String(levelA), String(levelB), JSON.stringify(sets), winner, delta, Number(shuttles) || 2, Number(durationMin) || 40, Date.now()).lastInsertRowid);
  // Cập nhật ELO nếu trùng tên VĐV trong danh sách opponents
  for (const op of db.prepare('SELECT * FROM opponents').all() as any[]) {
    const inA = a.toLowerCase().includes(op.name.toLowerCase());
    const inB = b.toLowerCase().includes(op.name.toLowerCase());
    if (inA || inB) {
      const won = (inA && winner === 'A') || (inB && winner === 'B');
      const newElo = Math.max(1000, op.elo + (won ? delta : -delta));
      const f = ((won ? 'W,' : 'L,') + op.form).split(',').slice(0, 5).join(',');
      db.prepare('UPDATE opponents SET elo=?, rank_tier=?, wins=wins+?, losses=losses+?, streak=?, form=? WHERE id=?')
        .run(newElo, tierOf(newElo), won ? 1 : 0, won ? 0 : 1, won ? op.streak + 1 : 0, f, op.id);
    }
  }
  push(); res.status(201).json({ id, winner, eloDelta: delta });
});

// ---- API: Huấn luyện viên cầu lông & Đặt lịch học ----
app.get('/api/coaches', (_req, res) => {
  res.json((db.prepare('SELECT * FROM coaches ORDER BY rating DESC, exp_years DESC').all() as any[]).map(c => ({
    ...c, tags: String(c.tags || '').split(',').filter(Boolean)
  })));
});

app.get('/api/coaches/bookings', (req, res) => {
  const u = userOf(req);
  const rows = u && RANK[u.role] >= 1
    ? db.prepare('SELECT * FROM coach_bookings ORDER BY id DESC LIMIT 30').all()
    : u
      ? db.prepare('SELECT * FROM coach_bookings WHERE user_id=? ORDER BY id DESC LIMIT 20').all(u.id)
      : db.prepare('SELECT id,coach_id,coach_name,student_name,class_type,date,time_slot,price,status,created FROM coach_bookings ORDER BY id DESC LIMIT 10').all();
  res.json(rows);
});

app.post('/api/coaches/book', (req, res) => {
  const u = userOf(req);
  const { coachId, studentName, studentPhone = '', classType = '1ON1', date, timeSlot = '17:30 – 19:00', note = '' } = req.body ?? {};
  const c: any = db.prepare('SELECT * FROM coaches WHERE id=?').get(Number(coachId));
  const name = u?.name || String(studentName ?? '').trim();
  const phone = u?.phone || String(studentPhone ?? '').trim();
  if (!c || !name || !date) return res.status(400).json({ message: 'Vui lòng chọn HLV, nhập họ tên và ngày học' });
  const price = classType === '1ON1' ? c.price_1on1 : c.price_group;
  const id = Number(db.prepare(`INSERT INTO coach_bookings(coach_id,coach_name,user_id,student_name,student_phone,class_type,date,time_slot,price,note,created)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(c.id, c.name, u?.id ?? null, name, phone, String(classType), String(date), String(timeSlot), price, String(note).slice(0, 160), Date.now()).lastInsertRowid);
  db.prepare('UPDATE coaches SET students=students+1 WHERE id=?').run(c.id);
  if (u?.id) notify(u.id, `Đã đăng ký lịch học cầu lông với ${c.name} vào ${date} (${timeSlot})`);
  push(); res.status(201).json(db.prepare('SELECT * FROM coach_bookings WHERE id=?').get(id));
});

// ---- API: CLB Cầu lông định kỳ & Dịch vụ Đan cước vợt ----
app.get('/api/clubs', (req, res) => {
  const u = userOf(req);
  res.json((db.prepare('SELECT * FROM clubs ORDER BY id').all() as any[]).map(c => ({
    ...c, joined: !!u && !!db.prepare('SELECT 1 FROM club_joins WHERE club_id=? AND user_id=?').get(c.id, u.id)
  })));
});

app.post('/api/clubs/:id/join', need('PLAYER'), (req, res) => {
  const u = (req as any).user as U;
  const c: any = db.prepare('SELECT * FROM clubs WHERE id=?').get(req.params.id);
  if (!c) return res.sendStatus(404);
  if (c.members_count >= c.max_members) return res.status(409).json({ message: 'CLB đã đủ thành viên' });
  const r = db.prepare('INSERT OR IGNORE INTO club_joins VALUES (?,?)').run(c.id, u.id);
  if (!r.changes) return res.status(409).json({ message: 'Bạn đã là thành viên CLB này' });
  db.prepare('UPDATE clubs SET members_count=members_count+1 WHERE id=?').run(c.id);
  notify(u.id, `Chào mừng bạn gia nhập ${c.name}! Lịch sinh hoạt: ${c.schedule}`);
  push(); res.json({ ok: true });
});

const STRINGS_CATALOG: Record<string, number> = {
  'Yonex BG65': 140000, 'Yonex BG65 Titanium': 160000, 'Yonex BG80 Power': 195000,
  'Yonex Exbolt 63': 210000, 'Yonex Exbolt 65': 210000, 'Yonex Aerobite': 230000, 'Lining No.1': 165000
};
app.get('/api/stringing', (_req, res) => {
  res.json({ catalog: STRINGS_CATALOG, orders: db.prepare('SELECT * FROM stringing_orders ORDER BY id DESC LIMIT 15').all() });
});
app.post('/api/stringing', (req, res) => {
  const u = userOf(req);
  const { customerName, phone = '', racketModel, stringName = 'Yonex BG65 Titanium', tensionKg = 11, pattern = '4 nút chuẩn Yonex', pickupDate } = req.body ?? {};
  const name = u?.name || String(customerName ?? '').trim();
  if (!name || !String(racketModel ?? '').trim()) return res.status(400).json({ message: 'Vui lòng nhập tên và dòng vợt cần đan' });
  const price = STRINGS_CATALOG[stringName] ?? 160000;
  const id = Number(db.prepare(`INSERT INTO stringing_orders(user_id,customer_name,phone,racket_model,string_name,tension_kg,pattern,price,pickup_date,created)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(u?.id ?? null, name, u?.phone || String(phone), String(racketModel).slice(0, 80), String(stringName), Number(tensionKg) || 11, String(pattern), price, String(pickupDate || new Date().toISOString().slice(0, 10)), Date.now()).lastInsertRowid);
  if (u?.id) notify(u.id, `Đã nhận đơn đan vợt ${racketModel} (${stringName} - ${tensionKg}kg). Phí: ${price.toLocaleString('vi-VN')}đ`);
  push(); res.status(201).json(db.prepare('SELECT * FROM stringing_orders WHERE id=?').get(id));
});

const port = Number(process.env.PORT ?? 4000);
http.listen(port, () => console.log(`Web chạy tại http://localhost:${port}`));


