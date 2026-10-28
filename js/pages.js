/* ============================================================
   pages.js — login, router SPA (hash), dan semua halaman
   ============================================================ */
'use strict';

const LV = { operator: 1, admin: 2, superuser: 3 };
const PERAN = { operator: 'Operator', admin: 'Admin', superuser: 'Super User' };
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dash', min: 1 },
  { id: 'penduduk', label: 'Data Penduduk', icon: 'users', min: 1 },
  { id: 'kk', label: 'Kartu Keluarga', icon: 'home', min: 1 },
  { id: 'mutasi', label: 'Mutasi Penduduk', icon: 'swap', min: 1 },
  { id: 'surat', label: 'Buat Surat', icon: 'file', min: 1 },
  { id: 'riwayat', label: 'Riwayat Surat', icon: 'history', min: 1 },
  { id: 'pemilih', label: 'Daftar Pemilih', icon: 'vote', min: 1 },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'sliders', min: 2 }
];
const OPT = {
  jk: ['Laki-laki', 'Perempuan'],
  gol_darah: ['-', 'A', 'B', 'AB', 'O'],
  agama: ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Kepercayaan'],
  status_kawin: ['Belum Kawin', 'Kawin', 'Kawin Tercatat', 'Kawin Belum Tercatat', 'Cerai Hidup', 'Cerai Mati', 'Cerai Belum Tercatat'],
  hubungan_keluarga: ['Kepala Keluarga', 'Istri', 'Anak', 'Menantu', 'Cucu', 'Orang Tua', 'Mertua', 'Famili Lain', 'Lainnya'],
  pendidikan: ['Tidak/Belum Sekolah', 'Belum Tamat SD', 'Tamat SD', 'SLTP/Sederajat', 'SLTA/Sederajat', 'Diploma I/II', 'Akademi/Diploma III', 'Diploma IV/Strata I', 'Strata II', 'Strata III'],
  status_dasar: ['Hidup', 'Meninggal', 'Pindah']
};
const PENANDA = ['nama', 'nik', 'no_kk', 'ttl', 'tempat_lahir', 'tgl_lahir', 'umur', 'jk', 'agama', 'status_kawin', 'pendidikan', 'pekerjaan', 'alamat_lengkap', 'alamat', 'dusun', 'rt', 'rw', 'nama_ayah', 'nama_ibu', 'kewarganegaraan', 'keperluan', 'nomor_surat', 'tanggal_surat', 'nama_desa', 'kecamatan', 'kabupaten', 'penandatangan', 'jabatan_penandatangan'];

const me = () => AppState.user || {};
const lvl = () => LV[me().peran] || 0;
const opts = (arr, sel, ph) => (ph ? '<option value="">' + esc(ph) + '</option>' : '') + (sel && arr.indexOf(sel) < 0 ? [sel] : []).concat(arr).map(v => '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>').join('');

/* ============================================================
   SESI & MASUK / KELUAR
   ============================================================ */
function setSession(token, user) { AppState.token = token; AppState.user = user; Store.set('session', { token, user }); }
function onSessionExpired() { if (AppState.token) { logout(); toast('Sesi berakhir. Silakan masuk kembali.', 'err'); } }
function logout() {
  Store.clearUser(); AppState.token = ''; AppState.user = null; AppState.boot = null;
  Object.keys(Pages).forEach(k => { const el = $('.page[data-page="' + k + '"]'); if (el) el.remove(); Pages[k].ready = false; });
  PenState.all = []; PenState.loaded = false; document.body.classList.remove('nav-open');
  $('#shell').hidden = true; $('#login').hidden = false; $('#lPass').value = ''; location.hash = '';
  setTimeout(() => $('#lUser').focus(), 50);
}
function showApp() {
  $('#login').hidden = true; $('#shell').hidden = false;
  const u = me();
  $('#suName').textContent = u.nama || u.username; $('#suRole').textContent = (PERAN[u.peran] || '') + (u.jabatan ? ' · ' + u.jabatan : '');
  $('#suAv').textContent = (u.nama || u.username || '?').trim().charAt(0).toUpperCase();
  $('#nav').innerHTML = NAV.filter(n => lvl() >= n.min).map(n => '<a href="#/' + n.id + '" data-nav="' + n.id + '">' + ic(n.icon) + '<span>' + n.label + '</span></a>').join('');
  route();
}
function bindLogin() {
  $('#lEye').addEventListener('click', () => { const i = $('#lPass'); i.type = i.type === 'password' ? 'text' : 'password'; });
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#lErr'); err.hidden = true;
    const username = $('#lUser').value.trim(), password = $('#lPass').value;
    if (!username || !password) { err.textContent = 'Isi username dan password.'; err.hidden = false; return; }
    await busy($('#lBtn'), 'Memeriksa…', async () => {
      const res = await api('login', { username, password });
      if (!res.success) { err.textContent = res.message || 'Gagal masuk.'; err.hidden = false; return; }
      const { token, boot, dash } = res.data;
      setSession(token, boot.user); AppState.boot = boot; Store.set(userKey('boot'), boot);
      Store.set(userKey('dash'), { t: Date.now(), h: hashStr(JSON.stringify(dash)), data: dash });
      showApp(); prefetch();
    });
  });
  $('#btnLogout').addEventListener('click', async () => { if (await confirmBox({ title: 'Keluar', message: 'Keluar dari aplikasi?', okText: 'Keluar' })) logout(); });
  $('#btnMenu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
  $('#btnAkun').addEventListener('click', akunModal);
}
async function revalidate() {
  const res = await api('boot');
  if (res.success) { AppState.boot = res.data; Store.set(userKey('boot'), res.data); setSession(AppState.token, res.data.user); }
}
/** Prefetch data besar sekali jalan saat idle (1 panggilan batch). */
function prefetch() {
  const run = async () => {
    const res = await api('batch', { calls: [{ action: 'pendudukList' }, { action: 'riwayatList' }] });
    if (!res.success) return;
    [['pendudukList', 'pen'], ['riwayatList', 'rwy']].forEach(([a, k]) => {
      const r = res.data[a]; if (r && r.success) Store.set(userKey(k), { t: Date.now(), h: hashStr(JSON.stringify(r.data)), data: r.data });
    });
  };
  if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 2500 }); else setTimeout(run, 1200);
}
function akunModal() {
  const m = openModal({
    title: 'Akun saya', size: 'sm',
    body: '<div class="kv" style="margin-bottom:20px"><div><small>Nama</small><b>' + esc(me().nama) + '</b></div><div><small>Peran</small><b>' + esc(PERAN[me().peran]) + '</b></div><div class="full"><small>Username</small><b>' + esc(me().username) + '</b></div></div>' +
      '<form id="fPw"><div class="sect">Ganti password</div>' +
      '<div class="field"><label>Password lama</label><input class="input" name="lama" type="password" autocomplete="current-password" required></div>' +
      '<div class="field"><label>Password baru</label><input class="input" name="baru" type="password" autocomplete="new-password" minlength="6" required><div class="hint">Minimal 6 karakter.</div></div>' +
      '<div class="field"><label>Ulangi password baru</label><input class="input" name="ulang" type="password" autocomplete="new-password" required></div>' +
      '<div class="err" id="pwErr" hidden></div></form>',
    footer: '<button class="btn btn-ghost" data-close>Tutup</button><button class="btn btn-primary" id="pwSave">Simpan password</button>'
  });
  $('#pwSave', m.el).addEventListener('click', async e => {
    const f = $('#fPw', m.el), fd = new FormData(f), er = $('#pwErr', m.el); er.hidden = true;
    if (fd.get('baru') !== fd.get('ulang')) { er.textContent = 'Konfirmasi password tidak sama.'; er.hidden = false; return; }
    await busy(e.currentTarget, 'Menyimpan…', async () => {
      const res = await api('gantiPassword', { lama: fd.get('lama'), baru: fd.get('baru') });
      if (!res.success) { er.textContent = res.message; er.hidden = false; return; }
      setSession(res.data.token, me()); toast('Password berhasil diganti.'); m.close();
    });
  });
}

/* ============================================================
   ROUTER (hash) — halaman dibuat sekali, tidak dibuang saat pindah
   ============================================================ */
const Pages = {};
function route() {
  if (!AppState.token) return;
  const parts = location.hash.replace(/^#\/?/, '').split('/'), name = parts[0], param = parts[1] ? decodeURIComponent(parts[1]) : '';
  const def = Pages[name];
  if (!def || lvl() < def.min) { location.hash = '#/dashboard'; return; }
  let el = $('.page[data-page="' + name + '"]');
  if (!el) { el = document.createElement('section'); el.className = 'page'; el.dataset.page = name; $('#view').appendChild(el); }
  if (!def.ready) { def.ready = true; el.innerHTML = def.template(); def.init && def.init(el); }
  $$('.page').forEach(p => { p.hidden = p !== el; });
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name));
  $('#pageTitle').textContent = def.title;
  document.body.classList.remove('nav-open');
  window.scrollTo(0, 0);
  def.show && def.show(el, param);
}

/* ============================================================
   DASHBOARD
   ============================================================ */
Pages.dashboard = {
  title: 'Dashboard', min: 1,
  template: () => '<div id="dBody">' + '<div class="stats">' + Array.from({ length: 4 }, () => '<div class="skel" style="height:86px"></div>').join('') + '</div></div>',
  show(el) {
    swr('dash', 'dashboard', {}, d => this.render(el, d), { fresh: 60000, onError: r => { $('#dBody', el).innerHTML = errorState(r, 'dRetry'); const b = $('#dRetry', el); b && b.addEventListener('click', () => this.show(el)); } });
  },
  render(el, d) {
    const u = me(), max = Math.max(1, ...d.dusun.map(x => x.jumlah)), tot = Math.max(1, d.laki + d.perempuan);
    const pl = d.laki / tot * 100, pp = d.perempuan / tot * 100;
    const jam = new Date().getHours(), sapa = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam';
    $('#dBody', el).innerHTML =
      '<div class="hero"><h2>' + sapa + ', ' + esc((u.nama || '').split(' ')[0]) + '</h2><p>' + nf(d.total) + ' penduduk aktif tercatat · ' + nf(d.surat.bulanIni) + ' surat diterbitkan bulan ini.</p>' +
      '<a class="btn" href="#/surat">' + ic('file') + ' Buat surat baru</a></div>' +
      '<div class="stats">' +
      stat('users', '', nf(d.total), 'Penduduk aktif') + stat('home', 'g', nf(d.kk), 'Kepala keluarga (KK)') +
      stat('file', 'p', nf(d.surat.tahunIni), 'Surat tahun ini') + stat('alert', 'w', nf(d.meninggal + d.pindah), 'Meninggal / pindah') + '</div>' +
      '<div class="cols-2"><div class="card"><h3>Penduduk per dusun</h3>' +
      (d.dusun.length ? d.dusun.map(x => '<div class="bar-row"><span title="' + esc(x.nama) + '">' + esc(x.nama) + '</span><div class="bar"><i data-w="' + (x.jumlah / max * 100) + '"></i></div><b class="mono">' + nf(x.jumlah) + '</b></div>').join('') : '<p class="muted">Belum ada data.</p>') + '</div>' +
      '<div class="card"><h3>Jenis kelamin</h3><div class="donut-wrap"><svg class="donut" viewBox="0 0 42 42" role="img" aria-label="Laki-laki ' + d.laki + ', perempuan ' + d.perempuan + '">' +
      '<circle cx="21" cy="21" r="15.9155" stroke="#eef3fa"/>' +
      '<circle cx="21" cy="21" r="15.9155" stroke="#2f7de1" stroke-dasharray="' + pl + ' ' + (100 - pl) + '" stroke-dashoffset="25"/>' +
      '<circle cx="21" cy="21" r="15.9155" stroke="#7fc4ff" stroke-dasharray="' + pp + ' ' + (100 - pp) + '" stroke-dashoffset="' + (25 - pl) + '"/>' +
      '<text x="21" y="22" font-size="6.5" font-weight="800" fill="#0e2238">' + nf(d.total) + '</text><text x="21" y="27" font-size="2.6" fill="#7d90a6">penduduk</text></svg>' +
      '<div class="legend"><div><i style="background:#2f7de1"></i>Laki-laki <b>' + nf(d.laki) + '</b></div><div><i style="background:#7fc4ff"></i>Perempuan <b>' + nf(d.perempuan) + '</b></div></div></div></div></div>' +
      '<div class="cols-2"><div class="card flush"><div style="padding:22px 22px 0"><h3>Jumlah penduduk per RT</h3></div><div class="tbl-wrap" style="max-height:340px;overflow:auto"><table class="tbl"><thead><tr><th>Dusun</th><th>RW</th><th>RT</th><th style="text-align:right">Jumlah</th></tr></thead><tbody>' +
      (d.rt.length ? d.rt.map(r => '<tr><td>' + esc(r.dusun) + '</td><td>' + esc(r.rw) + '</td><td>' + esc(r.rt) + '</td><td class="mono" style="text-align:right"><b>' + nf(r.jumlah) + '</b></td></tr>').join('') : '<tr><td colspan="4" class="muted">Belum ada data.</td></tr>') + '</tbody></table></div></div>' +
      '<div class="card"><h3>Surat terbaru</h3>' + (d.terbaru.length ? d.terbaru.map(s => '<div class="row" style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px dashed var(--line)"><div class="cell-main" style="min-width:0"><b>' + esc(s.nama) + '</b><small>' + esc(s.nama_jenis) + ' · ' + esc(tglID(s.tanggal)) + '</small></div></div>').join('') : '<p class="muted">Belum ada surat diterbitkan.</p>') + '</div></div>';
    requestAnimationFrame(() => $$('.bar i[data-w]', el).forEach(i => { i.style.width = i.dataset.w + '%'; }));
  }
};
function stat(icon, cls, val, label) { return '<div class="stat"><div class="si ' + cls + '">' + ic(icon) + '</div><div><b class="mono">' + val + '</b><small>' + label + '</small></div></div>'; }

