// CầuLông Pro – app.js v3 (Smash Club Badminton Edition)
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => Math.round(n).toLocaleString('vi-VN') + 'đ';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
let token = localStorage.getItem('token'), me = null;
try { if (token) me = JSON.parse(localStorage.getItem('clp_user')); } catch {}

const api = async (url, method = 'GET', body) => {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || 'Lỗi ' + r.status);
  return data;
};

// ---- Toast ----
let tt;
const toast = (m, type = 'info') => {
  const t = $('#toast');
  const icons = { info: 'ℹ️', ok: '✅', warn: '⚠️', err: '❌' };
  t.textContent = (icons[type] || '') + ' ' + m;
  t.className = 'fixed bottom-24 md:bottom-4 right-4 px-4 py-2.5 rounded-2xl z-[60] max-w-xs font-semibold text-sm';
  const bg = { ok: '#16a34a', warn: '#d97706', err: '#dc2626', info: '#0f172a' };
  t.style.background = bg[type] || bg.info;
  t.style.color = '#fff';
  t.style.display = 'block';
  clearTimeout(tt);
  tt = setTimeout(() => { t.style.display = 'none'; }, 3200);
};

const lab = (h0, s) => `${String(h0 + Math.floor(s / 2)).padStart(2, '0')}:${s % 2 ? '30' : '00'}`;
const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

// Date init
$('#date').value = iso(new Date());
$('#date').min = iso(new Date());

// Dark mode
if (localStorage.getItem('dark') === '1') {
  document.documentElement.classList.add('dark');
  document.body.classList.add('dark');
}
$('#dark').onclick = () => {
  const on = document.documentElement.classList.toggle('dark');
  document.body.classList.toggle('dark', on);
  localStorage.setItem('dark', on ? '1' : '0');
};

const ALL_TABS = ['book', 'opponents', 'history', 'coaches', 'social', 'tour', 'my', 'admin'];
const PAGE_MAP = {
  book: '/index.html',
  opponents: '/opponents.html',
  history: '/history.html',
  coaches: '/coaches.html',
  social: '/social.html',
  tour: '/tournaments.html',
  my: '/my.html',
  admin: '/admin.html'
};
const PAGE_TITLES = {
  book: 'CầuLông Pro – Đặt sân cầu lông trực tuyến',
  opponents: 'Tìm đối thủ & Thách đấu ELO – CầuLông Pro',
  history: 'Lịch sử thi đấu BWF & Bảng xếp hạng ELO – CầuLông Pro',
  coaches: 'Đội ngũ Huấn luyện viên Cầu lông – CầuLông Pro',
  social: 'Giao lưu vãng lai, CLB & Đan vợt – CầuLông Pro',
  tour: 'Tổ chức Giải đấu & Bảng điểm BWF – CầuLông Pro',
  my: 'Hồ sơ & Lịch đặt sân của tôi – CầuLông Pro',
  admin: 'Quản trị hệ thống sân – CầuLông Pro'
};
const PATH_TO_TAB = {
  '/': 'book', '/index.html': 'book',
  '/opponents.html': 'opponents', '/opponents': 'opponents',
  '/history.html': 'history', '/history': 'history',
  '/coaches.html': 'coaches', '/coaches': 'coaches',
  '/social.html': 'social', '/social': 'social',
  '/tournaments.html': 'tour', '/tournaments': 'tour', '/tour.html': 'tour',
  '/my.html': 'my', '/my': 'my',
  '/admin.html': 'admin', '/admin': 'admin'
};
function resolveInitialTab() {
  const h = location.hash.replace('#', '');
  if (ALL_TABS.includes(h)) return h;
  if (window.PAGE_TAB && ALL_TABS.includes(window.PAGE_TAB)) return window.PAGE_TAB;
  const p = PATH_TO_TAB[location.pathname.toLowerCase()];
  if (p) return p;
  return 'book';
}
let S = null, sel = null, curTab = resolveInitialTab(), holdCode = null, cdTimer = null, authChecked = !token;

const rank = { PLAYER: 0, CASHIER: 1, MANAGER: 2, OWNER: 3 };
const isStaff = () => me && rank[me.role] >= 1;
const isMgr = () => me && rank[me.role] >= 2;
const STATUS = {
  PENDING: 'Chờ cọc', CONFIRMED: 'Đã xác nhận', PLAYING: 'Đang chơi',
  COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn'
};
const ROLE_LABEL = { PLAYER: 'Hội viên', CASHIER: 'Thu ngân', MANAGER: 'Quản lý', OWNER: 'Chủ sân' };

// ---- Điều hướng đa trang con (Mỗi mục có đường dẫn .html riêng, F5 giữ nguyên trang hiện tại) ----
function buildTabs() {
  const tabs = [
    ['book', '📅', 'Đặt sân'],
    ['opponents', '⚔️', 'Đối thủ'],
    ['history', '📊', 'Lịch sử & ELO'],
    ['coaches', '🎓', 'HLV'],
    ['social', '🤝', 'Giao lưu'],
    ['tour', '🏆', 'Giải đấu']
  ];
  if (me) tabs.push(['my', '👤', 'Của tôi']);
  if (isStaff()) tabs.push(['admin', '🛠', 'Quản trị']);
  if (authChecked && !tabs.some(x => x[0] === curTab)) curTab = 'book';
  if (PAGE_TITLES[curTab]) document.title = PAGE_TITLES[curTab];

  $('#tabs').innerHTML = tabs.map(([k, i, n]) =>
    `<button data-t="${k}" data-href="${PAGE_MAP[k]}" class="${k === curTab ? 'tab-on' : ''}">${i} ${n}</button>`
  ).join('');

  $('#bottomnav').innerHTML = tabs.map(([k, i, n]) =>
    `<button data-t="${k}" data-href="${PAGE_MAP[k]}" class="${k === curTab ? 'tab-on' : ''}">
      <div class="bn-icon">${i}</div>${n}
    </button>`
  ).join('');

  ALL_TABS.forEach(x => {
    const el = $('#t-' + x);
    if (el) el.classList.toggle('hidden', x !== curTab);
  });
  const hero = $('#hero');
  if (hero) hero.classList.toggle('hidden', curTab !== 'book');
}

