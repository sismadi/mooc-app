// ============================================================
// QUIZ — Kuis per KURSUS (bukan lagi 1 kuis global untuk RPL saja).
// ============================================================
// VERSI ASYNC (D1): quizSvc & certSvc sekarang async (db.js memanggil
// Worker API lewat fetch). Semua override (web.evaluateQuiz,
// web.resolveCertificate, web.resolveKuisDashboard) dan tambahan ke
// dosenView/dosenAction di file ini ikut jadi async, dengan pola yang
// sama seperti courses.js & dosen.js: setiap pemanggilan db.*/courseSvc.*
// yang lama sinkron sekarang diberi `await`.
//
// Skema tabel (lihat schema.sql):
//   quizzes       : { id, slug, title, passingGrade, password, questions }
//   quizAttempts  : { id, username, slug, score, date }
//   certificates  : { id, username, name, slug, examTitle, score, date }
// ============================================================
const quizSvc = {
    async of(slug) {
        return db.find('quizzes', q => q.slug === slug);
    },

    async upsert(slug, { title, passingGrade, password, questions }) {
        return db.upsertBy('quizzes', q => q.slug === slug, {
            slug,
            title: title || `Kuis ${slug}`,
            passingGrade: Number(passingGrade) || 75,
            password: password || '',
            questions: questions || []
        });
    },

    async remove(slug) {
        const rec = await this.of(slug);
        if (rec) await db.remove('quizzes', rec.id);
        const attempts = await db.query('quizAttempts', a => a.slug === slug);
        await Promise.all(attempts.map(a => db.remove('quizAttempts', a.id)));
        return true;
    },

    async lastAttempt(username, slug) {
        const rows = await db.query('quizAttempts', a => a.username === username && a.slug === slug);
        return rows.length ? rows[rows.length - 1] : null;
    },

    async recordAttempt(username, slug, score) {
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
     *  dobel baris). Murni, tidak menyentuh db — tetap sinkron. */
    codeFor(username, slug) {
        return `SLS-KUIS-${slug}-${username}`.toUpperCase().replace(/[^A-Z0-9-]/g, '-');
    },

    async award(user, slug, examTitle, score) {
        const id = this.codeFor(user.username, slug);
        return db.upsertBy('certificates', c => c.id === id, {
            id, username: user.username, name: user.name, slug, examTitle, score,
            date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        });
    },

    async of(username) {
        return db.query('certificates', c => c.username === username);
    },

    async get(id) {
        return db.find('certificates', c => c.id === id);
    }
};

// --- Seed 1 kuis demo (RPL) sekarang dilakukan lewat schema.sql
// (INSERT INTO quizzes ...), BUKAN lagi db.seedIfEmpty() di client —
// lihat catatan di db.js versi D1. Blok db.seedIfEmpty('quizzes', ...)
// yang dulu ada di sini sengaja dihapus.

// ============================================================
// OVERRIDE — components.quizEngine (versi asli di script.js)
// TIDAK menyentuh db sama sekali (murni membangun form dari `ctx` yang
// sudah di-resolve sebelumnya) — tetap sinkron, tidak berubah.
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
// OVERRIDE FINAL — web.evaluateQuiz (ASYNC)
// Menimpa versi generik (script.js) sekaligus versi lama di auth.js.
// Dipanggil dari onsubmit (lihat components.quizEngine di atas) —
// fire-and-forget async dari HTML tetap berjalan normal di browser,
// tidak perlu di-await oleh pemanggilnya.
// ============================================================
web.evaluateQuiz = async function (form, questions, slug) {
    const score = questions.reduce((acc, q, idx) => {
        const selected = form.querySelector(`input[name="q${idx}"]:checked`);
        return (selected && btoa(selected.value) === q.ans) ? acc + 1 : acc;
    }, 0);
    const finalScore = Number(((score / questions.length) * 100).toFixed(2));

    const user = auth.currentUser();
    const quiz = slug ? await quizSvc.of(slug) : null;
    let lulus  = false;

    if (user && slug) {
        await quizSvc.recordAttempt(user.username, slug, finalScore);
        lulus = !!quiz && finalScore >= quiz.passingGrade;
        if (lulus) {
            const c = await courseSvc.get(slug);
            await certSvc.award(user, slug, quiz.title || c?.title || slug, finalScore);
        }
    }

    const gradeInfo = quiz ? ` (Passing Grade: ${quiz.passingGrade})` : '';
    alert(lulus
        ? `Ujian Selesai!\nSkor Anda: ${finalScore}${gradeInfo}\nSelamat, Anda LULUS! Sertifikat sudah tersedia di Dashboard.`
        : `Ujian Selesai!\nSkor Anda: ${finalScore}${gradeInfo}`);
    this.navigate(slug ? 'kuis' : 'dashboard');
};

