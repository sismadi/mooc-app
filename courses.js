// ============================================================
// courseSvc — Penggabung kursus STATIS (var `courses` di pages/learn.js
// + pages[slug].categories) dengan kursus/materi TAMBAHAN dari dosen
// (disimpan lewat db.js, tabel 'courses').
// ============================================================
// Kenapa perlu ini: pages/*.js dimuat sebagai file statis (lihat
// loadPageScripts di dataset.js), jadi dosen tidak bisa "menambah file
// pages/xxx.js" saat runtime. Kursus & materi baru buatan dosen karena
// itu disimpan di db, lalu digabung di sini setiap kali dibutuhkan.
//
// Modul ini TIDAK mengubah script.js. Dua titik yang butuh tahu soal
// kursus dinamis (components.courseCatalog & web.resolveLearningModule)
// di-override (ditimpa) di bagian bawah file ini — isinya sengaja dibuat
// sedekat mungkin dengan versi asli di script.js, hanya sumber datanya
// yang diganti jadi lewat courseSvc.
// ============================================================
const courseSvc = {
    /** Daftar kursus gabungan: statis (courses) + override/tambahan (db). */
    list() {
        const staticList = (typeof courses !== 'undefined') ? courses : [];
        const dbList = db.all('courses');

        const merged = staticList.map(c => {
            const override = dbList.find(d => d.slug === c.slug);
            return override ? { ...c, ...override } : { ...c };
        });

        dbList.forEach(d => {
            if (!merged.some(m => m.slug === d.slug)) merged.push({ ...d });
        });

        // Kursus yang dihapus (lihat remove()) disaring di sini — satu-satunya
        // titik yang menentukan "kursus mana yang tampil", jadi katalog,
        // dashboard dosen/admin & routing otomatis konsisten tanpa disentuh
        // satu-satu.
        return merged.filter(c => !c.deleted);
    },

    get(slug) {
        return this.list().find(c => c.slug === slug) || null;
    },

    /** Kategori/materi gabungan suatu kursus — statis (pages[slug]) + tambahan dosen (db). */
    categoriesOf(slug) {
        const staticCats = (pages[slug] && Array.isArray(pages[slug].categories)) ? pages[slug].categories : [];
        const dbCourse = db.find('courses', c => c.slug === slug);
        const extraCats = (dbCourse && Array.isArray(dbCourse.categories)) ? dbCourse.categories : [];
        return [...staticCats, ...extraCats];
    },

    /** Buat kursus baru milik dosen yang sedang login. */
    create({ slug, title, description, price, period, instructorUsername, instructorName }) {
        return db.insert('courses', {
            slug,
            title,
            description: description || '',
            price: price || 'Gratis',
            period: period || 'Self-paced',
            instructor: instructorName,
            instructorUsername,
            categories: []
        });
    },

    /** Update field kursus (mis. periode buka) — jalan utk kursus statis maupun buatan dosen. */
    update(slug, patch) {
        return db.upsertBy('courses', c => c.slug === slug, { slug, ...patch });
    },

    /** Tambah 1 materi (pdf/youtube) ke kategori "Materi Tambahan" milik sebuah kursus. */
    addMaterial(slug, { title, type, url }) {
        let rec = db.find('courses', c => c.slug === slug);
        if (!rec) rec = db.insert('courses', { slug, categories: [] });

        const categories = Array.isArray(rec.categories) ? [...rec.categories] : [];
        let cat = categories.find(c => c.name === 'Materi Tambahan');
        if (!cat) { cat = { name: 'Materi Tambahan', items: [] }; categories.push(cat); }

        const line = type === 'youtube' ? `video:youtube:${url}` : `pdf:${url}`;
        cat.items = [...cat.items, {
            id: 'materi_' + Date.now().toString(36),
            title,
            lines: [line]
        }];

        db.update('courses', rec.id, { categories });
        return rec;
    },

    /** Materi tambahan (id 'materi_...') boleh diedit/dihapus dosen; materi bawaan (statis) tidak. */
    isEditableMaterial(itemId) {
        return typeof itemId === 'string' && itemId.startsWith('materi_');
    },

    /** Balik 1 baris `lines` materi tambahan jadi {type,url} — kebalikan dari format di addMaterial(). */
    _parseMaterialLine(item) {
        const line = (item.lines || [])[0] || '';
        if (line.startsWith('video:youtube:')) return { type: 'youtube', url: line.slice('video:youtube:'.length) };
        return { type: 'pdf', url: line.startsWith('pdf:') ? line.slice('pdf:'.length) : '' };
    },

    /** Ambil 1 materi tambahan (untuk pre-isi form edit). */
    getMaterial(slug, itemId) {
        const rec  = db.find('courses', c => c.slug === slug);
        const cat  = (rec?.categories || []).find(c => c.name === 'Materi Tambahan');
        const item = (cat?.items || []).find(i => i.id === itemId);
        return item ? { ...item, ...this._parseMaterialLine(item) } : null;
    },

    /** Edit 1 materi tambahan milik sebuah kursus. */
    updateMaterial(slug, itemId, { title, type, url }) {
        const rec = db.find('courses', c => c.slug === slug);
        if (!rec) return null;
        const categories = (rec.categories || []).map(cat => cat.name !== 'Materi Tambahan' ? cat : {
            ...cat,
            items: cat.items.map(i => i.id !== itemId ? i : {
                ...i, title, lines: [type === 'youtube' ? `video:youtube:${url}` : `pdf:${url}`]
            })
        });
        db.update('courses', rec.id, { categories });
        return rec;
    },

    /** Hapus 1 materi tambahan milik sebuah kursus. */
    removeMaterial(slug, itemId) {
        const rec = db.find('courses', c => c.slug === slug);
        if (!rec) return null;
        const categories = (rec.categories || []).map(cat => cat.name !== 'Materi Tambahan' ? cat : {
            ...cat, items: cat.items.filter(i => i.id !== itemId)
        });
        db.update('courses', rec.id, { categories });
        return rec;
    },

    /**
     * Daftarkan slug kursus TAMBAHAN (tabel db 'courses') ke web.routes,
     * memakai resolver generik 'resolveLearningModule' — persis seperti
     * kursus statis (rpl/pbo/robotika). Tanpa ini, web.navigate(slug)
     * kursus baru jatuh ke resolveContent() (tidak kenal slug → Home).
     * Dipanggil sekali saat file dimuat (kursus lama dari sesi sebelumnya)
     * + tiap kali dosen submit kursus baru, supaya langsung bisa dibuka
     * tanpa reload halaman.
     */
    registerRoutes() {
        db.all('courses').forEach(c => {
            if (c.slug && !web.routes[c.slug]) web.routes[c.slug] = 'resolveLearningModule';
        });
    },

    /**
     * Hapus kursus. Kursus BUATAN DOSEN (murni ada di tabel db) langsung
     * dihapus barisnya. Kursus STATIS bawaan (rpl/pbo/robotika, dari
     * pages/learn.js) tidak bisa dihapus dari array-nya (itu kode, bukan
     * data), jadi ditandai `deleted: true` lewat mekanisme override yang
     * sama dipakai update() — list() di atas yang menyaringnya keluar dari
     * semua tampilan (katalog, dashboard dosen & admin, routing).
     */
    remove(slug) {
        const isStatic = (typeof courses !== 'undefined') && courses.some(c => c.slug === slug);
        if (isStatic) {
            db.upsertBy('courses', c => c.slug === slug, { slug, deleted: true });
        } else {
            const rec = db.find('courses', c => c.slug === slug);
            if (rec) db.remove('courses', rec.id);
        }
        return true;
    },

    /** Apakah `user` adalah pemilik/pengampu kursus ini? (admin selalu ya) */
    isOwner(course, user) {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return course.instructorUsername === user.username || course.instructor === user.name;
    },

    myCourses(user) {
        return this.list().filter(c => this.isOwner(c, user));
    },

    /** Daftar peserta (nama + progress) suatu kursus, berdasarkan tabel db 'progress'. */
    participantsOf(slug) {
        const total = this.categoriesOf(slug).flatMap(c => c.items || []).length;
        return db.query('progress', p => p.slug === slug).map(p => {
            const u = db.find('users', u => u.username === p.username);
            const viewed = (p.viewed || []).length;
            return {
                Nama: u ? u.name : p.username,
                Progress: total ? Math.round((viewed / total) * 100) + '%' : '0%',
                'Modul Dilihat': `${viewed}/${total}`
            };
        });
    },

    /**
     * Progress belajar 1 akun pada 1 kursus: { viewed, total, pct }.
     * SATU-SATUNYA titik hitung persentase progress per akun (dipakai oleh
     * Dashboard di auth.js, gerbang "kuis butuh progress 100%" & daftar
     * kuis di quiz.js) — supaya angka yang ditampilkan di mana pun selalu
     * konsisten & tidak dihitung ulang dengan cara berbeda-beda di tiap
     * file. Modul yang sudah dihapus dosen otomatis tidak lagi dihitung
     * sebagai "viewed" (sama seperti resolveDashboard sebelumnya).
     */
    progressOf(username, slug) {
        const allItems = this.categoriesOf(slug).flatMap(cat => cat.items || []);
        const total    = allItems.length;
        const row      = db.find('progress', p => p.username === username && p.slug === slug);
        const viewed   = row ? (row.viewed || []).filter(id => allItems.some(i => i.id === id)).length : 0;
        // Kursus tanpa modul sama sekali dianggap 100% (tidak ada yang perlu
        // dituntaskan), supaya kuisnya tidak terkunci selamanya.
        return { viewed, total, pct: total ? Math.round((viewed / total) * 100) : 100 };
    }
};

