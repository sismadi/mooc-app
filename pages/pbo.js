pages.pbo = {
    categories: [
        {
            name: 'Bagian 1: Pemrograman Berorientasi Objek',
            items: [

                // -------------------------------------------------------------
                // MODUL 01
                // -------------------------------------------------------------
                {
                    id: 'pbo01',
                    title: 'Pertemuan 1: Pengenalan OOP',
                    lines: [
                        'Pemrograman Berorientasi Objek (OOP) adalah paradigma yang membungkus data dan perilaku ke dalam satu unit bernama objek.',
                        '---',

                        '### Poin Utama',
                        'card:Class:Cetak biru (blueprint) yang mendefinisikan atribut dan method suatu objek.',
                        'card:Object:Instance konkret yang dibuat dari sebuah class.',
                        '---',

                        '### 4 Pilar OOP',
                        'skill:100%:Encapsulation — menyembunyikan detail internal objek.:Pilar',
                        'skill:100%:Inheritance — pewarisan sifat antar class.:Pilar',
                        'skill:100%:Polymorphism — satu interface, banyak bentuk.:Pilar',
                        'skill:100%:Abstraction — fokus pada hal penting, sembunyikan kompleksitas.:Pilar',
                    ]
                },

                // -------------------------------------------------------------
                // MODUL 02
                // -------------------------------------------------------------
                {
                    id: 'pbo02',
                    title: 'Pertemuan 2: Class, Object & Constructor',
                    lines: [
                        'Class didefinisikan sekali, lalu bisa dibuat menjadi banyak object dengan constructor.',
                        '---',

                        '### Poin Utama',
                        'card:Constructor:Method khusus yang dijalankan otomatis saat object dibuat, biasa dipakai untuk inisialisasi atribut.',
                        'card:Method:Fungsi yang didefinisikan di dalam class untuk mendeskripsikan perilaku object.',
                        '---',

                        '### Contoh Sederhana',
                        '```javascript',
                        'class Mahasiswa {\n  constructor(nama, nim) {\n    this.nama = nama;\n    this.nim = nim;\n  }\n  perkenalan() {\n    return `Saya ${this.nama}, NIM ${this.nim}`;\n  }\n}\n\nconst m1 = new Mahasiswa("Budi", "2201001");\nconsole.log(m1.perkenalan());',
                        '```',
                    ]
                },

                // -------------------------------------------------------------
                // MODUL 03
                // -------------------------------------------------------------
                {
                    id: 'pbo03',
                    title: 'Pertemuan 3: Inheritance & Polymorphism',
                    lines: [
                        'Inheritance memungkinkan sebuah class mewarisi atribut dan method dari class lain, sedangkan polymorphism memungkinkan method yang sama berperilaku berbeda.',
                        '---',

                        '### Poin Utama',
                        'card:Inheritance:Class turunan (child) mewarisi class induk (parent) menggunakan kata kunci extends.',
                        'card:Overriding:Class turunan mendefinisikan ulang method milik parent dengan perilaku baru.',
                        '---',

                        '### Checklist Dasar',
                        'skill:100%:Memahami relasi parent-child pada class:Wajib',
                        'skill:80%:Mampu melakukan method overriding sederhana:Penting',
                    ]
                },
            ]
        },
    ]
};
