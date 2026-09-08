// ============================================================
// AUTH — Login sederhana + pembagian peran (peserta / dosen / admin).
// ============================================================
// Session disimpan di localStorage (key: slsSession), akun diambil dari
// db.js (tabel 'users'). Mengisi #authSlot (dipanggil dari renderMenu()
// di index.html) dan menyediakan halaman /?login lewat web.routes —
// keduanya ditambahkan di sini, TANPA menyentuh script.js.
// ============================================================
const auth = {
    SESSION_KEY: 'slsSession',

    // --- Percobaan masuk terbatas (anti brute-force sederhana) ---------
    // Disimpan di localStorage per-username: { count, lockedUntil }.
    // Setelah MAX_LOGIN_ATTEMPTS gagal berturut-turut, akun dikunci
    // sementara selama LOCKOUT_MS sebelum boleh mencoba lagi.
    ATTEMPTS_KEY: 'slsLoginAttempts',
    MAX_LOGIN_ATTEMPTS: 3,
    LOCKOUT_MS: 5 * 60 * 1000, // 5 menit

    // --- Reset password lewat email ------------------------------------
    // Token berlaku singkat, cukup untuk demo (tidak ada server email
    // sungguhan — lihat catatan di auth.requestPasswordReset di bawah).
    RESET_TOKEN_TTL_MS: 30 * 60 * 1000, // 30 menit

    _readAttempts() {
        try { return JSON.parse(localStorage.getItem(this.ATTEMPTS_KEY) || '{}'); }
        catch (e) { return {}; }
    },

    _writeAttempts(map) {
        localStorage.setItem(this.ATTEMPTS_KEY, JSON.stringify(map));
    },

    /** Cek apakah `username` sedang dikunci. Kalau masa kuncinya sudah lewat, otomatis dibersihkan. */
    isLockedOut(username) {
        const map = this._readAttempts();
        const rec = map[username];
        if (!rec || !rec.lockedUntil) return false;
        if (Date.now() >= rec.lockedUntil) {
            delete map[username];
            this._writeAttempts(map);
            return false;
        }
        return true;
    },

    /** Sisa waktu kunci dalam menit (dibulatkan ke atas), untuk ditampilkan ke pengguna. */
    lockoutMinutesLeft(username) {
        const rec = this._readAttempts()[username];
        if (!rec || !rec.lockedUntil) return 0;
        return Math.max(1, Math.ceil((rec.lockedUntil - Date.now()) / 60000));
    },

    _recordLoginFailure(username) {
        const map = this._readAttempts();
        const rec = map[username] || { count: 0, lockedUntil: 0 };
        rec.count += 1;
        if (rec.count >= this.MAX_LOGIN_ATTEMPTS) {
            rec.lockedUntil = Date.now() + this.LOCKOUT_MS;
            rec.count = 0;
        }
        map[username] = rec;
        this._writeAttempts(map);
    },

    _clearLoginAttempts(username) {
        const map = this._readAttempts();
        if (map[username]) { delete map[username]; this._writeAttempts(map); }
    },

    // --- Captcha sederhana ("1+2=?") -------------------------------------
    // Soal baru dibuat tiap kali form (masuk/daftar/lupa password)
    // dirender, disimpan di memori (bukan localStorage) supaya tidak bisa
    // dibaca/diubah lewat devtools storage. Jawaban dicek di sisi klien —
    // ini captcha demo untuk menghambat bot sederhana, BUKAN pengaman
    // tingkat produksi.
    _captcha: { a: 0, b: 0 },

    newCaptcha() {
        this._captcha = { a: 1 + Math.floor(Math.random() * 9), b: 1 + Math.floor(Math.random() * 9) };
        return `${this._captcha.a} + ${this._captcha.b}`;
    },

    checkCaptcha(answer) {
        const n = parseInt(String(answer).trim(), 10);
        return !isNaN(n) && n === (this._captcha.a + this._captcha.b);
    },

    currentUser() {
        try { return JSON.parse(localStorage.getItem(this.SESSION_KEY) || 'null'); }
        catch (e) { return null; }
    },

    login(username, password) {
        if (this.isLockedOut(username)) return 'locked';
        const user = db.find('users', u => u.username === username && u.password === password);
        if (!user) { this._recordLoginFailure(username); return false; }
        this._clearLoginAttempts(username);
        localStorage.setItem(this.SESSION_KEY, JSON.stringify({
            username: user.username, name: user.name, role: user.role
        }));
        return true;
    },

    /**
     * Registrasi mandiri untuk PESERTA (publik, tanpa perlu masuk).
     * Peran akun baru SELALU 'peserta' — akun Dosen/Admin hanya dibuat
     * lewat Dashboard Admin (adminAction.submitTambahAkun di admin.js),
     * bukan lewat pendaftaran mandiri ini.
     * Mengembalikan string pesan error, atau null kalau berhasil.
     */
    register({ username, password, name, email }) {
        if (!username || !password || !name || !email) return 'Semua field wajib diisi.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid.';
        if (db.find('users', u => u.username === username)) return 'Username sudah dipakai, gunakan username lain.';
        if (db.find('users', u => u.email && u.email.toLowerCase() === email.toLowerCase())) return 'Email sudah terdaftar, gunakan email lain.';

        db.insert('users', { username, password, name, role: 'peserta', email });
        this.login(username, password); // langsung masuk setelah daftar
        return null;
    },

    // --- Lupa / Reset Password ------------------------------------------
    /**
     * Buat token reset & "kirim" ke email pemilik akun. CATATAN PENTING:
     * ini aplikasi client-side (tanpa server), jadi tidak ada layanan
     * email sungguhan yang bisa dipanggil dari sini. Sebagai gantinya,
     * tautan reset ditampilkan langsung ke pengguna (mensimulasikan isi
     * email yang "diterima") lewat web.resolveLupaPasswordSent di bawah.
     * Untuk produksi sungguhan, ganti bagian "kirim" ini dengan pemanggilan
     * endpoint backend yang benar-benar mengirim email.
     * Mengembalikan { error } atau { resetUrl, user }.
     */
    requestPasswordReset(email) {
        const user = db.find('users', u => u.email && u.email.toLowerCase() === String(email).trim().toLowerCase());
        // Pesan sengaja sama baik email ditemukan atau tidak (di pemanggil),
        // supaya orang tidak bisa menebak email mana yang terdaftar.
        if (!user) return { error: null, user: null, resetUrl: null };

        const token = db._id('reset') + Math.random().toString(36).slice(2, 10);
        db.insert('passwordResets', { username: user.username, token, expiresAt: Date.now() + this.RESET_TOKEN_TTL_MS });

        const resetUrl = `${window.location.origin}${window.location.pathname}?reset-password/${token}`;
        return { error: null, user, resetUrl };
    },

    /** Ambil record token reset yang masih berlaku (belum kadaluarsa). */
    validResetToken(token) {
        const rec = db.find('passwordResets', r => r.token === token);
        if (!rec) return null;
        if (Date.now() >= rec.expiresAt) { db.remove('passwordResets', rec.id); return null; }
        return rec;
    },

    /** Set password baru lewat token yang valid. Mengembalikan string error, atau null kalau berhasil. */
    resetPassword(token, newPassword) {
        if (!newPassword || newPassword.length < 6) return 'Password baru minimal 6 karakter.';
        const rec = this.validResetToken(token);
        if (!rec) return 'Tautan reset tidak valid atau sudah kadaluarsa. Silakan minta tautan baru.';

        const user = db.find('users', u => u.username === rec.username);
        if (!user) return 'Akun terkait tautan ini tidak ditemukan.';

        db.update('users', user.id, { password: newPassword });
        db.remove('passwordResets', rec.id);
        this._clearLoginAttempts(user.username); // reset percobaan gagal yang mungkin masih terkunci
        return null;
    },

    logout() {
        localStorage.removeItem(this.SESSION_KEY);
        if (typeof renderMenu === 'function') renderMenu();
        web.navigate('login');
    },

    hasRole(...roles) {
        const u = this.currentUser();
        return !!u && roles.includes(u.role);
    },

    /**
     * Bikin key localStorage yang di-scope per akun yang sedang login
     * (mis. 'slsProfile' → 'slsProfile_budi123'). Dipakai supaya data
     * semacam profil/progress/skor kuis TIDAK tercampur antar akun
     * peserta yang login bergantian di browser yang sama — sebelumnya
     * key-key ini ditulis global sehingga peserta lain bisa melihat
     * profil/progress peserta sebelumnya yang pernah login di browser
     * yang sama.
     */
    userKey(base) {
        const u = this.currentUser();
        return u ? `${base}_${u.username}` : `${base}_guest`;
    },

    /**
     * Baca profil (nama/email/notif) milik `username` TERTENTU — beda dari
     * userKey() di atas yang selalu terikat akun yang SEDANG login. Dipakai
     * oleh portofolio publik (web.resolvePublicPortfolio di bawah) untuk
     * menampilkan nama pemilik profil yang benar, walau pengunjungnya tidak
     * login atau sedang login sebagai akun lain. Key-nya ('slsProfile_user')
     * sama persis dengan yang ditulis userKey() saat `username` login &
     * menyimpan profilnya sendiri, jadi tidak perlu skema penyimpanan baru.
     */
    profileOf(username) {
        try { return JSON.parse(localStorage.getItem(`slsProfile_${username}`) || '{}'); }
        catch (e) { return {}; }
    },

    /** Dipanggil dari renderMenu() (index.html) tiap kali menu digambar ulang. */
    renderAuthUI() {
        const slot = web.gebi('authSlot');
        if (!slot) return;
        const user = this.currentUser();
        slot.innerHTML = user
            ? `<span class="auth-chip">
                   <i class="di-person img-24"></i>
                   <span class="auth-name">${user.name}</span>
                   <span class="badge auth-role">${user.role}</span>
               </span>
               <button class="slcBtn auth-logout" onclick="auth.logout()">Keluar</button>`
            : `<a href="javascript:void(0)" onclick="web.navigate('login')" class="auth-chip">
                   <i class="di-lock img-24"></i>
                   <span class="auth-name">Masuk</span>
               </a>`;
        if (typeof svg?.di === 'function') svg.di();
    },

    handleLoginSubmit(form) {
        const username = form.querySelector('[name="username"]').value.trim();
        const password = form.querySelector('[name="password"]').value;
        const captcha  = form.querySelector('[name="captcha"]').value;

        if (this.isLockedOut(username)) {
            alert(`Akun ini dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${this.lockoutMinutesLeft(username)} menit.`);
            web.navigate('login'); // render ulang, sekaligus dapat captcha baru
            return;
        }

        if (!this.checkCaptcha(captcha)) {
            alert('Jawaban captcha salah, silakan coba lagi.');
            web.navigate('login');
            return;
        }

        const result = this.login(username, password);
        if (result === true) {
            if (typeof renderMenu === 'function') renderMenu();
            web.navigate('dashboard');
        } else if (result === 'locked') {
            alert(`Akun ini dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${this.lockoutMinutesLeft(username)} menit.`);
            web.navigate('login');
        } else {
            const map = this._readAttempts()[username];
            const sisa = map ? this.MAX_LOGIN_ATTEMPTS - map.count : this.MAX_LOGIN_ATTEMPTS;
            alert(this.isLockedOut(username)
                ? `Username atau password salah. Akun dikunci sementara ${this.lockoutMinutesLeft(username)} menit.`
                : `Username atau password salah. Sisa percobaan: ${sisa}.`);
            web.navigate('login');
        }
    },

    handleRegisterSubmit(form) {
        const username = form.querySelector('[name="username"]').value.trim().toLowerCase();
        const password = form.querySelector('[name="password"]').value;
        const confirm  = form.querySelector('[name="confirm"]').value;
        const name     = form.querySelector('[name="name"]').value.trim();
        const email    = form.querySelector('[name="email"]').value.trim();
        const captcha  = form.querySelector('[name="captcha"]').value;

        if (!this.checkCaptcha(captcha)) {
            alert('Jawaban captcha salah, silakan coba lagi.');
            web.navigate('daftar');
            return;
        }

        if (password !== confirm) { alert('Konfirmasi password tidak cocok.'); return; }

        const err = this.register({ username, password, name, email });
        if (err) { alert(err); web.navigate('daftar'); return; }

        if (typeof renderMenu === 'function') renderMenu();
        alert(`Akun berhasil dibuat. Selamat datang, ${name}!`);
        web.navigate('dashboard');
    },

    handleForgotPasswordSubmit(form) {
        const email   = form.querySelector('[name="email"]').value.trim();
        const captcha = form.querySelector('[name="captcha"]').value;

        if (!this.checkCaptcha(captcha)) {
            alert('Jawaban captcha salah, silakan coba lagi.');
            web.navigate('lupa-password');
            return;
        }

        const { resetUrl } = this.requestPasswordReset(email);
        // Simpan URL (kalau ada) untuk ditampilkan di halaman konfirmasi.
        // Lihat catatan di auth.requestPasswordReset soal keterbatasan
        // demo client-side ini (tidak ada server email sungguhan).
        this._lastResetUrl = resetUrl || null;
        web.navigate('lupa-password-terkirim');
    },

    handleResetPasswordSubmit(form, token) {
        const password = form.querySelector('[name="password"]').value;
        const confirm  = form.querySelector('[name="confirm"]').value;

        if (password !== confirm) { alert('Konfirmasi password tidak cocok.'); return; }

        const err = this.resetPassword(token, password);
        if (err) { alert(err); return; }

        alert('Password berhasil diganti. Silakan masuk dengan password baru Anda.');
        web.navigate('login');
    }
};

