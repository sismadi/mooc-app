// ============================================================
// DOSEN DASHBOARD — /?dosen dan sub-halamannya.
// ============================================================
// Satu slug 'dosen' menampung beberapa sub-view (kursusku, tambah
// kursus, modul, tambah materi, update periode, peserta), dibedakan
// lewat subParam berformat "aksi:parameter" (mis. "modul:rpl") — pola
// ini konsisten dengan cara web.navigate() di script.js sudah meneruskan
// subParam ke resolver, jadi TIDAK perlu menambah apa pun ke script.js.
//
// Semua tampilan memakai komponen render yang sudah ada (titleHero,
// article, table:, card:, form:, link:) — tidak ada komponen baru
// khusus untuk dosen.
// ============================================================
web.routes.dosen = 'resolveDosenDashboard';

// [DEDUP] Guard akses kepemilikan kursus — dipakai oleh SEMUA sub-view
// dosen (modul, materi, periode, peserta, edit, kuis) supaya seorang
// dosen tidak bisa mengelola kursus dosen lain hanya dengan menebak
// slug lewat URL. `courseSvc.isOwner` sudah otomatis meloloskan admin,
// jadi guard yang sama ini SEKALIGUS yang membuat Dashboard Admin bisa
// memakai ulang seluruh halaman/aksi dosen (lihat admin.js) tanpa
// duplikasi kode.
function requireOwnedCourse(slug, user) {
    const course = courseSvc.get(slug);
    if (!course) return { denied: [{ section: 'titleHero', title: 'Kursus Tidak Ditemukan' }] };
    if (!courseSvc.isOwner(course, user)) {
        return { denied: [{ section: 'titleHero', title: 'Akses Ditolak',
                             description: 'Anda bukan pengampu kursus ini.' }] };
    }
    return { course };
}