window.switchTab = (t, pushUrl = true) => {
  if (!ALL_TABS.includes(t)) return;
  curTab = t;
  try { sessionStorage.setItem('clp_cur_tab', t); } catch {}
  if (pushUrl && PAGE_MAP[t]) {
    const targetUrl = t === 'book' && location.pathname === '/' ? '/' : PAGE_MAP[t];
    if (location.pathname !== targetUrl) {
      try { history.pushState({ tab: t }, PAGE_TITLES[t] || '', targetUrl); } catch {}
    } else if (location.hash) {
      try { history.replaceState({ tab: t }, PAGE_TITLES[t] || '', targetUrl); } catch {}
    }
  }
  buildTabs();
  refresh();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (t === 'book') setTimeout(() => map && map.invalidateSize(), 60);
};

window.addEventListener('popstate', () => {
  window.switchTab(resolveInitialTab(), false);
});

const go = e => {
  const t = e.target.closest('[data-t]')?.dataset.t;
  if (!t) return;
  window.switchTab(t, true);
};
$('#tabs').onclick = go;
$('#bottomnav').onclick = go;

// ---- Auth ----
let reg = false;
function authUI() {
  $('#authTitle').textContent = reg ? 'Đăng ký tài khoản' : 'Đăng nhập';
  $('#authGo').textContent = reg ? 'Tạo tài khoản' : 'Đăng nhập';
  $('#authSwitch').textContent = reg ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay';
  $('#aname').classList.toggle('hidden', !reg);
  $('#aname').required = reg;
}
$('#authSwitch').onclick = () => { reg = !reg; authUI(); };
$('#authClose').onclick = () => $('#loginModal').classList.add('hidden');
$('#authForm').onsubmit = async e => {
  e.preventDefault();
  const btn = $('#authGo'); btn.disabled = true; btn.textContent = 'Đang xử lý…';
  try {
    const r = await api(reg ? '/api/register' : '/api/login', 'POST', {
      name: $('#aname').value, phone: $('#aphone').value, password: $('#apass').value
    });
    token = r.token; me = r.user; authChecked = true;
    localStorage.setItem('token', token);
    localStorage.setItem('clp_user', JSON.stringify(me));
    $('#loginModal').classList.add('hidden'); $('#apass').value = '';
    toast(`Xin chào ${me.name}!`, 'ok');
    afterAuth();
  } catch (err) { toast(err.message, 'err'); }
  btn.disabled = false; authUI();
};
$('#loginBtn').onclick = async () => {
  if (me) {
    await api('/api/logout', 'POST').catch(() => {});
    token = null; me = null; authChecked = true;
    localStorage.removeItem('token'); localStorage.removeItem('clp_user');
    if (curTab === 'my' || curTab === 'admin') window.switchTab('book', true);
    afterAuth(); toast('Đã đăng xuất', 'info');
  } else {
    reg = false; authUI(); $('#loginModal').classList.remove('hidden'); $('#aphone').focus();
  }
};
function afterAuth() {
  $('#who').textContent = '';
  if (me) {
    $('#loginBtn').className = 'btn !py-1.5 !px-3 !text-xs btn-soft max-w-[11rem] truncate';
    $('#loginBtn').textContent = `👤 ${me.name} · Thoát`;
    $('#loginBtn').title = `${me.name} (${ROLE_LABEL[me.role]}) – Bấm để đăng xuất`;
  } else {
    $('#loginBtn').className = 'btn btn-primary !py-2 !px-3.5 !text-xs';
    $('#loginBtn').textContent = 'Đăng nhập';
    $('#loginBtn').title = 'Đăng nhập tài khoản';
  }
  $('#cname').classList.toggle('hidden', !!me && !isStaff());
  buildTabs(); refresh();
}