// --- Route + resolver 'login' — didaftarkan di sini, script.js tidak diubah ---
web.routes.login = 'resolveLogin';

// --- Route + resolver 'daftar' — registrasi mandiri akun Peserta ---
web.routes.daftar = 'resolveRegister';

// --- Route + resolver untuk alur lupa / reset password ---
web.routes['lupa-password']         = 'resolveLupaPassword';
web.routes['lupa-password-terkirim'] = 'resolveLupaPasswordSent';
web.routes['reset-password']         = 'resolveResetPassword';

web.resolveRegister = function () {
    const user = auth.currentUser();

    if (user) {
        return [
            { section: 'titleHero', title: 'Sudah Masuk',
              description: `Anda masuk sebagai <strong>${user.name}</strong> (${user.role}).` },
            { section: 'article',
              leftCol: { subtitle: '', lines: ['link:Ke Dashboard:dashboard'] },
              rightCol: { subtitle: '', lines: [] } }
        ];
    }

    const captchaQ = auth.newCaptcha();
    return [
        { section: 'titleHero', title: 'Daftar Akun Peserta',
          description: 'Buat akun baru untuk mulai mengikuti kursus.' },
        {
            section: 'article',
            leftCol: { subtitle: '', lines: ['link:Sudah punya akun? Masuk di sini:login'] },
            rightCol: {
                subtitle: 'Form Pendaftaran',
                fields: [
                    { type: 'text',     name: 'name',     label: 'Nama Lengkap', required: true },
                    { type: 'text',     name: 'username', label: 'Username', required: true,
                      placeholder: 'mis: budi123' },
                    { type: 'email',    name: 'email',    label: 'Email', required: true,
                      placeholder: 'nama@email.com' },
                    { type: 'password', name: 'password', label: 'Password', required: true },
                    { type: 'password', name: 'confirm',  label: 'Konfirmasi Password', required: true },
                    { type: 'text',     name: 'captcha',  label: `Captcha: Berapa ${captchaQ} ?`, required: true,
                      placeholder: 'Jawaban' }
                ],
                submitText: 'Daftar',
                onSubmit: 'event.preventDefault(); auth.handleRegisterSubmit(this);',
                lines: ['form:']
            }
        }
    ];
};

