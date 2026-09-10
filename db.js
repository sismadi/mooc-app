// ============================================================
// DB — Lapisan akses data untuk fitur peran (peserta/dosen/admin).
// ============================================================
// VERSI D1: _read()/_write() diganti fetch() ke Worker API (worker.js),
// yang membaca/menulis ke Cloudflare D1. Nama & bentuk fungsi publik
// (all/find/query/insert/update/remove/upsertBy) TETAP SAMA seperti
// versi localStorage, sesuai rencana migrasi yang sudah tertulis di
// komentar file ini sebelumnya — pemanggil (auth.js, courses.js,
// dosen.js, admin.js, quiz.js) hanya perlu ditambah `await` di setiap
// titik pemanggilan karena fetch bersifat asynchronous.
//
// PENTING — db.js versi ini TIDAK sinkron lagi, jadi mesin render
// script.js yang masih sinkron (courseSvc.list(), quizSvc.of(), dst.)
// perlu diaudit satu-satu: fungsi apa pun yang memanggil salah satu
// method db.* di bawah harus ikut jadi async function dan dipanggil
// dengan await, sampai ke titik yang memicu render (onclick, onsubmit,
// override components.*). Ini efek berantai yang sudah diperkirakan
// di komentar db.js versi sebelumnya.
//
// Skema tabel: lihat schema.sql (7 tabel: users, courses, progress,
// passwordResets, quizzes, quizAttempts, certificates)
// ============================================================
const API_BASE = '/api';

async function apiGet(path) {
    const res = await fetch(`${API_BASE}/${path}`);
    if (!res.ok) throw new Error(`GET ${path} gagal (${res.status})`);
    return res.json();
}

async function apiSend(method, path, body) {
    const res = await fetch(`${API_BASE}/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${method} ${path} gagal (${res.status})`);
    return res.json();
}

const db = {
    async all(table) {
        return apiGet(table);
    },

    async find(table, predicate) {
        const rows = await this.all(table);
        return rows.find(predicate) || null;
    },

    async query(table, predicate) {
        const rows = await this.all(table);
        return rows.filter(predicate);
    },

    async insert(table, row) {
        return apiSend('POST', table, row);
    },

    async update(table, id, patch) {
        return apiSend('PATCH', `${table}/${id}`, patch);
    },

    /** Insert kalau belum ada baris yang cocok dengan matchFn, update kalau sudah ada. */
    async upsertBy(table, matchFn, row) {
        const rows = await this.all(table);
        const existing = rows.find(matchFn);
        if (!existing) return this.insert(table, row);
        return this.update(table, existing.id, row);
    },

    async remove(table, id) {
        await apiSend('DELETE', `${table}/${id}`);
        return true;
    },

    // seedIfEmpty dihapus dari client — akun demo & kuis contoh (RPL)
    // sekarang dibuat lewat INSERT di schema.sql (dijalankan sekali saat
    // setup database D1), bukan dicek ulang tiap load halaman.
};
