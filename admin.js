// ============================================================
// ADMIN DASHBOARD — /?admin
// ============================================================
// Menambah 2 komponen kecil ke `components` (statGrid, barChart) karena
// tidak ada padanannya di mesin render script.js untuk kartu KPI & bar
// chart — selebihnya (titleHero, article, table:) memakai yang sudah ada.
// CSS untuk keduanya (.stat-grid/.stat-card, .chart-svg/.chart-bar) sudah
// tersedia di style.css.
// ============================================================
web.routes.admin = 'resolveAdminDashboard';

components.statGrid = (d) => `
    <div class="row page4 artikel">
        <div class="stat-grid ">
            ${(d.stats || []).map(s => `
                <div class="stat-card">
                    <div class="stat-value">${s.value}</div>
                    <div class="stat-label">${s.label}</div>
                </div>`).join('')}
        </div>
    </div>`;

components.barChart = (d) => {
    const items  = d.items || [];
    const max    = Math.max(100, ...items.map(i => i.value));
    const barH   = 28, gap = 10, leftW = 170, chartW = 380, topPad = 10;
    const height = items.length * (barH + gap) + topPad || (barH + topPad);

    const bars = items.map((it, i) => {
        const y = topPad + i * (barH + gap);
        const w = max ? (it.value / max) * chartW : 0;
        return `
            <text x="0" y="${y + barH / 2}" class="chart-label" text-anchor="start">${it.label}</text>
            <rect x="${leftW}" y="${y}" width="${w}" height="${barH}" class="chart-bar" rx="4"></rect>
            <text x="${leftW + w + 8}" y="${y + barH / 2}" class="chart-value">${it.value}%</text>`;
    }).join('');

    return `
        <div class="row page4 artikel">
            <h3>${d.title || ''}</h3>
            <div class="chart-wrap">
                ${items.length
                    ? `<svg class="chart-svg" viewBox="0 0 ${leftW + chartW + 60} ${height}">${bars}</svg>`
                    : '<p>Belum ada data progress untuk ditampilkan.</p>'}
            </div>
        </div>`;
};

// Aksi admin: naikkan peran akun 'peserta' menjadi 'dosen', dan buat akun
// baru (peran bebas). Dipanggil dari tombol/form pada Dashboard Admin —
// memakai db.js langsung, tanpa komponen/tabel baru.
const adminAction = {
    // [DRAWER] Tambah Akun Baru dibuka lewat drawer kanan — lihat
    // adminView.formTambahAkun (fields tidak dituliskan ulang di sini).
    bukaTambahAkun() {
        web.openFormFromPage(adminView.formTambahAkun());
    },

    jadikanDosen(userId) {
        if (!confirm('Ubah peran akun ini menjadi Dosen?')) return;
        db.update('users', userId, { role: 'dosen' });
        alert('Peran akun berhasil diubah menjadi Dosen.');
        web.navigate('admin');
    },

    submitTambahAkun(form) {
        const username = form.querySelector('[name="username"]').value.trim().toLowerCase();
        const password = form.querySelector('[name="password"]').value;
        const name     = form.querySelector('[name="name"]').value.trim();
        const role     = form.querySelector('[name="role"]').value;

        if (!username || !password || !name || !role) { alert('Semua field wajib diisi.'); return; }
        if (db.find('users', u => u.username === username)) { alert('Username sudah dipakai, gunakan username lain.'); return; }

        db.insert('users', { username, password, name, role });
        alert('Akun berhasil dibuat.');
        web.navigate('admin');
    }
};

const adminView = {
    formTambahAkun() {
        return [
            { section: 'titleHero', title: 'Tambah Akun Baru' },
            {
                section: 'article',
                leftCol: { subtitle: '', lines: ['link:&laquo; Kembali ke Dashboard Admin:admin'] },
                rightCol: {
                    subtitle: 'Detail Akun',
                    fields: [
                        { type: 'text',     name: 'username', label: 'Username', required: true,
                          placeholder: 'mis: budi123' },
                        { type: 'password', name: 'password', label: 'Password', required: true },
                        { type: 'text',     name: 'name',     label: 'Nama Lengkap', required: true },
                        { type: 'select',   name: 'role',     label: 'Peran', value: 'peserta', required: true,
                          options: [
                              { value: 'peserta', label: 'Peserta' },
                              { value: 'dosen',   label: 'Dosen' },
                              { value: 'admin',   label: 'Admin' }
                          ] }
                    ],
                    submitText: 'Simpan Akun',
                    onSubmit: 'event.preventDefault(); adminAction.submitTambahAkun(this);',
                    lines: ['form:']
                }
            }
        ];
    }
};