web.resolveLogin = function () {
    const user = auth.currentUser();

    if (user) {
        return [
            { section: 'titleHero', title: 'Sudah Masuk',
              description: `Anda masuk sebagai <strong>${user.name}</strong> (${user.role}).` },
            {
                section: 'article',
                leftCol: {
                    subtitle: 'Aksi',
                    lines: [
                        'link:Ke Dashboard:dashboard',
                        '---',
                        '<button class="slcBtn" onclick="auth.logout()">Keluar</button>'
                    ]
                },
                rightCol: { subtitle: '', lines: [] }
            }
        ];
    }

    const captchaQ = auth.newCaptcha();
    return [
        { section: 'titleHero', title: 'Masuk',
          description: 'Gunakan akun peserta / dosen / admin untuk mengakses dashboard sesuai peran.' },
        {
            section: 'article',
            leftCol: {
                subtitle: 'Akun Demo',
                lines: [
                    'card:Peserta:peserta / peserta123',
                    'card:Dosen:dosen / dosen123',
                    'card:Admin:admin / admin123'
                ]
            },
            rightCol: {
                subtitle: 'Form Masuk',
                fields: [
                    { type: 'text', name: 'username', label: 'Username', required: true, placeholder: 'username' },
                    { type: 'password', name: 'password', label: 'Password', required: true, placeholder: 'password' },
                    { type: 'text', name: 'captcha', label: `Captcha: Berapa ${captchaQ} ?`, required: true,
                      placeholder: 'Jawaban' }
                ],
                submitText: 'Masuk',
                onSubmit: 'event.preventDefault(); auth.handleLoginSubmit(this);',
                lines: ['form:', 'link:Lupa password?:lupa-password', 'link:Belum punya akun? Daftar di sini:daftar']
            }
        }
    ];
};

