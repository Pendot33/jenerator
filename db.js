const Database = require('better-sqlite3');
const config = require('./config');

const db = new Database(config.DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS gmail_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone_number TEXT,
    first_name TEXT,
    last_name TEXT,
    dob_month TEXT,
    dob_day TEXT,
    dob_year TEXT,
    status TEXT DEFAULT 'SUCCESS',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    total_target INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'RUNNING',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

function createJob(jobId, total) {
    return db.prepare(`INSERT INTO jobs (job_id, total_target) VALUES (?, ?)`).run(jobId, total);
}

function updateJob(jobId, completed, failed, status) {
    return db.prepare(`UPDATE jobs SET completed = ?, failed = ?, status = ? WHERE job_id = ?`).run(completed, failed, status, jobId);
}

function saveAccount(data) {
    try {
        return db.prepare(`
            INSERT INTO gmail_accounts (email, password, phone_number, first_name, last_name, dob_month, dob_day, dob_year, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(data.email, data.password, data.phone, data.firstName, data.lastName, data.dobMonth, data.dobDay, data.dobYear, data.status || 'SUCCESS');
    } catch (e) {
        return null;
    }
}

function getStats() {
    const success = db.prepare(`SELECT COUNT(*) as c FROM gmail_accounts WHERE status = 'SUCCESS'`).get().c;
    const failed = db.prepare(`SELECT COUNT(*) as c FROM gmail_accounts WHERE status = 'FAILED'`).get().c;
    return { success, failed };
}

module.exports = { createJob, updateJob, saveAccount, getStats };