/* ============================================================
   DATA PENDUDUK
   ============================================================ */
const PenState = { all: [], loaded: false, q: '', dusun: '', rw: '', rt: '', status: '', page: 1, size: 25 };
function unpackPen(p) { return p.rows.map(r => { const o = {}; p.cols.forEach((c, i) => { o[c] = r[i]; }); return o; }); }
function packPen() {
  const cols = ['id', 'nik', 'no_kk', 'nama', 'tempat_lahir', 'tgl_lahir', 'jk', 'gol_darah', 'agama', 'status_kawin', 'hubungan_keluarga', 'pendidikan', 'pekerjaan', 'alamat', 'dusun', 'rw', 'rt', 'nama_ayah', 'nama_ibu', 'kewarganegaraan', 'no_hp', 'status_dasar', 'created_at', 'updated_at'];
  return { cols, rows: PenState.all.map(o => cols.map(c => o[c] || '')) };
}
function persistPen() { const d = packPen(); Store.set(userKey('pen'), { t: Date.now(), h: hashStr(JSON.stringify(d)), data: d }); Store.del(userKey('dash')); }
function loadPen(force) {
  return swr('pen', 'pendudukList', {}, d => { PenState.all = unpackPen(d); PenState.loaded = true; refreshPenViews(); }, { force, fresh: 120000, onError: r => { const el = $('.page[data-page="penduduk"]'); if (el) $('#pBody', el).innerHTML = errorState(r, 'pRetry'); const b = $('#pRetry'); b && b.addEventListener('click', () => loadPen(true)); } });
}
async function ensurePen() { if (!PenState.loaded) await loadPen(); return PenState.all; }