// --- Resolver 'lupa-password' — form minta tautan reset lewat email ----
web.resolveLupaPassword = function () {
    const captchaQ = auth.newCaptcha();
    return [
        { section: 'titleHero', title: 'Lupa Password',
          description: 'Masukkan email yang dipakai saat mendaftar. Tautan reset password akan dikirim ke email tersebut.' },
        {
            section: 'article',
            leftCol: { subtitle: '', lines: ['link:Ingat password? Masuk di sini:login', 'link:Belum punya akun? Daftar di sini:daftar'] },
            rightCol: {
                subtitle: 'Form Lupa Password',
                fields: [
                    { type: 'email', name: 'email', label: 'Email Terdaftar', required: true, placeholder: 'nama@email.com' },
                    { type: 'text',  name: 'captcha', label: `Captcha: Berapa ${captchaQ} ?`, required: true, placeholder: 'Jawaban' }
                ],
                submitText: 'Kirim Tautan Reset',
                onSubmit: 'event.preventDefault(); auth.handleForgotPasswordSubmit(this);',
                lines: ['form:']
            }
        }
    ];
};

// --- Resolver 'lupa-password-terkirim' — konfirmasi setelah submit -----
// CATATAN: karena ini aplikasi client-side tanpa server, tidak ada email
// sungguhan yang benar-benar terkirim. Tautan reset ditampilkan langsung
// di halaman ini (mensimulasikan isi email) supaya alur tetap bisa dicoba
// end-to-end dalam demo. Untuk deployment sungguhan, ganti dengan
// pemanggilan API backend yang mengirim email asli dan JANGAN tampilkan
// tautannya di layar.
web.resolveLupaPasswordSent = function () {
    const resetUrl = auth._lastResetUrl;
    auth._lastResetUrl = null; // sekali tampil saja

    return [
        { section: 'titleHero', title: 'Periksa Email Anda',
          description: 'Jika email tersebut terdaftar, tautan untuk reset password telah "dikirim".' },
        {
            section: 'article',
            leftCol: {
                subtitle: '',
                lines: resetUrl
                    ? [
                        'Ini adalah demo tanpa server email sungguhan, jadi tautan resetnya ditampilkan langsung di sini:',
                        `<div class="a-row"><input type="text" readonly id="reset-url" value="${resetUrl}" onclick="this.select()" style="width:70%">
                            <button class="slcBtn" onclick="navigator.clipboard.writeText(web.gebi('reset-url').value); alert('Tautan berhasil disalin!');">Salin Tautan</button></div>`,
                        `link:Buka Tautan Reset:${resetUrl.split('?')[1]}`
                      ]
                    : ['Jika email itu memang terdaftar, Anda akan menerima instruksi reset password.']
            },
            rightCol: { subtitle: '', lines: ['link:Kembali ke Halaman Masuk:login'] }
        }
    ];
};