// ============================================================
// OVERRIDE — web.resolveCertificate (ASYNC)
// Menimpa versi asli (script.js) supaya kode sertifikat KUIS (certSvc,
// tabel db 'certificates') ikut bisa diverifikasi lewat '/?cert/<id>' —
// dibungkus (bukan ditulis ulang total) memakai referensi resolver asli
// supaya sertifikat STATIS (pages.certificates, pages/cert.js) & halaman
// form verifikasi tanpa ID tetap berperilaku persis seperti semula.
// _baseResolveCertificate (script.js) TIDAK menyentuh db, jadi tetap
// dipanggil sinkron lewat .call() — hanya dibungkus fungsi luar yang
// async karena bagian certSvc.get() di atasnya butuh await.
// ============================================================
const _baseResolveCertificate = web.resolveCertificate;
web.resolveCertificate = async function (id) {
    if (id) {
        const c = await certSvc.get(id);
        if (c) {
            return [{ section: 'certificate', id, name: c.name, exam: c.examTitle, score: c.score, date: c.date }];
        }
    }
    return _baseResolveCertificate.call(this, id);
};

// ============================================================
// ROUTE PUBLIK — '/?kuis' & '/?kuis/<slug>' (ASYNC)
// ============================================================
web.routes.kuis = 'resolveKuisDashboard';