Pages.penduduk = {
  title: 'Data Penduduk', min: 1,
  template: () => '<div class="page-h"><div><h2>Data Penduduk</h2><p>Buku induk penduduk Desa Lamongan.</p></div><div class="chips"><button class="btn btn-primary" id="pAdd">' + ic('plus') + ' Tambah penduduk</button></div></div>' +
    '<div class="card flush"><div class="toolbar"><div class="search">' + ic('search') + '<input class="input" id="pQ" placeholder="Cari NIK, nama, atau No KK…" aria-label="Cari penduduk"></div>' +
    '<select class="select" id="pDusun" aria-label="Dusun"></select><select class="select" id="pRw" aria-label="RW"></select><select class="select" id="pRt" aria-label="RT"></select>' +
    '<select class="select" id="pSt" aria-label="Status"><option value="">Semua status</option><option>Hidup</option><option>Meninggal</option><option>Pindah</option></select></div>' +
    '<div id="pBody">' + '<div style="padding:18px">' + skeleton(6) + '</div></div></div>',
  init(el) {
    const re = () => { PenState.page = 1; this.draw(el); };
    $('#pQ', el).addEventListener('input', debounce(e => { PenState.q = e.target.value.trim().toLowerCase(); re(); }, 250));
    [['pDusun', 'dusun'], ['pRw', 'rw'], ['pRt', 'rt'], ['pSt', 'status']].forEach(([id, k]) => $('#' + id, el).addEventListener('change', e => { PenState[k] = e.target.value; re(); }));
    $('#pAdd', el).addEventListener('click', () => penForm());
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (b) { const id = b.dataset.id; ({ view: () => penDetail(id), edit: () => penForm(id), del: () => penHapus(id), prev: () => { PenState.page--; this.draw(el); }, next: () => { PenState.page++; this.draw(el); } })[b.dataset.act](); return; }
      const tr = e.target.closest('tr.click'); if (tr) penDetail(tr.dataset.id);
    });
  },
  show(el) { loadPen(); if (PenState.loaded) this.draw(el); },
  fill(el) {
    const uniq = k => Array.from(new Set(PenState.all.map(p => p[k]).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
    const set = (id, arr, ph, sel) => { const s = $('#' + id, el); s.innerHTML = opts(arr, sel, ph); };
    set('pDusun', uniq('dusun'), 'Semua dusun', PenState.dusun); set('pRw', uniq('rw'), 'Semua RW', PenState.rw); set('pRt', uniq('rt'), 'Semua RT', PenState.rt);
    $('#pSt', el).value = PenState.status;
  },
  filtered() {
    const s = PenState, q = s.q;
    return s.all.filter(p => (!q || p.nik.includes(q) || (p.no_kk || '').includes(q) || p.nama.toLowerCase().includes(q)) &&
      (!s.dusun || p.dusun === s.dusun) && (!s.rw || p.rw === s.rw) && (!s.rt || p.rt === s.rt) && (!s.status || p.status_dasar === s.status));
  },
  draw(el) {
    this.fill(el);
    const list = this.filtered(), s = PenState, pages = Math.max(1, Math.ceil(list.length / s.size));
    s.page = Math.min(Math.max(1, s.page), pages);
    const rows = list.slice((s.page - 1) * s.size, s.page * s.size), body = $('#pBody', el), del = me().canDelete;
    if (!s.all.length) { body.innerHTML = emptyState('users', 'Belum ada data penduduk', 'Mulai dengan menambahkan penduduk pertama.'); return; }
    if (!list.length) { body.innerHTML = emptyState('search', 'Tidak ada hasil', 'Coba ubah kata kunci atau filter.'); return; }
    const badge = st => '<span class="badge ' + (st === 'Hidup' ? 'b-ok' : st === 'Meninggal' ? 'b-bad' : 'b-warn') + '">' + esc(st) + '</span>';
    body.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>NIK</th><th>Nama</th><th class="hide-md">No KK</th><th class="hide-sm">Dusun · RT/RW</th><th>Status</th><th></th></tr></thead><tbody>' +
      rows.map(p => '<tr class="click" data-id="' + esc(p.id) + '"><td class="mono">' + esc(p.nik) + '</td><td class="cell-main"><b>' + esc(p.nama) + '</b><small>' + esc(p.jk) + ' · ' + umur(p.tgl_lahir) + '</small></td><td class="mono hide-md">' + esc(p.no_kk || '-') + '</td>' +
        '<td class="hide-sm">' + esc(p.dusun || '-') + ' · ' + esc(p.rt || '-') + '/' + esc(p.rw || '-') + '</td><td>' + badge(p.status_dasar) + '</td>' +
        '<td class="act"><button class="icon-btn sm" data-act="edit" data-id="' + esc(p.id) + '" aria-label="Ubah ' + esc(p.nama) + '" title="Ubah">' + ic('pencil') + '</button>' +
        (del ? '<button class="icon-btn sm danger" data-act="del" data-id="' + esc(p.id) + '" aria-label="Hapus ' + esc(p.nama) + '" title="Hapus">' + ic('trash') + '</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="pager"><span>' + nf((s.page - 1) * s.size + 1) + '–' + nf(Math.min(s.page * s.size, list.length)) + ' dari ' + nf(list.length) + ' penduduk</span><div>' +
      '<button class="btn btn-ghost btn-sm" data-act="prev"' + (s.page <= 1 ? ' disabled' : '') + '>' + ic('chevL') + ' Sebelumnya</button><button class="btn btn-ghost btn-sm" data-act="next"' + (s.page >= pages ? ' disabled' : '') + '>Berikutnya ' + ic('chevR') + '</button></div></div>';
  }
};

function penDetail(id) {
  const p = PenState.all.find(x => x.id === id); if (!p) return toast('Data tidak ditemukan. Muat ulang halaman (Ctrl+Shift+R).', 'err');
  const k = (l, v, full) => '<div' + (full ? ' class="full"' : '') + '><small>' + l + '</small><b>' + esc(v || '-') + '</b></div>';
  const m = openModal({
    title: p.nama, size: 'lg',
    body: '<div class="kv">' + k('NIK', p.nik) + k('No KK', p.no_kk) + k('Tempat, tanggal lahir', (p.tempat_lahir ? p.tempat_lahir + ', ' : '') + tglID(p.tgl_lahir) + (umur(p.tgl_lahir) ? ' (' + umur(p.tgl_lahir) + ')' : '')) + k('Jenis kelamin', p.jk) +
      k('Golongan darah', p.gol_darah) + k('Agama', p.agama) + k('Status kawin', p.status_kawin) + k('Hubungan dalam keluarga', p.hubungan_keluarga) + k('Pendidikan', p.pendidikan) + k('Pekerjaan', p.pekerjaan) +
      k('Alamat', [p.alamat, 'Dusun ' + (p.dusun || '-'), 'RT ' + (p.rt || '-') + '/RW ' + (p.rw || '-')].filter(Boolean).join(', '), true) + k('Nama ayah', p.nama_ayah) + k('Nama ibu', p.nama_ibu) + k('Kewarganegaraan', p.kewarganegaraan) + k('No HP', p.no_hp) + k('Status dasar', p.status_dasar) + k('Terakhir diubah', tglID(p.updated_at)) + '</div>',
    footer: '<button class="btn btn-ghost" data-close>Tutup</button><button class="btn btn-soft" data-e>' + ic('pencil') + ' Ubah data</button><button class="btn btn-primary" data-s>' + ic('file') + ' Buat surat</button>'
  });
  $('[data-e]', m.el).addEventListener('click', () => { m.close(); penForm(id); });
  $('[data-s]', m.el).addEventListener('click', () => { m.close(); location.hash = '#/surat/' + encodeURIComponent(id); });
}

function penForm(id) {
  const p = id ? PenState.all.find(x => x.id === id) : { kewarganegaraan: 'WNI', status_dasar: 'Hidup' }; if (!p) return toast('Data tidak ditemukan. Muat ulang halaman (Ctrl+Shift+R).', 'err');
  if (id) p.tgl_lahir = normIso(p.tgl_lahir);
  const inp = (n, l, o) => { o = o || {}; return '<div class="field' + (o.full ? ' full' : '') + '"><label for="f_' + n + '">' + l + (o.req ? ' <i>*</i>' : '') + '</label><input class="input" id="f_' + n + '" name="' + n + '" value="' + esc(p[n]) + '" ' + (o.attr || '') + (o.req ? ' required' : '') + '>' + (o.hint ? '<div class="hint">' + o.hint + '</div>' : '') + '<div class="err" data-err="' + n + '" hidden></div></div>'; };
  const sel = (n, l, arr, o) => { o = o || {}; return '<div class="field"><label for="f_' + n + '">' + l + (o.req ? ' <i>*</i>' : '') + '</label><select class="select" id="f_' + n + '" name="' + n + '">' + opts(arr, p[n], o.ph || 'Pilih…') + '</select><div class="err" data-err="' + n + '" hidden></div></div>'; };
  const m = openModal({
    title: id ? 'Ubah data penduduk' : 'Tambah penduduk', size: 'xl',
    body: '<form id="fPen" novalidate><div class="sect">Identitas</div><div class="form-grid">' +
      inp('nik', 'NIK', { req: 1, attr: 'inputmode="numeric" maxlength="16" autocomplete="off"', hint: /^BELUM-/.test(p.nik || '') ? 'NIK belum terbit — ganti dengan 16 digit bila sudah ada.' : '16 digit angka.' }) + inp('no_kk', 'No KK', { attr: 'inputmode="numeric" maxlength="16" autocomplete="off"' }) +
      inp('nama', 'Nama lengkap', { req: 1, full: 1 }) + inp('tempat_lahir', 'Tempat lahir') + inp('tgl_lahir', 'Tanggal lahir', { req: 1, attr: 'type="date" max="' + hariIni() + '"' }) +
      sel('jk', 'Jenis kelamin', OPT.jk, { req: 1 }) + sel('gol_darah', 'Golongan darah', OPT.gol_darah) + sel('agama', 'Agama', OPT.agama) + sel('status_kawin', 'Status perkawinan', OPT.status_kawin) +
      '</div><div class="sect">Keluarga &amp; pekerjaan</div><div class="form-grid">' +
      sel('hubungan_keluarga', 'Hubungan dalam keluarga', OPT.hubungan_keluarga) + sel('pendidikan', 'Pendidikan terakhir', OPT.pendidikan) + inp('pekerjaan', 'Pekerjaan') + inp('kewarganegaraan', 'Kewarganegaraan') +
      inp('nama_ayah', 'Nama ayah') + inp('nama_ibu', 'Nama ibu') +
      '</div><div class="sect">Alamat &amp; kontak</div><div class="form-grid">' +
      inp('alamat', 'Alamat (jalan/nama tempat)', { full: 1 }) + inp('dusun', 'Dusun') + inp('no_hp', 'No HP', { attr: 'inputmode="tel"' }) + inp('rw', 'RW', { attr: 'inputmode="numeric" maxlength="3"' }) + inp('rt', 'RT', { attr: 'inputmode="numeric" maxlength="3"' }) +
      sel('status_dasar', 'Status dasar', OPT.status_dasar, { ph: '' }) + '</div><div class="form-err" id="penErr" hidden></div></form>',
    footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="penSave">Simpan</button>'
  });
  $('#penSave', m.el).addEventListener('click', async e => {
    const f = $('#fPen', m.el), d = Object.fromEntries(new FormData(f)); if (id) d.id = id;
    $$('[data-err]', f).forEach(x => { x.hidden = true; }); $$('.bad', f).forEach(x => x.classList.remove('bad')); $('#penErr', m.el).hidden = true;
    const bad = (field, msg) => { const x = $('[data-err="' + field + '"]', f), i = $('[name="' + field + '"]', f); if (x) { x.textContent = msg; x.hidden = false; } if (i) { i.classList.add('bad'); i.focus(); } };
    if (!/^\d{16}$/.test(d.nik || '') && !/^BELUM-\d{6}$/.test(d.nik || '')) return bad('nik', 'NIK harus 16 digit angka.');
    if (d.no_kk && !/^\d{16}$/.test(d.no_kk)) return bad('no_kk', 'No KK harus 16 digit angka.');
    if (!(d.nama || '').trim()) return bad('nama', 'Nama wajib diisi.');
    if (!d.tgl_lahir) return bad('tgl_lahir', 'Tanggal lahir wajib diisi.');
    if (!d.jk) return bad('jk', 'Pilih jenis kelamin.');
    await busy(e.currentTarget, 'Menyimpan…', async () => {
      const res = await api('pendudukSave', d);
      if (!res.success) { if (res.data && res.data.field) bad(res.data.field, res.message); else { const b = $('#penErr', m.el); b.textContent = res.message; b.hidden = false; } return; }
      const i = PenState.all.findIndex(x => x.id === res.data.id);
      if (i > -1) PenState.all[i] = res.data; else PenState.all.unshift(res.data);
      PenState.loaded = true; persistPen(); toast(id ? 'Data penduduk diperbarui.' : 'Penduduk berhasil ditambahkan.'); m.close();
      const el = $('.page[data-page="penduduk"]'); if (el) Pages.penduduk.draw(el);
    });
  });
}
async function penHapus(id) {
  const p = PenState.all.find(x => x.id === id); if (!p) return;
  if (!await confirmBox({ title: 'Hapus data penduduk', danger: true, okText: 'Hapus permanen', message: 'Hapus data <b>' + esc(p.nama) + '</b> (NIK ' + esc(p.nik) + ')? Tindakan ini tidak dapat dibatalkan.' })) return;
  const res = await api('pendudukDelete', { id });
  if (!res.success) return toast(res.message, 'err');
  PenState.all = PenState.all.filter(x => x.id !== id); persistPen(); toast('Data penduduk dihapus.');
  Pages.penduduk.draw($('.page[data-page="penduduk"]'));
}

/* ============================================================
   KARTU KELUARGA — tampilan keluarga dikelompokkan dari No KK
   ============================================================ */
const KkState = { q: '', dusun: '', page: 1, size: 20 };
function groupKK() {
  const m = {}; let tanpa = 0;
  PenState.all.forEach(p => { if (!p.no_kk) { tanpa++; return; } (m[p.no_kk] = m[p.no_kk] || []).push(p); });
  const rank = p => { const i = OPT.hubungan_keluarga.indexOf(p.hubungan_keluarga); return i < 0 ? 99 : i; };
  const list = Object.keys(m).map(no => {
    const a = m[no].slice().sort((x, y) => rank(x) - rank(y) || String(x.tgl_lahir).localeCompare(String(y.tgl_lahir)));
    const kepala = a.find(x => /kepala/i.test(x.hubungan_keluarga)) || a[0];
    return { no, anggota: a, kepala, aktif: a.filter(x => x.status_dasar === 'Hidup').length };
  }).sort((x, y) => x.kepala.nama.localeCompare(y.kepala.nama, 'id'));
  return { list, tanpa };
}

Pages.kk = {
  title: 'Kartu Keluarga', min: 1,
  template: () => '<div class="page-h"><div><h2>Kartu Keluarga</h2><p>Keluarga dikelompokkan berdasarkan nomor KK.</p></div></div>' +
    '<div class="card flush"><div class="toolbar"><div class="search">' + ic('search') + '<input class="input" id="kQ" placeholder="Cari No KK, nama kepala keluarga, atau anggota…" aria-label="Cari keluarga"></div>' +
    '<select class="select" id="kDusun" aria-label="Dusun"></select></div><div id="kBody"><div style="padding:18px">' + skeleton(6) + '</div></div></div>',
  init(el) {
    const re = () => { KkState.page = 1; this.draw(el); };
    $('#kQ', el).addEventListener('input', debounce(e => { KkState.q = e.target.value.trim().toLowerCase(); re(); }, 250));
    $('#kDusun', el).addEventListener('change', e => { KkState.dusun = e.target.value; re(); });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (b) { KkState.page += b.dataset.act === 'next' ? 1 : -1; return this.draw(el); }
      const tr = e.target.closest('tr.click'); if (tr) kkDetail(tr.dataset.no);
    });
  },
  show(el) { loadPen(); if (PenState.loaded) this.draw(el); },
  draw(el) {
    const { list, tanpa } = groupKK(), body = $('#kBody', el), s = KkState;
    const dusun = Array.from(new Set(list.map(k => k.kepala.dusun).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id'));
    $('#kDusun', el).innerHTML = opts(dusun, s.dusun, 'Semua dusun');
    const q = s.q, rows = list.filter(k => (!s.dusun || k.kepala.dusun === s.dusun) && (!q || k.no.includes(q) || k.anggota.some(a => a.nama.toLowerCase().includes(q) || a.nik.includes(q))));
    const pages = Math.max(1, Math.ceil(rows.length / s.size)); s.page = Math.min(Math.max(1, s.page), pages);
    const note = tanpa ? '<div class="pager" style="border-bottom:1px solid var(--line)"><span>' + ic('alert') + ' ' + nf(tanpa) + ' penduduk belum memiliki No KK dan tidak tampil di sini.</span></div>' : '';
    if (!list.length) { body.innerHTML = note + emptyState('home', 'Belum ada data keluarga', 'Isi kolom No KK pada data penduduk agar keluarga terbentuk.'); return; }
    if (!rows.length) { body.innerHTML = note + emptyState('search', 'Tidak ada hasil', 'Coba ubah kata kunci atau filter.'); return; }
    const page = rows.slice((s.page - 1) * s.size, s.page * s.size);
    body.innerHTML = note + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>No KK</th><th>Kepala keluarga</th><th class="hide-sm">Dusun · RT/RW</th><th>Anggota</th></tr></thead><tbody>' +
      page.map(k => '<tr class="click" data-no="' + esc(k.no) + '"><td class="mono">' + esc(k.no) + '</td><td class="cell-main"><b>' + esc(k.kepala.nama) + '</b><small class="hide-md">' + esc(k.kepala.alamat || '') + '</small></td>' +
        '<td class="hide-sm">' + esc(k.kepala.dusun || '-') + ' · ' + esc(k.kepala.rt || '-') + '/' + esc(k.kepala.rw || '-') + '</td><td><span class="badge b-info">' + k.anggota.length + ' orang</span></td></tr>').join('') + '</tbody></table></div>' +
      '<div class="pager"><span>' + nf((s.page - 1) * s.size + 1) + '–' + nf(Math.min(s.page * s.size, rows.length)) + ' dari ' + nf(rows.length) + ' keluarga</span><div>' +
      '<button class="btn btn-ghost btn-sm" data-act="prev"' + (s.page <= 1 ? ' disabled' : '') + '>' + ic('chevL') + ' Sebelumnya</button><button class="btn btn-ghost btn-sm" data-act="next"' + (s.page >= pages ? ' disabled' : '') + '>Berikutnya ' + ic('chevR') + '</button></div></div>';
  }
};

function kkDetail(no) {
  const k = groupKK().list.find(x => x.no === no); if (!k) return toast('Data keluarga tidak ditemukan.', 'err');
  const h = k.kepala, kv = (l, v, full) => '<div' + (full ? ' class="full"' : '') + '><small>' + l + '</small><b>' + esc(v || '-') + '</b></div>';
  const badge = st => '<span class="badge ' + (st === 'Hidup' ? 'b-ok' : st === 'Meninggal' ? 'b-bad' : 'b-warn') + '">' + esc(st) + '</span>';
  const m = openModal({
    title: 'Kartu Keluarga', size: 'xl', noFocus: true,
    body: '<div class="kv" style="margin-bottom:20px">' + kv('No KK', k.no) + kv('Kepala keluarga', h.nama) + kv('Alamat', h.alamat, true) + kv('Dusun', h.dusun) + kv('RT / RW', (h.rt || '-') + ' / ' + (h.rw || '-')) + kv('Jumlah anggota', k.anggota.length + ' orang (' + k.aktif + ' berstatus hidup)') + '</div>' +
      '<div class="tbl-wrap" style="border:1px solid var(--line);border-radius:12px"><table class="tbl"><thead><tr><th>No</th><th>Nama</th><th class="hide-sm">NIK</th><th>Hubungan</th><th class="hide-md">JK</th><th class="hide-md">Tempat, tgl lahir</th><th>Status</th></tr></thead><tbody>' +
      k.anggota.map((a, i) => '<tr class="click" data-id="' + esc(a.id) + '"><td>' + (i + 1) + '</td><td class="cell-main"><b>' + esc(a.nama) + '</b><small>' + esc(a.pekerjaan || '') + '</small></td><td class="mono hide-sm">' + esc(a.nik) + '</td><td>' + esc(a.hubungan_keluarga || '-') + '</td><td class="hide-md">' + esc(a.jk) + '</td>' +
        '<td class="hide-md">' + esc((a.tempat_lahir ? a.tempat_lahir + ', ' : '') + tglID(a.tgl_lahir)) + '</td><td>' + badge(a.status_dasar) + '</td></tr>').join('') + '</tbody></table></div><p class="hint" style="margin-top:10px">Klik anggota untuk melihat data lengkap atau membuat surat.</p>',
    footer: '<button class="btn btn-ghost" data-close>Tutup</button>'
  });
  m.body.addEventListener('click', e => { const tr = e.target.closest('tr.click'); if (tr) penDetail(tr.dataset.id); });
}

/* ============================================================
   MUTASI PENDUDUK — pindah keluar & pindah masuk (beberapa orang sekaligus)
   ============================================================ */
const MtsState = { all: [], jenis: '', page: 1, size: 20 };
const ALASAN = ['Pekerjaan', 'Pendidikan', 'Keamanan', 'Kesehatan', 'Perumahan', 'Keluarga', 'Perkawinan', 'Lainnya'];
function refreshPenViews() { ['penduduk', 'kk', 'pemilih'].forEach(k => { const el = $('.page[data-page="' + k + '"]'); if (el && Pages[k].ready) Pages[k].draw(el); }); }
function afterMutasi(d) {
  Store.del(userKey('mts')); Store.del(userKey('rwy')); Store.del(userKey('dash'));
  const el = $('.page[data-page="mutasi"]'); if (el && Pages.mutasi.ready) Pages.mutasi.show(el);
  suratModal({ title: 'Surat No. ' + d.nomor, html: d.html, id: d.id_surat });
}
const dField = (id, n, l, o) => { o = o || {}; return '<div class="field' + (o.full ? ' full' : '') + '"><label for="' + id + n + '">' + l + (o.req ? ' <i>*</i>' : '') + '</label><input class="input" id="' + id + n + '" name="' + n + '" value="' + esc(o.val || '') + '"' + (o.attr || '') + '></div>'; };
const alasanList = '<datalist id="alasanList">' + ALASAN.map(a => '<option value="' + a + '">').join('') + '</datalist>';

Pages.mutasi = {
  title: 'Mutasi Penduduk', min: 1,
  template: () => '<div class="page-h"><div><h2>Mutasi Penduduk</h2><p>Catat perpindahan penduduk — data penduduk dan surat dibuat otomatis.</p></div><div class="chips">' +
    '<button class="btn btn-soft" id="mKeluar">' + ic('logout') + ' Pindah keluar</button><button class="btn btn-soft" id="mMasuk">' + ic('plus') + ' Pindah masuk</button><button class="btn btn-soft" id="mLahir">' + ic('heart') + ' Kelahiran</button><button class="btn btn-soft" id="mMati">' + ic('alert') + ' Meninggal</button></div></div>' +
    '<div class="card flush"><div class="toolbar"><select class="select" id="mJenis" aria-label="Jenis mutasi"><option value="">Semua mutasi</option><option>Pindah Keluar</option><option>Pindah Masuk</option><option>Lahir</option><option>Meninggal</option></select></div>' +
    '<div id="mBody"><div style="padding:18px">' + skeleton(5) + '</div></div></div>',
  init(el) {
    $('#mKeluar', el).addEventListener('click', mutasiKeluarForm); $('#mMasuk', el).addEventListener('click', mutasiMasukForm); $('#mLahir', el).addEventListener('click', mutasiLahirForm); $('#mMati', el).addEventListener('click', mutasiMeninggalForm);
    $('#mJenis', el).addEventListener('change', e => { MtsState.jenis = e.target.value; MtsState.page = 1; this.draw(el); });
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'prev' || b.dataset.act === 'next') { MtsState.page += b.dataset.act === 'next' ? 1 : -1; return this.draw(el); }
      await busy(b, '…', async () => {
        const r = await api('riwayatDetail', { id: b.dataset.id }); if (!r.success) return toast(r.message, 'err');
        suratModal({ title: 'Surat No. ' + r.data.nomor, html: r.data.html, id: r.data.id });
      });
    });
  },
  show(el) {
    loadPen();
    swr('mts', 'mutasiList', {}, d => { MtsState.all = d; this.draw(el); }, { fresh: 60000, onError: r => { $('#mBody', el).innerHTML = errorState(r, 'mRetry'); const b = $('#mRetry'); b && b.addEventListener('click', () => this.show(el)); } });
  },
  draw(el) {
    const s = MtsState, list = s.all.filter(r => !s.jenis || r.jenis === s.jenis), body = $('#mBody', el);
    const pages = Math.max(1, Math.ceil(list.length / s.size)); s.page = Math.min(Math.max(1, s.page), pages);
    if (!s.all.length) { body.innerHTML = emptyState('swap', 'Belum ada mutasi', 'Catat pindah keluar atau pindah masuk untuk mulai.'); return; }
    if (!list.length) { body.innerHTML = emptyState('search', 'Tidak ada hasil', 'Ubah filter jenis mutasi.'); return; }
    const nama = r => { let a = []; try { a = JSON.parse(r.anggota); } catch (e) {} return a.length ? esc(a[0].nama) + (a.length > 1 ? ' <small class="muted">+' + (a.length - 1) + ' lainnya</small>' : '') : esc(r.kepala); };
    body.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Mutasi</th><th>Penduduk</th><th class="hide-md">Keterangan</th><th class="hide-sm">No. surat</th><th></th></tr></thead><tbody>' +
      list.slice((s.page - 1) * s.size, s.page * s.size).map(r => '<tr><td>' + esc(tglID(r.tanggal)) + '</td><td><span class="badge ' + ({ 'Pindah Keluar': 'b-warn', 'Pindah Masuk': 'b-ok', 'Meninggal': 'b-bad', 'Lahir': 'b-info' }[r.jenis] || '') + '">' + esc(r.jenis) + '</span></td>' +
        '<td class="cell-main"><b>' + nama(r) + '</b><small>' + esc(r.jumlah) + ' orang' + (r.no_kk ? ' · KK ' + esc(r.no_kk) : '') + '</small></td><td class="hide-md">' + esc(r.daerah) + '</td><td class="mono hide-sm">' + esc(r.nomor) + '</td>' +
        '<td class="act"><button class="btn btn-soft btn-sm" data-act="buka" data-id="' + esc(r.id_surat) + '">' + ic('printer') + ' Surat</button></td></tr>').join('') + '</tbody></table></div>' +
      '<div class="pager"><span>' + nf((s.page - 1) * s.size + 1) + '–' + nf(Math.min(s.page * s.size, list.length)) + ' dari ' + nf(list.length) + ' mutasi</span><div><button class="btn btn-ghost btn-sm" data-act="prev"' + (s.page <= 1 ? ' disabled' : '') + '>' + ic('chevL') + ' Sebelumnya</button><button class="btn btn-ghost btn-sm" data-act="next"' + (s.page >= pages ? ' disabled' : '') + '>Berikutnya ' + ic('chevR') + '</button></div></div>';
  }
};