const dosenView = {
    kursusku(user) {
        const mine = courseSvc.myCourses(user);
        const rows = mine.map(c => {
            const total   = courseSvc.categoriesOf(c.slug).flatMap(cat => cat.items || []).length;
            const peserta = courseSvc.participantsOf(c.slug).length;
            return {
                Kursus: c.title,
                Periode: c.period,
                Materi: total,
                Peserta: peserta,
                Aksi: `<a href="javascript:void(0)" onclick="web.navigate('dosen/modul:${c.slug}')">Modul</a> ·
                       <a href="javascript:void(0)" onclick="web.navigate('dosen/kuis:${c.slug}')">Kuis</a> ·
                       <a href="javascript:void(0)" onclick="dosenAction.bukaEditKursus('${c.slug}')">Edit</a> ·
                       <a href="javascript:void(0)" onclick="web.navigate('dosen/peserta:${c.slug}')">Peserta</a> ·
                       <a href="javascript:void(0)" onclick="dosenAction.hapusKursus('${c.slug}')">Hapus</a>`
            };
        });

        return [
            { section: 'titleHero', title: 'Dashboard Dosen',
              description: `Selamat datang, <strong>${user.name}</strong>.` },


              {
                  section: 'articleFull',
                  subtitle: 'Kursusku',
                  lines: [
                  '<button type="button" class="slcBtn" onclick="dosenAction.bukaTambahKursus()">+ Tambah Kursus Baru</button>',
                  '---',
                  rows.length ? `table:${JSON.stringify(rows)}` : 'Anda belum memiliki kursus.'
            ]

              }
        ];
    },

    /** Form edit kursus (judul/deskripsi/harga/periode) + tombol hapus kursus. */
    formEditKursus(slug, user) {
        const guard = requireOwnedCourse(slug, user);
        if (guard.denied) return guard.denied;
        const c = guard.course;

        return [
            { section: 'titleHero', title: `Edit Kursus — ${c.title}` },
            {
                section: 'article',
                leftCol: {
                    subtitle: '',
                    lines: [
                        'link:&laquo; Kembali ke Kursusku:dosen',
                        '---',
                        `<button class="slcBtn" onclick="dosenAction.hapusKursus('${slug}')">Hapus Kursus Ini</button>`
                    ]
                },
                rightCol: {
                    subtitle: 'Detail Kursus',
                    fields: [
                        { type: 'text', name: 'title', label: 'Judul Kursus', value: c.title, required: true },
                        { type: 'textarea', name: 'description', label: 'Deskripsi', rows: 3, value: c.description || '' },
                        { type: 'text', name: 'price', label: 'Harga', value: c.price },
                        { type: 'text', name: 'period', label: 'Periode Buka', value: c.period }
                    ],
                    submitText: 'Simpan Perubahan',
                    onSubmit: `event.preventDefault(); dosenAction.submitEditKursus(this,'${slug}');`,
                    lines: ['form:']
                }
            }
        ];
    },

    formTambahKursus() {
        return [
            { section: 'titleHero', title: 'Tambah Kursus Baru' },
            {
                section: 'article',
                leftCol: { subtitle: '', lines: ['link:&laquo; Kembali ke Kursusku:dosen'] },
                rightCol: {
                    subtitle: 'Detail Kursus',
                    fields: [
                        { type: 'text', name: 'slug', label: 'Slug (unik, huruf kecil tanpa spasi)',
                          required: true, placeholder: 'contoh: basis-data' },
                        { type: 'text', name: 'title', label: 'Judul Kursus', required: true },
                        { type: 'textarea', name: 'description', label: 'Deskripsi', rows: 3 },
                        { type: 'text', name: 'price', label: 'Harga', value: 'Gratis' },
                        { type: 'text', name: 'period', label: 'Periode Buka', value: 'Self-paced' }
                    ],
                    submitText: 'Simpan Kursus',
                    onSubmit: 'event.preventDefault(); dosenAction.submitTambahKursus(this);',
                    lines: ['form:']
                }
            }
        ];
    },

    listModul(slug, user) {
        const guard = requireOwnedCourse(slug, user);
        if (guard.denied) return guard.denied;
        const c = guard.course;

        const rows = courseSvc.categoriesOf(slug).flatMap(cat => (cat.items || []).map(i => ({
            Kategori: cat.name,
            Materi: i.title,
            Aksi: courseSvc.isEditableMaterial(i.id)
                ? `<a href="javascript:void(0)" onclick="dosenAction.bukaEditMateri('${slug}','${i.id}')">Edit</a> ·
                   <a href="javascript:void(0)" onclick="dosenAction.hapusMateri('${slug}','${i.id}')">Hapus</a>`
                : `<span style="color:var(--aColor)">Bawaan Sistem</span>`
        })));

        return [
            { section: 'titleHero', title: `Modul — ${c.title}` },
            {
                section: 'article',
                leftCol: {
                    subtitle: 'Aksi',
                    // [DRAWER] Tambah/Edit Materi dibuka lewat drawer kanan —
                    // lihat dosenAction.bukaTambahMateri/bukaEditMateri di bawah.
                    lines: [
                        `<button type="button" class="slcBtn" onclick="dosenAction.bukaTambahMateri('${slug}')">+ Tambah Materi (PDF/YouTube)</button>`,
                        '---',
                        'link:&laquo; Kembali ke Kursusku:dosen'
                    ]
                },
                rightCol: {
                    subtitle: 'Daftar Materi',
                    lines: rows.length ? [`table:${JSON.stringify(rows)}`] : ['Belum ada materi.']
                }
            }
        ];
    },

    formTambahMateri(slug, user) {
        const guard = requireOwnedCourse(slug, user);
        if (guard.denied) return guard.denied;
        const c = guard.course;

        return [
            { section: 'titleHero', title: `Tambah Materi — ${c.title}` },
            {
                section: 'article',
                leftCol: { subtitle: '', lines: [`link:&laquo; Kembali ke Modul:dosen/modul:${slug}`] },
                rightCol: {
                    subtitle: 'Materi Baru',
                    fields: [
                        { type: 'text', name: 'title', label: 'Judul Materi', required: true },
                        { type: 'select', name: 'type', label: 'Jenis', value: 'pdf',
                          options: [
                              { value: 'pdf', label: 'Dokumen PDF (link)' },
                              { value: 'youtube', label: 'Video YouTube' }
                          ] },
                        { type: 'text', name: 'url', label: 'Link PDF / ID Video YouTube', required: true,
                          placeholder: 'https://.../modul.pdf  atau  dQw4w9WgXcQ' }
                    ],
                    submitText: 'Simpan Materi',
                    onSubmit: `event.preventDefault(); dosenAction.submitTambahMateri(this,'${slug}');`,
                    lines: ['form:']
                }
            }
        ];
    },

    formEditMateri(slug, itemId, user) {
        const guard = requireOwnedCourse(slug, user);
        if (guard.denied) return guard.denied;
        const c    = guard.course;
        const item = courseSvc.getMaterial(slug, itemId);
        if (!item) return [{ section: 'titleHero', title: 'Materi Tidak Ditemukan' }];

        return [
            { section: 'titleHero', title: `Edit Materi — ${c.title}` },
            {
                section: 'article',
                leftCol: { subtitle: '', lines: [`link:&laquo; Kembali ke Modul:dosen/modul:${slug}`] },
                rightCol: {
                    subtitle: 'Edit Materi',
                    fields: [
                        { type: 'text', name: 'title', label: 'Judul Materi', value: item.title, required: true },
                        { type: 'select', name: 'type', label: 'Jenis', value: item.type,
                          options: [
                              { value: 'pdf', label: 'Dokumen PDF (link)' },
                              { value: 'youtube', label: 'Video YouTube' }
                          ] },
                        { type: 'text', name: 'url', label: 'Link PDF / ID Video YouTube', value: item.url, required: true,
                          placeholder: 'https://.../modul.pdf  atau  dQw4w9WgXcQ' }
                    ],
                    submitText: 'Simpan Perubahan',
                    onSubmit: `event.preventDefault(); dosenAction.submitEditMateri(this,'${slug}','${itemId}');`,
                    lines: ['form:']
                }
            }
        ];
    },

    formPeriode(slug, user) {
        const guard = requireOwnedCourse(slug, user);
        if (guard.denied) return guard.denied;
        const c = guard.course;

        return [
            { section: 'titleHero', title: `Update Periode — ${c.title}` },
            {
                section: 'article',
                leftCol: { subtitle: '', lines: ['link:&laquo; Kembali ke Kursusku:dosen'] },
                rightCol: {
                    subtitle: 'Periode Buka Kursus',
                    fields: [
                        { type: 'text', name: 'period', label: 'Periode', value: c.period, required: true,
                          placeholder: 'contoh: 1 Sep – 30 Nov 2026' }
                    ],
                    submitText: 'Simpan',
                    onSubmit: `event.preventDefault(); dosenAction.submitPeriode(this,'${slug}');`,
                    lines: ['form:']
                }
            }
        ];
    },

    listPeserta(slug, user) {
        const guard = requireOwnedCourse(slug, user);
        if (guard.denied) return guard.denied;
        const c = guard.course;

        const rows = courseSvc.participantsOf(slug);

        return [
            { section: 'titleHero', title: `Peserta — ${c.title}` },
            {
                section: 'article',
                leftCol: { subtitle: '', lines: ['link:&laquo; Kembali ke Kursusku:dosen'] },
                rightCol: {
                    subtitle: 'Daftar Peserta & Progress',
                    lines: rows.length
                        ? [`table:${JSON.stringify(rows)}`]
                        : ['Belum ada peserta yang tercatat login & belajar pada kursus ini.']
                }
            }
        ];
    }
};

