// ============================================================
// QUIZ — Kuis per KURSUS (bukan lagi 1 kuis global untuk RPL saja).
// ============================================================
// Tujuan file ini: menyambungkan akun (db 'users'), kursus (courseSvc),
// kuis, dan sertifikat (pages.certificates) supaya Dashboard menampilkan
// info yang realistis & terintegrasi — bukan angka lepas seperti sebelumnya.
//
// Skema tabel baru di db.js (tanpa mengubah db.js — db.js sudah generik):
//   quizzes       : { id, slug, title, passingGrade, password, questions }
//                   -> SATU baris per kursus (kunci: slug), questions
//                      berformat sama seperti pages/kuis.js lama:
//                      [{ q, options:[...], ans: btoa('jawaban benar') }]
//   quizAttempts  : { id, username, slug, score, date }
//                   -> riwayat pengerjaan, PER AKUN PER KURSUS.
//
// Halaman publik '/?kuis' (dulu statis, 1 kuis) sekarang jadi:
//   - '/?kuis'      → daftar semua kuis yang tersedia (lintas kursus)
//   - '/?kuis/slug' → halaman pengerjaan kuis kursus tsb
// memakai ULANG components.quizEngine (script.js), hanya diperluas lewat
// override (persis pola components.courseCatalog di courses.js) supaya
// (a) password kuis boleh dikosongkan, dan (b) submit kuis ikut membawa
// slug kursus — tanpa menyentuh script.js sama sekali.
//
// Pengelolaan soal oleh dosen ("Kelola Kuis" di tiap kursus) ditambahkan
// dengan MENIMPA/menambah properti ke `dosenView` & `dosenAction` (sudah
// dideklarasikan di dosen.js) — bukan mendefinisikan ulang objeknya, jadi
// tidak menduplikasi kode akses/kepemilikan kursus yang sudah ada di sana
// (requireOwnedCourse), sekaligus otomatis ikut menikmati akses admin.
// ============================================================
const quizSvc = {
    of(slug) {
        return db.find('quizzes', q => q.slug === slug);
    },

    upsert(slug, { title, passingGrade, password, questions }) {
        return db.upsertBy('quizzes', q => q.slug === slug, {
            slug,
            title: title || `Kuis ${slug}`,
            passingGrade: Number(passingGrade) || 75,
            password: password || '',
            questions: questions || []
        });
    },

    remove(slug) {
        const rec = this.of(slug);
        if (rec) db.remove('quizzes', rec.id);
        db.query('quizAttempts', a => a.slug === slug).forEach(a => db.remove('quizAttempts', a.id));
        return true;
    },

    lastAttempt(username, slug) {
        const rows = db.query('quizAttempts', a => a.username === username && a.slug === slug);
        return rows.length ? rows[rows.length - 1] : null;
    },

    recordAttempt(username, slug, score) {
        return db.insert('quizAttempts', { username, slug, score, date: new Date().toISOString() });
    }
};

// ============================================================
// certSvc — Sertifikat KUIS, terbit OTOMATIS saat peserta lulus (skor >=
// passingGrade) kuis suatu kursus (lihat web.evaluateQuiz di bawah).
// Tabel db baru 'certificates' : { id, username, name, slug, examTitle,
// score, date } — terpisah dari pages.certificates (dataset statis di
// pages/cert.js) supaya keduanya tidak saling menimpa; digabung kembali
// saat ditampilkan (Dashboard peserta di auth.js, statGrid di admin.js)
// lewat pengecekan `typeof certSvc`. Halaman verifikasi '/?cert/<id>'
// (resolveCertificate, script.js) di-override di bawah supaya ikut
// mengenali kode sertifikat kuis ini.
// ============================================================
const certSvc = {
    /** Kode sertifikat deterministik per akun+kursus, supaya 1 peserta
     *  hanya punya 1 sertifikat per kursus (lulus ulang = update, bukan
     *  dobel baris). */
    codeFor(username, slug) {
        return `SLS-KUIS-${slug}-${username}`.toUpperCase().replace(/[^A-Z0-9-]/g, '-');
    },

    award(user, slug, examTitle, score) {
        const id = this.codeFor(user.username, slug);
        return db.upsertBy('certificates', c => c.id === id, {
            id, username: user.username, name: user.name, slug, examTitle, score,
            date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        });
    },

    of(username) {
        return db.query('certificates', c => c.username === username);
    },

    get(id) {
        return db.find('certificates', c => c.id === id);
    }
};

