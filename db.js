// ============================================================
// DB — Lapisan akses data untuk fitur peran (peserta/dosen/admin).
// ============================================================
// SEKARANG   : disimpan di localStorage, per "tabel" (array of object).
// NANTI (D1) : cukup ganti isi _read()/_write() di bawah agar memanggil
//              endpoint Worker (mis. fetch('/api/'+table)) alih-alih
//              localStorage. Nama fungsi publik (all/find/query/insert/
//              update/remove) sengaja dibuat setara operasi SQL dasar
//              (SELECT / SELECT WHERE / INSERT / UPDATE / DELETE) supaya
//              pemetaan ke SQL & pemanggil (auth.js, courses.js, dosen.js,
//              admin.js) TIDAK perlu diubah bentuknya — hanya perlu
//              ditambah `await` di titik pemanggilan karena fetch bersifat
//              asynchronous (db.js sengaja tidak dibuat Promise-based dari
//              awal, supaya mesin render script.js yang masih sinkron
//              tidak perlu dirombak sekarang).
//
// Skema tabel (tiap baris selalu punya field `id`):
//   users       : { id, username, password, name, role, email }
//                 role: 'peserta' | 'dosen' | 'admin'
//                 email: dipakai saat pendaftaran, juga untuk fitur lupa
//                 password (lihat auth.js) — harus unik per akun.
//   courses     : { id, slug, title, description, price, instructor,
//                   instructorUsername, period, categories }
//                 -> ini kursus TAMBAHAN/override dari dosen di atas
//                    kursus statis (pages/learn.js + pages/<slug>.js).
//                    Lihat courses.js untuk logika penggabungannya.
//   progress    : { id, username, slug, viewed: [], lastId }
//                 -> progress belajar PER AKUN (dicatat oleh override
//                    web.resolveLearningModule di courses.js).
//   passwordResets : { id, username, token, expiresAt }
//                 -> token reset password sekali pakai (lihat
//                    auth.requestPasswordReset / auth.resetPassword di
//                    auth.js). expiresAt = epoch ms; token dihapus begitu
//                    dipakai atau kadaluarsa.
// ============================================================
const DB_PREFIX = 'slsdb_';

const db = {
    _read(table) {
        try { return JSON.parse(localStorage.getItem(DB_PREFIX + table) || '[]'); }
        catch (e) { return []; }
    },

    _write(table, rows) {
        localStorage.setItem(DB_PREFIX + table, JSON.stringify(rows));
    },

    _id(table) {
        return table + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    all(table) {
        return this._read(table);
    },

    find(table, predicate) {
        return this._read(table).find(predicate) || null;
    },

    query(table, predicate) {
        return this._read(table).filter(predicate);
    },

    insert(table, row) {
        const rows = this._read(table);
        const record = { id: row.id || this._id(table), ...row };
        rows.push(record);
        this._write(table, rows);
        return record;
    },

    update(table, id, patch) {
        const rows = this._read(table);
        const idx = rows.findIndex(r => r.id === id);
        if (idx === -1) return null;
        rows[idx] = { ...rows[idx], ...patch };
        this._write(table, rows);
        return rows[idx];
    },

    /** Insert kalau belum ada baris yang cocok dengan matchFn, update kalau sudah ada. */
    upsertBy(table, matchFn, row) {
        const rows = this._read(table);
        const idx = rows.findIndex(matchFn);
        if (idx === -1) return this.insert(table, row);
        rows[idx] = { ...rows[idx], ...row };
        this._write(table, rows);
        return rows[idx];
    },

    remove(table, id) {
        this._write(table, this._read(table).filter(r => r.id !== id));
        return true;
    },

    seedIfEmpty(table, seedRows) {
        if (this._read(table).length === 0) this._write(table, seedRows);
    }
};

// --- Akun demo bawaan (hanya dibuat sekali, kalau tabel 'users' kosong) ---
// CATATAN: password disimpan polos untuk kesederhanaan demo client-side.
// Jangan dipakai apa adanya untuk data akun sungguhan / production.
db.seedIfEmpty('users', [
    { id: 'u_admin',   username: 'admin',   password: 'admin123',   name: 'Administrator',  role: 'admin',   email: 'admin@sls.demo'   },
    { id: 'u_dosen',   username: 'dosen',   password: 'dosen123',   name: 'Wawan Sismadi',  role: 'dosen',   email: 'dosen@sls.demo'   },
    { id: 'u_peserta', username: 'peserta', password: 'peserta123', name: 'Peserta Demo',   role: 'peserta', email: 'peserta@sls.demo' }
]);
