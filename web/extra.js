// extra.js – Đợt 3+4+5+6 (Smash Club Badminton Edition): Hợp đồng, Giao lưu, CLB, Đan vợt, Đối thủ ELO, Lịch sử BWF, HLV
const DAYS = ['CN','T2','T3','T4','T5','T6','T7'];

// ---- Hợp đồng khách cố định ----
$('#ct-days').innerHTML = DAYS.map((d,i) =>
  `<label class="inline-flex items-center gap-1 text-xs border rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-brand hover:bg-[var(--brand-l)] transition-colors">
    <input type="checkbox" value="${i}" ${[2,4,6].includes(i)?'checked':''}> ${d}
  </label>`).join('');
$('#ct-court').innerHTML = [1,2,3,4,5,6].map(c => `<option value="${c}">Sân ${c}</option>`).join('');
{
  const d = new Date();
  $('#ct-vf').value = iso(d);
  $('#ch-date').value = iso(new Date(Date.now() + 864e5));
  $('#cb-date').value = iso(new Date(Date.now() + 864e5));
  const dt = new Date(Date.now() + 864e5);
  $('#po-at').value = `${iso(dt)}T18:30`;
  d.setMonth(d.getMonth()+3);
  $('#ct-vt').value = iso(d);
}

const toSlot = v => { const [h,m] = v.split(':').map(Number); return (h-6)*2+(m>=30?1:0); };

$('#ctForm').onsubmit = async e => {
  e.preventDefault();
  const btn = e.submitter; if (btn) { btn.disabled=true; btn.textContent='Đang tạo…'; }
  try {
    const r = await api('/api/contracts', 'POST', {
      name: $('#ct-name').value.trim(), court: +$('#ct-court').value,
      from: toSlot($('#ct-from').value), to: toSlot($('#ct-to').value),
      weekdays: [...document.querySelectorAll('#ct-days input:checked')].map(x => +x.value),
      validFrom: $('#ct-vf').value, validTo: $('#ct-vt').value, deposit: +$('#ct-deposit').value||0
    });
    toast(`📌 Đã khóa ${r.created} buổi${r.skipped.length?`, bỏ qua ${r.skipped.length} buổi trùng`:''}.`, 'ok');
    $('#ct-name').value = '';
  } catch (err) { toast(err.message, 'err'); }
  if (btn) { btn.disabled=false; btn.textContent='📌 Tạo hợp đồng & khóa lịch tự động'; }
  refresh();
};