web.resolveAdminDashboard = function (subParam) {
    const user = auth.currentUser();

    if (!user) {
        return [
            { section: 'titleHero', title: 'Dashboard Admin', description: 'Silakan masuk terlebih dahulu.' },
            { section: 'article',
              leftCol: { subtitle: '', lines: ['link:Ke Halaman Masuk:login'] },
              rightCol: { subtitle: '', lines: [] } }
        ];
    }
    if (user.role !== 'admin') {
        return [{ section: 'titleHero', title: 'Akses Ditolak',
                   description: 'Halaman ini khusus untuk peran Admin.' }];
    }

    // subParam 'tambahakun' → form Tambah Akun Baru. Pola sama dengan
    // dosen.js (aksi dibedakan lewat subParam), tanpa menyentuh script.js.
    if (subParam === 'tambahakun') return adminView.formTambahAkun();

    const list  = courseSvc.list();
    const users = db.all('users');

    const jumlahDosen     = users.filter(u => u.role === 'dosen').length;
    const jumlahPeserta   = users.filter(u => u.role === 'peserta').length;
    // Statis (pages.certificates) + otomatis-terbit dari kuis (tabel db
    // 'certificates', lihat certSvc di quiz.js) — sama seperti penggabungan
    // sertifikat di Dashboard peserta (auth.js).
    const jumlahSertifikat = Object.keys(pages.certificates || {}).length
        + ((typeof certSvc !== 'undefined') ? db.all('certificates').length : 0);

    // Data kuis (quiz.js) — dibaca lewat db langsung + guard `typeof`
    // supaya admin.js tetap jalan walau quiz.js tidak dimuat.
    const quizAttempts = (typeof quizSvc !== 'undefined') ? db.all('quizAttempts') : [];
    const jumlahKuis    = (typeof quizSvc !== 'undefined') ? db.all('quizzes').length : 0;
    const avgQuizScore  = quizAttempts.length
        ? Math.round(quizAttempts.reduce((a, b) => a + Number(b.score || 0), 0) / quizAttempts.length)
        : 0;

    const progressRows = db.all('progress');
    const pctList = progressRows.map(p => {
        const total = courseSvc.categoriesOf(p.slug).flatMap(c => c.items || []).length;
        return total ? (p.viewed || []).length / total * 100 : 0;
    });
    const avgProgress = pctList.length
        ? Math.round(pctList.reduce((a, b) => a + b, 0) / pctList.length)
        : 0;

    const perCourse = list.map(c => {
        const rows  = progressRows.filter(p => p.slug === c.slug);
        const total = courseSvc.categoriesOf(c.slug).flatMap(cat => cat.items || []).length;
        const avg = (rows.length && total)
            ? Math.round(rows.reduce((a, p) => a + (p.viewed || []).length, 0) / (rows.length * total) * 100)
            : 0;
        return { label: c.title, value: avg };
    });

    return [
        { section: 'titleHero', title: 'Dashboard Admin',
          description: `Ringkasan platform untuk <strong>${user.name}</strong>.` },
        { section: 'statGrid', stats: [
            { label: 'Jumlah Kursus', value: list.length },
            { label: 'Jumlah Peserta', value: jumlahPeserta },
            { label: 'Jumlah Dosen', value: jumlahDosen },
            { label: 'Jumlah Kuis', value: jumlahKuis },
            { label: 'Rata-rata Skor Kuis', value: avgQuizScore + '%' },
            { label: 'Sertifikat Diperoleh', value: jumlahSertifikat },
            { label: 'Rata-rata Progress', value: avgProgress + '%' }
        ]},
        { section: 'barChart', title: 'Progress Rata-rata per Kursus', items: perCourse },

      {
            section: 'articleFull',
            subtitle: 'Daftar Kursus',
            // Aksi Modul/Edit/Hapus memakai ULANG halaman & fungsi milik
            // Dashboard Dosen (dosen.js) — courseSvc.isOwner() otomatis
            // meloloskan admin utk kursus siapa pun, jadi admin bisa
            // lihat/edit/hapus semua kursus & semua modul TANPA komponen
            // atau logika baru di sini (lihat requireOwnedCourse di dosen.js).
            lines: [
                'link:Kelola lewat Dashboard Dosen:dosen',
                '---',
                ...(list.length
                    ? [`table:${JSON.stringify(list.map(c => ({
                          Kursus: c.title, Instruktur: c.instructor, Periode: c.period,
                          Peserta: courseSvc.participantsOf(c.slug).length,
                          Aksi: `<a href="javascript:void(0)" onclick="web.navigate('dosen/modul:${c.slug}')">Modul</a> ·
                                 <a href="javascript:void(0)" onclick="dosenAction.bukaEditKursus('${c.slug}')">Edit</a> ·
                                 <a href="javascript:void(0)" onclick="dosenAction.hapusKursus('${c.slug}')">Hapus</a>`
                      })))}`]
                    : ['Belum ada kursus.'])
            ]
        },

        {
            section: 'articleFull',
            subtitle: 'Akun Terdaftar',
            lines: [
                '<button type="button" class="slcBtn" onclick="adminAction.bukaTambahAkun()">+ Tambah Akun Baru</button>',
                '---',
                ...(users.length
                    ? [`table:${JSON.stringify(users.map(u => ({
                          Nama: u.name, Username: u.username, Peran: u.role,
                          Aksi: u.role === 'peserta'
                              ? `<a href="javascript:void(0)" onclick="adminAction.jadikanDosen('${u.id}')">Jadikan Dosen</a>`
                              : '-'
                      })))}`]
                    : ['Belum ada akun.'])
            ]
        }


    ];
};
