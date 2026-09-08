// Contoh data diselaraskan dengan konteks MOOC IPWIJA (bukan lagi sampel
// generik "PT SLS/Fundamental Cybersecurity"): kode kredensial memakai
// prefiks MOOC-IPWIJA, dan nama kursus mengikuti katalog nyata di
// platform ini (lihat pages/learn.js: RPL, PBO, Robotika).
pages.certificates = {
    'MOOC-IPWIJA-2026-001': {
        name: 'Wawan Sismadi',
        exam: 'Rekayasa Perangkat Lunak',
        score: '98/100',
        date: '19 April 2026'
    },
    'MOOC-IPWIJA-2026-002': {
        name: 'Budi Santoso',
        exam: 'Pemrograman Berorientasi Objek',
        score: '95/100',
        date: '19 April 2026'
    },
    'MOOC-IPWIJA-2026-003': {
        name: 'Peserta',
        exam: 'Robotika',
        score: '100/100',
        date: '20 April 2026'
    }
};

pages.cert = [

    {
        section: 'titleHero',
        title: 'Verifikasi Sertifikat'
    },
    {
        section: 'article',
        layout: 'split',
        leftCol: {
            subtitle: 'Cek Kredensial',
            lines: [
              'Gunakan form di samping untuk melakukan validasi Sertifikat Keikutsertaan.',
              'kredensial:**MOOC-IPWIJA-2026-001**.',

                '---',
                '### Mengapa Verifikasi?',
                'Menjamin keaslian dokumen yang diterbitkan dalam program MOOC IPWIJA -- Pengabdian kepada Masyarakat oleh dosen Informatika Universitas IPWIJA.',
                '---',
                '*Catatan: Sertifikat Keikutsertaan menyatakan keikutsertaan dan kelulusan evaluasi mandiri, dan tidak menyiratkan pemberian kredit akademik (SKS) maupun gelar/kualifikasi resmi dari perguruan tinggi manapun.*'
            ]
        },
        rightCol: {
            subtitle: 'Validasi',
            lines: ['form:validate-cert']
        }
    }
];