// ============================================================
// OVERRIDE 1 — components.courseCatalog
// Sama seperti versi asli di script.js, hanya daftar kursus & jumlah
// materinya sekarang diambil lewat courseSvc supaya kursus buatan dosen
// ikut tampil.
// ============================================================
components.courseCatalog = (d) => {
    const list = courseSvc.list();
    return `
    <div class="row page4">
    <div class="artikel">
            ${d.title ? `<h2>${d.title}</h2>` : ''}
            ${d.description ? `<p>${d.description}</p>` : ''}
            <p class="course-count">${list.length} kursus tersedia</p>
            <div class="course-grid">
                ${list.map(c => {
                    const materiCount = courseSvc.categoriesOf(c.slug).flatMap(cat => cat.items || []).length;
                    return `
                    <div class="course-card">
                        <h3>${c.title}</h3>
                        <p>${c.description}</p>
                        <ul class="course-meta">
                            <li><strong>Harga:</strong> ${c.price}</li>
                            <li><strong>Instruktur:</strong> ${c.instructor}</li>
                            <li><strong>Periode:</strong> ${c.period}</li>
                            <li><strong>Materi:</strong> ${materiCount} modul</li>
                        </ul>
                        <a href="javascript:void(0)" class="slcBtn"
                           onclick="web.navigate('${c.slug}')">Enroll</a>
                    </div>`;
                }).join('')}
                </div>
                </div>
        </div>`;
};