// --- Seed 1 kuis demo (RPL) — konten sama seperti pages/kuis.js lama,
// supaya kuis contoh yang sudah ada tidak hilang saat migrasi ke model
// per-kursus. Hanya jalan sekali (tabel 'quizzes' kosong). ---
db.seedIfEmpty('quizzes', [
    {
        id: 'quiz_rpl',
        slug: 'rpl',
        title: 'Evaluasi Kompetensi: Rekayasa Perangkat Lunak',
        passingGrade: 75,
        password: 'DonatJS',
        questions: [
            { q: 'Berapakah nilai x dari persamaan 2x + 5 = 13?', options: ['3', '4', '6', '8'], ans: btoa('4') },
            { q: 'Jika 3(x - 2) = x + 10, maka nilai x adalah...', options: ['4', '6', '8', '10'], ans: btoa('8') },
            { q: 'Tentukan penyelesaian dari persamaan 5x - 7 = 2x + 8.', options: ['3', '5', '15', '2'], ans: btoa('5') }
        ]
    }
]);

// ============================================================
// OVERRIDE — components.quizEngine (versi asli di script.js)
// Tambahan: password boleh kosong (langsung terbuka, tanpa layar kunci),
// dan hasil submit ikut membawa `slug` kursus ke web.evaluateQuiz().
// ============================================================
components.quizEngine = (ctx) => {
    const randomized = [...(ctx.questions || [])].sort(() => Math.random() - 0.5);
    const slugArg = ctx.slug ? `, '${ctx.slug}'` : '';

    const lock = ctx.password ? `
        <div id="quiz-lock" class="card-input">
            <p><strong>Ujian Terproteksi.</strong> Masukkan sandi:</p>
            <input type="password" id="quiz-pass-input" style="width:200px">
            <button class="slcBtn" onclick="
                if(web.gebi('quiz-pass-input').value==='${ctx.password}'){
                    web.gebi('quiz-container').classList.remove('hide');
                    web.gebi('quiz-lock').classList.add('hide');
                } else { alert('Salah!'); }
            ">Buka</button>
        </div>` : '';

    return `
        ${lock}
        <form id="quiz-container" class="dynamic-form ${ctx.password ? 'hide' : ''}"
            onsubmit="event.preventDefault(); web.evaluateQuiz(this, ${JSON.stringify(randomized).replace(/"/g, '&quot;')}${slugArg});">
            ${randomized.map((q, i) => `
                <div class="quiz-box">
                    <p><strong>${i + 1}. ${q.q}</strong></p>
                    ${q.options.map(opt =>
                        `<label><input type="radio" name="q${i}" value="${opt}" required> ${opt}</label>`
                    ).join('')}
                </div>`).join('')}
            <button type="submit" class="slcBtn">Kirim</button>
        </form>`;
};

// ============================================================
// OVERRIDE FINAL — web.evaluateQuiz
// Menimpa versi generik (script.js) sekaligus versi lama di auth.js.
// Skor sekarang dicatat PER KURSUS (tabel db 'quizAttempts'), dibaca
// balik oleh resolveDashboard (auth.js) & resolveKuisDashboard di bawah.
// Tambahan: kalau skor >= passingGrade kuis, sertifikat diterbitkan
// otomatis lewat certSvc.award() supaya langsung muncul di Dashboard.
// ============================================================
web.evaluateQuiz = function (form, questions, slug) {
    const score = questions.reduce((acc, q, idx) => {
        const selected = form.querySelector(`input[name="q${idx}"]:checked`);
        return (selected && btoa(selected.value) === q.ans) ? acc + 1 : acc;
    }, 0);
    const finalScore = Number(((score / questions.length) * 100).toFixed(2));

    const user = auth.currentUser();
    const quiz = slug ? quizSvc.of(slug) : null;
    let lulus  = false;

    if (user && slug) {
        quizSvc.recordAttempt(user.username, slug, finalScore);
        lulus = !!quiz && finalScore >= quiz.passingGrade;
        if (lulus) {
            const c = courseSvc.get(slug);
            certSvc.award(user, slug, quiz.title || c?.title || slug, finalScore);
        }
    }

    const gradeInfo = quiz ? ` (Passing Grade: ${quiz.passingGrade})` : '';
    alert(lulus
        ? `Ujian Selesai!\nSkor Anda: ${finalScore}${gradeInfo}\nSelamat, Anda LULUS! Sertifikat sudah tersedia di Dashboard.`
        : `Ujian Selesai!\nSkor Anda: ${finalScore}${gradeInfo}`);
    this.navigate(slug ? 'kuis' : 'dashboard');
};

