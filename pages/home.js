pages.home = [
    // 1. HERO
    // Framing dikembalikan ke MOOC/PkM: terbuka untuk umum, gratis,
    // tanpa periode gelombang, diselenggarakan sebagai Pengabdian
    // kepada Masyarakat (PkM) dosen -- BUKAN LMS institusional formal.
    // Detail teknis (kuis + passing grade, sertifikat + kode kredensial)
    // tetap disebut apa adanya karena memang nyata ada di sistem
    // (quiz.js, pages/cert.js) -- MOOC tetap bisa punya evaluasi &
    // sertifikat, hanya saja tanpa menyiratkan kredit akademik (SKS)
    // atau gelar/kualifikasi resmi dari perguruan tinggi manapun.
    {
        section: 'hero',
        title: 'MOOC IPWIJA',
        tagline: 'Jendela pengetahuan yang terbuka bagi masyarakat umum, di manapun berada.',
        description: 'Program Massive Open Online Course (MOOC) yang diselenggarakan sebagai Pengabdian kepada Masyarakat oleh dosen Informatika Universitas IPWIJA — program pembelajaran terbuka bagi masyarakat umum di manapun berada, mencakup Rekayasa Perangkat Lunak, Pemrograman Berorientasi Objek, hingga Robotika. Sertifikat yang diterbitkan menyatakan keikutsertaan dan kelulusan kuis, serta tidak menyiratkan pemberian kredit akademik (SKS) maupun gelar/kualifikasi resmi dari perguruan tinggi manapun.',
        badges: [
            'Program Pembelajaran Terbuka (MOOC)',
            'Pengabdian kepada Masyarakat (PkM)',
            'Kuis & Sertifikat',
            'Terbuka Untuk Umum',
            'Gratis'
        ],
        cta: {
            text: 'Jelajahi Semua Modul',
            link: 'learn'
        },
        imgClass: 'di-donat'
    },

    // 2. TENTANG PROGRAM + TERBUKA UNTUK UMUM (bertipe 'features' ->
    // grid kartu). Framing dikembalikan ke narasi PkM/MOOC: gratis,
    // terbuka untuk umum, tanpa periode gelombang tertentu.
    {
        section: 'features',
        items: [
            {
                icon: 'di-web',
                title: 'Program Terbuka',
                content: 'Program ini diselenggarakan sebagai Pengabdian kepada Masyarakat oleh dosen Informatika Universitas IPWIJA -- daring, terbuka bagi masyarakat umum di manapun berada, dan tanpa dipungut biaya.'
            },
            {
                icon: 'di-code',
                title: 'Periode Pendaftaran',
                content: 'Pendaftaran modul di platform ini bersifat terbuka sepanjang waktu -- tidak ada periode gelombang khusus, silakan daftar dan mulai belajar kapan saja.'
            },
            {
                icon: 'di-setting',
                title: 'Tingkatkan Keterampilan Anda',
                content: 'Ikuti modul daring MOOC IPWIJA secara gratis, kapan saja dan di mana saja.',
                linkText: 'Jelajahi Semua Modul &raquo;',
                linkTarget: 'learn'
            }
        ]
    },

    // 3. CARA BELAJAR (5 langkah, diadaptasi dari alur 5 langkah UT)
    // + PERAN PENGGUNA. Hanya memakai tipe baris yang terbukti valid:
    // 'step:N:Judul:Isi', 'card:Judul:Isi', 'link:Teks:target', '---'.
    // "Uji Kompetensi" (istilah UT) diganti "Evaluasi Mandiri", dan
    // "sertifikat kompetensi" diganti "Sertifikat Keikutsertaan" --
    // UT boleh pakai istilah kompetensi karena berstatus PTN dengan
    // otoritas akademik formal; untuk MOOC PkM dosen, istilah itu
    // dihindari agar tidak menyiratkan sertifikat kompetensi resmi
    // (yang hanya sah lewat jalur LSK). Secara teknis di baliknya tetap
    // memakai mesin kuis dengan nilai kelulusan (quiz.js) -- istilah
    // permukaan sengaja dibuat lebih rendah hati sesuai konteks PkM.
    {
        section: 'article',
        leftCol: {
            subtitle: 'Cara Belajar di MOOC IPWIJA',
            lines: [
                'step:1:Registrasi:Daftarkan diri Anda secara gratis untuk mendapatkan akun di platform ini.',
                'step:2:Pilih Modul yang Diminati:Pilih materi yang ingin dipelajari, lalu mulai modul tersebut dari Katalog Modul.',
                'step:3:Mengikuti Proses Pembelajaran:Pelajari semua topik, latihan, dan evaluasi mandiri yang tersedia di setiap modul.',
                'step:4:Evaluasi Mandiri:Kerjakan evaluasi mandiri di akhir modul untuk mengukur pemahaman Anda sendiri.',
                'step:5:Dapatkan Sertifikat Keikutsertaan:Sertifikat Keikutsertaan terbit otomatis setelah Anda menyelesaikan seluruh sesi modul.',
                '---',
                'link:Lihat Katalog Modul &raquo;:learn'
            ]
        },
        rightCol: {
            subtitle: 'Dibangun untuk 3 Peran',
            lines: [
                'card:Peserta:Mendaftar bebas, mengikuti modul pilihan, mengerjakan evaluasi mandiri, dan mengunduh Sertifikat Keikutsertaan.',
                'card:Dosen:Mengelola modul sendiri -- menambah materi, menyusun evaluasi mandiri, dan memantau progres peserta.',
                'card:Admin:Memantau seluruh platform: jumlah modul, peserta, dosen, dan statistik penyelesaian modul.'
            ]
        }
    }
];