const dosenAction = {
    // [DRAWER] Pembuka form tambah/edit lewat drawer kanan — mengambil ULANG
    // konfigurasi field dari dosenView.formXxx yang SUDAH ADA lewat
    // web.openFormFromPage (script.js), supaya definisi field TIDAK
    // dituliskan dua kali (sekali untuk halaman, sekali untuk drawer).
    bukaTambahKursus() {
        web.openFormFromPage(dosenView.formTambahKursus());
    },
    bukaEditKursus(slug) {
        web.openFormFromPage(dosenView.formEditKursus(slug, auth.currentUser()));
    },
    bukaTambahMateri(slug) {
        web.openFormFromPage(dosenView.formTambahMateri(slug, auth.currentUser()));
    },
    bukaEditMateri(slug, itemId) {
        web.openFormFromPage(dosenView.formEditMateri(slug, itemId, auth.currentUser()));
    },

    submitTambahKursus(form) {
        const user = auth.currentUser();
        const slug = form.querySelector('[name="slug"]').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
        if (!slug) { alert('Slug tidak boleh kosong.'); return; }
        if (courseSvc.get(slug)) { alert('Slug sudah dipakai, gunakan slug lain.'); return; }
        if (web.routes[slug]) { alert('Slug tidak boleh sama dengan halaman sistem, gunakan slug lain.'); return; }

        courseSvc.create({
            slug,
            title: form.querySelector('[name="title"]').value.trim(),
            description: form.querySelector('[name="description"]').value.trim(),
            price: form.querySelector('[name="price"]').value.trim() || 'Gratis',
            period: form.querySelector('[name="period"]').value.trim() || 'Self-paced',
            instructorUsername: user.username,
            instructorName: user.name
        });
        courseSvc.registerRoutes(); // supaya slug baru langsung bisa dibuka tanpa reload

        alert('Kursus berhasil dibuat.');
        web.navigate('dosen');
    },

    submitTambahMateri(form, slug) {
        courseSvc.addMaterial(slug, {
            title: form.querySelector('[name="title"]').value.trim(),
            type: form.querySelector('[name="type"]').value,
            url: form.querySelector('[name="url"]').value.trim()
        });

        alert('Materi berhasil ditambahkan.');
        web.navigate('dosen/modul:' + slug);
    },

    submitPeriode(form, slug) {
        courseSvc.update(slug, { period: form.querySelector('[name="period"]').value.trim() });
        alert('Periode berhasil diperbarui.');
        web.navigate('dosen');
    },

    submitEditMateri(form, slug, itemId) {
        courseSvc.updateMaterial(slug, itemId, {
            title: form.querySelector('[name="title"]').value.trim(),
            type: form.querySelector('[name="type"]').value,
            url: form.querySelector('[name="url"]').value.trim()
        });
        alert('Materi berhasil diperbarui.');
        web.navigate('dosen/modul:' + slug);
    },

    hapusMateri(slug, itemId) {
        if (!confirm('Hapus materi ini? Tindakan tidak bisa dibatalkan.')) return;
        courseSvc.removeMaterial(slug, itemId);
        alert('Materi berhasil dihapus.');
        web.navigate('dosen/modul:' + slug);
    },

    submitEditKursus(form, slug) {
        courseSvc.update(slug, {
            title: form.querySelector('[name="title"]').value.trim(),
            description: form.querySelector('[name="description"]').value.trim(),
            price: form.querySelector('[name="price"]').value.trim() || 'Gratis',
            period: form.querySelector('[name="period"]').value.trim() || 'Self-paced'
        });
        alert('Kursus berhasil diperbarui.');
        web.navigate('dosen');
    },

    hapusKursus(slug) {
        if (!confirm('Hapus kursus ini beserta seluruh materinya? Tindakan tidak bisa dibatalkan.')) return;
        courseSvc.remove(slug);
        // Kuis milik kursus ini (lihat quiz.js) ikut dihapus, kalau ada.
        if (typeof quizSvc !== 'undefined') quizSvc.remove(slug);
        alert('Kursus berhasil dihapus.');
        web.navigate('dosen');
    }
};

