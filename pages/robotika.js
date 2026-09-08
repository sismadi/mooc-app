pages.robotika = {
    categories: [
        {
            name: 'Bagian 1: Dasar Robotika',
            items: [

                // -------------------------------------------------------------
                // MODUL 01
                // -------------------------------------------------------------
                {
                    id: 'robo01',
                    title: 'Pertemuan 1: Pengenalan Robotika',
                    lines: [
                        'Robotika adalah cabang ilmu yang mempelajari perancangan, pembuatan, dan pengoperasian robot untuk membantu atau menggantikan pekerjaan manusia.',
                        '---',

                        '### Poin Utama',
                        'card:Robot:Sistem mekanik-elektronik yang dapat merasakan lingkungan (sensor), berpikir (kontroler), dan bertindak (aktuator).',
                        'card:Sistem Kontrol:Otak dari robot yang memproses input sensor menjadi perintah gerak.',
                        '---',

                        '### 3 Komponen Dasar Robot',
                        'skill:100%:Sensor — menangkap kondisi lingkungan.:Komponen',
                        'skill:100%:Kontroler — memproses data dan mengambil keputusan.:Komponen',
                        'skill:100%:Aktuator — mengeksekusi gerakan fisik.:Komponen',
                    ]
                },

                // -------------------------------------------------------------
                // MODUL 02
                // -------------------------------------------------------------
                {
                    id: 'robo02',
                    title: 'Pertemuan 2: Sensor & Aktuator',
                    lines: [
                        'Sensor memberi robot kemampuan "merasakan", sementara aktuator memberi robot kemampuan "bergerak".',
                        '---',

                        '### Poin Utama',
                        'card:Sensor Umum:Ultrasonik (jarak), LDR (cahaya), IR (garis/halangan), accelerometer (kemiringan).',
                        'card:Aktuator Umum:Motor DC, motor servo, motor stepper.',
                        '---',

                        '### Perbandingan Aktuator',
                        'table:[{"Jenis":"Motor DC","Karakteristik":"Putaran kontinu, kecepatan diatur PWM"},{"Jenis":"Motor Servo","Karakteristik":"Sudut presisi 0–180 derajat"},{"Jenis":"Motor Stepper","Karakteristik":"Gerak per langkah, presisi posisi tinggi"}]',
                    ]
                },

                // -------------------------------------------------------------
                // MODUL 03
                // -------------------------------------------------------------
                {
                    id: 'robo03',
                    title: 'Pertemuan 3: Dasar Pemrograman Mikrokontroler',
                    lines: [
                        'Mikrokontroler seperti Arduino menjalankan logika kontrol sederhana untuk membaca sensor dan menggerakkan aktuator.',
                        '---',

                        '### Poin Utama',
                        'card:Struktur Program:Terdiri dari setup() untuk inisialisasi dan loop() yang berjalan berulang.',
                        'card:Logika Kontrol:Umumnya berbentuk kondisi if/else berdasarkan pembacaan sensor.',
                        '---',

                        '### Contoh Sederhana',
                        '```cpp',
                        'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}',
                        '```',
                    ]
                },
            ]
        },
    ]
};