/* ---------- Pindah keluar: pilih penduduk (boleh satu KK), isi tujuan ---------- */
async function mutasiKeluarForm() {
  await ensurePen();
  const sel = [];
  const m = openModal({
    title: 'Pindah keluar', size: 'xl', noFocus: true,
    body: '<div class="sect">1 · Penduduk yang pindah</div><div class="search">' + ic('search') + '<input class="input" id="mkQ" placeholder="Cari NIK, nama, atau No KK, lalu tambahkan…" autocomplete="off" aria-label="Cari penduduk"></div>' +
      '<div class="pick-list" id="mkRes"></div><div id="mkSel" style="margin-top:14px"></div>' +
      '<div class="sect" style="margin-top:24px">2 · Tujuan pindah</div><div class="form-grid">' + dField('mk_', 'alamat', 'Alamat tujuan', { full: 1 }) + dField('mk_', 'desa', 'Desa / Kelurahan', { req: 1 }) + dField('mk_', 'kecamatan', 'Kecamatan') + dField('mk_', 'kabupaten', 'Kabupaten / Kota', { req: 1 }) + dField('mk_', 'provinsi', 'Provinsi') + '</div>' +
      '<div class="sect" style="margin-top:6px">3 · Keterangan</div><div class="form-grid">' + dField('mk_', 'tanggal', 'Tanggal pindah', { req: 1, attr: ' type="date"', val: hariIni() }) + dField('mk_', 'alasan', 'Alasan pindah', { attr: ' list="alasanList" placeholder="Pilih atau ketik"' }) + '</div>' + alasanList +
      '<div class="form-err" id="mkErr" hidden></div>',
    footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="mkSave">' + ic('check') + ' Simpan &amp; buat surat</button>'
  });
  const box = m.el, g = n => $('[name="' + n + '"]', box).value.trim();
  const drawSel = () => {
    $('#mkSel', box).innerHTML = sel.length ? '<div class="tbl-wrap" style="border:1px solid var(--line);border-radius:12px"><table class="tbl"><thead><tr><th>No</th><th>Nama</th><th class="hide-sm">NIK</th><th>Hubungan</th><th></th></tr></thead><tbody>' +
      sel.map((p, i) => '<tr><td>' + (i + 1) + '</td><td class="cell-main"><b>' + esc(p.nama) + '</b><small>' + esc(p.jk) + ' · ' + umur(p.tgl_lahir) + '</small></td><td class="mono hide-sm">' + esc(p.nik) + '</td><td>' + esc(p.hubungan_keluarga || '-') + '</td>' +
        '<td class="act"><button type="button" class="icon-btn sm danger" data-rm="' + esc(p.id) + '" aria-label="Keluarkan ' + esc(p.nama) + ' dari daftar">' + ic('x') + '</button></td></tr>').join('') + '</tbody></table></div>' :
      '<p class="hint">Belum ada penduduk dipilih. Cari lalu klik Tambah, atau tambahkan seluruh anggota satu KK sekaligus.</p>';
  };
  const drawRes = () => {
    const q = $('#mkQ', box).value.trim().toLowerCase(), res = $('#mkRes', box);
    if (q.length < 2) { res.innerHTML = ''; return; }
    const ok = p => p.status_dasar === 'Hidup' && !sel.some(s => s.id === p.id);
    const rows = PenState.all.filter(p => ok(p) && (p.nik.includes(q) || p.nama.toLowerCase().includes(q) || (p.no_kk || '').includes(q))).slice(0, 6);
    res.innerHTML = rows.length ? rows.map(p => { const fam = p.no_kk ? PenState.all.filter(x => x.no_kk === p.no_kk && ok(x)).length : 0;
      return '<div class="pick-row"><div class="cell-main" style="flex:1;min-width:0"><b>' + esc(p.nama) + '</b><small class="mono">' + esc(p.nik) + ' · ' + esc(p.hubungan_keluarga || '-') + '</small></div>' +
        '<button type="button" class="btn btn-soft btn-sm" data-add="' + esc(p.id) + '">' + ic('plus') + ' Tambah</button>' + (fam > 1 ? '<button type="button" class="btn btn-ghost btn-sm" data-kk="' + esc(p.no_kk) + '">Seluruh KK (' + fam + ')</button>' : '') + '</div>'; }).join('') :
      '<p class="muted" style="padding:6px 2px">Tidak ada penduduk aktif yang cocok.</p>';
  };
  drawSel();
  $('#mkQ', box).addEventListener('input', debounce(drawRes, 150));
  box.addEventListener('click', e => {
    const a = e.target.closest('[data-add]'), k = e.target.closest('[data-kk]'), r = e.target.closest('[data-rm]');
    if (a) { const p = PenState.all.find(x => x.id === a.dataset.add); if (p && !sel.some(s => s.id === p.id)) sel.push(p); }
    else if (k) PenState.all.filter(x => x.no_kk === k.dataset.kk && x.status_dasar === 'Hidup' && !sel.some(s => s.id === x.id)).forEach(x => sel.push(x));
    else if (r) { const i = sel.findIndex(s => s.id === r.dataset.rm); if (i > -1) sel.splice(i, 1); }
    else return;
    drawSel(); drawRes();
  });
  $('#mkSave', box).addEventListener('click', async () => {
    const er = $('#mkErr', box); er.hidden = true;
    const fail = msg => { er.textContent = msg; er.hidden = false; er.scrollIntoView({ block: 'nearest' }); };
    if (!sel.length) return fail('Pilih minimal satu penduduk yang pindah.');
    if (!g('desa') || !g('kabupaten')) return fail('Isi minimal desa/kelurahan dan kabupaten/kota tujuan.');
    if (!g('tanggal')) return fail('Tanggal pindah wajib diisi.');
    if (!await confirmBox({ title: 'Konfirmasi pindah keluar', okText: 'Ya, proses', message: '<b>' + sel.length + ' orang</b> akan ditandai berstatus <b>Pindah</b> dan surat pindah diterbitkan. Lanjutkan?' })) return;
    await busy($('#mkSave', box), 'Memproses…', async () => {
      const r = await api('mutasiKeluar', { ids: sel.map(p => p.id), tanggal: g('tanggal'), alasan: g('alasan'), tujuan: { alamat: g('alamat'), desa: g('desa'), kecamatan: g('kecamatan'), kabupaten: g('kabupaten'), provinsi: g('provinsi') } });
      if (!r.success) return fail(r.message);
      sel.forEach(p => { const x = PenState.all.find(y => y.id === p.id); if (x) x.status_dasar = 'Pindah'; });
      persistPen(); refreshPenViews(); m.close(); toast(sel.length + ' penduduk ditandai pindah.'); afterMutasi(r.data);
    });
  });
}

/* ---------- Pindah masuk: satu keluarga, banyak anggota ---------- */
function mutasiMasukForm() {
  const sl = (n, l, arr, ph) => '<div class="field"><label>' + l + '</label><select class="select" name="' + n + '">' + opts(arr, '', ph || 'Pilih…') + '</select></div>';
  const tx = (n, l, o) => { o = o || {}; return '<div class="field"><label>' + l + (o.req ? ' <i>*</i>' : '') + '</label><input class="input" name="' + n + '"' + (o.attr || '') + '></div>'; };
  const member = hub => '<div class="member" data-mem><div class="member-h"><span data-no>Anggota</span><button type="button" class="icon-btn sm danger" data-del aria-label="Hapus anggota">' + ic('trash') + '</button></div><div class="form-grid">' +
    tx('nik', 'NIK', { req: 1, attr: ' inputmode="numeric" maxlength="16" autocomplete="off"' }) + tx('nama', 'Nama lengkap', { req: 1 }) +
    '<div class="field"><label>Hubungan dalam keluarga</label><select class="select" name="hubungan_keluarga">' + opts(OPT.hubungan_keluarga, hub, 'Pilih…') + '</select></div>' + sl('jk', 'Jenis kelamin <i>*</i>', OPT.jk) +
    tx('tempat_lahir', 'Tempat lahir') + tx('tgl_lahir', 'Tanggal lahir <i>*</i>', { attr: ' type="date" max="' + hariIni() + '"' }) + sl('agama', 'Agama', OPT.agama) + sl('status_kawin', 'Status perkawinan', OPT.status_kawin) +
    sl('pendidikan', 'Pendidikan', OPT.pendidikan) + tx('pekerjaan', 'Pekerjaan') + sl('gol_darah', 'Golongan darah', OPT.gol_darah) + tx('nama_ayah', 'Nama ayah') + tx('nama_ibu', 'Nama ibu') + '</div></div>';
  const m = openModal({
    title: 'Pindah masuk', size: 'xl', noFocus: true,
    body: '<div class="sect">1 · Daerah asal</div><div class="form-grid">' + dField('mm_', 'a_alamat', 'Alamat asal', { full: 1 }) + dField('mm_', 'a_desa', 'Desa / Kelurahan', { req: 1 }) + dField('mm_', 'a_kecamatan', 'Kecamatan') + dField('mm_', 'a_kabupaten', 'Kabupaten / Kota', { req: 1 }) + dField('mm_', 'a_provinsi', 'Provinsi') + '</div>' +
      '<div class="sect" style="margin-top:6px">2 · Tempat tinggal di desa &amp; keterangan</div><div class="form-grid">' + dField('mm_', 'no_kk', 'No KK keluarga', { attr: ' inputmode="numeric" maxlength="16" autocomplete="off"' }) + dField('mm_', 'alamat', 'Alamat tinggal (jalan/nama tempat)') +
      dField('mm_', 'dusun', 'Dusun') + dField('mm_', 'rt', 'RT', { attr: ' inputmode="numeric" maxlength="3"' }) + dField('mm_', 'rw', 'RW', { attr: ' inputmode="numeric" maxlength="3"' }) +
      dField('mm_', 'tanggal', 'Tanggal kedatangan', { req: 1, attr: ' type="date"', val: hariIni() }) + dField('mm_', 'alasan', 'Alasan pindah', { attr: ' list="alasanList" placeholder="Pilih atau ketik"' }) + '</div>' + alasanList +
      '<div class="sect" style="margin-top:6px">3 · Anggota keluarga yang pindah</div><div id="mmList"></div><button type="button" class="btn btn-soft btn-sm" id="mmAdd">' + ic('plus') + ' Tambah anggota</button><div class="form-err" id="mmErr" hidden style="margin-top:14px"></div>',
    footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="mmSave">' + ic('check') + ' Simpan &amp; buat surat</button>'
  });
  const box = m.el, list = $('#mmList', box), g = n => $('[name="' + n + '"]', box).value.trim();
  const renum = () => { const ms = $$('[data-mem]', list); ms.forEach((c, i) => { $('[data-no]', c).textContent = 'Anggota ' + (i + 1); $('[data-del]', c).hidden = ms.length < 2; }); };
  const add = hub => { list.insertAdjacentHTML('beforeend', member(hub)); renum(); };
  add('Kepala Keluarga');
  $('#mmAdd', box).addEventListener('click', () => { add(''); const c = $$('[data-mem]', list).pop(); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('[name=nik]', c).focus(); });
  list.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) { d.closest('[data-mem]').remove(); renum(); } });
  $('#mmSave', box).addEventListener('click', async () => {
    const er = $('#mmErr', box); er.hidden = true;
    const fail = msg => { er.textContent = msg; er.hidden = false; er.scrollIntoView({ block: 'nearest' }); };
    if (!g('a_desa') || !g('a_kabupaten')) return fail('Isi minimal desa/kelurahan dan kabupaten/kota asal.');
    if (g('no_kk') && !/^\d{16}$/.test(g('no_kk'))) return fail('No KK harus 16 digit angka.');
    if (!g('tanggal')) return fail('Tanggal kedatangan wajib diisi.');
    const anggota = $$('[data-mem]', list).map(c => { const o = {}; $$('[name]', c).forEach(i => { o[i.name] = i.value.trim(); }); return o; });
    for (let i = 0; i < anggota.length; i++) {
      const a = anggota[i], p = 'Anggota ' + (i + 1) + ': ';
      if (!/^\d{16}$/.test(a.nik)) return fail(p + 'NIK harus 16 digit angka.');
      if (!a.nama) return fail(p + 'nama wajib diisi.'); if (!a.jk) return fail(p + 'pilih jenis kelamin.'); if (!a.tgl_lahir) return fail(p + 'tanggal lahir wajib diisi.');
    }
    await busy($('#mmSave', box), 'Memproses…', async () => {
      const r = await api('mutasiMasuk', { tanggal: g('tanggal'), alasan: g('alasan'), no_kk: g('no_kk'), alamat: g('alamat'), dusun: g('dusun'), rt: g('rt'), rw: g('rw'), anggota,
        asal: { alamat: g('a_alamat'), desa: g('a_desa'), kecamatan: g('a_kecamatan'), kabupaten: g('a_kabupaten'), provinsi: g('a_provinsi') } });
      if (!r.success) return fail(r.message);
      r.data.penduduk.forEach(p => { const i = PenState.all.findIndex(x => x.id === p.id); if (i > -1) PenState.all[i] = p; else PenState.all.unshift(p); });
      PenState.loaded = true; persistPen(); refreshPenViews(); m.close(); toast(r.data.penduduk.length + ' penduduk baru dicatat.'); afterMutasi(r.data);
    });
  });
}

