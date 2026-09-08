// ============================================================
// KATALOG KURSUS — SATU-SATUNYA SUMBER KEBENARAN untuk card di halaman ini
// ============================================================
// Dipindah dari dataset.js ke sini supaya konsisten dengan pola halaman
// lain (home.js, pbo.js, robotika.js, dll): setiap halaman memegang
// datanya sendiri. dataset.js sekarang murni berisi konfigurasi routing
// (siteConfig) + helper pemuatan script.
//
// slug       : harus sama dengan slug halaman kursus di siteConfig (dataset.js)
//              (menunjuk ke pages[slug], yang berisi { categories }).
// Field lain murni data tampilan kartu (deskripsi, harga, instruktur, periode).
// Jumlah kursus & jumlah materi TIDAK dihardcode — keduanya dideteksi
// otomatis oleh components.courseCatalog di script.js (lihat courses.length
// dan pages[slug].categories) sehingga menambah kursus baru cukup dengan
// menambah satu baris di array ini + satu baris di siteConfig (dataset.js).
const courses = [
    {
        slug: 'rpl',
        title: 'Rekayasa Perangkat Lunak',
        description: 'Fondasi RPL, analisis & desain (SRS, SDD, DFD), hingga strategi pengujian White Box & Black Box.',
        price: 'Gratis',
        instructor: 'Wawan Sismadi',
        period: 'Self-paced'
    },
    {
        slug: 'pbo',
        title: 'Pemrograman Berorientasi Objek',
        description: 'Konsep dasar OOP: class, object, constructor, hingga inheritance & polymorphism dengan contoh kode.',
        price: 'Gratis',
        instructor: 'Wawan Sismadi',
        period: 'Self-paced'
    },
    {
        slug: 'robotika',
        title: 'Robotika',
        description: 'Pengenalan robotika, sensor & aktuator, hingga dasar pemrograman mikrokontroler (Arduino).',
        price: 'Gratis',
        instructor: 'Wawan Sismadi',
        period: 'Self-paced'
    }
];

pages.learn = [
    // Halaman katalog — netral, tidak bias ke satu kursus tertentu.
    // Daftar kursus & jumlah materi 100% diambil dari `courses` di atas,
    // via komponen 'courseCatalog' di script.js.
    {
        section: 'titleHero',
        title: 'Katalog Kursus',
        description: 'Semua kursus di bawah ini gratis — pilih salah satu untuk mulai belajar.'
    },
    {
        section: 'courseCatalog'
    }
];