// ============================================================
// OVERRIDE 2 — web.resolveLearningModule
// Sama seperti versi asli di script.js, ditambah sumber materi lewat
// courseSvc.categoriesOf() (gabungan statis + dosen). Progress belajar
// TIDAK LAGI ditulis ke localStorage 'slsProgress' (key global, tercampur
// antar akun peserta pada browser yang sama) — satu-satunya sumber
// kebenaran sekarang tabel db 'progress' yang sudah per-akun (kolom
// `username`), dibaca oleh web.resolveDashboard (override di auth.js).
// 'slsLastModule' tetap dipakai sbg cache ringan, tapi key-nya di-scope
// per akun lewat auth.userKey() (lihat auth.js) — bukan lagi global.
// ============================================================
web.resolveLearningModule = function (id, slug = 'rpl') {
    const courseMeta = courseSvc.get(slug);

    // Kursus tidak ada / sudah dihapus (lihat courseSvc.remove) → tolak
    // di sini juga, supaya URL langsung (?slug) tidak lagi bisa membuka
    // konten kursus yang sudah dihapus dosen/admin.
    if (!courseMeta) {
        return [{ section: 'titleHero', title: 'Kursus Tidak Ditemukan',
                   description: 'Kursus ini tidak tersedia atau sudah dihapus.' }];
    }

    const categories = courseSvc.categoriesOf(slug);
    const allItems   = categories.flatMap(cat => cat.items || []);
    const defaultId  = allItems[0]?.id || '';
    const activeId   = id || defaultId;
    const exists     = allItems.some(i => i.id === activeId);

    if (exists) {
        const user = auth.currentUser();
        if (user) {
            localStorage.setItem(auth.userKey('slsLastModule'), activeId);

            const row = db.find('progress', p => p.username === user.username && p.slug === slug);
            const viewed = row ? Array.from(new Set([...(row.viewed || []), activeId])) : [activeId];
            if (row) db.update('progress', row.id, { viewed, lastId: activeId });
            else db.insert('progress', { username: user.username, slug, viewed, lastId: activeId });
        }
    }

    return [
        {
            section: 'titleHero',
            title: exists ? (courseMeta?.title || 'Learning Module') : 'Modul Tidak Ditemukan'
        },
        {
            section: 'learningModule',
            activeId: exists ? activeId : defaultId,
            slug: slug,
            data: { categories }
        }
    ];
};

// Daftarkan route utk kursus tambahan yang sudah ada dari sesi sebelumnya
// (lihat courseSvc.registerRoutes di atas untuk penjelasan lengkap).
courseSvc.registerRoutes();
