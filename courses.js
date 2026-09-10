// ============================================================
// courseSvc — Penggabung kursus STATIS (var `courses` di pages/learn.js
// + pages[slug].categories) dengan kursus/materi TAMBAHAN dari dosen
// (disimpan lewat db.js, tabel 'courses').
// ============================================================
// VERSI ASYNC (D1): db.js sekarang memanggil Worker API lewat fetch,
// jadi SEMUA method courseSvc yang menyentuh db.* di sini ikut jadi
// `async function` dan setiap pemanggilan db.* diberi `await`. Method
// murni (tidak menyentuh db) — isEditableMaterial, _parseMaterialLine,
// isOwner — TETAP sinkron seperti semula.
//
// Efek berantai: 2 titik override di bawah (components.courseCatalog &
// web.resolveLearningModule) ikut jadi async karena keduanya memanggil
// courseSvc. Ini artinya script.js (web.navigate & ui.render) WAJIB
// meng-`await` hasilnya sebelum merender — lihat catatan companion
// patch script.js yang menyertai file ini.
// ============================================================
const courseSvc = {
    /** Daftar kursus gabungan: statis (courses) + override/tambahan (db). */
    async list() {
        const staticList = (typeof courses !== 'undefined') ? courses : [];
        const dbList = await db.all('courses');

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

    async get(slug) {
        const list = await this.list();
        return list.find(c => c.slug === slug) || null;
    },

    /** Kategori/materi gabungan suatu kursus — statis (pages[slug]) + tambahan dosen (db). */
    async categoriesOf(slug) {
        const staticCats = (pages[slug] && Array.isArray(pages[slug].categories)) ? pages[slug].categories : [];
        const dbCourse = await db.find('courses', c => c.slug === slug);
        const extraCats = (dbCourse && Array.isArray(dbCourse.categories)) ? dbCourse.categories : [];
        return [...staticCats, ...extraCats];
    },

    /** Buat kursus baru milik dosen yang sedang login. */
    async create({ slug, title, description, price, period, instructorUsername, instructorName }) {
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
    async update(slug, patch) {
        return db.upsertBy('courses', c => c.slug === slug, { slug, ...patch });
    },

    /** Tambah 1 materi (pdf/youtube) ke kategori "Materi Tambahan" milik sebuah kursus. */
    async addMaterial(slug, { title, type, url }) {
        let rec = await db.find('courses', c => c.slug === slug);
        if (!rec) rec = await db.insert('courses', { slug, categories: [] });

        const categories = Array.isArray(rec.categories) ? [...rec.categories] : [];
        let cat = categories.find(c => c.name === 'Materi Tambahan');
        if (!cat) { cat = { name: 'Materi Tambahan', items: [] }; categories.push(cat); }

        const line = type === 'youtube' ? `video:youtube:${url}` : `pdf:${url}`;
        cat.items = [...cat.items, {
            id: 'materi_' + Date.now().toString(36),
            title,
            lines: [line]
        }];

        await db.update('courses', rec.id, { categories });
        return rec;
    },

    /** Materi tambahan (id 'materi_...') boleh diedit/dihapus dosen; materi bawaan (statis) tidak.
     *  (murni, tidak menyentuh db — tetap sinkron) */
    isEditableMaterial(itemId) {
        return typeof itemId === 'string' && itemId.startsWith('materi_');
    },

    /** Balik 1 baris `lines` materi tambahan jadi {type,url} — kebalikan dari format di addMaterial().
     *  (murni, tidak menyentuh db — tetap sinkron) */
    _parseMaterialLine(item) {
        const line = (item.lines || [])[0] || '';
        if (line.startsWith('video:youtube:')) return { type: 'youtube', url: line.slice('video:youtube:'.length) };
        return { type: 'pdf', url: line.startsWith('pdf:') ? line.slice('pdf:'.length) : '' };
    },

    /** Ambil 1 materi tambahan (untuk pre-isi form edit). */
    async getMaterial(slug, itemId) {
        const rec  = await db.find('courses', c => c.slug === slug);
        const cat  = (rec?.categories || []).find(c => c.name === 'Materi Tambahan');
        const item = (cat?.items || []).find(i => i.id === itemId);
        return item ? { ...item, ...this._parseMaterialLine(item) } : null;
    },

    /** Edit 1 materi tambahan milik sebuah kursus. */
    async updateMaterial(slug, itemId, { title, type, url }) {
        const rec = await db.find('courses', c => c.slug === slug);
        if (!rec) return null;
        const categories = (rec.categories || []).map(cat => cat.name !== 'Materi Tambahan' ? cat : {
            ...cat,
            items: cat.items.map(i => i.id !== itemId ? i : {
                ...i, title, lines: [type === 'youtube' ? `video:youtube:${url}` : `pdf:${url}`]
            })
        });
        await db.update('courses', rec.id, { categories });
        return rec;
    },

    /** Hapus 1 materi tambahan milik sebuah kursus. */
    async removeMaterial(slug, itemId) {
        const rec = await db.find('courses', c => c.slug === slug);
        if (!rec) return null;
        const categories = (rec.categories || []).map(cat => cat.name !== 'Materi Tambahan' ? cat : {
            ...cat, items: cat.items.filter(i => i.id !== itemId)
        });
        await db.update('courses', rec.id, { categories });
        return rec;
    },

    /**
     * Daftarkan slug kursus TAMBAHAN (tabel db 'courses') ke web.routes,
     * memakai resolver generik 'resolveLearningModule' — persis seperti
     * kursus statis (rpl/pbo/robotika). Tanpa ini, web.navigate(slug)
     * kursus baru jatuh ke resolveContent() (tidak kenal slug → Home).
     * Dipanggil sekali saat file dimuat (kursus lama dari sesi sebelumnya)
     * + tiap kali dosen submit kursus baru, supaya langsung bisa dibuka
     * tanpa reload halaman. Sekarang async karena db.all() menunggu API —
     * lihat pemanggilan di titik akhir file ini (`await courseSvc.registerRoutes()`).
     */
    async registerRoutes() {
        const rows = await db.all('courses');
        rows.forEach(c => {
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
    async remove(slug) {
        const isStatic = (typeof courses !== 'undefined') && courses.some(c => c.slug === slug);
        if (isStatic) {
            await db.upsertBy('courses', c => c.slug === slug, { slug, deleted: true });
        } else {
            const rec = await db.find('courses', c => c.slug === slug);
            if (rec) await db.remove('courses', rec.id);
        }
        return true;
    },

    /** Apakah `user` adalah pemilik/pengampu kursus ini? (admin selalu ya)
     *  (murni, tidak menyentuh db — tetap sinkron) */
    isOwner(course, user) {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return course.instructorUsername === user.username || course.instructor === user.name;
    },

    async myCourses(user) {
        const list = await this.list();
        return list.filter(c => this.isOwner(c, user));
    },

    /** Daftar peserta (nama + progress) suatu kursus, berdasarkan tabel db 'progress'.
     *  Pakai Promise.all karena tiap baris butuh await db.find('users', ...) sendiri
     *  — .map() biasa tidak bisa await, jadi map dibuat async lalu di-Promise.all-kan. */
    async participantsOf(slug) {
        const cats  = await this.categoriesOf(slug);
        const total = cats.flatMap(c => c.items || []).length;
        const rows  = await db.query('progress', p => p.slug === slug);

        return Promise.all(rows.map(async p => {
            const u = await db.find('users', u => u.username === p.username);
            const viewed = (p.viewed || []).length;
            return {
                Nama: u ? u.name : p.username,
                Progress: total ? Math.round((viewed / total) * 100) + '%' : '0%',
                'Modul Dilihat': `${viewed}/${total}`
            };
        }));
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
    async progressOf(username, slug) {
        const cats     = await this.categoriesOf(slug);
        const allItems = cats.flatMap(cat => cat.items || []);
        const total    = allItems.length;
        const row      = await db.find('progress', p => p.username === username && p.slug === slug);
        const viewed   = row ? (row.viewed || []).filter(id => allItems.some(i => i.id === id)).length : 0;
        // Kursus tanpa modul sama sekali dianggap 100% (tidak ada yang perlu
        // dituntaskan), supaya kuisnya tidak terkunci selamanya.
        return { viewed, total, pct: total ? Math.round((viewed / total) * 100) : 100 };
    }
};

// ============================================================
// OVERRIDE 1 — components.courseCatalog (ASYNC)
// Sama seperti versi asli di script.js, hanya daftar kursus & jumlah
// materinya sekarang diambil lewat courseSvc (async) supaya kursus
// buatan dosen ikut tampil. ui.render (script.js, lihat companion
// patch) HARUS meng-await hasil komponen sebelum menyisipkannya ke
// innerHTML, karena fungsi ini sekarang mengembalikan Promise<string>.
// ============================================================
components.courseCatalog = async (d) => {
    const list = await courseSvc.list();
    const cards = await Promise.all(list.map(async c => {
        const materiCount = (await courseSvc.categoriesOf(c.slug)).flatMap(cat => cat.items || []).length;
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
    }));

    return `
    <div class="row page4">
    <div class="artikel">
            ${d.title ? `<h2>${d.title}</h2>` : ''}
            ${d.description ? `<p>${d.description}</p>` : ''}
            <p class="course-count">${list.length} kursus tersedia</p>
            <div class="course-grid">
                ${cards.join('')}
                </div>
                </div>
        </div>`;
};

// ============================================================
// OVERRIDE 2 — web.resolveLearningModule (ASYNC)
// Sama seperti versi asli di script.js, ditambah sumber materi lewat
// courseSvc.categoriesOf() (gabungan statis + dosen). Progress belajar
// TIDAK LAGI ditulis ke localStorage 'slsProgress' (key global, tercampur
// antar akun peserta pada browser yang sama) — satu-satunya sumber
// kebenaran sekarang tabel db 'progress' yang sudah per-akun (kolom
// `username`), dibaca oleh web.resolveDashboard (override di auth.js).
// 'slsLastModule' tetap dipakai sbg cache ringan, tapi key-nya di-scope
// per akun lewat auth.userKey() (lihat auth.js) — bukan lagi global.
//
// web.navigate() (script.js) memanggil resolver lewat
// `this[resolverName](subParam, targetSlug)` — karena fungsi ini sekarang
// async, navigate WAJIB `await` hasilnya (lihat companion patch script.js).
// ============================================================
web.resolveLearningModule = async function (id, slug = 'rpl') {
    const courseMeta = await courseSvc.get(slug);

    // Kursus tidak ada / sudah dihapus (lihat courseSvc.remove) → tolak
    // di sini juga, supaya URL langsung (?slug) tidak lagi bisa membuka
    // konten kursus yang sudah dihapus dosen/admin.
    if (!courseMeta) {
        return [{ section: 'titleHero', title: 'Kursus Tidak Ditemukan',
                   description: 'Kursus ini tidak tersedia atau sudah dihapus.' }];
    }

    const categories = await courseSvc.categoriesOf(slug);
    const allItems   = categories.flatMap(cat => cat.items || []);
    const defaultId  = allItems[0]?.id || '';
    const activeId   = id || defaultId;
    const exists     = allItems.some(i => i.id === activeId);

    if (exists) {
        const user = auth.currentUser();
        if (user) {
            localStorage.setItem(auth.userKey('slsLastModule'), activeId);

            const row = await db.find('progress', p => p.username === user.username && p.slug === slug);
            const viewed = row ? Array.from(new Set([...(row.viewed || []), activeId])) : [activeId];
            if (row) await db.update('progress', row.id, { viewed, lastId: activeId });
            else await db.insert('progress', { username: user.username, slug, viewed, lastId: activeId });
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
// Async top-level call (dibungkus IIFE) karena file ini bukan module —
// `await` di top level tidak tersedia di skrip biasa.
(async () => { await courseSvc.registerRoutes(); })();
