const pages = {};

// ============================================================
// KONFIGURASI HALAMAN — SATU-SATUNYA SUMBER KEBENARAN
// ============================================================
// Setiap baris di bawah ini mewakili satu halaman di navbar.
// Urutan array = urutan menu (tinggal geser baris untuk ubah urutan).
//
//   slug  : dipakai di URL (?slug) dan oleh web.navigate()/web.routes.
//   file  : nama file di pages/ yang perlu dimuat. Isi null kalau
//           halaman tidak punya file statis (kontennya dibuat langsung
//           oleh resolver di script.js, contoh: dashboard, settings).
//   label : teks yang tampil di menu.
//   menu  : true = tampil di navbar, false = halaman tersembunyi
//           (masih bisa diakses lewat URL, hanya tidak muncul di menu).
//
// Untuk menambah halaman baru: cukup tambah satu baris di sini.
// - Kalau halaman statis biasa (hero/features/article dsb): isi `file`,
//   tidak perlu sentuh script.js sama sekali.
// - Kalau halaman butuh logika (seperti Dashboard/Settings): isi
//   `file: null` lalu daftarkan resolvernya di `web.routes` (script.js).
const siteConfig = [
    { slug: 'home',      file: 'home',     label: 'Home',        menu: true },
    // 'learn' = halaman KATALOG (daftar semua kursus), bukan lagi
    // materi RPL secara langsung — supaya Home tidak "bias" ke satu
    // kursus tertentu. Materi tiap kursus punya slug tersendiri (lihat
    // di bawah: rpl, pbo, robotika, ...) menu:false agar navbar tetap
    // minimalis — tetap bisa diakses lewat URL (?rpl, ?pbo, ?robotika)
    // dan lewat tombol "Enroll" pada card kursus (data kursus `courses`
    // sekarang ada di pages/learn.js — lihat komentar di sana — dirender
    // oleh section 'courseCatalog' di halaman 'learn').
    { slug: 'learn',     file: 'learn',    label: 'Belajar',     menu: true },
    { slug: 'rpl',       file: 'rpl',      label: 'RPL',         menu: false },
    { slug: 'pbo',       file: 'pbo',      label: 'PBO',         menu: false },
    { slug: 'robotika',  file: 'robotika', label: 'Robotika',    menu: false },
    // 'kuis': file diset null — sejak quiz.js, kuis dibuat per-kursus dan
    // datanya disimpan di db (tabel 'quizzes'), bukan lagi 1 file statis
    // pages/kuis.js. Resolver ('resolveKuisDashboard') didaftarkan sendiri
    // oleh quiz.js lewat web.routes, sama seperti pola login/dosen/admin.
    { slug: 'kuis',      file: null,       label: 'Kuis',        menu: true },
    { slug: 'cert',      file: 'cert',     label: 'Sertifikat',  menu: true },
    { slug: 'dashboard', file: null,       label: 'Dashboard',   menu: true },
    { slug: 'settings',  file: null,       label: 'Pengaturan',  menu: true },

    // --- Peran (auth.js / dosen.js / admin.js) ------------------------
    // `role`      : hanya tampil di menu untuk user dengan peran ini
    //               (admin selalu ikut melihat semua menu ber-`role`).
    // `guestOnly` : hanya tampil kalau BELUM login.
    // Resolver masing-masing (resolveLogin, resolveDosenDashboard,
    // resolveAdminDashboard) didaftarkan sendiri oleh file terkait lewat
    // web.routes — tidak menyentuh script.js.
    { slug: 'login',     file: null,       label: 'Masuk',       menu: true, guestOnly: true },
    { slug: 'daftar',    file: null,       label: 'Daftar',      menu: true, guestOnly: true },
    { slug: 'dosen',     file: null,       label: 'Dosen',       menu: true, role: 'dosen' },
    { slug: 'admin',     file: null,       label: 'Admin',       menu: true, role: 'admin' }
];

// Catatan: array `courses` (katalog kursus) TIDAK lagi didefinisikan di
// sini. Sesuai pola tiap halaman memegang datanya sendiri (home.js,
// pbo.js, robotika.js, dll), `courses` sekarang tinggal di pages/learn.js
// — karena di situlah ia dipakai untuk merender section 'courseCatalog'.
// dataset.js murni berisi konfigurasi routing (siteConfig) + helper
// pemuatan script (loadPageScripts) agar tanggung jawabnya jelas.

// Diturunkan otomatis dari siteConfig — dipakai loadPageScripts() dan editor.
// Tidak perlu didefinisikan ulang di tempat lain (index.html, script.js, dll).
const pageFiles = siteConfig.filter(p => p.file).map(p => p.file);

function loadPageScripts(files, callback) {
    let index = 0;

    function loadNext() {
        if (index >= files.length) { callback(); return; }

        const name = files[index];
        const script = document.createElement('script');
        script.src = `pages/${name}.js`;
        script.onload = () => { index++; loadNext(); };
        script.onerror = () => {
            console.warn(`Gagal memuat pages/${name}.js — halaman ini dilewati.`);
            index++; loadNext();
        };
        document.head.appendChild(script);
    }

    loadNext();
}