// ============================================================
// OVERRIDE — web.resolveCertificate
// Menimpa versi asli (script.js) supaya kode sertifikat KUIS (certSvc,
// tabel db 'certificates') ikut bisa diverifikasi lewat '/?cert/<id>' —
// dibungkus (bukan ditulis ulang total) memakai referensi resolver asli
// supaya sertifikat STATIS (pages.certificates, pages/cert.js) & halaman
// form verifikasi tanpa ID tetap berperilaku persis seperti semula.
// ============================================================
const _baseResolveCertificate = web.resolveCertificate;
web.resolveCertificate = function (id) {
    if (id) {
        const c = certSvc.get(id);
        if (c) {
            return [{ section: 'certificate', id, name: c.name, exam: c.examTitle, score: c.score, date: c.date }];
        }
    }
    return _baseResolveCertificate.call(this, id);
};

// ============================================================
// ROUTE PUBLIK — '/?kuis' & '/?kuis/<slug>'
// ============================================================
web.routes.kuis = 'resolveKuisDashboard';

web.resolveKuisDashboard = function (subParam) {
    const user = auth.currentUser();

    // --- Halaman pengerjaan kuis 1 kursus -------------------------------
    if (subParam) {
        const slug = subParam.split('?')[0];
        const c    = courseSvc.get(slug);
        const quiz = quizSvc.of(slug);

        if (!c || !quiz) {
            return [{ section: 'titleHero', title: 'Kuis Tidak Ditemukan',
                       description: 'Kursus ini belum memiliki kuis.' }];
        }
        if (!user) {
            return [
                { section: 'titleHero', title: `Kuis — ${c.title}`,
                  description: 'Silakan masuk terlebih dahulu untuk mengerjakan kuis.' },
                { section: 'article',
                  leftCol: { subtitle: '', lines: ['link:Ke Halaman Masuk:login'] },
                  rightCol: { subtitle: '', lines: [] } }
            ];
        }

        // --- Gerbang: kuis baru bisa dikerjakan setelah progress kursus
        // 100% (seluruh modul sudah dilihat). Dihitung lewat courseSvc.
        // progressOf() (courses.js) — sumber yang sama dipakai Dashboard,
        // supaya angka progress yang dilihat peserta selalu konsisten.
        const { viewed, total, pct } = courseSvc.progressOf(user.username, slug);
        if (pct < 100) {
            return [
                { section: 'titleHero', title: `Kuis — ${quiz.title}`,
                  description: 'Selesaikan seluruh materi kursus ini terlebih dahulu sebelum mengerjakan kuis.' },
                {
                    section: 'article',
                    leftCol: {
                        subtitle: 'Progress Kursus',
                        lines: [`skill:${pct}%:${c.title}:${viewed}/${total} modul`]
                    },
                    rightCol: {
                        subtitle: 'Kuis Terkunci',
                        lines: [
                            `Progress belajar Anda baru **${pct}%**. Kuis akan terbuka otomatis setelah seluruh materi (100%) selesai dipelajari.`,
                            `link:Lanjutkan Belajar — ${c.title}:${slug}`,
                            '---',
                            'link:&laquo; Kembali ke Daftar Kuis:kuis'
                        ]
                    }
                }
            ];
        }

        const last = quizSvc.lastAttempt(user.username, slug);
        return [
            { section: 'titleHero', title: `Kuis — ${quiz.title}` },
            {
                section: 'article',
                leftCol: {
                    subtitle: 'Informasi Ujian',
                    lines: [
                        `**Kursus:** ${c.title}`,
                        `**Jumlah Soal:** ${quiz.questions.length}`,
                        `**Passing Grade:** ${quiz.passingGrade}%`,
                        `**Skor Terakhir Anda:** ${last ? last.score : 'Belum pernah mengerjakan'}`,
                        '---',
                        'link:&laquo; Kembali ke Daftar Kuis:kuis'
                    ]
                },
                rightCol: {
                    subtitle: 'Kerjakan Kuis',
                    lines: ['form:quiz'],
                    password: quiz.password,
                    questions: quiz.questions,
                    slug
                }
            }
        ];
    }

    // --- Daftar semua kuis (lintas kursus) ------------------------------
    const rows = courseSvc.list()
        .map(c => ({ c, quiz: quizSvc.of(c.slug) }))
        .filter(x => x.quiz)
        .map(({ c, quiz }) => {
            const last = user ? quizSvc.lastAttempt(user.username, c.slug) : null;
            // Progress dipakai utk mengunci aksi "Kerjakan" sampai 100% —
            // sama seperti gerbang di halaman pengerjaan kuis (atas).
            const pct  = user ? courseSvc.progressOf(user.username, c.slug).pct : null;
            return {
                Kursus: c.title,
                'Passing Grade': quiz.passingGrade + '%',
                'Progress Anda': user ? pct + '%' : '-',
                'Skor Terakhir': last ? last.score : '-',
                Aksi: (user && pct < 100)
                    ? `<span style="color:var(--aColor)">Selesaikan materi dulu</span>`
                    : `<a href="javascript:void(0)" onclick="web.navigate('kuis/${c.slug}')">Kerjakan</a>`
            };
        });

    return [
        { section: 'titleHero', title: 'Kuis', description: 'Pilih kursus untuk mengerjakan kuisnya.' },
        {
            section: 'article',
            leftCol: { subtitle: '', lines: ['link:Lihat Katalog Kursus:learn'] },
            rightCol: {
                subtitle: 'Daftar Kuis Tersedia',
                lines: rows.length ? [`table:${JSON.stringify(rows)}`] : ['Belum ada kuis yang tersedia untuk kursus manapun.']
            }
        }
    ];
};