$('#export').onclick = async () => {
  const r = await fetch('/api/export.csv', { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return toast('Không có quyền xuất báo cáo', 'err');
  const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob());
  a.download = `bao-cao-${iso(new Date())}.csv`; a.click();
  toast('Đã tải xuống báo cáo CSV', 'ok');
};

async function renderContracts() {
  $('#ctForm').classList.toggle('hidden', !isMgr());
  $('#export').classList.toggle('hidden', !isMgr());
  const list = await api('/api/contracts');
  $('#contracts').innerHTML = list.length ? list.map(c => `
    <div class="list-item ${c.dueSoon ? 'border-red-400 dark:border-red-600' : ''}">
      <div class="flex flex-wrap justify-between gap-2">
        <div>
          <span class="font-bold">#${c.id} · ${esc(c.name)}</span>
          <span class="ml-2 chip ${c.status==='ACTIVE' ? '' : 'chip-red'} text-xs">${c.status==='ACTIVE' ? 'Đang hiệu lực' : 'Đã kết thúc'}</span>
        </div>
        ${isMgr() && c.status==='ACTIVE' ? `
          <div class="flex gap-2">
            <button class="btn btn-soft btn-sm" onclick="ctPaid(${c.id})">💵 Ghi nhận thu</button>
            <button class="btn btn-danger btn-sm" onclick="ctCancel(${c.id})">Kết thúc HĐ</button>
          </div>` : ''}
      </div>
      <div class="text-xs text-slate-500 mt-1">Sân ${c.court} · ${c.weekdays.map(d => DAYS[d]).join('-')} · ${lab(6,c.from_s)}–${lab(6,c.to_s)} · ${c.valid_from} → ${c.valid_to} · <b>${c.sessions} buổi</b> · Cọc ${fmt(c.deposit)}</div>
      <div class="text-xs mt-1 ${c.dueSoon ? 'text-red-500 font-bold' : 'text-slate-400'}">
        Đã thu tiền đến: <b>${c.paid_until}</b>${c.dueSoon ? ' ⚠️ Sắp/đã đến kỳ thanh toán!' : ''}
      </div>
    </div>`).join('')
    : '<p class="text-slate-400 text-sm py-3 text-center">Chưa có hợp đồng khách cố định.</p>';
}

window.ctPaid = async id => {
  const u = prompt('Đã thu tiền đến ngày (YYYY-MM-DD)?', iso(new Date(Date.now()+30*864e5)));
  if (!u) return;
  try { await api(`/api/contracts/${id}/paid`, 'POST', { until: u }); toast('✅ Đã ghi nhận thanh toán hợp đồng', 'ok'); } catch (e) { toast(e.message, 'err'); }
  refresh();
};
window.ctCancel = async id => {
  if (!confirm('Kết thúc hợp đồng và hủy toàn bộ các buổi tương lai?')) return;
  try { const r = await api(`/api/contracts/${id}/cancel`, 'POST'); toast(`Đã hủy ${r.cancelled} buổi tương lai`, 'ok'); } catch (e) { toast(e.message, 'err'); }
  refresh();
};

{ const _ra = renderAdmin; renderAdmin = async function () { await _ra(); await renderContracts(); }; }

// ==================== GIAO LƯU VÃNG LAI, CLB & ĐAN VỢT ====================
$('#po-level').innerHTML = lvls.map(l => `<option>${l}</option>`).join('');
$('#po-filter').innerHTML = '<option value="">Tất cả trình độ</option>' + lvls.map(l => `<option>${l}</option>`).join('');
$('#po-filter').onchange = () => renderPosts();

$('#postForm').onsubmit = async e => {
  e.preventDefault();
  try {
    await api('/api/posts', 'POST', {
      title: $('#po-title').value, level: $('#po-level').value,
      slots: +$('#po-slots').value, fee: +$('#po-fee').value, playAt: $('#po-at').value
    });
    toast('📢 Đã đăng bài tuyển giao lưu', 'ok'); $('#po-title').value = '';
  } catch (err) { toast(err.message, 'err'); }
  renderPosts();
};

async function renderPosts() {
  $('#postForm').classList.toggle('hidden', !me);
  $('#po-login').classList.toggle('hidden', !!me);
  const f = $('#po-filter').value;
  const list = (await api('/api/posts')).filter(p => !f || p.level === f);
  $('#posts').innerHTML = list.length ? list.map(p => `
    <div class="list-item flex flex-wrap items-center justify-between gap-3">
      <div class="flex-1 min-w-0">
        <div class="font-bold text-sm flex flex-wrap items-center gap-2">
          <span>${esc(p.title)}</span>
          <span class="chip text-xs">Trình độ ${esc(p.level)}</span>
        </div>
        <div class="text-slate-500 text-xs mt-1">👤 Người đăng: <b>${esc(p.author)}</b> · 🕒 ${new Date(p.play_at).toLocaleString('vi-VN')}</div>
        <div class="mt-1 text-xs md:text-sm">
          Còn trống <b>${p.left}</b>/${p.slots} chỗ · Tổng quỹ ${fmt(p.fee)} → Chia đều ~<b class="text-brand font-mono">${fmt(p.perHead)}</b>/người
        </div>
      </div>
      <div class="shrink-0">
        ${p.mine ? '<span class="chip text-xs">✅ Đã tham gia</span>'
          : p.left > 0 ? `<button class="btn btn-primary btn-sm" onclick="joinPost(${p.id})">🤝 Xin tham gia</button>`
          : '<span class="chip chip-red text-xs">Đã đủ người</span>'}
      </div>
    </div>`).join('')
    : '<p class="text-slate-400 text-sm py-4 text-center">Chưa có bài đăng tuyển giao lưu phù hợp.</p>';
}

window.joinPost = async id => {
  if (!me) { toast('Vui lòng đăng nhập tài khoản trước khi tham gia', 'warn'); return $('#loginBtn').click(); }
  try { await api(`/api/posts/${id}/join`, 'POST'); toast('🤝 Đã tham gia kèo giao lưu!', 'ok'); } catch (e) { toast(e.message, 'err'); }
  renderPosts();
};

async function renderClubs() {
  const list = await api('/api/clubs').catch(() => []);
  $('#clubs-list').innerHTML = list.map(c => `
    <div class="op-card">
      <div class="space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-11 h-11 rounded-2xl bg-[var(--brand-l)] text-xl grid place-items-center shrink-0">${c.badge || '🏸'}</div>
            <div>
              <div class="font-extrabold text-sm leading-snug">${esc(c.name)}</div>
              <div class="text-xs text-slate-500">Chủ nhiệm: <b>${esc(c.leader)}</b></div>
            </div>
          </div>
        </div>
        <p class="text-xs text-slate-500 leading-relaxed">${esc(c.description)}</p>
        <div class="text-xs space-y-1 pt-1">
          <div>🗓 <b>Lịch cố định:</b> ${esc(c.schedule)} (Sân ${c.court})</div>
          <div>🎯 <b>Trình độ:</b> <span class="chip text-xs">${esc(c.level_range)}</span></div>
          <div>💳 <b>Quỹ hội:</b> ${esc(c.fee_note)}</div>
        </div>
      </div>
      <div class="pt-2 border-t border-[var(--line)] flex items-center justify-between">
        <span class="text-xs font-bold text-slate-500">👥 ${c.members_count}/${c.max_members} thành viên</span>
        ${c.joined ? '<span class="chip text-xs">✅ Thành viên</span>'
          : `<button class="btn btn-outline btn-sm" onclick="joinClub(${c.id})">+ Gia nhập CLB</button>`}
      </div>
    </div>`).join('');
}

window.joinClub = async id => {
  if (!me) { toast('Vui lòng đăng nhập để gia nhập CLB', 'warn'); return $('#loginBtn').click(); }
  try { await api(`/api/clubs/${id}/join`, 'POST'); toast('🎉 Chào mừng bạn gia nhập CLB!', 'ok'); } catch (e) { toast(e.message, 'err'); }
  renderClubs();
};

async function renderStringing() {
  if (me && !$('#st-name').value) $('#st-name').value = me.name;
  const r = await api('/api/stringing').catch(() => ({ orders: [] }));
  $('#string-orders').innerHTML = r.orders?.length ? r.orders.map(o => `
    <div class="list-item !p-2.5 flex items-center justify-between gap-2">
      <div>
        <b>${esc(o.customer_name)}</b> · <span class="text-brand font-bold">${esc(o.racket_model)}</span>
        <div class="text-slate-500">${esc(o.string_name)} · Căng <b>${o.tension_kg} kg</b> (${esc(o.pattern)})</div>
      </div>
      <div class="text-right shrink-0">
        <div class="font-extrabold font-mono text-sm">${fmt(o.price)}</div>
        <span class="chip text-[10px]">Đang đan</span>
      </div>
    </div>`).join('') : '<p class="text-slate-400 text-xs">Chưa có đơn đan vợt nào hôm nay.</p>';
}

$('#stringForm').onsubmit = async e => {
  e.preventDefault();
  try {
    await api('/api/stringing', 'POST', {
      customerName: $('#st-name').value.trim(),
      racketModel: $('#st-racket').value.trim(),
      stringName: $('#st-string').value,
      tensionKg: +$('#st-kg').value,
      pattern: $('#st-pat').value
    });
    toast('🏸 Đã đặt lịch đan cước vợt thành công!', 'ok');
    $('#st-racket').value = '';
    renderStringing();
  } catch (err) { toast(err.message, 'err'); }
};

// ==================== TÌM ĐỐI THỦ GẦN ĐÂY & THÁCH ĐẤU (SMASH CLUB) ====================
let cachedOpponents = [];
const tierClass = t => ({
  'Cao Thủ': 'tier-caothu', 'Kim Cương': 'tier-kimcuong', 'Vàng': 'tier-vang', 'Bạc': 'tier-bac', 'Đồng': 'tier-dong'
}[t] || 'tier-bac');

async function renderOpponents() {
  const [ops, chs] = await Promise.all([api('/api/opponents'), api('/api/challenges')]);
  cachedOpponents = ops;
  drawOpponents();

  $('#ch-count').textContent = `${chs.filter(c => c.status === 'OPEN').length} kèo đang mở`;
  $('#challenges-list').innerHTML = chs.length ? chs.map(c => {
    let actionHtml = '';
    if (c.status === 'ACCEPTED') {
      actionHtml = `<span class="chip text-xs">✅ Đã chốt kèo</span>`;
    } else if (c.status === 'DECLINED') {
      actionHtml = `<span class="chip chip-red text-xs">✕ Đã từ chối</span>`;
    } else if (c.canAccept) {
      actionHtml = `<div class="flex items-center gap-1.5">
        <button class="btn btn-accent btn-sm" onclick="acceptChallenge(${c.id})">🤝 Chấp nhận</button>
        <button class="btn btn-danger btn-sm" onclick="declineChallenge(${c.id})">✕ Từ chối</button>
      </div>`;
    } else if (c.canCancel) {
      actionHtml = `<div class="flex items-center gap-1.5">
        <span class="chip text-xs">⏳ Chờ ${esc(c.opponent_name)}</span>
        <button class="btn btn-danger btn-sm" onclick="cancelChallenge(${c.id})">✕ Hủy kèo</button>
      </div>`;
    } else {
      actionHtml = `<span class="text-xs text-slate-400 font-semibold">🔒 Chỉ <b>${esc(c.opponent_name)}</b> được nhận</span>`;
    }
    return `
    <div class="list-item flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-1 flex-1 min-w-[200px]">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="chip chip-accent text-xs">⚔️ ${esc(c.match_type)}</span>
          <span class="chip chip-blue text-xs">Sân ${c.court}</span>
          <span class="text-xs font-bold text-slate-500">${esc(c.play_date)} · ${esc(c.slot_time)}</span>
        </div>
        <div class="font-extrabold text-sm">
          ${esc(c.challenger_name)} <span class="text-accent mx-1">thách đấu</span> ${esc(c.opponent_name)}
        </div>
        <div class="text-xs text-slate-500">🏸 ${esc(c.shuttle_note)}${c.message ? ` · 💬 "${esc(c.message)}"` : ''}</div>
      </div>
      <div class="shrink-0">${actionHtml}</div>
    </div>`;
  }).join('')
    : '<p class="text-slate-400 text-sm col-span-full text-center py-2">Chưa có lời thách đấu nào.</p>';
}

function drawOpponents() {
  const q = ($('#op-q').value || '').toLowerCase().trim();
  const lv = $('#op-level').value;
  const sp = $('#op-spec').value;
  const st = $('#op-style').value;

  let list = cachedOpponents.map(o => ({
    ...o,
    km: myPos ? dist(myPos, { lat: o.lat, lng: o.lng }) : null
  }));
  if (myPos) list.sort((a, b) => (a.km ?? 999) - (b.km ?? 999));

  list = list.filter(o => {
    if (lv && o.level !== lv) return false;
    if (sp && !o.specialty.includes(sp)) return false;
    if (st && !o.style.includes(st)) return false;
    if (q && !(`${o.name} ${o.racket} ${o.district} ${o.specialty} ${o.style}`).toLowerCase().includes(q)) return false;
    return true;
  });

  $('#opponents-grid').innerHTML = list.length ? list.map(o => {
    const total = o.wins + o.losses;
    const winRate = total ? Math.round(o.wins / total * 100) : 0;
    const forms = String(o.form || '').split(',').filter(Boolean);
    return `
      <div class="op-card">
        <div class="space-y-3">
          <!-- Top profile -->
          <div class="flex items-start justify-between gap-2.5">
            <div class="flex items-center gap-3">
              <div class="op-avatar">${esc(o.avatar)}</div>
              <div>
                <div class="font-extrabold text-base leading-tight">${esc(o.name)}</div>
                <div class="text-xs text-slate-500 mt-0.5">📍 ${esc(o.district)}${o.km != null ? ` · <b class="text-brand">${o.km.toFixed(1)} km</b>` : ''} · ${esc(o.hand)}</div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="tier-badge ${tierClass(o.rank_tier)}">🏅 ${esc(o.rank_tier)}</span>
              <div class="font-mono font-extrabold text-sm text-brand mt-1">${o.elo} ELO</div>
            </div>
          </div>

          <!-- Badges -->
          <div class="flex flex-wrap gap-1.5">
            <span class="chip text-xs">Trình độ ${esc(o.level)}</span>
            <span class="chip chip-blue text-xs">${esc(o.specialty)}</span>
            <span class="chip chip-purple text-xs">⚡ ${esc(o.style)}</span>
          </div>

          <!-- Racket & Avail -->
          <div class="space-y-1.5 text-xs">
            <div class="racket-tag w-full">🏸 Vợt: ${esc(o.racket)}</div>
            <div class="text-slate-500">🕒 Khung giờ hay đánh: <b class="text-slate-700 dark:text-slate-200">${esc(o.avail)}</b></div>
            <p class="text-slate-500 italic">"${esc(o.bio)}"</p>
          </div>
        </div>

        <!-- Bottom stats & challenge CTA -->
        <div class="pt-3 border-t border-[var(--line)] space-y-2.5">
          <div class="flex items-center justify-between text-xs">
            <div>
              <span class="text-slate-400">Tỉ lệ thắng:</span>
              <b class="text-green-600 font-mono">${winRate}%</b>
              <span class="text-slate-400">(${o.wins}T – ${o.losses}B)</span>
            </div>
            <div class="flex items-center gap-1" title="Phong độ 5 trận gần nhất">
              ${forms.map(f => `<span class="form-dot form-${f}">${f}</span>`).join('')}
            </div>
          </div>
          ${o.isMe
            ? `<div class="chip w-full justify-center !py-2 text-xs">👤 Hồ sơ VĐV của bạn</div>`
            : `<button class="btn btn-accent w-full !py-2" onclick="openChallenge(${o.id})">⚔️ Thách đấu / Mời giao lưu</button>`}
        </div>
      </div>`;
  }).join('')
    : '<p class="text-slate-400 text-sm col-span-full text-center py-8">Không tìm thấy VĐV phù hợp với bộ lọc.</p>';
}

['#op-q', '#op-level', '#op-spec', '#op-style'].forEach(sel => {
  const el = $(sel);
  if (el) el.oninput = el.onchange = drawOpponents;
});

$('#opGeoBtn').onclick = () => {
  if (!navigator.geolocation) {
    myPos = { lat: 21.3240, lng: 105.4010 };
    drawOpponents();
    return toast('Đã sắp xếp khoảng cách theo tâm TP. Việt Trì', 'ok');
  }
  navigator.geolocation.getCurrentPosition(
    p => { myPos = { lat: p.coords.latitude, lng: p.coords.longitude }; drawOpponents(); toast('📍 Đã sắp xếp VĐV gần vị trí của bạn nhất!', 'ok'); },
    () => { myPos = { lat: 21.3240, lng: 105.4010 }; drawOpponents(); toast('📍 Đã tính khoảng cách từ trung tâm Việt Trì', 'ok'); }
  );
};

window.openChallenge = id => {
  if (!me) {
    toast('Vui lòng đăng nhập tài khoản trước khi gửi lời thách đấu!', 'warn');
    return $('#loginBtn').click();
  }
  const op = cachedOpponents.find(x => x.id === id);
  if (!op) return;
  if (op.isMe) return toast('Bạn không thể tự gửi lời thách đấu cho chính mình!', 'warn');
  $('#ch-op-id').value = op.id;
  $('#ch-target-info').innerHTML = `Đối thủ nhận lời thách đấu: <b>${esc(op.name)}</b> (<span class="text-brand font-mono">${op.elo} ELO</span> · Trình độ ${esc(op.level)})<br><span class="text-xs text-slate-500">Chỉ ${esc(op.name)} mới có quyền chấp nhận hoặc từ chối kèo này.</span>`;
  $('#ch-from-name').value = me.name;
  $('#ch-from-name').readOnly = true;
  $('#challengeModal').classList.remove('hidden');
};

$('#challengeForm').onsubmit = async e => {
  e.preventDefault();
  try {
    await api('/api/challenges', 'POST', {
      opponentId: +$('#ch-op-id').value,
      matchType: $('#ch-type').value,
      court: +$('#ch-court').value,
      playDate: $('#ch-date').value,
      slotTime: $('#ch-time').value,
      shuttleNote: $('#ch-shuttle').value.trim(),
      message: $('#ch-msg').value.trim()
    });
    $('#challengeModal').classList.add('hidden');
    toast('⚔️ Đã gửi lời thách đấu! Đang chờ đối thủ phản hồi.', 'ok');
    renderOpponents();
  } catch (err) { toast(err.message, 'err'); }
};

window.acceptChallenge = async id => {
  if (!me) { toast('Vui lòng đăng nhập tài khoản của người được thách đấu!', 'warn'); return $('#loginBtn').click(); }
  try {
    await api(`/api/challenges/${id}/accept`, 'POST');
    toast('🤝 Đã chấp nhận lời thách đấu! Hẹn gặp tại sân.', 'ok');
    renderOpponents();
  } catch (err) { toast(err.message, 'err'); }
};

window.declineChallenge = async id => {
  if (!confirm('Bạn muốn từ chối lời thách đấu này?')) return;
  try {
    await api(`/api/challenges/${id}/decline`, 'POST');
    toast('Đã từ chối lời thách đấu', 'info');
    renderOpponents();
  } catch (err) { toast(err.message, 'err'); }
};

window.cancelChallenge = async id => {
  if (!confirm('Hủy lời thách đấu bạn đã tạo?')) return;
  try {
    await api(`/api/challenges/${id}/cancel`, 'POST');
    toast('Đã hủy lời thách đấu', 'info');
    renderOpponents();
  } catch (err) { toast(err.message, 'err'); }
};

// ==================== LỊCH SỬ THI ĐẤU & BẢNG XẾP HẠNG ELO ====================
let cachedMatches = [];
async function renderHistory() {
  const [ms, lb] = await Promise.all([api('/api/matches'), api('/api/leaderboard')]);
  cachedMatches = ms;
  const totalSets = ms.reduce((s, m) => s + (m.scores?.length || 0), 0);
  const totalShuttles = ms.reduce((s, m) => s + (m.shuttles || 0), 0);
  const avgDur = ms.length ? Math.round(ms.reduce((s, m) => s + (m.duration_min || 40), 0) / ms.length) : 0;

  $('#hist-kpi').innerHTML = [
    ['🏸', 'Tổng số trận đã đấu', ms.length + ' trận', 'kpi-green'],
    ['🎯', 'Tổng số ván BWF', totalSets + ' ván', 'kpi-blue'],
    ['⚡', 'Cầu tiêu thụ', totalShuttles + ' quả', 'kpi-orange'],
    ['⏱️', 'Thời lượng TB/trận', avgDur + ' phút', 'kpi-purple']
  ].map(([ic, lb, vl, cl]) => `
    <div class="kpi-card flex items-center gap-3">
      <div class="kpi-icon ${cl}">${ic}</div>
      <div>
        <div class="text-xs text-slate-500 font-semibold">${lb}</div>
        <div class="text-lg font-extrabold font-mono mt-0.5">${vl}</div>
      </div>
    </div>`).join('');

  drawMatchesList();

  // Leaderboard
  $('#leaderboard-list').innerHTML = lb.map((p, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
    const wr = (p.wins + p.losses) ? Math.round(p.wins / (p.wins + p.losses) * 100) : 0;
    return `
      <div class="list-item flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 text-center font-extrabold text-base shrink-0">${medal}</div>
          <div class="op-avatar !w-10 !h-10 !text-xs !rounded-xl">${esc(p.avatar)}</div>
          <div class="min-w-0">
            <div class="font-extrabold text-sm truncate">${esc(p.name)}</div>
            <div class="text-xs text-slate-500 truncate">${esc(p.specialty)} · Thắng ${wr}% (${p.wins}T-${p.losses}B)</div>
          </div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-mono font-extrabold text-sm text-brand">${p.elo} ELO</div>
          <span class="tier-badge ${tierClass(p.rank_tier)} !text-[10px] !py-0.5 !px-2">${esc(p.rank_tier)}</span>
        </div>
      </div>`;
  }).join('');
}

function drawMatchesList() {
  const f = $('#mh-filter').value;
  const list = cachedMatches.filter(m => !f || m.match_type === f);
  const modeBadge = {
    RANKED: ['Đấu hạng ELO', 'chip-accent'],
    TOURNAMENT: ['Giải đấu', 'chip-red'],
    FRIENDLY: ['Giao lưu', '']
  };
  $('#matches-list').innerHTML = list.length ? list.map(m => {
    const [mLabel, mCls] = modeBadge[m.mode] || ['Giao lưu', ''];
    return `
      <div class="list-item space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="chip chip-blue">${esc(m.match_type)}</span>
            <span class="chip ${mCls}">${mLabel}</span>
            <span class="text-slate-500 font-semibold">Sân ${m.court} · ${esc(m.play_date)}</span>
          </div>
          <span class="font-mono font-bold text-green-600">+${m.elo_delta} ELO</span>
        </div>

        <div class="grid sm:grid-cols-2 gap-2 items-center pt-1">
          <div class="space-y-1">
            <div class="font-bold text-sm ${m.winner==='A' ? 'text-brand' : ''}">
              ${m.winner==='A' ? '🏆 ' : ''}${esc(m.team_a)} <span class="text-xs text-slate-400">(${esc(m.level_a)})</span>
            </div>
            <div class="font-bold text-sm ${m.winner==='B' ? 'text-brand' : ''}">
              ${m.winner==='B' ? '🏆 ' : ''}${esc(m.team_b)} <span class="text-xs text-slate-400">(${esc(m.level_b)})</span>
            </div>
          </div>
          <div class="flex flex-wrap sm:justify-end gap-1.5">
            ${(m.scores || []).map((s, idx) => `<span class="set-pill ${((m.winner==='A' && s.a>s.b)||(m.winner==='B' && s.b>s.a)) ? 'set-win' : ''}">V${idx+1}: ${s.a}–${s.b}</span>`).join('')}
          </div>
        </div>

        <div class="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-[var(--line)]">
          <span>🏸 Cầu sử dụng: <b>${m.shuttles} quả</b> · ⏱ Thời lượng: <b>${m.duration_min} phút</b></span>
          <span class="text-green-600 font-semibold">✔ Đã xác thực BWF</span>
        </div>
      </div>`;
  }).join('') : '<p class="text-slate-400 text-sm py-4 text-center">Chưa có trận đấu nào trong mục này.</p>';
}

$('#mh-filter').onchange = drawMatchesList;

$('#matchForm').onsubmit = async e => {
  e.preventDefault();
  const scores = [
    { a: +$('#mf-s1a').value, b: +$('#mf-s1b').value },
    { a: +$('#mf-s2a').value, b: +$('#mf-s2b').value },
    { a: +$('#mf-s3a').value, b: +$('#mf-s3b').value }
  ].filter(s => s.a > 0 || s.b > 0);
  try {
    const r = await api('/api/matches', 'POST', {
      matchType: $('#mf-type').value,
      mode: $('#mf-mode').value,
      court: +$('#mf-court').value,
      shuttles: +$('#mf-shuttles').value,
      teamA: $('#mf-a').value.trim(),
      teamB: $('#mf-b').value.trim(),
      scores
    });
    toast(`🏆 Đã lưu kết quả trận đấu! Đội ${r.winner} thắng (+${r.eloDelta} ELO)`, 'ok');
    $('#mf-a').value = ''; $('#mf-b').value = '';
    renderHistory();
  } catch (err) { toast(err.message, 'err'); }
};

// ==================== TÌM HUẤN LUYỆN VIÊN CẦU LÔNG ====================
let cachedCoaches = [];
async function renderCoaches() {
  const [cs, bks] = await Promise.all([api('/api/coaches'), api('/api/coaches/bookings')]);
  cachedCoaches = cs;
  drawCoaches();

  const typeLabel = { '1ON1': 'Kèm riêng 1-1', 'GROUP': 'Nhóm 2–4 HV' };
  $('#coach-bookings-list').innerHTML = bks.length ? bks.map(b => `
    <div class="list-item flex items-center justify-between gap-3">
      <div>
        <div class="font-extrabold text-sm">🎓 ${esc(b.coach_name)}</div>
        <div class="text-xs text-slate-500 mt-0.5">Học viên: <b>${esc(b.student_name)}</b> · ${esc(typeLabel[b.class_type] || b.class_type)}</div>
        <div class="text-xs text-slate-400 mt-0.5">🗓 Ngày ${esc(b.date)} · Khung giờ ${esc(b.time_slot)}</div>
      </div>
      <div class="text-right shrink-0">
        <div class="font-mono font-extrabold text-brand">${fmt(b.price)}</div>
        <span class="chip text-xs mt-1">Đã xác nhận</span>
      </div>
    </div>`).join('') : '<p class="text-slate-400 text-sm col-span-full text-center py-3">Chưa có lịch đăng ký học nào.</p>';
}

function drawCoaches() {
  const f = ($('#coach-filter').value || '').toLowerCase();
  const list = cachedCoaches.filter(c => !f || (`${c.specialty} ${c.tags.join(' ')} ${c.bio}`).toLowerCase().includes(f));
  $('#coaches-grid').innerHTML = list.map(c => `
    <div class="coach-card">
      <div class="space-y-3">
        <div class="flex items-start gap-3">
          <div class="coach-avatar">${esc(c.avatar)}</div>
          <div class="min-w-0">
            <div class="font-extrabold text-base leading-snug">${esc(c.name)}</div>
            <div class="text-xs font-bold text-accent mt-0.5">${esc(c.title)}</div>
            <div class="text-xs text-slate-500 mt-0.5">🏅 ${esc(c.cert)}</div>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/70 px-3 py-2 rounded-xl">
          <span>⭐ <b>${c.rating}</b> (${c.reviews} đánh giá)</span>
          <span>🎓 <b>${c.students}+</b> học viên</span>
          <span>⏳ <b>${c.exp_years} năm</b> KN</span>
        </div>

        <div class="space-y-1.5">
          <div class="text-xs font-bold text-brand">🎯 Chuyên môn: ${esc(c.specialty)}</div>
          <div class="flex flex-wrap gap-1">
            ${c.tags.map(t => `<span class="chip text-[11px]">${esc(t)}</span>`).join('')}
          </div>
          <p class="text-xs text-slate-500 leading-relaxed pt-1">${esc(c.bio)}</p>
          <div class="text-xs text-slate-400">🗓 Lịch dạy: <b class="text-slate-600 dark:text-slate-300">${esc(c.schedule)}</b></div>
        </div>
      </div>

      <div class="pt-3 border-t border-[var(--line)] space-y-2.5">
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-2 rounded-xl border border-[var(--line)]">
            <div class="text-slate-400">Kèm riêng 1–1</div>
            <div class="font-extrabold font-mono text-sm text-brand">${fmt(c.price_1on1)}/giờ</div>
          </div>
          <div class="p-2 rounded-xl border border-[var(--line)]">
            <div class="text-slate-400">Nhóm 2–4 HV</div>
            <div class="font-extrabold font-mono text-sm">${fmt(c.price_group)}/buổi</div>
          </div>
        </div>
        <button class="btn btn-primary w-full" onclick="openCoachBook(${c.id})">🎓 Đặt lịch học với HLV</button>
      </div>
    </div>`).join('');
}

$('#coach-filter').onchange = drawCoaches;

window.openCoachBook = id => {
  const c = cachedCoaches.find(x => x.id === id);
  if (!c) return;
  $('#cb-coach-id').value = c.id;
  $('#cb-coach-info').innerHTML = `Huấn luyện viên: <b>${esc(c.name)}</b> (${esc(c.cert)})<br><span class="text-xs text-slate-500">Học phí: Kèm 1-1 <b>${fmt(c.price_1on1)}/h</b> · Nhóm <b>${fmt(c.price_group)}/buổi</b></span>`;
  if (me) { $('#cb-name').value = me.name; $('#cb-phone').value = me.phone || ''; }
  $('#coachModal').classList.remove('hidden');
};

$('#coachBookForm').onsubmit = async e => {
  e.preventDefault();
  try {
    await api('/api/coaches/book', 'POST', {
      coachId: +$('#cb-coach-id').value,
      studentName: $('#cb-name').value.trim(),
      studentPhone: $('#cb-phone').value.trim(),
      classType: $('#cb-type').value,
      date: $('#cb-date').value,
      timeSlot: $('#cb-slot').value,
      note: $('#cb-note').value.trim()
    });
    $('#coachModal').classList.add('hidden');
    toast('🎓 Đã đăng ký lịch học cầu lông thành công!', 'ok');
    renderCoaches();
  } catch (err) { toast(err.message, 'err'); }
};

// ---- Lưu giải đấu ----
let lastTour = null;
{ const _go = $('#tgo').onclick;
  $('#tgo').onclick = async () => {
    await _go();
    const p = { format: $('#tf').value, n: +$('#tn').value, courts: +$('#tc').value };
    try { lastTour = { ...p, data: await api('/api/tournament', 'POST', p) }; } catch {}
    $('#tsave').classList.toggle('hidden', !isMgr());
  };
}
$('#tsave').onclick = async () => {
  const name = prompt('Nhập tên giải đấu để lưu?'); if (!name || !lastTour) return;
  try { await api('/api/tournaments', 'POST', { name, format:lastTour.format, n:lastTour.n, data:lastTour.data }); toast('💾 Đã lưu giải đấu', 'ok'); renderSaved(); } catch (e) { toast(e.message, 'err'); }
};
async function renderSaved() {
  const list = await api('/api/tournaments');
  const box = $('#tsaved'); box.classList.toggle('hidden', !list.length);
  if (list.length) {
    box.innerHTML = `<div class="font-extrabold text-sm mb-2">📂 Giải đấu đã lưu:</div>
      <div class="flex flex-wrap gap-2">
        ${list.map(t => `<button class="btn btn-soft btn-sm" onclick="openTour(${t.id})">🏆 ${esc(t.name)} (${t.n} đội)</button>`).join('')}
      </div>`;
  }
}
window.openTour = async id => {
  const t = await api('/api/tournaments/' + id); const r = t.data;
  $('#tf').value = t.format; $('#tn').value = t.n;
  const rows = r.format==='roundrobin' ? r.matches.slice().sort((a,b)=>a.time.localeCompare(b.time)||a.court-b.court).map(m =>
    `<tr class="border-b hover:bg-slate-50 dark:hover:bg-slate-800" style="border-color:var(--line)">
      <td class="py-1.5 pr-4 font-mono text-sm font-bold">${m.time}</td>
      <td class="py-1.5 pr-4"><span class="chip chip-blue text-xs">Sân ${m.court}</span></td>
      <td class="py-1.5 pr-4 text-slate-500">Vòng ${m.round}</td>
      <td class="py-1.5 font-bold">Đội ${m.a} vs Đội ${m.b}</td>
    </tr>`).join('') : null;
  $('#tout').innerHTML = `<p class="font-extrabold mb-3">🏆 ${esc(t.name)}</p>` + (rows
    ? `<div class="overflow-x-auto"><table class="w-full text-left border-separate" style="border-spacing:0">
        <tr class="text-xs text-slate-500"><th class="pb-2">Giờ</th><th class="pb-2">Sân</th><th class="pb-2">Lượt</th><th class="pb-2">Trận</th></tr>
        ${rows}</table></div>`
    : `<pre class="text-xs overflow-auto bg-slate-50 dark:bg-slate-800 rounded p-3">${esc(JSON.stringify(r,null,2).slice(0,4000))}</pre>`);
};

// Inject các tab mới vào refresh
{ const _rf = refresh; refresh = async function () {
  await _rf();
  try {
    if (curTab==='opponents') await renderOpponents();
    if (curTab==='history') await renderHistory();
    if (curTab==='coaches') await renderCoaches();
    if (curTab==='social') { await renderPosts(); await renderClubs(); await renderStringing(); }
    if (curTab==='tour') await renderSaved();
  } catch (e) { toast(e.message, 'err'); }
}; }

// ==================== Đợt 5: cấu hình, thông báo, live score ====================
fetch('/api/config').then(r => r.json()).then(c => { window.PAY = c; }).catch(() => {});

$('#settings').onsubmit = async e => {
  e.preventDefault();
  const btn = e.submitter; if (btn) { btn.disabled=true; btn.textContent='Đang lưu…'; }
  try {
    await api('/api/settings', 'POST', {
      courts:+$('#s-courts').value, off_price:+$('#s-off').value, peak_price:+$('#s-peak').value,
      peak_from:+$('#s-from').value, weekend_pct:+$('#s-wk').value, deposit_pct:+$('#s-dep').value
    });
    toast('✅ Đã lưu cấu hình sân & bảng giá', 'ok');
  } catch (err) { toast(err.message, 'err'); }
  if (btn) { btn.disabled=false; btn.textContent='Lưu cấu hình'; }
  refresh();
};

{ const _ra2 = renderAdmin;
  renderAdmin = async function () {
    await _ra2();
    $('#settings').classList.toggle('hidden', !isMgr());
    const keep = $('#ct-court').value;
    if (S) $('#ct-court').innerHTML = S.courts.map(c => `<option value="${c}">Sân ${c}</option>`).join('');
    if (keep) $('#ct-court').value = keep;
    if (isMgr() && document.activeElement?.closest('#settings') == null) {
      try {
        const c = await api('/api/settings');
        $('#s-courts').value = c.courts; $('#s-off').value = c.off_price; $('#s-peak').value = c.peak_price;
        $('#s-from').value = c.peak_from; $('#s-wk').value = c.weekend_pct; $('#s-dep').value = c.deposit_pct;
      } catch {}
    }
  };
}

// ---- Thông báo ----
let lastNotif = 0;
async function loadNotifs() {
  if (!me) return;
  let list; try { list = await api('/api/my/notifications'); } catch { return; }
  const unread = list.filter(n => !n.read);
  $('#bellN').textContent = unread.length;
  $('#bellN').classList.toggle('hidden', !unread.length);
  const max = Math.max(0, ...list.map(n => n.id));
  if (lastNotif && 'Notification' in window && Notification.permission==='granted')
    list.filter(n => n.id > lastNotif && !n.read).forEach(n => new Notification('CầuLông Pro 🏸', { body: n.msg }));
  lastNotif = max;
  $('#notifList').innerHTML = list.length ? list.map(n => `
    <div class="border-b border-[var(--line)] pb-2 last:border-0 ${n.read ? 'opacity-60' : ''}">
      <div class="text-sm font-medium">${esc(n.msg)}</div>
      <div class="text-xs text-slate-400 mt-0.5">${new Date(n.created).toLocaleString('vi-VN')}</div>
    </div>`).join('')
    : '<p class="text-slate-400 text-sm text-center py-3">Chưa có thông báo mới.</p>';
}

$('#bell').onclick = async () => {
  if ('Notification' in window && Notification.permission==='default') Notification.requestPermission();
  $('#notifModal').classList.remove('hidden');
  await loadNotifs();
  await api('/api/my/notifications/read', 'POST').catch(() => {});
  setTimeout(loadNotifs, 300);
};
$('#notifClose').onclick = () => $('#notifModal').classList.add('hidden');

{ const _aa = afterAuth; afterAuth = function () {
  _aa();
  $('#bell').classList.toggle('hidden', !me);
  lastNotif = 0;
  if (me) loadNotifs();
}; }
io().on('notify', e => { if (me && e.userId===me.id) loadNotifs(); });
setInterval(() => loadNotifs(), 60000);

// ---- Trận trực tiếp ----
$('#liveForm').onsubmit = async e => {
  e.preventDefault();
  try {
    await api('/api/live', 'POST', { a: $('#lv-a').value, b: $('#lv-b').value, court: +$('#lv-c').value });
    $('#lv-a').value = $('#lv-b').value = '';
    toast('▶ Đã bắt đầu phát trực tiếp trận đấu', 'ok');
  } catch (err) { toast(err.message, 'err'); }
  renderLives();
};

async function renderLives() {
  $('#liveForm').classList.toggle('hidden', !isStaff());
  const ls = await api('/api/live');
  $('#lives').innerHTML = ls.length ? ls.map(l => {
    const g = l.state.games, cur = g[g.length-1] || { a:0, b:0 };
    const done = !!l.state.winner;
    return `
      <div class="list-item flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <span class="font-extrabold text-sm">${esc(l.a)}</span>
            <span class="text-2xl font-extrabold font-mono text-brand">${cur.a} – ${cur.b}</span>
            <span class="font-extrabold text-sm">${esc(l.b)}</span>
            <span class="chip chip-blue text-xs">Sân ${l.court}</span>
            ${done ? `<span class="chip text-xs">🏆 ${esc(l.state.winner==='A'?l.a:l.b)} thắng</span>` : '<span class="pulse w-2.5 h-2.5 bg-red-500 rounded-full inline-block"></span>'}
          </div>
          <div class="text-xs text-slate-400 mt-1 font-mono">Các ván: ${g.map(x=>x.a+'–'+x.b).join(' | ')||'0–0'}</div>
        </div>
        ${isStaff() ? `
          <div class="flex flex-wrap items-center gap-1.5">
            <button class="btn !bg-slate-200 dark:!bg-slate-700 !text-slate-800 dark:!text-white btn-sm" title="Trừ 1 điểm Đội A" onclick="livePt(${l.id},'A','sub')">− A</button>
            ${!done ? `<button class="btn !bg-blue-600 !text-white btn-sm" onclick="livePt(${l.id},'A','add')">+ ${esc(l.a)}</button>` : ''}
            ${!done ? `<button class="btn !bg-red-500 !text-white btn-sm" onclick="livePt(${l.id},'B','add')">+ ${esc(l.b)}</button>` : ''}
            <button class="btn !bg-slate-200 dark:!bg-slate-700 !text-slate-800 dark:!text-white btn-sm" title="Trừ 1 điểm Đội B" onclick="livePt(${l.id},'B','sub')">− B</button>
          </div>` : ''}
      </div>`;
  }).join('')
    : '<p class="text-slate-400 text-sm py-3 text-center">Chưa có trận nào đang diễn ra.</p>';
}
window.livePt = async (id, side, action = 'add') => {
  try { await api(`/api/live/${id}/point`, 'POST', { side, action }); } catch (e) { toast(e.message, 'err'); }
  renderLives();
};
io().on('live', () => { if (curTab==='tour') renderLives(); });
{ const _rf2 = refresh; refresh = async function () {
  await _rf2();
  try { if (curTab==='tour') await renderLives(); } catch (e) { toast(e.message, 'err'); }
}; }

// ---- Bracket tương tác (knockout) ----
let BR = null;
const slotKey = id => (+/M(\d+)/.exec(id)[1] % 2 === 1 ? 'a' : 'b');
function propagate(m) {
  if (!m.next) return;
  const nm = BR[m.next], k = slotKey(m.id);
  if (nm[k] !== m.winner) { nm[k] = m.winner; if (nm.winner) { nm.winner = null; propagate(nm); } }
}
function renderBracket(matches) {
  BR = Object.fromEntries(matches.map(m => [m.id, { ...m, winner: null }]));
  Object.values(BR).filter(m => m.round===1).forEach(m => { if (m.a==null || m.b==null) { m.winner=m.a??m.b; propagate(m); } });
  drawBracket();
}
function drawBracket() {
  const all = Object.values(BR), rounds = [...new Set(all.map(m => m.round))], last = all.find(m => !m.next);
  $('#tout').innerHTML = `
    <p class="text-sm text-slate-500 mb-3">Bấm vào đội thắng để đưa vào vòng tiếp theo (bấm lại để chỉnh sửa).</p>
    <div class="flex gap-4 overflow-x-auto pb-2">
      ${rounds.map(rd => `
        <div class="space-y-2.5 min-w-[135px] shrink-0">
          <b class="text-sm font-extrabold block">${rd===rounds.length ? '🏆 Chung kết' : 'Vòng '+rd}</b>
          ${all.filter(m => m.round===rd).map(m => `
            <div class="bracket-match">
              ${['a','b'].map(s => {
                const v = m[s]; const w = m.winner!==null && m.winner===v && v!=null;
                return `<button data-m="${m.id}" data-s="${s}" ${v==null?'disabled':''} class="bracket-team ${w?'win':''}">${v==null?(m.round===1?'Bye':'—'):'Đội '+v}</button>`;
              }).join('')}
            </div>`).join('')}
        </div>`).join('')}
    </div>
    ${last?.winner ? `<p class="mt-4 text-xl font-extrabold text-brand">🏆 Nhà vô địch: Đội ${last.winner}</p>` : ''}`;
}
$('#tout').onclick = e => {
  const b = e.target.closest('button[data-m]'); if (!b || !BR) return;
  const m = BR[b.dataset.m], v = m[b.dataset.s]; if (v==null) return;
  m.winner = m.winner===v ? null : v; propagate(m); drawBracket();
};
{ const _g2 = $('#tgo').onclick;
  $('#tgo').onclick = async () => { await _g2(); if (lastTour?.format==='knockout') renderBracket(lastTour.data.matches); };
}

// ---- Hero matrix & stats ----
(() => {
  const el = $('#heroMatrix'); if (!el) return;
  let h = '';
  for (let i=0; i<72; i++) {
    const v = Math.abs(Math.sin(i*12.9898+1)*43758.5453) % 1;
    h += `<i class="${v<.55?'free':v<.85?'booked':'playing'}"></i>`;
  }
  el.innerHTML = h;
  setInterval(() => {
    const cells = el.querySelectorAll('i');
    const idx = Math.floor(Math.random()*72);
    const cls = ['free','free','free','booked','playing'][Math.floor(Math.random()*5)];
    if (cells[idx]) cells[idx].className = cls;
  }, 900);
})();

fetch('/api/stats').then(r => r.json()).then(s => {
  document.querySelectorAll('#heroStats [data-k]').forEach(e => {
    const val = s[e.dataset.k] ?? 0;
    e.textContent = val.toLocaleString('vi-VN');
  });
}).catch(() => {});

function shiftDay(n) {
  const d = new Date($('#date').value + 'T12:00:00');
  d.setDate(d.getDate()+n);
  const v = iso(d);
  if (v < $('#date').min) return toast('Không thể chọn ngày đã qua', 'warn');
  $('#date').value = v; $('#date').onchange(); updateQuickDays();
}
$('#dayPrev').onclick = () => shiftDay(-1);
$('#dayNext').onclick = () => shiftDay(1);

if (new Date().getHours() >= 22) {
  $('#date').value = iso(new Date(Date.now()+864e5));
  setTimeout(() => { $('#date').onchange(); updateQuickDays(); }, 100);
}

document.querySelector('a[href="#venues-sec"]')?.addEventListener('click', () => {
  setTimeout(() => $('#geo')?.click(), 500);
});

// Đảm bảo nạp đầy đủ dữ liệu cho mọi tab ngay khi khởi chạy / F5
setTimeout(() => { busy = false; refresh(); }, 50);