// ---- Map & Venues ----
const VENUES = [
  { id: 1, name: 'Sân Cầu Lông Hùng Vương (6 sân thảm Yonex)', district: 'Việt Trì', lat: 21.3227, lng: 105.4023, price: 60000, amenities: 'Thảm PVC chống trượt · Đèn LED chống chói · Bãi đỗ ô tô', open: true },
  { id: 2, name: 'CLB Cầu Lông Thị xã Phú Thọ (4 sân)', district: 'Phú Thọ', lat: 21.4000, lng: 105.2200, price: 70000, amenities: 'Thảm gỗ tiêu chuẩn · Trần cao 10m · Quầy căng vợt', open: false },
  { id: 3, name: 'Nhà thi đấu Cầu Lông Lâm Thao (4 sân)', district: 'Lâm Thao', lat: 21.3200, lng: 105.3100, price: 50000, amenities: 'Thảm PVC · Khán đài 200 chỗ · Phòng thay đồ', open: false },
];
let map = null, markers = [], myPos = null;
const dist = (a, b) => {
  const R = 6371, r = x => x * Math.PI / 180, dl = r(b.lat - a.lat), dg = r(b.lng - a.lng);
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dl/2)**2 + Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dg/2)**2));
};
function renderVenues() {
  const d = $('#district').value;
  let v = VENUES.filter(x => !d || x.district === d);
  if (myPos) v = v.map(x => ({ ...x, km: dist(myPos, x) })).sort((a,b) => a.km - b.km);
  $('#venues').innerHTML = v.map(x => `
    <div class="venue-card ${x.open ? '' : 'opacity-75'}" onclick="selectVenue(${x.id})">
      <div class="font-bold text-sm">${esc(x.name)}</div>
      <div class="text-xs text-slate-500 mt-0.5">${x.district}${x.km != null ? ' · Cách ' + x.km.toFixed(1) + ' km' : ''} · Từ <b>${fmt(x.price)}</b>/giờ</div>
      <div class="text-xs text-slate-400 mt-0.5">${x.amenities}</div>
      <div class="mt-1.5">${x.open
        ? '<span class="text-green-600 font-bold text-xs">✅ Đang mở đặt trực tuyến ↓</span>'
        : '<span class="text-xs text-slate-400 font-medium">Liên hệ trực tiếp tại quầy</span>'
      }</div>
    </div>`).join('') || '<p class="text-sm text-slate-400 py-2">Không có cụm sân trong khu vực này.</p>';
  if (map) {
    markers.forEach(m => m.remove());
    markers = v.map(x => L.marker([x.lat, x.lng]).addTo(map).bindPopup(`<b>${x.name}</b><br>${x.amenities}`));
  }
}
window.selectVenue = id => {
  $$('.venue-card').forEach(el => el.classList.remove('active'));
  const idx = VENUES.findIndex(v => v.id === id);
  const el = $('#venues').children[idx];
  if (el) el.classList.add('active');
  const v = VENUES[idx];
  if (v && map) { map.setView([v.lat, v.lng], 14); markers[idx]?.openPopup(); }
  if (v?.open) $('#booking').scrollIntoView({ behavior: 'smooth' });
};
function initMap() {
  if (typeof L === 'undefined') {
    $('#map').innerHTML = '<p class="p-4 text-sm text-slate-500">Không tải được bản đồ (cần kết nối Internet).</p>';
    renderVenues(); return;
  }
  map = L.map('map').setView([21.34, 105.35], 11);
  L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi', {
    subdomains: '0123',
    maxZoom: 20,
    attribution: '© Google Maps · CầuLông Pro'
  }).addTo(map);
  renderVenues();
}
$('#district').onchange = renderVenues;
$('#geo').onclick = () => {
  if (!navigator.geolocation) return toast('Trình duyệt không hỗ trợ định vị', 'warn');
  $('#geo').disabled = true; $('#geo').textContent = '📡 Đang lấy tọa độ…';
  navigator.geolocation.getCurrentPosition(
    p => {
      myPos = { lat: p.coords.latitude, lng: p.coords.longitude };
      $('#geo-out').textContent = '✅ Đã tính khoảng cách';
      renderVenues();
      map?.setView([myPos.lat, myPos.lng], 11);
      $('#geo').disabled = false; $('#geo').textContent = '📍 Định vị khoảng cách từ chỗ tôi';
    },
    () => {
      myPos = { lat: 21.3240, lng: 105.4010 };
      $('#geo-out').textContent = '📍 Tâm TP. Việt Trì';
      renderVenues();
      $('#geo').disabled = false; $('#geo').textContent = '📍 Định vị khoảng cách từ chỗ tôi';
      toast('Đã dùng vị trí mặc định tại trung tâm TP. Việt Trì', 'info');
    }
  );
};

// ---- Court Grid ----
async function load() { S = await api('/api/state?date=' + $('#date').value); }
const slotMs = s => new Date(`${$('#date').value}T${lab(S.startH, s)}:00`).getTime();
function cellState(c, s) {
  const b = S.bookings.find(b => b.court === c && s >= b.from && s < b.to);
  if (b) return { b, cls: b.status === 'PLAYING' ? 'playing' : 'booked' };
  if (slotMs(s) + 30 * 60000 < S.now) return { cls: 'past' };
  return { cls: 'free' };
}
const slotPrice = s => { const m = (S.startH*60)+s*30; const r = S.rules.find(r => m >= r.startMin && m < r.endMin); return r.perHour/2; };

function head() {
  let h = '<tr><th class="sticky left-0 z-10 text-left pr-2" style="background:var(--card)">Sân đấu</th>';
  for (let s = 0; s < S.slots; s++) {
    const isPeak = (S.startH + Math.floor(s/2)) >= 17;
    h += `<th class="${isPeak ? '!text-amber-600 dark:!text-amber-400' : ''}">${s%2 ? '' : lab(S.startH,s)}</th>`;
  }
  return h + '</tr>';
}