// ============================================================
// DASHBOARD DOSEN — "Kelola Kuis" per kursus.
// Ditambahkan sbg properti baru ke dosenView/dosenAction (dideklarasikan
// di dosen.js) — dipanggil oleh dispatcher resolveDosenDashboard lewat
// action 'kuis' (dosen.js sudah menyediakan cabang pemanggilannya).
// Guard kepemilikan memakai ULANG requireOwnedCourse (dosen.js) supaya
// aturan "hanya dosen pengampu (atau admin) yang boleh kelola" konsisten
// di satu tempat saja.
//
// dosenView.formKelolaKuis — ROUTER tipis untuk sub-halaman "Kelola Kuis".
// subParam dari dosen.js diteruskan APA ADANYA sebagai `param` (lihat
// komentar dosen.js: "'kuis' didaftarkan oleh quiz.js"), berformat
// "slug" (daftar soal, default) atau "slug:edit:index" (form edit 1
// soal) — pola sama seperti "dosen/editmateri:slug:id" di dosen.js,
// hanya diparsing di sini supaya dosen.js TIDAK perlu tahu apa pun
// soal sub-aksi kuis ini.
// ============================================================
dosenView.formKelolaKuis = function (param, user) {
    const [slug, subAction, idxStr] = String(param || '').split(':');
    if (subAction === 'edit') return dosenView.formEditSoal(slug, Number(idxStr), user);
    return dosenView.listKelolaKuis(slug, user);
};

// [DRAWER] Halaman ini dulu memuat 2 form PENUH inline (Pengaturan Kuis di
// leftCol, Tambah Soal Baru di article ke-2) — sekarang keduanya, PLUS
// "Edit Soal" (dulu halaman terpisah 'dosen/kuis:slug:edit:idx'), dibuka
// lewat drawer kanan (web.openFormFromPage). Definisi field masing-masing
// form dipindah ke dosenView.formPengaturanKuis / formTambahSoal (di
// bawah) SATU KALI saja — listKelolaKuis di sini cukup menampilkan
// ringkasan pengaturan + tombol pemicu drawer, supaya halaman tetap
// ringkas seperti daftar (bukan form panjang).
dosenView.listKelolaKuis = function (slug, user) {
    const guard = requireOwnedCourse(slug, user);
    if (guard.denied) return guard.denied;
    const c = guard.course;

    const quiz = quizSvc.of(slug) || { title: `Kuis ${c.title}`, passingGrade: 75, password: '', questions: [] };

    const rows = (quiz.questions || []).map((q, i) => ({
        No: i + 1,
        Pertanyaan: q.q,
        'Jml Opsi': (q.options || []).length,
        Aksi: `<a href="javascript:void(0)" onclick="dosenAction.bukaEditSoal('${slug}',${i})">Edit</a> ·
               <a href="javascript:void(0)" onclick="dosenAction.hapusSoal('${slug}',${i})">Hapus</a>`
    }));

    return [
        { section: 'titleHero', title: `Kelola Kuis — ${c.title}` },
        {
            section: 'article',
            leftCol: {
                subtitle: 'Pengaturan Kuis',
                lines: [
                  `**Judul Kuis** ${quiz.title}`,
                  `**Passing Grade** ${quiz.passingGrade}%`,
                  `**Password Kuis** — ${quiz.password ? 'Terpasang (terproteksi)' : 'Tanpa proteksi'}`,

                  `<button type="button" class="slcBtn" onclick="dosenAction.bukaPengaturanKuis('${slug}')">Edit Pengaturan Kuis</button>`,
                    '---',
                    'link:&laquo; Kembali ke Kursusku:dosen'
                ]
            },
            rightCol: {
                subtitle: 'Daftar Soal',
                lines: [
                    `<button type="button" class="slcBtn" onclick="dosenAction.bukaTambahSoal('${slug}')">+ Tambah Soal Baru</button>`,
                    ...(rows.length ? [`table:${JSON.stringify(rows)}`] : ['Belum ada soal.'])
                ]
            }
        }
    ];
};