// --- Resolver 'reset-password' — form password baru lewat token --------
web.resolveResetPassword = function (token) {
    const rec = token ? auth.validResetToken(token) : null;

    if (!rec) {
        return [
            { section: 'titleHero', title: 'Tautan Tidak Valid',
              description: 'Tautan reset password tidak valid atau sudah kadaluarsa.' },
            { section: 'article',
              leftCol: { subtitle: '', lines: ['link:Minta Tautan Reset Baru:lupa-password', 'link:Kembali ke Halaman Masuk:login'] },
              rightCol: { subtitle: '', lines: [] } }
        ];
    }

    return [
        { section: 'titleHero', title: 'Buat Password Baru',
          description: `Membuat password baru untuk akun <strong>${rec.username}</strong>.` },
        {
            section: 'article',
            leftCol: { subtitle: '', lines: [] },
            rightCol: {
                subtitle: 'Form Reset Password',
                fields: [
                    { type: 'password', name: 'password', label: 'Password Baru', required: true },
                    { type: 'password', name: 'confirm',  label: 'Konfirmasi Password Baru', required: true }
                ],
                submitText: 'Simpan Password Baru',
                onSubmit: `event.preventDefault(); auth.handleResetPasswordSubmit(this, '${token}');`,
                lines: ['form:']
            }
        }
    ];
};