function renderBook() {
  const only = $('#onlyFree').checked;
  let h = head();
  for (const c of S.courts) {
    if (only && !Array.from({ length: S.slots }, (_,s) => cellState(c,s).cls).includes('free')) continue;
    h += `<tr><td class="sticky left-0 z-10 pr-2" style="background:var(--card)"><span class="court-pill">🏸 Sân ${c}</span></td>`;
    for (let s = 0; s < S.slots; s++) {
      const st = cellState(c, s);
      const on = sel && sel.court === c && s >= sel.from && s <= sel.to;
      const tip = st.cls === 'free' ? `Sân ${c} · ${lab(S.startH,s)}–${lab(S.startH,s+1)} · ${fmt(slotPrice(s))}/30p` : st.b ? (isStaff() ? st.b.name : 'Đã có người đặt') : 'Đã qua giờ';
      h += `<td class="cell ${on ? 'sel' : st.cls}" data-c="${c}" data-s="${s}" title="${esc(tip)}"></td>`;
    }
    h += '</tr>';
  }
  $('#grid-book').innerHTML = h;

  const r0 = S.rules[0], r1 = S.rules[1];
  const isWk = [0,6].includes(new Date($('#date').value + 'T12:00:00').getDay());
  $('#rules').innerHTML = `
    <span>☀️ Giờ thường (06:00–${lab(S.startH,(S.rules[1]?.startMin-S.startH*60)/30|0)}): ${fmt(r0.perHour)}/giờ</span>
    <span class="chip-accent">🔥 Giờ cao điểm: ${fmt(r1.perHour)}/giờ</span>
    ${isWk ? '<span class="chip-accent">📅 Áp dụng phụ thu cuối tuần</span>' : ''}
    <span class="ml-auto">💳 Đặt cọc giữ sân ${S.depositPct??30}%</span>
  `;

  if (sel) {
    $('#pick').classList.remove('hidden');
    let sum = 0; for (let s = sel.from; s <= sel.to; s++) sum += slotPrice(s);
    $('#pick-sum').textContent = `🏸 Sân ${sel.court} · ${lab(S.startH,sel.from)} – ${lab(S.startH,sel.to+1)} (${(sel.to-sel.from+1)*30} phút)`;
    $('#pick-price').textContent = `Tổng ${fmt(sum)} · Cọc ${fmt(sum*(S.depositPct??30)/100)}`;
  } else { $('#pick').classList.add('hidden'); }
}

$('#grid-book').onclick = e => {
  const td = e.target.closest('td.cell'); if (!td) return;
  const c = +td.dataset.c, s = +td.dataset.s;
  if (cellState(c,s).cls !== 'free') return toast('Khung giờ này không còn trống', 'warn');
  if (sel && sel.court === c && s >= sel.from) {
    for (let k = sel.from; k <= s; k++) if (cellState(c,k).cls !== 'free') { sel = { court:c, from:s, to:s }; return renderBook(); }
    sel.to = s;
  } else sel = { court:c, from:s, to:s };
  renderBook();
};
$('#clear').onclick = () => { sel = null; renderBook(); };
$('#date').onchange = () => { sel = null; refresh(); updateQuickDays(); };
$('#onlyFree').onchange = renderBook;

function updateQuickDays() {
  $$('#quick button').forEach((btn, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    btn.classList.toggle('qday-on', iso(d) === $('#date').value);
  });
}
$('#quick').innerHTML = ['Hôm nay','Ngày mai','+2 ngày'].map((n,i) => `<button data-d="${i}">${n}</button>`).join('');
$('#quick').onclick = e => {
  const i = e.target.dataset.d; if (i == null) return;
  const d = new Date(); d.setDate(d.getDate() + +i);
  $('#date').value = iso(d); sel = null; refresh(); updateQuickDays();
};

// ---- Hold + VietQR ----
$('#hold').onclick = async () => {
  const name = me && !isStaff() ? me.name : $('#cname').value.trim();
  if (!name) return toast('Vui lòng nhập tên trước khi giữ chỗ', 'warn');
  if (!sel) return;
  $('#hold').disabled = true; $('#hold').textContent = 'Đang khóa slot…';
  try {
    const b = await api('/api/hold', 'POST', { court:sel.court, date:$('#date').value, from:sel.from, to:sel.to+1, name });
    sel = null; showPay(b);
  } catch (e) { toast(e.message, 'err'); sel = null; }
  $('#hold').disabled = false; $('#hold').innerHTML = '🔒 Giữ chỗ & Đặt cọc VietQR';
  refresh();
};
function showPay(b) {
  holdCode = b.code;
  const P = window.PAY || { bank:'970422', account:'0123456789', accountName:'CAU LONG PRO', demoPay:true };
  $('#qr').src = `https://img.vietqr.io/image/${P.bank}-${P.account}-compact2.png?amount=${b.deposit}&addInfo=${encodeURIComponent(b.code)}&accountName=${encodeURIComponent(P.accountName)}`;
  $('#simpay').classList.toggle('hidden', !P.demoPay);
  $('#m-info').innerHTML = `Mã đơn: <b class="font-mono">${esc(b.code)}</b> · Sân ${b.court}<br>Khung giờ: <b>${lab(S.startH,b.from)}–${lab(S.startH,b.to)}</b> (${b.date})<br>Tổng tiền sân: <b>${fmt(b.amount)}</b> · Cần cọc: <b class="text-brand">${fmt(b.deposit)}</b>`;
  $('#modal').classList.remove('hidden');
  clearInterval(cdTimer);
  const tick = async () => {
    const x = await api('/api/booking/' + holdCode).catch(() => null); if (!x) return;
    if (x.status === 'CONFIRMED') return done('🎉 Đặt sân thành công! Hẹn gặp bạn tại sân.', 'ok');
    if (x.status === 'EXPIRED') return done('⏰ Hết thời gian giữ chỗ, slot đã được mở lại.', 'warn');
    const left = Math.max(0, x.holdUntil - Date.now());
    $('#cd').textContent = `${String(Math.floor(left/60000)).padStart(2,'0')}:${String(Math.floor(left/1000)%60).padStart(2,'0')}`;
  };
  tick(); cdTimer = setInterval(tick, 1000);
}
function done(msg, type='ok') { clearInterval(cdTimer); $('#modal').classList.add('hidden'); toast(msg, type); refresh(); }
$('#simpay').onclick = async () => { try { await api('/api/pay/' + holdCode, 'POST'); } catch (e) { toast(e.message, 'err'); } };
$('#mclose').onclick = () => { clearInterval(cdTimer); $('#modal').classList.add('hidden'); };

