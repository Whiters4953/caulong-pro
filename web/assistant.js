// Nút liên hệ nổi (Zalo, Facebook, Gọi) + Trợ lý AI giới thiệu dịch vụ & gợi ý lịch đặt sân
(() => {
  const CONTACT = {
    phone: '0353154185',
    zalo: 'https://zalo.me/0353154185',
    // Đổi thành link Facebook/Messenger thật của bạn, ví dụ: https://m.me/ten-trang
    facebook: 'https://www.facebook.com/'
  };
  const PRICE = { off: 60000, peak: 80000, peakFrom: 17, open: 6, close: 22 };
  const vnd = n => n.toLocaleString('vi-VN') + 'đ';
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const css = document.createElement('style');
  css.textContent = `
  #cl-fab{position:fixed;right:14px;bottom:90px;z-index:9998;display:flex;flex-direction:column;gap:10px;align-items:flex-end}
  #cl-fab a,#cl-fab button{width:50px;height:50px;border-radius:50%;border:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer;text-decoration:none;transition:transform .15s}
  #cl-fab a:hover,#cl-fab button:hover{transform:scale(1.1)}
  #cl-zalo{background:#0068ff}#cl-fb{background:#1877f2}#cl-call{background:#16a34a}#cl-ai{background:linear-gradient(135deg,#f97316,#db2777);width:58px!important;height:58px!important;font-size:22px!important}
  #cl-chat{position:fixed;right:14px;bottom:90px;width:360px;max-width:calc(100vw - 28px);height:520px;max-height:calc(100vh - 110px);background:#0f1f2e;color:#e2e8f0;border:1px solid #1f3a52;border-radius:16px;z-index:9999;display:none;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.5);overflow:hidden}
  #cl-chat.open{display:flex}
  #cl-chat header{padding:12px 14px;background:linear-gradient(135deg,#0d9488,#0f766e);display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
  #cl-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px}
  .cl-m{padding:8px 11px;border-radius:12px;max-width:88%;line-height:1.45}
  .cl-bot{background:#173247;align-self:flex-start}.cl-user{background:#0d9488;color:#fff;align-self:flex-end}
  .cl-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}
  .cl-chip,.cl-pick{background:#173247;border:1px solid #2b5878;color:#e2e8f0;border-radius:999px;padding:5px 10px;font-size:12px;cursor:pointer}
  .cl-pick{display:block;margin-top:5px;background:#f97316;border-color:#f97316;color:#fff;font-weight:700;border-radius:8px}
  #cl-form{display:flex;gap:6px;padding:10px;border-top:1px solid #1f3a52}
  #cl-in{flex:1;background:#0b1722;border:1px solid #2b5878;color:#e2e8f0;border-radius:10px;padding:8px 10px;font-size:13px}
  #cl-send{background:#f97316;color:#fff;border:0;border-radius:10px;padding:0 14px;font-weight:800;cursor:pointer}
  `;
  document.head.appendChild(css);

  const fab = document.createElement('div');
  fab.id = 'cl-fab';
  fab.innerHTML = `
    <a id="cl-call" href="tel:${CONTACT.phone}" title="Gọi ${CONTACT.phone}" aria-label="Gọi điện">📞</a>
    <a id="cl-zalo" href="${CONTACT.zalo}" target="_blank" rel="noopener" title="Chat Zalo ${CONTACT.phone}" aria-label="Zalo">Zalo</a>
    <a id="cl-fb" href="${CONTACT.facebook}" target="_blank" rel="noopener" title="Nhắn Facebook" aria-label="Facebook">f</a>
    <button id="cl-ai" title="Trợ lý AI CầuLông Pro" aria-label="Trợ lý AI">🤖</button>`;
  document.body.appendChild(fab);

  const chat = document.createElement('div');
  chat.id = 'cl-chat';
  chat.innerHTML = `
    <header><span>🤖 Trợ lý AI CầuLông Pro</span><button id="cl-x" style="background:none;border:0;color:#fff;font-size:18px;cursor:pointer">✕</button></header>
    <div id="cl-msgs"></div>
    <div class="cl-chips">
      <button class="cl-chip" data-q="Giới thiệu dịch vụ">Giới thiệu dịch vụ</button>
      <button class="cl-chip" data-q="Gợi ý lịch đặt sân hôm nay">Gợi ý hôm nay</button>
      <button class="cl-chip" data-q="Gợi ý lịch đặt sân ngày mai buổi tối">Gợi ý tối mai</button>
      <button class="cl-chip" data-q="Bảng giá sân">Bảng giá</button>
      <button class="cl-chip" data-q="Liên hệ">Liên hệ</button>
    </div>
    <form id="cl-form"><input id="cl-in" placeholder="VD: gợi ý sân 2 tiếng chiều mai..." autocomplete="off"><button id="cl-send">Gửi</button></form>`;
  document.body.appendChild(chat);

  const msgs = chat.querySelector('#cl-msgs');
  const add = (html, who) => {
    const d = document.createElement('div');
    d.className = 'cl-m ' + (who === 'user' ? 'cl-user' : 'cl-bot');
    d.innerHTML = html;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    return d;
  };

  const intro = () => `<b>CầuLông Pro</b> – nền tảng đặt sân &amp; kết nối cộng đồng cầu lông:<br>
    🏸 Đặt sân real-time 6 sân, mở cửa ${PRICE.open}h–${PRICE.close}h, khóa slot chống trùng + VietQR<br>
    ⚔️ Tìm đối thủ &amp; xếp hạng ELO · 🎓 Tìm HLV · 🤝 CLB &amp; đan cước vợt<br>
    🏆 Giải đấu Berger &amp; chấm điểm trực tiếp theo luật BWF<br>
    Hỏi mình để được <b>gợi ý lịch đặt sân</b> nhé!`;
  const pricing = () => `💰 <b>Bảng giá</b>: trước ${PRICE.peakFrom}h: <b>${vnd(PRICE.off)}/giờ</b> · từ ${PRICE.peakFrom}h: <b>${vnd(PRICE.peak)}/giờ</b>.<br>VD 16h–18h = ${vnd(PRICE.off + PRICE.peak)}. Cọc giữ sân theo cấu hình hệ thống.`;
  const contact = () => `📞 Hotline/Zalo: <b>${CONTACT.phone}</b><br>
    <a href="${CONTACT.zalo}" target="_blank" style="color:#60a5fa">Nhắn Zalo</a> · <a href="${CONTACT.facebook}" target="_blank" style="color:#60a5fa">Facebook</a> · <a href="tel:${CONTACT.phone}" style="color:#4ade80">Gọi ngay</a>`;

  const cost = (s, e) => { let t = 0; for (let h = s; h < e; h++) t += h < PRICE.peakFrom ? PRICE.off : PRICE.peak; return t; };

  async function freeBlocks(dateStr) {
    const st = await (await fetch('/api/state?date=' + dateStr)).json();
    const base = st.startH ?? PRICE.open;
    const now = new Date(), isToday = dateStr === iso(now), curH = now.getHours() + now.getMinutes() / 60;
    const taken = {};
    st.bookings.forEach(b => {
      for (let h = Math.floor(base + b.from / 2); h < Math.ceil(base + b.to / 2); h++) (taken[b.court] ||= new Set()).add(h);
    });
    return { courts: st.courts, taken, isToday, curH };
  }

  function parseIntent(q) {
    const t = q.toLowerCase();
    const d = new Date();
    if (/mai|ngày mai/.test(t)) d.setDate(d.getDate() + 1);
    else if (/mốt|kia/.test(t)) d.setDate(d.getDate() + 2);
    let range = [PRICE.open, PRICE.close];
    if (/sáng/.test(t)) range = [6, 12];
    else if (/chiều/.test(t)) range = [12, 17];
    else if (/tối|đêm/.test(t)) range = [17, 22];
    const m = t.match(/(\d)\s*(tiếng|giờ|h)/);
    const len = m ? Math.min(4, Math.max(1, +m[1])) : 2;
    const cheap = /rẻ|tiết kiệm/.test(t);
    return { date: iso(d), range, len, cheap };
  }

  async function suggest(q) {
    const { date, range, len, cheap } = parseIntent(q);
    const bot = add('⏳ Đang kiểm tra lịch trống...');
    try {
      const { courts, taken, isToday, curH } = await freeBlocks(date);
      const out = [];
      for (const c of courts) {
        for (let s = range[0]; s + len <= range[1]; s++) {
          if (isToday && s <= curH) continue;
          let ok = true;
          for (let h = s; h < s + len; h++) if (taken[c]?.has(h)) { ok = false; break; }
          if (ok) out.push({ c, s, e: s + len, price: cost(s, s + len) });
        }
      }
      if (!out.length) { bot.innerHTML = `😕 Ngày ${date} không còn khung ${len}h phù hợp. Thử ngày khác hoặc nhắn Zalo <b>${CONTACT.phone}</b>.`; return; }
      // Ưu tiên: ít người đặt sân nhiều, giá rẻ nếu yêu cầu, giờ vàng 18–20h
      out.sort((a, b) => cheap ? a.price - b.price || a.s - b.s : Math.abs(a.s - 18) - Math.abs(b.s - 18) || a.c - b.c);
      const seen = new Set(), top = [];
      for (const o of out) { const k = o.s + '-' + o.c; if (!seen.has(k)) { seen.add(k); top.push(o); } if (top.length >= 4) break; }
      bot.innerHTML = `✨ Gợi ý ${len}h ngày <b>${date}</b> (${out.length} khung trống):` + top.map(o =>
        `<div style="margin-top:6px;padding:7px;background:#0f2536;border-radius:8px">🏸 <b>Sân ${o.c}</b> · ${o.s}h–${o.e}h · <b>${vnd(o.price)}</b>
         <button class="cl-pick" data-c="${o.c}" data-s="${o.s}" data-e="${o.e}" data-d="${date}">Chọn khung này</button></div>`).join('');
    } catch (e) { bot.innerHTML = '❌ Không đọc được lịch lúc này, vui lòng thử lại.'; }
  }

  function answer(q) {
    const t = q.toLowerCase();
    if (/gợi ý|đề xuất|lịch|trống|đặt sân|sân nào|còn sân/.test(t)) return suggest(q);
    if (/giá|bao nhiêu|phí|tiền/.test(t)) return add(pricing());
    if (/liên hệ|zalo|facebook|hotline|sđt|số điện thoại|gọi/.test(t)) return add(contact());
    if (/giới thiệu|dịch vụ|có gì|tính năng|xin chào|hello|hi\b/.test(t)) return add(intro());
    if (/huấn luyện|hlv|coach/.test(t)) return add('🎓 Mục <b>HLV</b> có hồ sơ chứng chỉ BWF, học phí 1-1 &amp; nhóm. Mở tab “HLV” để đăng ký lịch học.');
    if (/đối thủ|elo|thách đấu/.test(t)) return add('⚔️ Mục <b>Đối thủ</b> giúp tìm VĐV gần bạn, thách đấu và cập nhật ELO sau trận.');
    return add('Mình có thể: <b>giới thiệu dịch vụ</b>, <b>gợi ý lịch sân</b> (VD “sân 2 tiếng tối mai”), báo <b>giá</b> hoặc cho <b>liên hệ</b>. Bạn cần gì?');
  }

  function send(q) { q = q.trim(); if (!q) return; add(esc(q), 'user'); answer(q); }

  chat.addEventListener('click', e => {
    const chip = e.target.closest('.cl-chip');
    if (chip) return send(chip.dataset.q);
    const pk = e.target.closest('.cl-pick');
    if (pk) {
      const c = +pk.dataset.c, s = +pk.dataset.s, en = +pk.dataset.e, d = pk.dataset.d;
      const dateEl = document.getElementById('date');
      const apply = () => {
        if (document.getElementById('n3-court')) {
          document.getElementById('n3-court').value = c;
          document.getElementById('n3-start').value = s;
          document.getElementById('n3-end').value = en;
          window.n3OnFormChange?.();
        }
        (document.getElementById('nhom3-box') || document.getElementById('booking'))?.scrollIntoView({ behavior: 'smooth' });
        chat.classList.remove('open');
      };
      if (dateEl && dateEl.value !== d) { dateEl.value = d; dateEl.onchange?.(); setTimeout(apply, 700); } else apply();
      add(`✅ Đã chọn Sân ${c}, ${s}h–${en}h ngày ${d}. Bấm “Đặt lịch sân ngay” để hoàn tất!`);
    }
  });
  chat.querySelector('#cl-form').onsubmit = e => { e.preventDefault(); const i = chat.querySelector('#cl-in'); send(i.value); i.value = ''; };
  chat.querySelector('#cl-x').onclick = () => { chat.classList.remove('open'); fab.style.display = 'flex'; };
  fab.querySelector('#cl-ai').onclick = () => {
    chat.classList.add('open');
    if (window.innerWidth < 500) fab.style.display = 'none';
    if (!msgs.children.length) { add('Xin chào 👋 Mình là trợ lý AI của <b>CầuLông Pro</b>.'); add(intro()); }
  };
})();