web.resolveDosenDashboard = function (subParam) {
    const user = auth.currentUser();

    if (!user) {
        return [
            { section: 'titleHero', title: 'Dashboard Dosen', description: 'Silakan masuk terlebih dahulu.' },
            { section: 'article',
              leftCol: { subtitle: '', lines: ['link:Ke Halaman Masuk:login'] },
              rightCol: { subtitle: '', lines: [] } }
        ];
    }
    if (user.role !== 'dosen' && user.role !== 'admin') {
        return [{ section: 'titleHero', title: 'Akses Ditolak',
                   description: 'Halaman ini khusus untuk peran Dosen.' }];
    }

    // [DEDUP] param digabung dari SEMUA bagian setelah 'aksi:' (bukan cuma
    // bagian pertama), supaya aksi yang butuh 2 parameter (mis. slug +
    // id materi pada 'editmateri') tetap bisa lewat pola URL yang sama
    // "dosen/aksi:param1:param2" tanpa mengubah web.navigate() di script.js.
    const [action, ...paramParts] = (subParam || '').split(':');
    const param = paramParts.join(':');

    if (action === 'tambahkursus') return dosenView.formTambahKursus();
    if (action === 'modul')        return dosenView.listModul(param, user);
    if (action === 'tambahmateri') return dosenView.formTambahMateri(param, user);
    if (action === 'editmateri')   return dosenView.formEditMateri(paramParts[0], paramParts[1], user);
    if (action === 'periode')      return dosenView.formPeriode(param, user);
    if (action === 'peserta')      return dosenView.listPeserta(param, user);
    if (action === 'edit')         return dosenView.formEditKursus(param, user);
    // 'kuis' didaftarkan oleh quiz.js (dosenView.formKelolaKuis) — dipanggil
    // lewat properti supaya dosen.js TIDAK perlu tahu isi quiz.js sama sekali.
    if (action === 'kuis' && typeof dosenView.formKelolaKuis === 'function')
        return dosenView.formKelolaKuis(param, user);

    return dosenView.kursusku(user);
};