// ---- My bookings ----
async function renderMy() {
  const r = await api('/api/my'); me = r.user;
  $('#my-name').textContent = me.name;
  $('#my-pts').textContent = me.points.toLocaleString('vi-VN');
  $('#my-avatar').textContent = me.name?.[0]?.toUpperCase() || '?';
  const roleCls = { PLAYER:'chip', CASHIER:'chip chip-blue', MANAGER:'chip chip-accent', OWNER:'chip chip-red' }[me.role] || 'chip';
  $('#my-role-chip').innerHTML = `<span class="${roleCls}">${ROLE_LABEL[me.role]||me.role}</span>`;

  $('#my-list').innerHTML = r.bookings.length
    ? r.bookings.map(b => `
      <div class="list-item flex flex-wrap justify-between gap-2 text-sm">
        <div>
          <div class="font-bold"><span class="font-mono">${esc(b.code)}</span> · Sân ${b.court}</div>
          <div class="text-slate-500 mt-0.5">${b.date} · ${lab(6,b.from)}–${lab(6,b.to)}</div>
          <div class="mt-0.5">Tổng <b>${fmt(b.amount)}</b> · Đã cọc ${fmt(b.deposit)}</div>
          ${b.items?.length ? '<div class="text-xs text-slate-400 mt-0.5">Phụ kiện/Nước: ' + b.items.map(i => esc(i.name) + '×' + i.qty).join(', ') + '</div>' : ''}
        </div>
        <div class="text-right flex flex-col items-end gap-1.5">
          <span class="badge-status badge-${b.status}">${STATUS[b.status]||b.status}</span>
          ${['PENDING','CONFIRMED'].includes(b.status) ? `<button class="btn btn-danger btn-sm" onclick="cancelMy('${b.code}')">Hủy lịch</button>` : ''}
        </div>
      </div>`).join('')
    : '<p class="text-slate-400 text-sm py-4 text-center">Bạn chưa có lịch đặt sân nào.</p>';
}
window.cancelMy = async code => {
  if (!confirm(`Xác nhận hủy đơn đặt sân ${code}?`)) return;
  try { await api('/api/my/cancel/' + code, 'POST'); toast('Đã hủy đặt sân', 'ok'); } catch (e) { toast(e.message, 'err'); }
  refresh();
};

// ---- Admin grid ----
function renderAdminGrid() {
  let h = head();
  for (const c of S.courts) {
    h += `<tr><td class="sticky left-0 z-10 pr-2" style="background:var(--card)"><span class="court-pill">🏸 Sân ${c}</span></td>`;
    for (let s = 0; s < S.slots; s++) {
      const b = S.bookings.find(b => b.court === c && b.from === s);
      if (b) {
        h += `<td colspan="${b.to-b.from}" class="cell ${b.status==='PLAYING'?'playing':'booked'} text-[11px] text-center px-1 truncate font-bold" style="cursor:grab;color:#0f172a" draggable="true" data-code="${esc(b.code)}">${esc(b.name)}</td>`;
        s = b.to - 1;
      } else {
        h += `<td class="cell free" data-c="${c}" data-s="${s}"></td>`;
      }
    }
    h += '</tr>';
  }
  const g = $('#grid-admin'); g.innerHTML = h;
  g.ondragstart = e => { const c = e.target.dataset?.code; if (c) e.dataTransfer.setData('text', c); };
  g.ondragover = e => { const t = e.target.closest('td.free'); if (t) { e.preventDefault(); t.classList.add('dragover'); } };
  g.ondragleave = e => e.target.classList?.remove('dragover');
  g.ondrop = async e => {
    const t = e.target.closest('td.free'); if (!t) return; e.preventDefault();
    t.classList.remove('dragover');
    try {
      const r = await api('/api/move/' + e.dataTransfer.getData('text'), 'POST', { court:+t.dataset.c, from:+t.dataset.s });
      toast(r.diff ? `Đã chuyển lịch. Chênh lệch: ${r.diff>0?'+':''}${fmt(r.diff)}` : 'Đã chuyển lịch thành công', 'ok');
    } catch (err) { toast(err.message, 'err'); }
    refresh();
  };
}

