/* ============================================================
   core.js — helper, ikon, klien API (fetch → GAS), cache perangkat, UI dasar
   Prinsip gas-instant-ux-pro: SWR + TTL, 1 panggilan/layar, timeout+retry, reqId idempoten
   ============================================================ */
'use strict';

const CFG = window.APP_CONFIG;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random());

/* ---------- ikon (Lucide, inline) ---------- */
const ICONS = {
  landmark: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  dash: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  vote: '<path d="m9 12 2 2 4-4"/><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z"/><path d="M22 19H2"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'
};
function ic(n, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }
function hydrateIcons(root) { $$('[data-ic]', root).forEach(el => { el.innerHTML = ic(el.dataset.ic); el.removeAttribute('data-ic'); }); }

/* ---------- format ---------- */
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function normIso(s) {
  s = String(s || '').trim(); const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);
  return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : s;
}
function tglID(iso) { iso = normIso(iso); const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? (+m[3]) + ' ' + BULAN[+m[2] - 1] + ' ' + m[1] : (iso || '-'); }
function umur(iso) {
  iso = normIso(iso); const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return '';
  const n = new Date(); let u = n.getFullYear() - (+m[1]);
  if (n.getMonth() + 1 < +m[2] || (n.getMonth() + 1 === +m[2] && n.getDate() < +m[3])) u--;
  return u + ' th';
}
const nf = n => Number(n || 0).toLocaleString('id-ID');
function hariIni() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }

/* ---------- state & penyimpanan perangkat ---------- */
const AppState = { token: '', user: null, boot: null };
const LS_PREFIX = 'desa:' + (CFG.VERSI_CACHE || 'v1') + ':';
const Store = {
  get(k, d) { try { const v = localStorage.getItem(LS_PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) {
    const s = JSON.stringify(v);
    try { localStorage.setItem(LS_PREFIX + k, s); }
    catch (e) {
      Object.keys(localStorage).filter(x => x.indexOf(LS_PREFIX + 'u:') === 0).forEach(x => localStorage.removeItem(x));
      try { localStorage.setItem(LS_PREFIX + k, s); } catch (e2) { /* jalan tanpa cache */ }
    }
  },
  del(k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (e) {} },
  clearUser() { try { Object.keys(localStorage).filter(x => x.indexOf(LS_PREFIX) === 0).forEach(x => localStorage.removeItem(x)); } catch (e) {} }
};
const userKey = k => 'u:' + ((AppState.user && AppState.user.username) || 'anon') + ':' + k;

/* ---------- pengukur performa ---------- */
const Perf = {
  rows: [],
  add(action, total, server) { this.rows.push({ action, total, server: server == null ? null : server, net: server == null ? null : total - server }); if (this.rows.length > 100) this.rows.shift(); },
  table() { console.table(this.rows.slice(-30)); }
};
window.Perf = Perf;

/* ---------- klien API ---------- */
const READ_ACTIONS = /^(login|boot|batch|pendudukList|dashboard|jenisList|suratPreview|suratPdf|riwayatList|riwayatDetail|userList|resetCache|ping)$/;
async function apiOnce(action, data, timeout, reqId) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
  try {
    const res = await fetch(CFG.GAS_URL, {
      method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },               // hindari CORS preflight
      body: JSON.stringify({ action, token: AppState.token || '', reqId, data: data || {} })
    });
    const text = await res.text();
    try { const j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms); return j; }
    catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429 || res.status === 200, message: 'Server membalas dengan format tak terduga. Pastikan URL Web App benar dan akses diset "Anyone".' }; }
  } catch (err) {
    return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi terputus. Periksa internet Anda.' };
  } finally { clearTimeout(timer); }
}
function waitOnline(ms) { return new Promise(r => { if (navigator.onLine !== false) return r(); const t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); r(); } addEventListener('online', done); }); }
async function api(action, data, opt) {
  opt = opt || {};
  if (!CFG.GAS_URL || /GANTI_DENGAN/.test(CFG.GAS_URL)) return { success: false, message: 'GAS_URL belum diisi di js/config.js.' };
  const isRead = READ_ACTIONS.test(action);
  const reqId = isRead ? '' : (opt.reqId || uid());
  const tries = isRead ? 3 : 2;
  let res;
  for (let i = 0; i < tries; i++) {
    if (i) { await new Promise(r => setTimeout(r, 1200 * i)); if (navigator.onLine === false) await waitOnline(15000); }
    res = await apiOnce(action, data, isRead ? (i ? 40000 : 25000) : 60000, reqId);
    if (res.success || !res.retryable) break;
  }
  if (!res.success && res.data && res.data.code === 'AUTH' && typeof onSessionExpired === 'function') onSessionExpired();
  return res;
}
function warmUpServer() { if (CFG.GAS_URL && !/GANTI_DENGAN/.test(CFG.GAS_URL)) fetch(CFG.GAS_URL + '?ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); }

/** SWR: tampilkan cache seketika, segarkan di latar; render hanya bila data berubah. */
async function swr(key, action, payload, render, opt) {
  opt = opt || {};
  const fresh = opt.fresh == null ? 60000 : opt.fresh, k = userKey(key), c = Store.get(k, null);
  if (c) render(c.data, true);
  if (c && !opt.force && Date.now() - c.t < fresh) return { success: true, data: c.data, cached: true };
  const ns = $('#netState'); if (c && ns) ns.hidden = false;
  const res = await api(action, payload);
  if (ns) ns.hidden = true;
  if (res.success) {
    const h = hashStr(JSON.stringify(res.data));
    Store.set(k, { t: Date.now(), h, data: res.data });
    if (!c || c.h !== h) render(res.data, false);
  } else if (!c && opt.onError) opt.onError(res);
  return res;
}

/* ---------- UI: toast, modal, konfirmasi ---------- */
function toast(msg, type) {
  const box = $('#toast'), el = document.createElement('div');
  el.className = type === 'err' ? 't-err' : 't-ok';
  el.innerHTML = ic(type === 'err' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>';
  box.appendChild(el); setTimeout(() => el.remove(), type === 'err' ? 5200 : 3200);
}
const _modals = [];
function openModal(o) {
  const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
  wrap.innerHTML = '<div class="modal modal-' + (o.size || 'md') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
    '<header class="modal-h"><h3>' + esc(o.title) + '</h3><button class="icon-btn sm" data-close aria-label="Tutup">' + ic('x') + '</button></header>' +
    '<div class="modal-b"></div><footer class="modal-f"></footer></div>';
  const body = $('.modal-b', wrap), foot = $('.modal-f', wrap);
  if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
  if (typeof o.footer === 'string') foot.innerHTML = o.footer;
  const m = { el: wrap, body, foot, close() { const i = _modals.indexOf(m); if (i > -1) _modals.splice(i, 1); wrap.remove(); if (!_modals.length) document.body.style.overflow = ''; if (o.onClose) o.onClose(); } };
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) m.close(); });
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) m.close(); });
  $('#modal-root').appendChild(wrap); _modals.push(m); document.body.style.overflow = 'hidden';
  setTimeout(() => { const f = $('input:not([type=hidden]),select,textarea', body); if (f && !o.noFocus) f.focus(); }, 60);
  return m;
}
addEventListener('keydown', e => { if (e.key === 'Escape' && _modals.length) _modals[_modals.length - 1].close(); });
function confirmBox(o) {
  return new Promise(res => {
    const m = openModal({ title: o.title || 'Konfirmasi', size: 'sm', noFocus: true, onClose: () => res(false),
      body: '<div class="confirm-ic">' + ic('alert') + '</div><p>' + o.message + '</p>',
      footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(o.okText || 'Ya, lanjutkan') + '</button>' });
    $('[data-ok]', m.el).addEventListener('click', () => { res(true); m.el.querySelector('[data-close]').click(); });
  });
}
async function busy(btn, label, fn) {
  const t = btn.innerHTML; btn.disabled = true; btn.textContent = label;
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = t; }
}
function emptyState(icon, title, text, action) {
  return '<div class="empty"><div class="eic">' + ic(icon) + '</div><b>' + esc(title) + '</b><p>' + esc(text || '') + '</p>' + (action || '') + '</div>';
}
function errorState(res, retryId) {
  return emptyState('alert', 'Data belum dapat dimuat', res && res.message, '<p><button class="btn btn-soft btn-sm" id="' + retryId + '" style="margin-top:14px">' + ic('refresh') + ' Coba lagi</button></p>');
}
function skeleton(rows) { return Array.from({ length: rows || 5 }, () => '<div class="skel" style="height:46px;margin-bottom:10px"></div>').join(''); }