// ============================================================
// OVERRIDE — web.resolveDashboard / web.resolveSettings / web.saveProfile
// / web.evaluateQuiz (versi asli di script.js, TIDAK diubah).
//
// Kenapa perlu ini: versi asli menyimpan profil/progress/skor kuis di
// localStorage dengan key GLOBAL ('slsProfile', 'slsProgress',
// 'slsQuizScore', 'slsLastModule') — tidak dibedakan per akun. Akibatnya,
// kalau 2 peserta login bergantian di browser yang sama, peserta kedua
// akan melihat profil & progress milik peserta pertama. Di sini key-key
// tsb di-scope per akun lewat auth.userKey() (lihat auth.js bagian atas).
//
// Progress kursus juga TIDAK lagi dibaca dari localStorage 'slsProgress'
// (lihat catatan di courses.js), tapi langsung dari tabel db 'progress'
// yang sudah per-akun (kolom `username`) — sekaligus jumlah modul per
// kursus dihitung lewat courseSvc.categoriesOf(slug), bukan pages[slug]
// saja, supaya kursus TAMBAHAN buatan dosen (yang materinya tersimpan di
// db, bukan di pages[]) ikut terhitung dengan benar. Modul yang sudah
// dihapus dosen (lihat fitur edit/hapus modul) juga otomatis tidak lagi
// dihitung sebagai "viewed", supaya angka progress selalu realistis.
// ============================================================
web.resolveDashboard = function (subParam) {
    // Portofolio publik (tautan share) — /?dashboard/<username>, TIDAK
    // perlu login. Diperiksa PALING AWAL, sebelum guard "harus masuk" di
    // bawah, supaya tautan yang dibagikan bisa dibuka siapa saja tanpa
    // akun. `subParam` datang dari web.navigate() (script.js, TIDAK
    // diubah) yang memang sudah meneruskan bagian setelah slash pertama —
    // jadi route "dashboard/peserta" otomatis sampai ke sini tanpa
    // pendaftaran route baru.
    if (subParam) return web.resolvePublicPortfolio(subParam);

    const user = auth.currentUser();

    if (!user) {
        return [
            { section: 'titleHero', title: 'Dashboard', description: 'Silakan masuk terlebih dahulu.' },
            { section: 'article',
              leftCol: { subtitle: '', lines: ['link:Ke Halaman Masuk:login'] },
              rightCol: { subtitle: '', lines: [] } }
        ];
    }

    const profile    = JSON.parse(localStorage.getItem(auth.userKey('slsProfile')) || '{}');
    const name       = profile.name || user.name;
    const lastModule = localStorage.getItem(auth.userKey('slsLastModule')) || 'Belum ada';

    // --- Kursus diikuti, progress & sertifikat (khusus akun ini) -------
    // buildPortfolioData() (bawah file) = SATU-SATUNYA titik hitung, dipakai
    // ulang oleh web.resolvePublicPortfolio supaya Dashboard privat & versi
    // publik yang dibagikan selalu menampilkan angka yang identik.
    const { progressLines, myCerts } = buildPortfolioData(user.username, name);

    // Tautan portofolio publik yang bisa dibagikan (lihat resolvePublicPortfolio
    // di bawah) — dibangun dari lokasi halaman saat ini supaya otomatis ikut
    // domain/path deploy-nya (localhost, sismadi.com, dst), tanpa hardcode host.
    const publicUrl = `${window.location.origin}${window.location.pathname}?dashboard/${user.username}`;

    return [
        { section: 'titleHero', title: 'Dashboard',
          description: `Selamat datang kembali, <strong>${name}</strong>.` },
        {
            section: 'article',
            leftCol: {
                subtitle: 'Kursus Diikuti & Progress',
                lines: progressLines.length ? progressLines : ['Anda belum mengikuti kursus apa pun.', 'link:Lihat Katalog Kursus:learn']
            },
            rightCol: {
                subtitle: 'Sertifikat Diperoleh',
                lines: myCerts.length
                    ? [`table:${JSON.stringify(myCerts)}`]
                    : [
                        'Belum ada sertifikat atas nama Anda.',
                        'Lulus kuis kursus untuk mendapat sertifikat otomatis, atau pastikan **Nama** di Pengaturan Profil sama dengan nama pada sertifikat.',
                        'link:Kerjakan Kuis:kuis',
                        '---',
                        'link:Verifikasi Sertifikat:cert'
                      ]
            }
        },
        {
            section: 'article',
            leftCol: {
                subtitle: 'Portofolio Publik',
                lines: [
                    'Bagikan progress belajar & sertifikat Anda lewat tautan ini — bisa dibuka siapa saja, tanpa perlu masuk:',
                    `<div class="a-row"><input type="text" readonly id="portfolio-url" value="${publicUrl}" onclick="this.select()" style="width:70%">
                        <button class="slcBtn" onclick="navigator.clipboard.writeText(web.gebi('portfolio-url').value); alert('Tautan berhasil disalin!');">Salin Tautan</button></div>`,
                    `link:Pratinjau Portofolio Publik Saya:dashboard/${user.username}`
                ]
            },
            rightCol: {
                subtitle: 'Ringkasan Lainnya',
                lines: [
                    `card:Modul Terakhir Dilihat:${lastModule}`,
                    `card:Kuis Dikerjakan:${(typeof quizSvc !== 'undefined') ? db.query('quizAttempts', a => a.username === user.username).length : 0} kali`
                ]
            }
        },
        {
            section: 'article',
            leftCol: {
                subtitle: 'Aksi Cepat',
                lines: [
                    'link:Lihat Katalog Kursus:learn',
                    '---',
                    'link:Kerjakan Kuis:kuis',
                    '---',
                    'link:Verifikasi Sertifikat:cert',
                    '---',
                    'link:Pengaturan Profil:settings',
                    '---'
                ]
            },
            rightCol: { subtitle: '', lines: [] }
        }
    ];
};