/* ---------- Pemilih orang (dipakai form Meninggal & Kelahiran) ---------- */
function bindPicker(box, qSel, resSel, filterFn, onPick) {
  const q = $(qSel, box), res = $(resSel, box);
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    if (t.length < 2) { res.innerHTML = ''; return; }
    const rows = PenState.all.filter(p => filterFn(p) && (p.nik.includes(t) || p.nama.toLowerCase().includes(t) || (p.no_kk || '').includes(t))).slice(0, 6);
    res.innerHTML = rows.length ? rows.map(p => '<div class="pick-row"><div class="cell-main" style="flex:1;min-width:0"><b>' + esc(p.nama) + '</b><small class="mono">' + esc(p.nik) + ' · ' + esc(p.hubungan_keluarga || '-') + ' · ' + esc(p.dusun || '-') + '</small></div><button type="button" class="btn btn-soft btn-sm" data-pick="' + esc(p.id) + '">Pilih</button></div>').join('') : '<p class="muted" style="padding:6px 2px">Tidak ada penduduk aktif yang cocok.</p>';
  };
  q.addEventListener('input', debounce(draw, 150));
  res.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b) return; const p = PenState.all.find(x => x.id === b.dataset.pick); if (p) { onPick(p); res.innerHTML = ''; q.value = ''; } });
}
const selField = (n, l, arr, ph) => '<div class="field"><label>' + l + '</label><select class="select" name="' + n + '">' + opts(arr, '', ph || 'Pilih…') + '</select></div>';
const HUB_PELAPOR = '<datalist id="hubList"><option value="Anak"><option value="Suami"><option value="Istri"><option value="Ayah"><option value="Ibu"><option value="Saudara"><option value="Kerabat"><option value="Lainnya"></datalist>';

/* ---------- Meninggal ---------- */
async function mutasiMeninggalForm() {
  await ensurePen();
  let picked = null;
  const m = openModal({
    title: 'Penduduk meninggal', size: 'xl', noFocus: true,
    body: '<div class="sect">1 · Penduduk yang meninggal</div><div class="search">' + ic('search') + '<input class="input" id="mdQ" placeholder="Cari NIK, nama, atau No KK…" autocomplete="off" aria-label="Cari penduduk"></div>' +
      '<div class="pick-list" id="mdRes"></div><div id="mdSel" style="margin-top:12px"></div>' +
      '<div class="sect" style="margin-top:22px">2 · Data kematian</div><div class="form-grid">' + dField('md_', 'tanggal', 'Tanggal meninggal', { req: 1, attr: ' type="date" max="' + hariIni() + '"', val: hariIni() }) + dField('md_', 'jam', 'Pukul', { attr: ' placeholder="Contoh: 03.30 WIB"' }) +
      dField('md_', 'tempat', 'Tempat meninggal', { attr: ' placeholder="Contoh: Rumah / RSUD"' }) + dField('md_', 'sebab', 'Sebab', { attr: ' list="sebabList" placeholder="Pilih atau ketik"' }) + '</div>' +
      '<datalist id="sebabList"><option value="Sakit"><option value="Usia lanjut"><option value="Kecelakaan"><option value="Lainnya"></datalist>' +
      '<div class="sect" style="margin-top:6px">3 · Pelapor</div><div class="form-grid">' + dField('md_', 'pelapor_nama', 'Nama pelapor', { req: 1 }) + dField('md_', 'pelapor_nik', 'NIK pelapor', { attr: ' inputmode="numeric" maxlength="16"' }) + dField('md_', 'pelapor_hubungan', 'Hubungan dengan yang meninggal', { attr: ' list="hubList"' }) + '</div>' + HUB_PELAPOR +
      '<div class="form-err" id="mdErr" hidden></div>',
    footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="mdSave">' + ic('check') + ' Simpan &amp; buat surat</button>'
  });
  const box = m.el, g = n => $('[name="' + n + '"]', box).value.trim();
  const showSel = () => { $('#mdSel', box).innerHTML = picked ? '<div class="pick sel"><div class="avatar">' + esc(picked.nama.charAt(0).toUpperCase()) + '</div><div class="cell-main"><b>' + esc(picked.nama) + '</b><small class="mono">' + esc(picked.nik) + ' · ' + esc(picked.jk) + ' · ' + umur(picked.tgl_lahir) + ' · ' + esc(picked.dusun || '-') + ' RT ' + esc(picked.rt || '-') + '/' + esc(picked.rw || '-') + '</small></div></div>' : '<p class="hint">Belum ada penduduk dipilih.</p>'; };
  showSel();
  bindPicker(box, '#mdQ', '#mdRes', p => p.status_dasar === 'Hidup', p => { picked = p; showSel(); const pl = $('[name=pelapor_nama]', box); if (!pl.value) pl.focus(); });
  $('#mdSave', box).addEventListener('click', async () => {
    const er = $('#mdErr', box); er.hidden = true;
    const fail = msg => { er.textContent = msg; er.hidden = false; er.scrollIntoView({ block: 'nearest' }); };
    if (!picked) return fail('Pilih penduduk yang meninggal.');
    if (!g('tanggal')) return fail('Tanggal meninggal wajib diisi.');
    if (!g('pelapor_nama')) return fail('Nama pelapor wajib diisi.');
    if (g('pelapor_nik') && !/^\d{16}$/.test(g('pelapor_nik'))) return fail('NIK pelapor harus 16 digit angka.');
    if (!await confirmBox({ title: 'Konfirmasi', okText: 'Ya, proses', message: '<b>' + esc(picked.nama) + '</b> akan ditandai berstatus <b>Meninggal</b> dan surat keterangan kematian diterbitkan. Lanjutkan?' })) return;
    await busy($('#mdSave', box), 'Memproses…', async () => {
      const r = await api('mutasiMeninggal', { id: picked.id, tanggal: g('tanggal'), jam: g('jam'), tempat: g('tempat'), sebab: g('sebab'), pelapor_nama: g('pelapor_nama'), pelapor_nik: g('pelapor_nik'), pelapor_hubungan: g('pelapor_hubungan') });
      if (!r.success) return fail(r.message);
      const x = PenState.all.find(y => y.id === picked.id); if (x) x.status_dasar = 'Meninggal';
      persistPen(); refreshPenViews(); m.close(); toast(picked.nama + ' dicatat meninggal.'); afterMutasi(r.data);
    });
  });
}

/* ---------- Kelahiran ---------- */
async function mutasiLahirForm() {
  await ensurePen();
  const m = openModal({
    title: 'Kelahiran', size: 'xl', noFocus: true,
    body: '<div class="sect">1 · Orang tua / keluarga (opsional, untuk mengisi otomatis)</div><div class="search">' + ic('search') + '<input class="input" id="lhQ" placeholder="Cari ayah / ibu / anggota keluarga…" autocomplete="off" aria-label="Cari orang tua"></div><div class="pick-list" id="lhRes"></div><div id="lhInfo" class="hint" style="margin-top:8px"></div>' +
      '<div class="sect" style="margin-top:22px">2 · Data bayi</div><div class="form-grid">' + dField('lh_', 'nama', 'Nama bayi', { req: 1 }) + selField('jk', 'Jenis kelamin <i>*</i>', OPT.jk) +
      dField('lh_', 'tempat_lahir', 'Tempat lahir', { req: 1 }) + dField('lh_', 'tgl_lahir', 'Tanggal lahir', { req: 1, attr: ' type="date" max="' + hariIni() + '"', val: hariIni() }) + dField('lh_', 'jam', 'Pukul', { attr: ' placeholder="Contoh: 10.15 WIB"' }) +
      dField('lh_', 'anak_ke', 'Anak ke', { attr: ' inputmode="numeric" maxlength="2"' }) + selField('agama', 'Agama', OPT.agama) + selField('gol_darah', 'Golongan darah', OPT.gol_darah) +
      '<div class="field full"><label for="lh_nik">NIK (isi bila sudah terbit)</label><input class="input" id="lh_nik" name="nik" inputmode="numeric" maxlength="16" autocomplete="off"><div class="hint">Kosongkan bila belum ada — sistem memberi nomor sementara (BELUM-xxxxxx) yang bisa diganti nanti lewat Ubah data.</div></div></div>' +
      '<div class="sect" style="margin-top:6px">3 · Orang tua &amp; alamat</div><div class="form-grid">' + dField('lh_', 'nama_ayah', 'Nama ayah') + dField('lh_', 'nama_ibu', 'Nama ibu') + dField('lh_', 'no_kk', 'No KK', { attr: ' inputmode="numeric" maxlength="16"' }) + dField('lh_', 'alamat', 'Alamat') +
      dField('lh_', 'dusun', 'Dusun') + dField('lh_', 'rt', 'RT', { attr: ' inputmode="numeric" maxlength="3"' }) + dField('lh_', 'rw', 'RW', { attr: ' inputmode="numeric" maxlength="3"' }) + '</div>' +
      '<div class="sect" style="margin-top:6px">4 · Pelapor</div><div class="form-grid">' + dField('lh_', 'pelapor_nama', 'Nama pelapor', { req: 1 }) + dField('lh_', 'pelapor_nik', 'NIK pelapor', { attr: ' inputmode="numeric" maxlength="16"' }) + dField('lh_', 'pelapor_hubungan', 'Hubungan dengan bayi', { attr: ' list="hubList"' }) + '</div>' + HUB_PELAPOR +
      '<div class="form-err" id="lhErr" hidden></div>',
    footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="lhSave">' + ic('check') + ' Simpan &amp; buat surat</button>'
  });
  const box = m.el, g = n => $('[name="' + n + '"]', box).value.trim(), set = (n, v) => { $('[name="' + n + '"]', box).value = v || ''; };
  bindPicker(box, '#lhQ', '#lhRes', p => p.status_dasar === 'Hidup', p => {
    const fam = p.no_kk ? PenState.all.filter(x => x.no_kk === p.no_kk && x.status_dasar === 'Hidup') : [p];
    const ayah = fam.find(x => x.jk === 'Laki-laki' && /kepala|suami/i.test(x.hubungan_keluarga)) || (p.jk === 'Laki-laki' ? p : null);
    const ibu = fam.find(x => x.jk === 'Perempuan' && /istri/i.test(x.hubungan_keluarga)) || fam.find(x => x.jk === 'Perempuan' && /kepala/i.test(x.hubungan_keluarga)) || (p.jk === 'Perempuan' ? p : null);
    set('nama_ayah', ayah && ayah.nama); set('nama_ibu', ibu && ibu.nama); set('no_kk', p.no_kk); set('alamat', p.alamat); set('dusun', p.dusun); set('rt', p.rt); set('rw', p.rw);
    $('#lhInfo', box).textContent = 'Terisi dari keluarga ' + p.nama + (p.no_kk ? ' (KK ' + p.no_kk + ')' : '') + '. Periksa dan ubah bila perlu.';
  });
  $('#lhSave', box).addEventListener('click', async () => {
    const er = $('#lhErr', box); er.hidden = true;
    const fail = msg => { er.textContent = msg; er.hidden = false; er.scrollIntoView({ block: 'nearest' }); };
    if (!g('nama')) return fail('Nama bayi wajib diisi.'); if (!g('jk')) return fail('Pilih jenis kelamin.');
    if (!g('tempat_lahir')) return fail('Tempat lahir wajib diisi.'); if (!g('tgl_lahir')) return fail('Tanggal lahir wajib diisi.');
    if (g('nik') && !/^\d{16}$/.test(g('nik'))) return fail('NIK harus 16 digit angka (atau kosongkan).');
    if (g('no_kk') && !/^\d{16}$/.test(g('no_kk'))) return fail('No KK harus 16 digit angka.');
    if (!g('nama_ayah') && !g('nama_ibu')) return fail('Isi nama ayah atau nama ibu.');
    if (!g('pelapor_nama')) return fail('Nama pelapor wajib diisi.');
    if (g('pelapor_nik') && !/^\d{16}$/.test(g('pelapor_nik'))) return fail('NIK pelapor harus 16 digit angka.');
    await busy($('#lhSave', box), 'Memproses…', async () => {
      const d = {}; $$('[name]', box).forEach(i => { d[i.name] = i.value.trim(); });
      const r = await api('mutasiLahir', d);
      if (!r.success) return fail(r.message);
      PenState.all.unshift(r.data.penduduk[0]); PenState.loaded = true; persistPen(); refreshPenViews(); m.close(); toast(d.nama + ' dicatat sebagai penduduk baru.'); afterMutasi(r.data);
    });
  });
}