/** Form "Pengaturan Kuis" (judul/passing grade/password) — dulu inline di
 *  leftCol listKelolaKuis, sekarang fungsi tersendiri supaya bisa dibuka
 *  lewat drawer (dosenAction.bukaPengaturanKuis) TANPA menuliskan field-nya
 *  dua kali. */
dosenView.formPengaturanKuis = function (slug, user) {
    const guard = requireOwnedCourse(slug, user);
    if (guard.denied) return guard.denied;
    const c = guard.course;

    const quiz = quizSvc.of(slug) || { title: `Kuis ${c.title}`, passingGrade: 75, password: '', questions: [] };

    return [
        { section: 'titleHero', title: `Pengaturan Kuis — ${c.title}` },
        {
            section: 'article',
            leftCol: { subtitle: '', lines: [] },
            rightCol: {
                subtitle: 'Pengaturan Kuis',
                fields: [
                    { type: 'text', name: 'title', label: 'Judul Kuis', value: quiz.title, required: true },
                    { type: 'text', name: 'passingGrade', label: 'Passing Grade (%)', value: quiz.passingGrade },
                    { type: 'text', name: 'password', label: 'Password Kuis (kosongkan = tanpa proteksi)', value: quiz.password }
                ],
                submitText: 'Simpan Pengaturan',
                onSubmit: `event.preventDefault(); dosenAction.submitKuisSettings(this,'${slug}');`,
                lines: ['form:']
            }
        }
    ];
};

/** Form "Tambah Soal Baru" — dulu inline di article ke-2 listKelolaKuis,
 *  sekarang fungsi tersendiri supaya bisa dibuka lewat drawer
 *  (dosenAction.bukaTambahSoal). */
dosenView.formTambahSoal = function (slug, user) {
    const guard = requireOwnedCourse(slug, user);
    if (guard.denied) return guard.denied;
    const c = guard.course;

    return [
        { section: 'titleHero', title: `Tambah Soal — ${c.title}` },
        {
            section: 'article',
            leftCol: { subtitle: '', lines: [] },
            rightCol: {
                subtitle: 'Tambah Soal Baru',
                fields: [
                    { type: 'text', name: 'q', label: 'Pertanyaan', required: true },
                    { type: 'textarea', name: 'options', label: 'Pilihan Jawaban (satu per baris, min. 2)', rows: 4, required: true,
                      placeholder: 'Opsi A\nOpsi B\nOpsi C\nOpsi D' },
                    { type: 'text', name: 'ans', label: 'Jawaban Benar (sama persis dgn salah satu pilihan)', required: true }
                ],
                submitText: 'Tambah Soal',
                onSubmit: `event.preventDefault(); dosenAction.submitTambahSoal(this,'${slug}');`,
                lines: ['form:']
            }
        }
    ];
};

/** Form edit 1 soal — pre-isi dari quiz.questions[index] (pola sama
 *  dengan dosenView.formEditMateri di dosen.js). */