async function renderAdmin() {
  renderAdminGrid();
  const [a, r] = await Promise.all([api('/api/admin'), isMgr() ? api('/api/report') : null]);

  if (r) {
    $('#kpi').innerHTML = [
      ['💰', 'Doanh thu tổng', fmt(r.total), 'kpi-green'],
      ['🏸', 'Tiền giờ sân', fmt(r.court), 'kpi-blue'],
      ['🛒', 'Phụ kiện & Nước', fmt(r.goods), 'kpi-orange'],
      ['📋', 'Tổng số đơn', r.count.toLocaleString('vi-VN'), 'kpi-purple']
    ].map(([icon, label, val, cls]) => `
      <div class="kpi-card flex items-center gap-3">
        <div class="kpi-icon ${cls}">${icon}</div>
        <div>
          <div class="text-xs text-slate-500 font-semibold">${label}</div>
          <div class="text-lg font-extrabold mt-0.5 font-mono">${val}</div>
        </div>
      </div>`).join('');

    const max = Math.max(1, ...r.heat);
    $('#charts').innerHTML = `
      <div class="card p-4">
        <h4 class="font-extrabold text-sm mb-3">📊 Tỷ lệ lấp đầy 7 ngày gần nhất</h4>
        <div class="flex items-end gap-2 h-24">
          ${r.fill.length ? r.fill.map(f => `
            <div class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full rounded-t-md transition-all" style="height:${Math.max(5,f.pct)}%;background:var(--brand-m)" title="${f.pct}%"></div>
              <div class="text-[10px] text-slate-500 font-semibold">${f.date.slice(5)}</div>
              <div class="text-[10px] font-extrabold font-mono" style="color:var(--brand)">${f.pct}%</div>
            </div>`).join('')
            : '<span class="text-slate-400 text-sm self-center mx-auto">Chưa có dữ liệu</span>'}
        </div>
      </div>
      <div class="card p-4">
        <h4 class="font-extrabold text-sm mb-3">🔥 Mật độ đặt sân theo khung giờ</h4>
        <div class="flex items-end gap-px h-24">
          ${r.heat.map((v,s) => `
            <div class="flex-1 rounded-t-sm" style="height:${Math.max(5,v/max*100)}%;background:${v?'#14b8a6':'#fca5a5'}" title="${lab(r.startH,s)}: ${v} lượt"></div>`).join('')}
        </div>
        <div class="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
          <span>${lab(r.startH,0)}</span><span>${lab(r.startH,Math.floor(S.slots/2))}</span><span>${lab(r.startH,S.slots-1)}</span>
        </div>
      </div>`;
  } else {
    $('#kpi').innerHTML = '<p class="col-span-4 text-sm text-slate-500 py-2">Báo cáo doanh thu chỉ dành cho Quản lý / Chủ sân.</p>';
    $('#charts').innerHTML = '';
  }

  const opts = a.inventory.map(i => `<option value="${i.id}">${esc(i.name)} (${fmt(i.price)})</option>`).join('');
  $('#orders').innerHTML = a.bookings.length ? a.bookings.map(b => {
    const goods = b.items.reduce((s,i) => s+i.qty*i.price, 0), total = b.amount + goods;
    const canAct = ['CONFIRMED','PLAYING'].includes(b.status);
    return `
      <div class="list-item text-sm">
        <div class="flex flex-wrap justify-between gap-1 mb-1">
          <b><span class="font-mono">${esc(b.code)}</span> · ${esc(b.name)}</b>
          <div class="flex items-center gap-2">
            <span class="badge-status badge-${b.status}">${STATUS[b.status]}</span>
            ${['CONFIRMED','PLAYING','COMPLETED'].includes(b.status) ? `<a class="text-xs text-brand font-bold underline" target="_blank" href="/invoice.html?code=${encodeURIComponent(b.code)}">🧾 Hóa đơn</a>` : ''}
          </div>
        </div>
        <div class="text-slate-500 text-xs">${b.date} · Sân ${b.court} · ${lab(6,b.from)}–${lab(6,b.to)}</div>
        <div class="mt-0.5">Giờ ${fmt(b.amount)} + Hàng ${fmt(goods)} = <b>${fmt(total)}</b>${canAct ? ` · Đã cọc ${fmt(b.deposit)} → Còn thu <b>${fmt(total-b.deposit)}</b>` : ''}</div>
        ${b.items.map(i => `<div class="text-xs text-slate-400">• ${esc(i.name)} ×${i.qty}</div>`).join('')}
        ${canAct ? `
          <div class="flex flex-wrap gap-1.5 mt-2">
            <select class="text-xs" style="flex:1;min-width:120px" id="it-${b.code}">${opts}</select>
            <input id="q-${b.code}" type="number" value="1" min="1" style="width:54px" class="text-xs">
            <button class="btn btn-sm btn-soft" onclick="addItem('${b.code}')">+ Thêm</button>
            ${b.status==='CONFIRMED' ? `<button class="btn btn-sm btn-primary" onclick="setSt('${b.code}','PLAYING')">▶ Check-in</button>` : `<button class="btn btn-sm" style="background:#16a34a;color:#fff" onclick="setSt('${b.code}','COMPLETED')">✅ Hoàn tất</button>`}
            ${isMgr() ? `<button class="btn btn-sm btn-danger" onclick="setSt('${b.code}','CANCELLED')">Hủy</button>` : ''}
          </div>` : ''}
      </div>`;
  }).join('') : '<p class="text-slate-400 py-4 text-center text-sm">Chưa có đơn đặt sân nào.</p>';

  $('#inv').innerHTML = `
    <table>
      <tr><th>Mặt hàng</th><th>Đơn giá</th><th>Tồn kho</th>${isMgr() ? '<th></th>' : ''}</tr>
      ${a.inventory.map(i => `
        <tr>
          <td class="font-semibold">${esc(i.name)}</td>
          <td class="font-mono">${fmt(i.price)}</td>
          <td class="font-mono ${i.stock <= i.low ? 'text-red-500 font-extrabold' : ''}">${i.stock}${i.stock<=i.low ? ' ⚠' : ''}</td>
          ${isMgr() ? `<td><button class="btn btn-sm btn-soft" onclick="restock(${i.id})">+ Nhập kho</button></td>` : ''}
        </tr>`).join('')}
    </table>`;

  $('#audit').innerHTML = a.audit
    ? (a.audit.length ? a.audit.map(x => `
        <div class="border-b border-[var(--line)] pb-1.5 last:border-0">
          <span class="text-slate-400 font-mono">${new Date(x.at).toLocaleTimeString('vi-VN')}</span>
          · <b>${esc(x.who)}</b> · <span class="text-brand font-bold">${esc(x.action)}</span>
          · ${esc(x.detail)}
        </div>`).join('')
      : '<span class="text-slate-400">Chưa có thao tác nhạy cảm nào.</span>')
    : '<span class="text-slate-400">Chỉ Quản lý / Chủ sân được xem nhật ký.</span>';
}