/* ============================================================
   DAFTAR PEMILIH — usia ≥ 17 tahun pada tanggal acuan · Excel & PDF
   ============================================================ */
const PmlState = { tgl: '', dusun: '', rw: '', rt: '', wni: true, page: 1, size: 25 };
function umurPada(iso, ref) {
  iso = normIso(iso); const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso), b = /^(\d{4})-(\d{2})-(\d{2})/.exec(ref); if (!a || !b) return -1;
  let u = +b[1] - +a[1]; if (+b[2] < +a[2] || (+b[2] === +a[2] && +b[3] < +a[3])) u--; return u;
}
function pemilihRows() {
  const s = PmlState; if (!/^\d{4}-\d{2}-\d{2}$/.test(s.tgl)) return [];
  return PenState.all.filter(p => p.status_dasar === 'Hidup' && umurPada(p.tgl_lahir, s.tgl) >= 17 && (!s.wni || !p.kewarganegaraan || /^wni$/i.test(p.kewarganegaraan)) &&
    (!s.dusun || p.dusun === s.dusun) && (!s.rw || p.rw === s.rw) && (!s.rt || p.rt === s.rt))
    .sort((a, b) => (a.dusun || '').localeCompare(b.dusun || '', 'id') || Number(a.rw) - Number(b.rw) || Number(a.rt) - Number(b.rt) || a.nama.localeCompare(b.nama, 'id'));
}
function pemilihInfo(rows) {
  const st = (AppState.boot && AppState.boot.pengaturan) || {}, s = PmlState, f = [s.dusun && 'Dusun ' + s.dusun, s.rw && 'RW ' + s.rw, s.rt && 'RT ' + s.rt].filter(Boolean).join(', ');
  return { st, filter: f, l: rows.filter(p => p.jk === 'Laki-laki').length, p: rows.filter(p => p.jk === 'Perempuan').length, tgl: tglID(s.tgl) };
}
const kawinLabel = p => p.status_kawin || '-';
function pemilihExcel(rows) {
  const i = pemilihInfo(rows), st = i.st, H = ['No', 'NIK', 'No KK', 'Nama Lengkap', 'L/P', 'Tempat Lahir', 'Tanggal Lahir', 'Umur', 'Status Kawin', 'Dusun', 'RT', 'RW', 'Alamat'];
  const L = (v, s) => ({ v, s: s || 0 }), data = [
    [L('DAFTAR PEMILIH', 2)], [L('Desa ' + (st.nama_desa || '') + ', Kecamatan ' + (st.kecamatan || '') + ', Kabupaten ' + (st.kabupaten || ''), 4)],
    [L('Berusia 17 tahun atau lebih pada tanggal ' + i.tgl + (i.filter ? ' · ' + i.filter : ''))], [L('Jumlah: ' + nf(rows.length) + ' pemilih (laki-laki ' + nf(i.l) + ', perempuan ' + nf(i.p) + ')')], [],
    H.map(h => L(h, 1))
  ].concat(rows.map((p, n) => [L(n + 1, 3), L(p.nik, 3), L(p.no_kk || '', 3), L(p.nama, 3), L(p.jk === 'Laki-laki' ? 'L' : p.jk === 'Perempuan' ? 'P' : '', 3), L(p.tempat_lahir || '', 3),
    L(normIso(p.tgl_lahir).split('-').reverse().join('-'), 3), L(umurPada(p.tgl_lahir, PmlState.tgl), 3), L(kawinLabel(p), 3), L(p.dusun || '', 3), L(p.rt || '', 3), L(p.rw || '', 3), L(p.alamat || '', 3)]));
  return XLSX_MINI.make({ sheet: 'Daftar Pemilih', rows: data, widths: [6, 20, 20, 30, 6, 18, 14, 7, 16, 16, 6, 6, 34], merges: ['A1:M1', 'A2:M2', 'A3:M3', 'A4:M4'], freeze: 6 });
}
function pemilihHtml(rows) {
  const i = pemilihInfo(rows), st = i.st;
  const css = '@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:9.5pt;color:#000;margin:0 auto;padding:10mm 12mm}@media print{body{padding:0}}' +
    '.kop{text-align:center;margin-bottom:8px}.kop div{text-transform:uppercase;line-height:1.35}.k1{font-weight:bold;font-size:11pt}h1{font-size:14pt;text-align:center;margin:8px 0 2px;text-decoration:underline}.sub{text-align:center;margin:0 0 10px}' +
    'table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:3px 5px;vertical-align:top}th{background:#e8f0fa;text-align:center}thead{display:table-header-group}tr{page-break-inside:avoid}.c{text-align:center}' +
    '.ttd{margin-top:22px;margin-left:68%;text-align:center;page-break-inside:avoid}.ttd .sp{height:60px}';
  return '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Daftar Pemilih</title><style>' + css + '</style></head><body><div class="kop"><div class="k1">Pemerintah Kabupaten ' + esc(st.kabupaten) + '</div><div class="k1">Kecamatan ' + esc(st.kecamatan) + '</div><div class="k1">Pemerintah Desa ' + esc(st.nama_desa) + '</div></div>' +
    '<h1>DAFTAR PEMILIH</h1><p class="sub">Berusia 17 tahun atau lebih pada tanggal ' + esc(i.tgl) + (i.filter ? ' · ' + esc(i.filter) : '') + '<br>Jumlah ' + nf(rows.length) + ' pemilih (laki-laki ' + nf(i.l) + ', perempuan ' + nf(i.p) + ')</p>' +
    '<table><thead><tr><th>No</th><th>NIK</th><th>Nama Lengkap</th><th>L/P</th><th>Tempat, Tgl. Lahir</th><th>Umur</th><th>Status Kawin</th><th>Alamat</th></tr></thead><tbody>' +
    rows.map((p, n) => '<tr><td class="c">' + (n + 1) + '</td><td>' + esc(p.nik) + '</td><td>' + esc(p.nama) + '</td><td class="c">' + (p.jk === 'Laki-laki' ? 'L' : p.jk === 'Perempuan' ? 'P' : '') + '</td><td>' + esc((p.tempat_lahir ? p.tempat_lahir + ', ' : '') + tglID(p.tgl_lahir)) + '</td><td class="c">' + umurPada(p.tgl_lahir, PmlState.tgl) + '</td><td>' + esc(kawinLabel(p)) + '</td><td>' + esc([p.alamat, p.dusun && 'Dusun ' + p.dusun, (p.rt || p.rw) && 'RT ' + (p.rt || '-') + '/RW ' + (p.rw || '-')].filter(Boolean).join(', ')) + '</td></tr>').join('') +
    '</tbody></table><div class="ttd"><div>' + esc(st.nama_desa) + ', ' + esc(tglID(hariIni())) + '</div><div>' + esc(st.jabatan_penandatangan) + '</div><div class="sp"></div><b><u>' + esc(st.nama_penandatangan) + '</u></b></div></body></html>';
}
function printModal(title, html) {
  const m = openModal({ title, size: 'xl', noFocus: true, body: '<iframe class="paper" title="' + esc(title) + '"></iframe><p class="hint" style="margin-top:10px">Di jendela cetak, pilih tujuan <b>Simpan sebagai PDF</b> (atau pilih printer).</p>',
    footer: '<button class="btn btn-ghost" data-close>Tutup</button><button class="btn btn-primary" data-print>' + ic('printer') + ' Cetak / Simpan PDF</button>' });
  const fr = $('iframe', m.el); fr.srcdoc = html;
  $('[data-print]', m.el).addEventListener('click', () => { fr.contentWindow.focus(); fr.contentWindow.print(); });
  return m;
}
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