dosenView.formEditSoal = function (slug, index, user) {
    const guard = requireOwnedCourse(slug, user);
    if (guard.denied) return guard.denied;
    const c = guard.course;

    const quiz = quizSvc.of(slug);
    const item = quiz?.questions?.[index];
    if (!item) {
        return [{ section: 'titleHero', title: 'Soal Tidak Ditemukan',
                   description: 'Soal ini sudah dihapus atau tidak tersedia lagi.' }];
    }

    return [
        { section: 'titleHero', title: `Edit Soal — ${c.title}` },
        {
            section: 'article',
            leftCol: { subtitle: '', lines: [`link:&laquo; Kembali ke Kelola Kuis:dosen/kuis:${slug}`] },
            rightCol: {
                subtitle: `Edit Soal #${index + 1}`,
                fields: [
                    { type: 'text', name: 'q', label: 'Pertanyaan', value: item.q, required: true },
                    { type: 'textarea', name: 'options', label: 'Pilihan Jawaban (satu per baris, min. 2)', rows: 4, required: true,
                      value: (item.options || []).join('\n') },
                    { type: 'text', name: 'ans', label: 'Jawaban Benar (sama persis dgn salah satu pilihan)',
                      value: item.ans ? atob(item.ans) : '', required: true }
                ],
                submitText: 'Simpan Perubahan',
                onSubmit: `event.preventDefault(); dosenAction.submitEditSoal(this,'${slug}',${index});`,
                lines: ['form:']
            }
        }
    ];
};

// [DRAWER] Pembuka form Pengaturan Kuis / Tambah Soal / Edit Soal lewat
// drawer kanan — sama pola dengan dosenAction.bukaTambahKursus dkk di
// dosen.js (web.openFormFromPage mengambil ULANG field dari dosenView.formXxx).
dosenAction.bukaPengaturanKuis = function (slug) {
    web.openFormFromPage(dosenView.formPengaturanKuis(slug, auth.currentUser()));
};
dosenAction.bukaTambahSoal = function (slug) {
    web.openFormFromPage(dosenView.formTambahSoal(slug, auth.currentUser()));
};
dosenAction.bukaEditSoal = function (slug, index) {
    web.openFormFromPage(dosenView.formEditSoal(slug, index, auth.currentUser()));
};

dosenAction.submitKuisSettings = function (form, slug) {
    const existing = quizSvc.of(slug);
    quizSvc.upsert(slug, {
        title: form.querySelector('[name="title"]').value.trim(),
        passingGrade: form.querySelector('[name="passingGrade"]').value,
        password: form.querySelector('[name="password"]').value.trim(),
        questions: existing?.questions || []
    });
    alert('Pengaturan kuis berhasil disimpan.');
    web.navigate('dosen/kuis:' + slug);
};

dosenAction.submitTambahSoal = function (form, slug) {
    const q       = form.querySelector('[name="q"]').value.trim();
    const options = form.querySelector('[name="options"]').value.split('\n').map(s => s.trim()).filter(Boolean);
    const ans     = form.querySelector('[name="ans"]').value.trim();

    if (options.length < 2) { alert('Minimal 2 pilihan jawaban.'); return; }
    if (!options.includes(ans)) { alert('Jawaban benar harus sama persis dengan salah satu pilihan di atas.'); return; }

    const existing  = quizSvc.of(slug);
    const questions = [...(existing?.questions || []), { q, options, ans: btoa(ans) }];
    quizSvc.upsert(slug, {
        title: existing?.title, passingGrade: existing?.passingGrade, password: existing?.password, questions
    });

    alert('Soal berhasil ditambahkan.');
    web.navigate('dosen/kuis:' + slug);
};

dosenAction.submitEditSoal = function (form, slug, index) {
    const q       = form.querySelector('[name="q"]').value.trim();
    const options = form.querySelector('[name="options"]').value.split('\n').map(s => s.trim()).filter(Boolean);
    const ans     = form.querySelector('[name="ans"]').value.trim();

    if (options.length < 2) { alert('Minimal 2 pilihan jawaban.'); return; }
    if (!options.includes(ans)) { alert('Jawaban benar harus sama persis dengan salah satu pilihan di atas.'); return; }

    const existing = quizSvc.of(slug);
    if (!existing || !existing.questions[index]) { alert('Soal tidak ditemukan.'); return; }

    const questions = existing.questions.map((item, i) => i !== index ? item : { q, options, ans: btoa(ans) });
    quizSvc.upsert(slug, {
        title: existing.title, passingGrade: existing.passingGrade, password: existing.password, questions
    });

    alert('Soal berhasil diperbarui.');
    web.navigate('dosen/kuis:' + slug);
};

dosenAction.hapusSoal = function (slug, index) {
    if (!confirm('Hapus soal ini? Tindakan tidak bisa dibatalkan.')) return;
    const existing = quizSvc.of(slug);
    if (!existing) return;
    const questions = existing.questions.filter((_, i) => i !== index);
    quizSvc.upsert(slug, {
        title: existing.title, passingGrade: existing.passingGrade, password: existing.password, questions
    });
    alert('Soal berhasil dihapus.');
    web.navigate('dosen/kuis:' + slug);
};