window.addItem = async code => {
  try {
    const r = await api('/api/pos', 'POST', { code, itemId: +$('#it-'+code).value, qty: +$('#q-'+code).value });
    toast(r.lowStock ? '✅ Đã thêm. ⚠ Mặt hàng sắp hết tồn kho!' : 'Đã thêm vào hóa đơn', r.lowStock ? 'warn' : 'ok');
  } catch (e) { toast(e.message, 'err'); }
  renderAdmin();
};
window.setSt = async (code, status) => {
  if (status === 'CANCELLED' && !confirm(`Xác nhận hủy đơn ${code}? Thao tác sẽ được lưu vào nhật ký.`)) return;
  try { await api('/api/status/' + code, 'POST', { status }); toast('Đã cập nhật trạng thái đơn', 'ok'); } catch (e) { toast(e.message, 'err'); }
  refresh();
};
window.restock = async id => {
  const q = prompt('Số lượng nhập thêm vào kho?', '10');
  if (!q || isNaN(+q) || +q <= 0) return;
  try { await api(`/api/inventory/${id}/restock`, 'POST', { qty: +q }); toast('✅ Đã nhập thêm hàng vào kho', 'ok'); } catch (e) { toast(e.message, 'err'); }
  renderAdmin();
};

// ---- Tournament ----
$('#tgo').onclick = async () => {
  const btn = $('#tgo'); btn.disabled = true; btn.textContent = 'Đang xếp lịch…';
  try {
    const r = await api('/api/tournament', 'POST', { format: $('#tf').value, n: +$('#tn').value, courts: +$('#tc').value });
    let h = '';
    if (r.format === 'roundrobin') {
      h = `<p class="mb-3 text-slate-500">Tổng cộng <b>${r.total}</b> trận = N(N−1)/2 = ${r.expected} ✔ · Thời lượng 30 phút/trận, thi đấu trên ${$('#tc').value} sân song song</p>
        <div class="overflow-x-auto"><table class="w-full text-left border-separate" style="border-spacing:0">
          <tr class="text-xs text-slate-500 border-b" style="border-color:var(--line)"><th class="pb-2">Giờ đấu</th><th class="pb-2">Sân</th><th class="pb-2">Vòng</th><th class="pb-2">Cặp đấu</th></tr>` +
        r.matches.slice().sort((a,b) => a.time.localeCompare(b.time)||a.court-b.court).map(m =>
          `<tr class="border-b hover:bg-slate-50 dark:hover:bg-slate-800/60" style="border-color:var(--line)">
            <td class="py-2 pr-4 font-mono text-sm font-bold">${m.time}</td>
            <td class="py-2 pr-4"><span class="chip chip-blue">Sân ${m.court}</span></td>
            <td class="py-2 pr-4 text-slate-500">Lượt ${m.round}</td>
            <td class="py-2 font-bold">Đội ${m.a} <span class="text-slate-400 mx-1">vs</span> Đội ${m.b}</td>
          </tr>`).join('') + '</table></div>';
    } else if (r.format === 'knockout') {
      const rounds = [...new Set(r.matches.map(m => m.round))];
      h = '<div class="flex gap-4 overflow-x-auto pb-2">' + rounds.map(rd =>
        `<div class="space-y-2 min-w-[135px]"><b class="text-sm font-extrabold block mb-2">${rd === rounds.length ? '🏆 Chung kết' : 'Vòng ' + rd}</b>` +
        r.matches.filter(m => m.round===rd).map(m =>
          `<div class="bracket-match"><button class="bracket-team" disabled>${m.a ?? (rd===1 ? 'Bye':'—')}</button><button class="bracket-team" disabled>${m.b ?? (rd===1 ? 'Bye':'—')}</button></div>`
        ).join('') + '</div>'
      ).join('') + '</div>';
    } else {
      h = r.groups.map((g,i) =>
        `<div class="mb-4"><b class="font-extrabold">Bảng ${String.fromCharCode(65+i)}:</b> Đội ${g.teams.join(', ')} · ${g.matches.length} trận<br>` +
        g.matches.map(m => `<span class="inline-block border rounded-lg px-2.5 py-1 m-0.5 text-xs font-semibold">Lượt ${m.round}: Đội ${m.a} – Đội ${m.b}</span>`).join('') + '</div>'
      ).join('');
    }
    $('#tout').innerHTML = h;
  } catch (e) { toast(e.message, 'err'); }
  btn.disabled = false; btn.textContent = '▶ Tạo lịch thi đấu';
};