Pages.pemilih = {
  title: 'Daftar Pemilih', min: 1,
  template: () => '<div class="page-h"><div><h2>Daftar Pemilih</h2><p>Penduduk aktif yang berusia 17 tahun atau lebih pada tanggal acuan.</p></div><div class="chips"><button class="btn btn-soft" id="pmXls">' + ic('download') + ' Unduh Excel</button><button class="btn btn-primary" id="pmPdf">' + ic('printer') + ' PDF / Cetak</button></div></div>' +
    '<div class="card" style="margin-bottom:16px"><div class="filters"><div class="field"><label for="pmTgl">Tanggal acuan <i>*</i></label><input class="input" type="date" id="pmTgl"></div>' +
    '<div class="field"><label for="pmDusun">Dusun</label><select class="select" id="pmDusun"></select></div><div class="field"><label for="pmRw">RW</label><select class="select" id="pmRw"></select></div><div class="field"><label for="pmRt">RT</label><select class="select" id="pmRt"></select></div></div>' +
    '<label class="switch"><input type="checkbox" id="pmWni" checked> Hanya warga negara Indonesia (WNI)</label></div>' +
    '<div class="stats" id="pmStats"></div><div class="card flush"><div id="pmBody"><div style="padding:18px">' + skeleton(5) + '</div></div></div>',
  init(el) {
    const re = () => { PmlState.page = 1; this.draw(el); };
    $('#pmTgl', el).addEventListener('change', e => { PmlState.tgl = e.target.value; re(); });
    [['pmDusun', 'dusun'], ['pmRw', 'rw'], ['pmRt', 'rt']].forEach(([id, k]) => $('#' + id, el).addEventListener('change', e => { PmlState[k] = e.target.value; re(); }));
    $('#pmWni', el).addEventListener('change', e => { PmlState.wni = e.target.checked; re(); });
    $('#pmXls', el).addEventListener('click', () => { const r = pemilihRows(); if (!r.length) return toast('Tidak ada data untuk diunduh.', 'err'); downloadBlob(pemilihExcel(r), 'Daftar-Pemilih-' + PmlState.tgl + '.xlsx'); toast(nf(r.length) + ' pemilih diunduh ke Excel.'); });
    $('#pmPdf', el).addEventListener('click', () => { const r = pemilihRows(); if (!r.length) return toast('Tidak ada data untuk dicetak.', 'err'); printModal('Daftar Pemilih', pemilihHtml(r)); });
    el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) { PmlState.page += b.dataset.act === 'next' ? 1 : -1; this.draw(el); } });
  },
  show(el) { if (!PmlState.tgl) PmlState.tgl = hariIni(); $('#pmTgl', el).value = PmlState.tgl; loadPen(); if (PenState.loaded) this.draw(el); },
  draw(el) {
    const s = PmlState, uniq = k => Array.from(new Set(PenState.all.map(p => p[k]).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
    $('#pmDusun', el).innerHTML = opts(uniq('dusun'), s.dusun, 'Semua dusun'); $('#pmRw', el).innerHTML = opts(uniq('rw'), s.rw, 'Semua RW'); $('#pmRt', el).innerHTML = opts(uniq('rt'), s.rt, 'Semua RT');
    const rows = pemilihRows(), i = pemilihInfo(rows), body = $('#pmBody', el);
    $('#pmStats', el).innerHTML = stat('vote', '', nf(rows.length), 'Jumlah pemilih') + stat('users', 'g', nf(i.l), 'Laki-laki') + stat('users', 'p', nf(i.p), 'Perempuan');
    const pages = Math.max(1, Math.ceil(rows.length / s.size)); s.page = Math.min(Math.max(1, s.page), pages);
    if (!PenState.all.length) { body.innerHTML = emptyState('users', 'Belum ada data penduduk', 'Tambahkan data penduduk lebih dulu.'); return; }
    if (!rows.length) { body.innerHTML = emptyState('vote', 'Tidak ada pemilih', 'Tidak ada penduduk berusia 17 tahun atau lebih pada tanggal dan filter ini.'); return; }
    body.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>No</th><th>NIK</th><th>Nama</th><th>L/P</th><th class="hide-md">Tempat, tgl lahir</th><th>Umur</th><th class="hide-sm">Dusun · RT/RW</th></tr></thead><tbody>' +
      rows.slice((s.page - 1) * s.size, s.page * s.size).map((p, n) => '<tr><td>' + ((s.page - 1) * s.size + n + 1) + '</td><td class="mono">' + esc(p.nik) + '</td><td class="cell-main"><b>' + esc(p.nama) + '</b></td><td>' + (p.jk === 'Laki-laki' ? 'L' : p.jk === 'Perempuan' ? 'P' : '-') + '</td>' +
        '<td class="hide-md">' + esc((p.tempat_lahir ? p.tempat_lahir + ', ' : '') + tglID(p.tgl_lahir)) + '</td><td>' + umurPada(p.tgl_lahir, s.tgl) + ' th</td><td class="hide-sm">' + esc(p.dusun || '-') + ' · ' + esc(p.rt || '-') + '/' + esc(p.rw || '-') + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="pager"><span>' + nf((s.page - 1) * s.size + 1) + '–' + nf(Math.min(s.page * s.size, rows.length)) + ' dari ' + nf(rows.length) + ' pemilih</span><div><button class="btn btn-ghost btn-sm" data-act="prev"' + (s.page <= 1 ? ' disabled' : '') + '>' + ic('chevL') + ' Sebelumnya</button><button class="btn btn-ghost btn-sm" data-act="next"' + (s.page >= pages ? ' disabled' : '') + '>Berikutnya ' + ic('chevR') + '</button></div></div>';
  }
};

/* ============================================================
   BUAT SURAT
   ============================================================ */
function suratModal(o) {
  const m = openModal({ title: o.title, size: 'xl', noFocus: true, body: '<iframe class="paper" title="Pratinjau surat"></iframe>', footer: '' });
  const fr = $('iframe', m.el); fr.srcdoc = o.html;
  const foot = (html) => { m.foot.innerHTML = html; };
  const actions = (id) => {
    foot('<button class="btn btn-ghost" data-close>Selesai</button><button class="btn btn-soft" data-pdf>' + ic('download') + ' Unduh PDF</button><button class="btn btn-primary" data-print>' + ic('printer') + ' Cetak</button>');
    $('[data-print]', m.el).addEventListener('click', () => { fr.contentWindow.focus(); fr.contentWindow.print(); });
    $('[data-pdf]', m.el).addEventListener('click', async e => busy(e.currentTarget, 'Menyiapkan…', async () => {
      const r = await api('suratPdf', { id }); if (!r.success) return toast(r.message, 'err');
      const bin = atob(r.data.base64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([a], { type: 'application/pdf' })); link.download = r.data.filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    }));
  };
  if (o.issue) {
    foot('<button class="btn btn-ghost" data-close>Kembali</button><button class="btn btn-primary" data-issue>' + ic('printer') + ' Terbitkan &amp; cetak</button>');
    $('[data-issue]', m.el).addEventListener('click', e => busy(e.currentTarget, 'Menerbitkan…', async () => {
      const r = await o.issue(); if (!r.success) return toast(r.message, 'err');
      $('.modal-h h3', m.el).textContent = 'Surat No. ' + r.data.nomor; fr.srcdoc = r.data.html; actions(r.data.id);
      fr.onload = () => { fr.onload = null; try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
      toast('Surat diterbitkan dengan nomor ' + r.data.nomor); o.onIssued && o.onIssued(r.data);
    }));
  } else actions(o.id);
  return m;
}

Pages.surat = {
  title: 'Buat Surat', min: 1, sel: null,
  template: () => '<div class="page-h"><div><h2>Buat Surat</h2><p>Pilih penduduk dan jenis surat — data terisi otomatis.</p></div></div>' +
    '<div class="surat-grid"><div class="card"><div class="step"><span class="n">1</span><h3>Pilih penduduk</h3></div>' +
    '<div class="search">' + ic('search') + '<input class="input" id="sQ" placeholder="Ketik NIK atau nama…" autocomplete="off" aria-label="Cari penduduk"></div><div class="pick-list" id="sList"></div>' +
    '<div class="step" style="margin-top:26px"><span class="n">2</span><h3>Jenis surat</h3></div><select class="select" id="sJenis" aria-label="Jenis surat"></select>' +
    '<div class="step" style="margin-top:26px"><span class="n">3</span><h3>Keterangan</h3></div><div class="form-grid"><div class="field"><label for="sTgl">Tanggal surat</label><input class="input" type="date" id="sTgl"></div></div>' +
    '<div class="field"><label for="sKep">Keperluan / keterangan tambahan</label><textarea class="textarea" id="sKep" placeholder="Contoh: melamar pekerjaan, pengajuan beasiswa…"></textarea><div class="hint">Mengisi penanda {{keperluan}} pada isi surat.</div></div></div>' +
    '<div class="card sum"><h3>Ringkasan</h3><div id="sSum"></div><button class="btn btn-primary btn-block" id="sGo" style="margin-top:18px" disabled>' + ic('eye') + ' Pratinjau surat</button></div></div>',
  init(el) {
    $('#sQ', el).addEventListener('input', debounce(() => this.list(el), 200));
    ['sJenis', 'sTgl', 'sKep'].forEach(i => $('#' + i, el).addEventListener('input', () => this.sum(el)));
    $('#sList', el).addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) { this.sel = b.dataset.pick; this.list(el); this.sum(el); } });
    $('#sGo', el).addEventListener('click', () => this.preview(el));
  },
  async show(el, param) {
    $('#sTgl', el).value = $('#sTgl', el).value || hariIni();
    if (param) this.sel = param;
    await Promise.all([ensurePen(), this.jenis(el)]);
    this.list(el); this.sum(el);
  },
  async jenis(el) {
    if (!AppState.boot) AppState.boot = Store.get(userKey('boot'), null);
    if (!AppState.boot) await revalidate();
    const j = (AppState.boot && AppState.boot.jenis) || [], s = $('#sJenis', el), cur = s.value;
    s.innerHTML = '<option value="">Pilih jenis surat…</option>' + j.map(x => '<option value="' + esc(x.id) + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(x.nama) + '</option>').join('');
  },
  list(el) {
    const q = $('#sQ', el).value.trim().toLowerCase(), box = $('#sList', el);
    const sel = this.sel && PenState.all.find(p => p.id === this.sel);
    let rows = PenState.all.filter(p => p.status_dasar === 'Hidup' && (!q || p.nik.includes(q) || p.nama.toLowerCase().includes(q))).slice(0, 6);
    if (sel && !rows.some(p => p.id === sel.id)) rows.unshift(sel);
    if (!rows.length) { box.innerHTML = '<p class="muted" style="padding:10px 2px">' + (PenState.all.length ? 'Tidak ada penduduk yang cocok.' : 'Belum ada data penduduk.') + '</p>'; return; }
    box.innerHTML = rows.map(p => '<button type="button" class="pick' + (p.id === this.sel ? ' sel' : '') + '" data-pick="' + esc(p.id) + '"><div class="avatar">' + esc(p.nama.charAt(0).toUpperCase()) + '</div><div class="cell-main"><b>' + esc(p.nama) + '</b><small class="mono">' + esc(p.nik) + ' · ' + esc(p.dusun || '-') + ' RT ' + esc(p.rt || '-') + '/' + esc(p.rw || '-') + '</small></div></button>').join('');
  },
  sum(el) {
    const p = PenState.all.find(x => x.id === this.sel), j = $('#sJenis', el), jn = j.value ? j.options[j.selectedIndex].text : '';
    const r = (l, v) => '<div class="row"><span>' + l + '</span><b>' + esc(v || '—') + '</b></div>';
    $('#sSum', el).innerHTML = r('Penduduk', p && p.nama) + r('NIK', p && p.nik) + r('Jenis surat', jn) + r('Tanggal', tglID($('#sTgl', el).value)) + r('Nomor surat', 'Otomatis saat terbit');
    $('#sGo', el).disabled = !(p && j.value);
  },
  async preview(el) {
    const body = { id_penduduk: this.sel, id_jenis: $('#sJenis', el).value, tanggal: $('#sTgl', el).value, keperluan: $('#sKep', el).value.trim() };
    await busy($('#sGo', el), 'Menyiapkan…', async () => {
      const res = await api('suratPreview', body); if (!res.success) return toast(res.message, 'err');
      suratModal({ title: 'Pratinjau surat', html: res.data.html, issue: () => api('suratTerbit', body), onIssued: () => { Store.del(userKey('rwy')); Store.del(userKey('dash')); $('#sKep', el).value = ''; } });
    });
  }
};

/* ============================================================
   RIWAYAT SURAT
   ============================================================ */
const RwyState = { all: [], q: '', jenis: '', dari: '', sampai: '', page: 1, size: 25 };
Pages.riwayat = {
  title: 'Riwayat Surat', min: 1,
  template: () => '<div class="page-h"><div><h2>Riwayat Surat</h2><p>Seluruh surat yang pernah diterbitkan.</p></div></div><div class="card flush"><div class="toolbar">' +
    '<div class="search">' + ic('search') + '<input class="input" id="rQ" placeholder="Cari nomor, nama, atau NIK…" aria-label="Cari surat"></div>' +
    '<select class="select" id="rJenis" aria-label="Jenis surat"></select><input class="input" type="date" id="rDari" style="width:auto" aria-label="Dari tanggal"><input class="input" type="date" id="rSampai" style="width:auto" aria-label="Sampai tanggal"></div>' +
    '<div id="rBody"><div style="padding:18px">' + skeleton(6) + '</div></div></div>',
  init(el) {
    const re = () => { RwyState.page = 1; this.draw(el); };
    $('#rQ', el).addEventListener('input', debounce(e => { RwyState.q = e.target.value.trim().toLowerCase(); re(); }, 250));
    [['rJenis', 'jenis'], ['rDari', 'dari'], ['rSampai', 'sampai']].forEach(([i, k]) => $('#' + i, el).addEventListener('change', e => { RwyState[k] = e.target.value; re(); }));
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'prev') { RwyState.page--; return this.draw(el); } if (b.dataset.act === 'next') { RwyState.page++; return this.draw(el); }
      if (b.dataset.act === 'buka') await busy(b, '…', async () => {
        const r = await api('riwayatDetail', { id: b.dataset.id }); if (!r.success) return toast(r.message, 'err');
        suratModal({ title: 'Surat No. ' + r.data.nomor, html: r.data.html, id: r.data.id });
      });
    });
  },
  show(el) { swr('rwy', 'riwayatList', {}, d => { RwyState.all = d; this.draw(el); }, { fresh: 60000, onError: r => { $('#rBody', el).innerHTML = errorState(r, 'rRetry'); const b = $('#rRetry'); b && b.addEventListener('click', () => this.show(el)); } }); },
  draw(el) {
    const s = RwyState, jn = Array.from(new Set(s.all.map(r => r.nama_jenis))).sort(), sel = $('#rJenis', el);
    sel.innerHTML = opts(jn, s.jenis, 'Semua jenis');
    const list = s.all.filter(r => (!s.q || r.nomor.toLowerCase().includes(s.q) || r.nama.toLowerCase().includes(s.q) || r.nik.includes(s.q)) && (!s.jenis || r.nama_jenis === s.jenis) && (!s.dari || r.tanggal >= s.dari) && (!s.sampai || r.tanggal <= s.sampai));
    const pages = Math.max(1, Math.ceil(list.length / s.size)); s.page = Math.min(Math.max(1, s.page), pages);
    const body = $('#rBody', el), rows = list.slice((s.page - 1) * s.size, s.page * s.size);
    if (!s.all.length) { body.innerHTML = emptyState('file', 'Belum ada surat', 'Surat yang diterbitkan akan tercatat di sini.', '<p><a class="btn btn-primary btn-sm" href="#/surat" style="margin-top:14px">' + ic('plus') + ' Buat surat</a></p>'); return; }
    if (!list.length) { body.innerHTML = emptyState('search', 'Tidak ada hasil', 'Coba ubah kata kunci atau rentang tanggal.'); return; }
    body.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nomor</th><th>Tanggal</th><th>Jenis surat</th><th>Penduduk</th><th class="hide-md">Dibuat oleh</th><th></th></tr></thead><tbody>' +
      rows.map(r => '<tr><td class="mono"><b>' + esc(r.nomor) + '</b></td><td>' + esc(tglID(r.tanggal)) + '</td><td>' + esc(r.nama_jenis) + '</td><td class="cell-main"><b>' + esc(r.nama) + '</b><small class="mono">' + esc(r.nik) + '</small></td><td class="hide-md">' + esc(r.dibuat_oleh) + '</td>' +
        '<td class="act"><button class="btn btn-soft btn-sm" data-act="buka" data-id="' + esc(r.id) + '">' + ic('printer') + ' Lihat / cetak</button></td></tr>').join('') + '</tbody></table></div>' +
      '<div class="pager"><span>' + nf((s.page - 1) * s.size + 1) + '–' + nf(Math.min(s.page * s.size, list.length)) + ' dari ' + nf(list.length) + ' surat</span><div><button class="btn btn-ghost btn-sm" data-act="prev"' + (s.page <= 1 ? ' disabled' : '') + '>' + ic('chevL') + ' Sebelumnya</button><button class="btn btn-ghost btn-sm" data-act="next"' + (s.page >= pages ? ' disabled' : '') + '>Berikutnya ' + ic('chevR') + '</button></div></div>';
  }
};

/* ============================================================
   PENGATURAN (Admin ke atas)
   ============================================================ */