/**
 * buildPortfolioData — hitung baris progress kursus & tabel sertifikat
 * milik SATU akun (`username`), lepas dari siapa yang sedang login. Dipakai
 * ulang oleh web.resolveDashboard (privat, akun sendiri) DAN
 * web.resolvePublicPortfolio (publik, siapa saja lewat tautan share) di
 * bawah — supaya keduanya selalu menampilkan angka yang identik dan logika
 * penggabungan sertifikat statis+kuis tidak dobel ditulis.
 */
function buildPortfolioData(username, name) {
    const progressLines = db.query('progress', p => p.username === username).map(p => {
        const meta = courseSvc.get(p.slug);
        // courseSvc.progressOf() = satu-satunya sumber hitung persentase
        // (lihat courses.js) — dipakai juga oleh gerbang kuis 100% & daftar
        // kuis di quiz.js, supaya angkanya selalu sinkron di semua halaman.
        const { viewed, total, pct } = courseSvc.progressOf(username, p.slug);
        const lastQuiz  = (typeof quizSvc !== 'undefined') ? quizSvc.lastAttempt(username, p.slug) : null;
        const quizText  = lastQuiz ? ` · Kuis: ${lastQuiz.score}` : '';
        return `skill:${pct}%:${meta?.title || p.slug}:${viewed}/${total} modul${quizText}`;
    });

    // Digabung dari DUA sumber: (a) sertifikat STATIS (pages.certificates,
    // dicocokkan lewat nama profil — dipertahankan supaya contoh sertifikat
    // lama tetap tampil), dan (b) sertifikat KUIS yang terbit OTOMATIS saat
    // peserta lulus kuis suatu kursus (tabel db 'certificates', lihat
    // certSvc.award di quiz.js). `typeof certSvc` dijaga supaya auth.js
    // tetap jalan sendiri kalau quiz.js belum/tidak dimuat.
    const staticCerts = Object.entries(pages.certificates || {})
        .filter(([id, c]) => name && c.name.trim().toLowerCase() === name.trim().toLowerCase())
        .map(([id, c]) => ({ Kode: id, Ujian: c.exam, Skor: c.score, Tanggal: c.date,
                              Aksi: `<a href="javascript:void(0)" onclick="web.navigate('cert/${id}')">Lihat</a>` }));

    const quizCerts = (typeof certSvc !== 'undefined')
        ? certSvc.of(username).map(c => ({
            Kode: c.id, Ujian: c.examTitle, Skor: c.score, Tanggal: c.date,
            Aksi: `<a href="javascript:void(0)" onclick="web.navigate('cert/${c.id}')">Lihat</a>`
          }))
        : [];

    return { progressLines, myCerts: [...quizCerts, ...staticCerts] };
}

