pages.rpl = {
    categories: [
        {
            name: 'Bagian 1: Rekayasa Perangkat Lunak',
            items: [

                // -------------------------------------------------------------
                // MODUL 01
                // -------------------------------------------------------------
                {
                    id: 'modul01',
                    title: 'Pertemuan 1: Pengenalan Rekayasa Perangkat Lunak',
                    lines: [
                        'Rekayasa Perangkat Lunak adalah disiplin ilmu untuk membangun software secara sistematis dan berkualitas.',
                        '---',

                        '### Poin Utama',
                        'card:Definisi:RPL mencakup proses, metode, dan alat untuk mengembangkan perangkat lunak yang andal.',
                        'card:Mengapa Penting:Tanpa pendekatan rekayasa, software mudah menjadi sulit dipelihara dan penuh bug.',
                        '---',

                        '### 3 Elemen Perangkat Lunak',
                        'skill:100%:Instruksi (Program) — kode yang dijalankan.:Elemen',
                        'skill:100%:Struktur Data — representasi informasi.:Elemen',
                        'skill:100%:Dokumentasi — panduan penggunaan & teknis.:Elemen',
                    ]
                },

                // -------------------------------------------------------------
                // MODUL 02
                // -------------------------------------------------------------
                {
                    id: 'modul02',
                    title: 'Pertemuan 2: Analisis & Desain',
                    lines: [
                        'Sebelum membangun software, kebutuhan harus dianalisis dan dirancang dengan jelas.',
                        '---',

                        '### Poin Utama',
                        'card:SRS:Software Requirement Specification — dokumen yang menjelaskan APA yang harus dibangun.',
                        'card:SDD:Software Design Document — dokumen yang menjelaskan BAGAIMANA sistem dibangun.',
                        '---',

                        '### Contoh Sederhana: DFD',
                        'table:[{"Level":"Konteks","Deskripsi":"Menggambarkan sistem sebagai satu proses tunggal dengan entitas luar."},{"Level":"Level 1","Deskripsi":"Memecah sistem menjadi beberapa proses utama."}]',
                    ]
                },

                // -------------------------------------------------------------
                // MODUL 03
                // -------------------------------------------------------------
                {
                    id: 'modul03',
                    title: 'Pertemuan 3: Pengujian Perangkat Lunak',
                    lines: [
                        'Pengujian memastikan perangkat lunak berjalan sesuai kebutuhan sebelum digunakan pengguna.',
                        '---',

                        '### Poin Utama',
                        'card:White Box:Menguji struktur internal kode, contoh: Cyclomatic Complexity.',
                        'card:Black Box:Menguji fungsi tanpa melihat kode, contoh: Boundary Value Analysis.',
                        '---',

                        '### Checklist Dasar',
                        'skill:100%:Memahami tujuan pengujian:Wajib',
                        'skill:80%:Mampu membuat test case sederhana:Penting',
                        '---',

                        'form:quiz',
                    ]
                },
            ]
        },
    ]
};