web.resolveKuisDashboard = async function (subParam) {
    const user = auth.currentUser();

    // --- Halaman pengerjaan kuis 1 kursus -------------------------------
    if (subParam) {
        const slug = subParam.split('?')[0];
        const c    = await courseSvc.get(slug);
        const quiz = await quizSvc.of(slug);

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
        const { viewed, total, pct } = await courseSvc.progressOf(user.username, slug);
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

        const last = await quizSvc.lastAttempt(user.username, slug);
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
    // Setiap baris butuh beberapa await (quizSvc.of, lastAttempt,
    // progressOf) — dibuat lewat Promise.all(map(async ...)) alih-alih
    // .map() biasa, lalu difilter setelah semuanya selesai (filter tidak
    // bisa dilakukan sebelum tahu quiz-nya ada atau tidak).
    const allCourses = await courseSvc.list();
    const withQuiz = await Promise.all(allCourses.map(async c => ({ c, quiz: await quizSvc.of(c.slug) })));
    const rows = await Promise.all(
        withQuiz.filter(x => x.quiz).map(async ({ c, quiz }) => {
            const last = user ? await quizSvc.lastAttempt(user.username, c.slug) : null;
            // Progress dipakai utk mengunci aksi "Kerjakan" sampai 100% —
            // sama seperti gerbang di halaman pengerjaan kuis (atas).
            const pct  = user ? (await courseSvc.progressOf(user.username, c.slug)).pct : null;
            return {
                Kursus: c.title,
                'Passing Grade': quiz.passingGrade + '%',
                'Progress Anda': user ? pct + '%' : '-',
                'Skor Terakhir': last ? last.score : '-',
                Aksi: (user && pct < 100)
                    ? `<span style="color:var(--aColor)">Selesaikan materi dulu</span>`
                    : `<a href="javascript:void(0)" onclick="web.navigate('kuis/${c.slug}')">Kerjakan</a>`
            };
        })
    );

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
// DASHBOARD DOSEN — "Kelola Kuis" per kursus. (ASYNC)
// Ditambahkan sbg properti baru ke dosenView/dosenAction (dideklarasikan
// di dosen.js) — dipanggil oleh dispatcher resolveDosenDashboard lewat
// action 'kuis'. Guard kepemilikan memakai ULANG requireOwnedCourse
// (dosen.js, sekarang async) supaya aturan "hanya dosen pengampu (atau
// admin) yang boleh kelola" konsisten di satu tempat saja.
// ============================================================
dosenView.formKelolaKuis = async function (param, user) {
    const [slug, subAction, idxStr] = String(param || '').split(':');
    if (subAction === 'edit') return dosenView.formEditSoal(slug, Number(idxStr), user);
    return dosenView.listKelolaKuis(slug, user);
};

// [DRAWER] Halaman ini menampilkan ringkasan pengaturan kuis + tombol
// pemicu drawer (Pengaturan Kuis / Tambah Soal / Edit Soal) — lihat
// dosenAction.bukaPengaturanKuis dkk di bawah.
dosenView.listKelolaKuis = async function (slug, user) {
    const guard = await requireOwnedCourse(slug, user);
    if (guard.denied) return guard.denied;
    const c = guard.course;

    const quiz = (await quizSvc.of(slug)) || { title: `Kuis ${c.title}`, passingGrade: 75, password: '', questions: [] };

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

/** Form "Pengaturan Kuis" (judul/passing grade/password). */
dosenView.formPengaturanKuis = async function (slug, user) {
    const guard = await requireOwnedCourse(slug, user);
    if (guard.denied) return guard.denied;
    const c = guard.course;

    const quiz = (await quizSvc.of(slug)) || { title: `Kuis ${c.title}`, passingGrade: 75, password: '', questions: [] };

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

/** Form "Tambah Soal Baru". */
dosenView.formTambahSoal = async function (slug, user) {
    const guard = await requireOwnedCourse(slug, user);
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

/** Form edit 1 soal — pre-isi dari quiz.questions[index]. */
dosenView.formEditSoal = async function (slug, index, user) {
    const guard = await requireOwnedCourse(slug, user);
    if (guard.denied) return guard.denied;
    const c = guard.course;

    const quiz = await quizSvc.of(slug);
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
// drawer kanan — sekarang async, await hasil form.formXxx SEBELUM
// diteruskan ke web.openFormFromPage (yang tetap sinkron), sama pola
// dengan dosenAction.bukaEditKursus dkk di dosen.js.
dosenAction.bukaPengaturanKuis = async function (slug) {
    web.openFormFromPage(await dosenView.formPengaturanKuis(slug, auth.currentUser()));
};
dosenAction.bukaTambahSoal = async function (slug) {
    web.openFormFromPage(await dosenView.formTambahSoal(slug, auth.currentUser()));
};
dosenAction.bukaEditSoal = async function (slug, index) {
    web.openFormFromPage(await dosenView.formEditSoal(slug, index, auth.currentUser()));
};

dosenAction.submitKuisSettings = async function (form, slug) {
    const existing = await quizSvc.of(slug);
    await quizSvc.upsert(slug, {
        title: form.querySelector('[name="title"]').value.trim(),
        passingGrade: form.querySelector('[name="passingGrade"]').value,
        password: form.querySelector('[name="password"]').value.trim(),
        questions: existing?.questions || []
    });
    alert('Pengaturan kuis berhasil disimpan.');
    web.navigate('dosen/kuis:' + slug);
};

dosenAction.submitTambahSoal = async function (form, slug) {
    const q       = form.querySelector('[name="q"]').value.trim();
    const options = form.querySelector('[name="options"]').value.split('\n').map(s => s.trim()).filter(Boolean);
    const ans     = form.querySelector('[name="ans"]').value.trim();

    if (options.length < 2) { alert('Minimal 2 pilihan jawaban.'); return; }
    if (!options.includes(ans)) { alert('Jawaban benar harus sama persis dengan salah satu pilihan di atas.'); return; }

    const existing  = await quizSvc.of(slug);
    const questions = [...(existing?.questions || []), { q, options, ans: btoa(ans) }];
    await quizSvc.upsert(slug, {
        title: existing?.title, passingGrade: existing?.passingGrade, password: existing?.password, questions
    });

    alert('Soal berhasil ditambahkan.');
    web.navigate('dosen/kuis:' + slug);
};

dosenAction.submitEditSoal = async function (form, slug, index) {
    const q       = form.querySelector('[name="q"]').value.trim();
    const options = form.querySelector('[name="options"]').value.split('\n').map(s => s.trim()).filter(Boolean);
    const ans     = form.querySelector('[name="ans"]').value.trim();

    if (options.length < 2) { alert('Minimal 2 pilihan jawaban.'); return; }
    if (!options.includes(ans)) { alert('Jawaban benar harus sama persis dengan salah satu pilihan di atas.'); return; }

    const existing = await quizSvc.of(slug);
    if (!existing || !existing.questions[index]) { alert('Soal tidak ditemukan.'); return; }

    const questions = existing.questions.map((item, i) => i !== index ? item : { q, options, ans: btoa(ans) });
    await quizSvc.upsert(slug, {
        title: existing.title, passingGrade: existing.passingGrade, password: existing.password, questions
    });

    alert('Soal berhasil diperbarui.');
    web.navigate('dosen/kuis:' + slug);
};

dosenAction.hapusSoal = async function (slug, index) {
    if (!confirm('Hapus soal ini? Tindakan tidak bisa dibatalkan.')) return;
    const existing = await quizSvc.of(slug);
    if (!existing) return;
    const questions = existing.questions.filter((_, i) => i !== index);
    await quizSvc.upsert(slug, {
        title: existing.title, passingGrade: existing.passingGrade, password: existing.password, questions
    });
    alert('Soal berhasil dihapus.');
    web.navigate('dosen/kuis:' + slug);
};