/**
 * web.resolvePublicPortfolio — versi PUBLIK (read-only, tanpa login) dari
 * Dashboard, dibuka lewat '/?dashboard/<username>' (subParam ditangkap di
 * web.resolveDashboard di atas). Hanya menampilkan progress & sertifikat —
 * TANPA "Aksi Cepat"/"Pengaturan Profil"/link salin tautan, supaya orang
 * yang membuka tautan share tidak melihat/mengira bisa mengubah akun orang
 * lain. Nama pemilik diambil lewat auth.profileOf(username) (auth.js
 * bagian atas) supaya benar walau pengunjungnya tidak login sama sekali.
 */
web.resolvePublicPortfolio = function (username) {
    const target = db.find('users', u => u.username === username);
    if (!target) {
        return [{ section: 'titleHero', title: 'Portofolio Tidak Ditemukan',
                   description: `Akun dengan username <strong>${username}</strong> tidak ditemukan.` }];
    }

    const profile = auth.profileOf(username);
    const name     = profile.name || target.name;
    const { progressLines, myCerts } = buildPortfolioData(username, name);

    return [
        { section: 'titleHero', title: `Portofolio — ${name}`,
          description: `Ringkasan progress belajar &amp; sertifikat milik <strong>${name}</strong>.` },
        {
            section: 'article',
            leftCol: {
                subtitle: 'Kursus Diikuti & Progress',
                lines: progressLines.length ? progressLines : ['Belum mengikuti kursus apa pun.']
            },
            rightCol: {
                subtitle: 'Sertifikat Diperoleh',
                lines: myCerts.length ? [`table:${JSON.stringify(myCerts)}`] : ['Belum ada sertifikat.']
            }
        },
        {
            section: 'article',
            leftCol: { subtitle: '', lines: ['link:Lihat Katalog Kursus:learn', '---', 'link:Verifikasi Sertifikat:cert'] },
            rightCol: { subtitle: '', lines: [] }
        }
    ];
};

web.resolveSettings = function () {
    const profile = JSON.parse(localStorage.getItem(auth.userKey('slsProfile')) || '{}');
    const user    = auth.currentUser();

    return [
        { section: 'titleHero', title: 'Pengaturan / Profil',
          description: 'Kelola informasi akun Anda.' },
        {
            section: 'article',
            leftCol: {
                subtitle: 'Info',
                lines: [
                    'link:Lihat Katalog Kursus:learn',
                    '---',
                    'link:Kerjakan Kuis:kuis',
                    '---',
                    'link:Verifikasi Sertifikat:cert',
                    '---',
                    'link:Pengaturan Profil:settings',
                    '---'
                ]
            },
            rightCol: {
                subtitle: 'Profil Saya',
                fields: [
                    { type: 'text',   name: 'name',  id: 'set-name',  label: 'Nama Lengkap',
                      value: profile.name  || user?.name || '', placeholder: 'Nama Anda', required: true },
                    { type: 'email',  name: 'email', id: 'set-email', label: 'Email',
                      value: profile.email || '', placeholder: 'nama@email.com' },
                    { type: 'select', name: 'notif', id: 'set-notif', label: 'Notifikasi Email',
                      value: profile.notif || 'on',
                      options: [{ value: 'on', label: 'Aktifkan' }, { value: 'off', label: 'Matikan' }] }
                ],
                submitText: 'Simpan Perubahan',
                onSubmit:   'event.preventDefault(); web.saveProfile(this);',
                lines: ['form:']
            }
        }
    ];
};

web.saveProfile = function (form) {
    const data = {
        name:  form.querySelector('[name="name"]')?.value.trim()  || '',
        email: form.querySelector('[name="email"]')?.value.trim() || '',
        notif: form.querySelector('[name="notif"]')?.value        || 'on'
    };
    localStorage.setItem(auth.userKey('slsProfile'), JSON.stringify(data));
    alert('Profil berhasil disimpan.');
    this.navigate('dashboard');
};

// web.evaluateQuiz TIDAK di-override di sini lagi — kuis sekarang berbasis
// per-kursus (tabel db 'quizAttempts'), jadi versi finalnya (yang menimpa
// versi generik di atas) ada di quiz.js supaya logika kuis terkumpul di
// satu file, konsisten dengan pola "satu fitur, satu file" di proyek ini.