Pages.pengaturan = {
  title: 'Pengaturan', min: 2, tab: 'jenis', jenis: [], users: [],
  template() {
    const T = [['jenis', 'Jenis surat'], ['users', 'Pengguna'], ['desa', 'Profil desa & penandatangan']].concat(lvl() >= 3 ? [['sistem', 'Sistem']] : []);
    return '<div class="page-h"><div><h2>Pengaturan</h2><p>Kelola jenis surat, akun pengguna, dan identitas desa.</p></div></div><div class="tabs" role="tablist">' +
      T.map(t => '<button class="tab' + (t[0] === 'jenis' ? ' on' : '') + '" role="tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div><div id="gBody"></div>';
  },
  init(el) {
    el.addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) { this.tab = t.dataset.tab; $$('.tab', el).forEach(x => x.classList.toggle('on', x === t)); this.load(el); } });
  },
  show(el) { this.load(el); },
  load(el) { ({ jenis: () => this.vJenis(el), users: () => this.vUsers(el), desa: () => this.vDesa(el), sistem: () => this.vSistem(el) })[this.tab](); },

  /* --- jenis surat --- */
  async vJenis(el) {
    const box = $('#gBody', el); box.innerHTML = '<div class="card">' + skeleton(4) + '</div>';
    const res = await api('jenisList'); if (!res.success) { box.innerHTML = '<div class="card">' + errorState(res, 'gRetry') + '</div>'; $('#gRetry').addEventListener('click', () => this.vJenis(el)); return; }
    this.jenis = res.data;
    box.innerHTML = '<div class="card flush"><div class="toolbar"><b>' + res.data.length + ' jenis surat</b><div class="grow"></div><button class="btn btn-primary btn-sm" id="jNew">' + ic('plus') + ' Jenis surat baru</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama surat</th><th class="hide-sm">Kode</th><th>Status</th><th></th></tr></thead><tbody>' +
      res.data.map(j => '<tr><td class="cell-main"><b>' + esc(j.nama) + '</b></td><td class="hide-sm mono">' + esc(j.kode) + '</td><td><span class="badge ' + (j.aktif === 'Y' ? 'b-ok' : '') + '">' + (j.aktif === 'Y' ? 'Aktif' : 'Nonaktif') + '</span></td><td class="act"><button class="icon-btn sm" data-j="' + esc(j.id) + '" aria-label="Ubah ' + esc(j.nama) + '">' + ic('pencil') + '</button></td></tr>').join('') + '</tbody></table></div></div>';
    $('#jNew', el).addEventListener('click', () => this.jForm(el)); $$('[data-j]', el).forEach(b => b.addEventListener('click', () => this.jForm(el, b.dataset.j)));
  },
  jForm(el, id) {
    const j = id ? this.jenis.find(x => x.id === id) : { nama: '', kode: '470', isi: 'Yang bertanda tangan di bawah ini Kepala Desa {{nama_desa}}, menerangkan bahwa:\n\nNama: {{nama}}\nNIK: {{nik}}\nAlamat: {{alamat_lengkap}}\n\nOrang tersebut …\n\nDemikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.', aktif: 'Y' };
    const m = openModal({
      title: id ? 'Ubah jenis surat' : 'Jenis surat baru', size: 'lg',
      body: '<form id="fJ"><div class="form-grid"><div class="field"><label>Nama surat <i>*</i></label><input class="input" name="nama" value="' + esc(j.nama) + '" required></div><div class="field"><label>Kode klasifikasi nomor</label><input class="input" name="kode" value="' + esc(j.kode) + '" maxlength="20"><div class="hint">Contoh nomor: 470/001/DS-LMG/X/2026</div></div></div>' +
        '<div class="field"><label>Isi surat <i>*</i></label><textarea class="textarea code" name="isi">' + esc(j.isi) + '</textarea><div class="hint">Pisahkan paragraf dengan baris kosong. Baris berformat <code>Label: nilai</code> otomatis menjadi tabel biodata.</div></div>' +
        '<div class="lbl">Klik untuk menyisipkan penanda data</div><div class="chips" id="chips">' + PENANDA.map(k => '<button type="button" class="chip" data-k="' + k + '">{{' + k + '}}</button>').join('') + '</div>' +
        '<div class="field" style="margin-top:18px"><label class="switch"><input type="checkbox" name="aktif"' + (j.aktif === 'Y' ? ' checked' : '') + '> Aktif (muncul di pilihan Buat Surat)</label></div><div class="form-err" id="jErr" hidden></div></form>',
      footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="jSave">Simpan</button>'
    });
    const ta = $('textarea', m.el);
    $('#chips', m.el).addEventListener('click', e => { const c = e.target.closest('[data-k]'); if (!c) return; const t = '{{' + c.dataset.k + '}}', s = ta.selectionStart; ta.value = ta.value.slice(0, s) + t + ta.value.slice(ta.selectionEnd); ta.focus(); ta.selectionStart = ta.selectionEnd = s + t.length; });
    $('#jSave', m.el).addEventListener('click', e => busy(e.currentTarget, 'Menyimpan…', async () => {
      const f = $('#fJ', m.el), fd = new FormData(f), d = { id, nama: fd.get('nama'), kode: fd.get('kode'), isi: fd.get('isi'), aktif: f.aktif.checked ? 'Y' : 'N' };
      const res = await api('jenisSave', d); if (!res.success) { const b = $('#jErr', m.el); b.textContent = res.message; b.hidden = false; return; }
      toast('Jenis surat disimpan.'); m.close(); revalidate(); this.vJenis(el);
    }));
  },

  /* --- pengguna --- */
  async vUsers(el) {
    const box = $('#gBody', el); box.innerHTML = '<div class="card">' + skeleton(4) + '</div>';
    const res = await api('userList'); if (!res.success) { box.innerHTML = '<div class="card">' + errorState(res, 'gRetry') + '</div>'; $('#gRetry').addEventListener('click', () => this.vUsers(el)); return; }
    this.users = res.data;
    box.innerHTML = '<div class="card flush"><div class="toolbar"><b>' + res.data.length + ' pengguna</b><div class="grow"></div><button class="btn btn-primary btn-sm" id="uNew">' + ic('plus') + ' Tambah pengguna</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pengguna</th><th>Peran</th><th class="hide-md">Terakhir masuk</th><th>Status</th><th></th></tr></thead><tbody>' +
      res.data.map(u => '<tr><td class="cell-main"><b>' + esc(u.nama) + '</b><small>@' + esc(u.username) + (u.jabatan ? ' · ' + esc(u.jabatan) : '') + '</small></td><td><span class="badge b-info">' + esc(PERAN[u.peran]) + '</span></td><td class="hide-md">' + (u.last_login ? esc(tglID(u.last_login)) : '—') + '</td><td><span class="badge ' + (u.aktif === 'Y' ? 'b-ok' : 'b-bad') + '">' + (u.aktif === 'Y' ? 'Aktif' : 'Nonaktif') + '</span></td>' +
        '<td class="act"><button class="icon-btn sm" data-u="' + esc(u.username) + '" aria-label="Ubah ' + esc(u.nama) + '">' + ic('pencil') + '</button><button class="icon-btn sm" data-r="' + esc(u.username) + '" aria-label="Reset password ' + esc(u.nama) + '" title="Reset password">' + ic('key') + '</button></td></tr>').join('') + '</tbody></table></div></div>';
    $('#uNew', el).addEventListener('click', () => this.uForm(el)); $$('[data-u]', el).forEach(b => b.addEventListener('click', () => this.uForm(el, b.dataset.u))); $$('[data-r]', el).forEach(b => b.addEventListener('click', () => this.uReset(el, b.dataset.r)));
  },
  uForm(el, un) {
    const u = un ? this.users.find(x => x.username === un) : { username: '', nama: '', jabatan: '', peran: 'operator', aktif: 'Y' };
    const peran = Object.keys(PERAN).filter(p => p !== 'superuser' || lvl() >= 3);
    const m = openModal({
      title: un ? 'Ubah pengguna' : 'Tambah pengguna', size: 'md',
      body: '<form id="fU" autocomplete="off"><div class="field"><label>Username <i>*</i></label><input class="input" name="username" value="' + esc(u.username) + '"' + (un ? ' readonly' : '') + ' autocapitalize="none" required><div class="hint">Huruf kecil, angka, titik, strip (3–30 karakter).</div></div>' +
        '<div class="field"><label>Nama lengkap <i>*</i></label><input class="input" name="nama" value="' + esc(u.nama) + '" required></div><div class="field"><label>Jabatan</label><input class="input" name="jabatan" value="' + esc(u.jabatan) + '" placeholder="Contoh: Kaur TU, Sekdes, Kepala Desa"><div class="hint">Hak hapus data hanya untuk jabatan Kepala Desa / Sekdes (peran Admin).</div></div>' +
        '<div class="field"><label>Peran</label><select class="select" name="peran">' + peran.map(p => '<option value="' + p + '"' + (p === u.peran ? ' selected' : '') + '>' + PERAN[p] + '</option>').join('') + '</select></div>' +
        (un ? '' : '<div class="field"><label>Password awal <i>*</i></label><input class="input" name="password" type="text" autocomplete="off" minlength="6"><div class="hint">Minimal 6 karakter. Sampaikan ke pengguna dan minta diganti.</div></div>') +
        '<div class="field"><label class="switch"><input type="checkbox" name="aktif"' + (u.aktif === 'Y' ? ' checked' : '') + '> Akun aktif</label></div><div class="form-err" id="uErr" hidden></div></form>',
      footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="uSave">Simpan</button>'
    });
    $('#uSave', m.el).addEventListener('click', e => busy(e.currentTarget, 'Menyimpan…', async () => {
      const f = $('#fU', m.el), fd = Object.fromEntries(new FormData(f)); fd.aktif = f.aktif.checked ? 'Y' : 'N';
      const res = await api('userSave', fd); if (!res.success) { const b = $('#uErr', m.el); b.textContent = res.message; b.hidden = false; return; }
      toast('Pengguna disimpan.'); m.close(); this.vUsers(el);
    }));
  },
  uReset(el, un) {
    const m = openModal({ title: 'Reset password @' + un, size: 'sm', body: '<div class="field"><label>Password baru</label><input class="input" id="rpw" type="text" autocomplete="off" minlength="6"><div class="hint">Pengguna akan keluar dari semua perangkat.</div></div><div class="form-err" id="rErr" hidden></div>', footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="rSave">Reset</button>' });
    $('#rSave', m.el).addEventListener('click', e => busy(e.currentTarget, 'Menyimpan…', async () => {
      const res = await api('userReset', { username: un, password: $('#rpw', m.el).value }); if (!res.success) { const b = $('#rErr', m.el); b.textContent = res.message; b.hidden = false; return; }
      toast('Password direset.'); m.close();
    }));
  },

  /* --- profil desa --- */
  vDesa(el) {
    const st = (AppState.boot && AppState.boot.pengaturan) || {}, box = $('#gBody', el);
    const f = (n, l, h) => '<div class="field"><label>' + l + '</label><input class="input" name="' + n + '" value="' + esc(st[n]) + '">' + (h ? '<div class="hint">' + h + '</div>' : '') + '</div>';
    box.innerHTML = '<div class="card" style="max-width:760px"><form id="fD"><div class="sect">Identitas pemerintah desa</div><div class="form-grid">' + f('nama_desa', 'Nama desa') + f('kecamatan', 'Kecamatan') + f('kabupaten', 'Kabupaten') + f('awalan_nomor', 'Awalan nomor surat', 'Contoh: DS-LMG') +
      '<div class="full">' + f('alamat_kantor', 'Alamat kantor (tampil di kop surat)') + '</div></div><div class="sect">Penandatangan surat</div><div class="form-grid">' + f('nama_penandatangan', 'Nama penandatangan') + f('jabatan_penandatangan', 'Jabatan') + '</div>' +
      '<div class="form-err" id="dErr" hidden></div><button class="btn btn-primary" id="dSave" type="submit">Simpan perubahan</button></form></div>';
    $('#fD', el).addEventListener('submit', e => { e.preventDefault(); busy($('#dSave', el), 'Menyimpan…', async () => {
      const res = await api('pengaturanSave', Object.fromEntries(new FormData(e.target))); if (!res.success) { const b = $('#dErr', el); b.textContent = res.message; b.hidden = false; return; }
      AppState.boot.pengaturan = res.data; Store.set(userKey('boot'), AppState.boot); toast('Pengaturan disimpan.');
    }); });
  },

  /* --- sistem (super user) --- */
  vSistem(el) {
    $('#gBody', el).innerHTML = '<div class="card" style="max-width:640px"><h3>Pemeliharaan</h3><p class="muted" style="margin-bottom:10px"><b>Rapikan data penduduk</b> memperbaiki data hasil tempel manual ke Sheet: ID kosong, tanggal dd/mm/yyyy, NIK/No KK bertanda baca, jenis kelamin L/P, status kosong.</p><p class="muted" style="margin-bottom:16px">Segarkan cache server bila data di Google Sheets diubah langsung (tanpa lewat aplikasi). Disarankan juga membuat salinan Spreadsheet secara berkala (File → Buat salinan).</p>' +
      '<button class="btn btn-primary" id="sRapi">' + ic('check') + ' Rapikan data penduduk</button> <button class="btn btn-soft" id="sCache">' + ic('refresh') + ' Segarkan cache server</button> <button class="btn btn-ghost" id="sPerf">Lihat catatan kecepatan (console)</button></div>';
    $('#sRapi', el).addEventListener('click', async e => {
      if (!await confirmBox({ title: 'Rapikan data penduduk', okText: 'Rapikan sekarang', message: 'Data di sheet Penduduk akan distandarkan (ID, tanggal, NIK/No KK, jenis kelamin, status). Disarankan membuat salinan Spreadsheet lebih dulu. Lanjutkan?' })) return;
      const btn = $('#sRapi', el);
      await busy(btn, 'Merapikan…', async () => {
        const r = await api('rapikanData');
        if (!r.success) return toast(r.message, 'err');
        Store.del(userKey('pen')); Store.del(userKey('dash')); PenState.loaded = false; loadPen(true);
        toast(r.data.diubah ? r.data.diubah + ' dari ' + r.data.jumlah + ' baris dirapikan.' : 'Semua ' + r.data.jumlah + ' baris sudah rapi.');
      });
    });
    $('#sCache', el).addEventListener('click', e => busy(e.currentTarget, 'Menyegarkan…', async () => { const r = await api('resetCache'); if (r.success) { Store.clearUser(); toast('Cache server disegarkan. Muat ulang halaman.'); } else toast(r.message, 'err'); }));
    $('#sPerf', el).addEventListener('click', () => { Perf.table(); toast('Tabel kecepatan ada di console browser (F12).'); });
  }
};

/* ============================================================
   START
   ============================================================ */
function start() {
  hydrateIcons();
  bindLogin();
  addEventListener('hashchange', route);
  warmUpServer();
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 120000) warmUpServer(); });
  const sess = Store.get('session', null);
  if (sess && sess.token) {
    AppState.token = sess.token; AppState.user = sess.user; AppState.boot = Store.get(userKey('boot'), null);
    showApp(); revalidate(); prefetch();
  } else { $('#login').hidden = false; setTimeout(() => $('#lUser').focus(), 60); }
  $('#splash').remove();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