let sc = { games: [], winner: null };
try { const saved = JSON.parse(localStorage.getItem('referee_score')); if (saved && Array.isArray(saved.games)) sc = saved; } catch {}
function showScore() {
  const g = sc.games || [], cur = g[g.length-1];
  $('#score').textContent = cur ? `${cur.a} – ${cur.b}` : '0 – 0';
  $('#sc-sum').textContent = g.length ? 'Tỉ số các ván: ' + g.map(x => `${x.a}–${x.b}`).join(' | ') + (sc.winner ? ` → 🏆 Đội ${sc.winner} thắng chung cuộc!` : '') : '';
  try { localStorage.setItem('referee_score', JSON.stringify(sc)); } catch {}
}
const point = async (side, action = 'add') => {
  try { sc = await api('/api/score', 'POST', { ...sc, side, action }); showScore(); } catch (e) { toast(e.message, 'err'); }
};
$('#pa').onclick = () => point('A', 'add');
$('#pb').onclick = () => point('B', 'add');
if ($('#ma')) $('#ma').onclick = () => point('A', 'sub');
if ($('#mb')) $('#mb').onclick = () => point('B', 'sub');
$('#preset').onclick = async () => {
  try { sc = await api('/api/score', 'POST', { action: 'reset' }); } catch { sc = { games:[], winner:null }; }
  showScore();
};
api('/api/score').then(r => { if (r && Array.isArray(r.games)) { sc = r; showScore(); } }).catch(() => showScore());

// ---- Social: matchmaking ----
const demoPlayers = [['Hậu','KHA',2],['Đức','TB+',1],['Hải','TB',0],['Dương','TB-',0],['Long','TOT',3],['Ánh','TB+',0]];
const lvls = ['Y','TB-','TB','TB+','TBK','KHA','TOT'];
$('#players').innerHTML = demoPlayers.map(([n,l,p],i) =>
  `<div class="list-item flex gap-2 items-center">
    <input class="text-sm font-bold" style="flex:1;min-width:75px" value="${n}" id="pn${i}" aria-label="Tên">
    <select id="pl${i}" style="width:auto">${lvls.map(x => `<option ${x===l?'selected':''}>${x}</option>`).join('')}</select>
    <label class="text-xs whitespace-nowrap">Số trận<input id="pp${i}" type="number" min="0" value="${p}" style="width:46px;margin-top:0;margin-left:4px"></label>
  </div>`).join('');

$('#mm').onclick = async () => {
  try {
    const r = await api('/api/matchmaking', 'POST', {
      players: demoPlayers.map((_,i) => ({ name: $('#pn'+i).value, level: $('#pl'+i).value, played: +$('#pp'+i).value }))
    });
    $('#mm-out').innerHTML = `
      <div class="grid sm:grid-cols-2 gap-3 mt-2">
        <div class="card p-3" style="border-color:#93c5fd">
          <div class="font-extrabold text-blue-600 mb-1">🏸 Đôi 1</div>
          ${r.teams[0].map(p => `<div class="text-sm font-semibold">${esc(p.id)} <span class="chip chip-blue text-xs">${p.level}</span></div>`).join('')}
        </div>
        <div class="card p-3" style="border-color:#fca5a5">
          <div class="font-extrabold text-red-500 mb-1">🏸 Đôi 2</div>
          ${r.teams[1].map(p => `<div class="text-sm font-semibold">${esc(p.id)} <span class="chip chip-red text-xs">${p.level}</span></div>`).join('')}
        </div>
      </div>
      <p class="text-xs text-slate-500 mt-2 font-medium">Độ lệch trình độ giữa 2 đôi: <b>${r.diff}</b> (tối ưu nhất)</p>`;
  } catch (e) { toast(e.message, 'err'); }
};

// ---- Refresh & real-time ----
let busy = false;
async function refresh() {
  if (busy) return; busy = true;
  try {
    if (!S && curTab==='book') $('#grid-book').innerHTML = Array.from({length:6}, () =>
      '<tr>' + Array.from({length:6}, () => '<td><div class="skeleton h-9 rounded-lg"></div></td>').join('') + '</tr>').join('');
    await load();
    if (curTab==='book') renderBook();
    if (curTab==='my') await renderMy();
    if (curTab==='admin') await renderAdmin();
  } catch (e) {
    if (/đăng nhập/i.test(e.message)) { me=null; token=null; localStorage.removeItem('token'); afterAuth(); }
    else toast(e.message, 'err');
  }
  busy = false;
}
io().on('changed', refresh);
setInterval(() => { if (S) { S.now += 30000; if (curTab==='book') refresh(); } }, 30000);

(async () => {
  if (token) {
    try {
      me = await api('/api/me');
      localStorage.setItem('clp_user', JSON.stringify(me));
    } catch {
      token = null; me = null;
      localStorage.removeItem('token'); localStorage.removeItem('clp_user');
    }
  }
  authChecked = true;
  initMap();
  afterAuth();
  updateQuickDays();
})();
