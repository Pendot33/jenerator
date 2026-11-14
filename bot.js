const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const db = require('./db');
const Worker = require('./worker');

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// Middleware Auth
bot.on('message', (msg) => {
    if (msg.from.id !== config.OWNER_ID) {
        if (msg.chat.type !== 'private') bot.deleteMessage(msg.chat.id, msg.message_id).catch(()=>{});
        return;
    }
});

// State Machine
const userStates = {};
const setState = (id, state, data = {}) => { userStates[id] = { state, ...data }; };
const getState = (id) => userStates[id] || null;
const clearState = (id) => { delete userStates[id]; };

// ==========================================
// UI CONSTANTS (Dev: @infalgin)
// ==========================================
const UI_BANNER = `
╔═════════════════════════════════════════╗
║   🏛  SOVEREIGN GMAIL FACTORY  🏛      ║
║    [ ULTRA STEALTH ENGINE v3.0 ]        ║
║    Dev: @infalgin                       ║
╚═════════════════════════════════════════╝
`;

const MAIN_MENU_KEYBOARD = {
    inline_keyboard: [
        [{ text: "🏛  PRODUCTION FLOOR", callback_data: "menu_factory" }],
        [{ text: "👤  SINGLE IDENTITY CREATOR", callback_data: "menu_single" }],
        [{ text: "📊  LIVE METRICS", callback_data: "menu_stats" }]
    ]
};

const FACTORY_MENU_KEYBOARD = {
    inline_keyboard: [
        [{ text: "🦅  GENERATE HUMAN NAMES (100)", callback_data: "bulk_human_100" }],
        [{ text: "🦅  GENERATE HUMAN NAMES (500)", callback_data: "bulk_human_500" }],
        [{ text: "🦅  GENERATE HUMAN NAMES (1000)", callback_data: "bulk_human_1000" }],
        [{ text: "⚙️  SET BULK CUSTOM PASSWORD", callback_data: "bulk_set_password" }],
        [{ text: "⬅️  RETURN TO MAIN HALL", callback_data: "menu_main" }]
    ]
};

// ==========================================
// HANDLER UTAMA
// ==========================================
bot.onText(/\/start/, (msg) => {
    if (msg.from.id !== config.OWNER_ID) return;
    clearState(msg.from.id);
    bot.sendMessage(msg.chat.id, 
        UI_BANNER + 
        "\nWelcome, Authorizer.\n" +
        "Sistem produksi massal ULTRA STEALTH telah siap.\n" +
        "Bebas deteksi, bebas hambatan, error di-handle otomatis.\n" +
        "─────────────────────────────────────────",
        { reply_markup: MAIN_MENU_KEYBOARD }
    );
});

bot.on('callback_query', async (query) => {
    if (query.from.id !== config.OWNER_ID) return bot.answerCallbackQuery(query.id, { text: "Akses Ditolak." });
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;
    clearState(userId);

    if (data === 'menu_main') {
        const stats = db.getStats();
        bot.editMessageText(
            UI_BANNER + 
            `\n📊 SUCCESS: ${stats.success} | FAILED: ${stats.failed}\n` +
            "Pilih menu:",
            { chat_id: chatId, message_id: query.message.message_id, reply_markup: MAIN_MENU_KEYBOARD }
        );
    }
    
    else if (data === 'menu_stats') {
        const stats = db.getStats();
        bot.editMessageText(
            UI_BANNER + 
            `\n📊 LIVE METRICS\n` +
            `─────────────────\n` +
            `Sukses: ${stats.success}\n` +
            `Gagal : ${stats.failed}\n` +
            `Status: [ OPTIMAL ]`,
            { chat_id: chatId, message_id: query.message.message_id, reply_markup: MAIN_MENU_KEYBOARD }
        );
    }

    else if (data === 'menu_factory') {
        bot.editMessageText(
            UI_BANNER + 
            "\n🏛 BULK PRODUCTION FLOOR\n" +
            "─────────────────────────\n" +
            "Mode Ultra Stealth diaktifkan.\n" +
            "Nama di-generate dari database manusia asli.\n\n" +
            "Pilih target:",
            { chat_id: chatId, message_id: query.message.message_id, reply_markup: FACTORY_MENU_KEYBOARD }
        );
    }

    else if (data === 'bulk_set_password') {
        setState(userId, 'AWAITING_BULK_PASSWORD');
        bot.editMessageText(
            UI_BANNER + 
            "\n⚙️ KIRIM PASSWORD KUSTOM UNTUK BULK\n" +
            "Ketik password yang diinginkan.\n" +
            "Ketik /skip untuk menggunakan password acak.",
            { chat_id: chatId, message_id: query.message.message_id }
        );
    }

    else if (data.startsWith('bulk_human_')) {
        const count = parseInt(data.split('_')[2]);
        bot.editMessageText(
            UI_BANNER + 
            `\n🚀 INITIALIZING BULK HUMAN PRODUCTION...\n` +
            `Target: ${count} Akun (Nama Manusia)\n` +
            `Engine: ULTRA STEALTH\n` +
            `Status: RUNNING`,
            { chat_id: chatId, message_id: query.message.message_id }
        );
        runJob(chatId, query.message.message_id, count, { customPassword: null });
    }

    else if (data === 'menu_single') {
        setState(userId, 'SINGLE_AWAIT_FIRST_NAME');
        bot.editMessageText(
            UI_BANNER + 
            "\n👤 SINGLE IDENTITY CREATOR\n" +
            "─────────────────────────\n" +
            "Masukkan Nama Depan.\n" +
            "Ketik /skip untuk mengabaikan (pakai nama random).",
            { chat_id: chatId, message_id: query.message.message_id }
        );
    }
});

// ==========================================
// STATE MACHINE (SINGLE FLOW)
// ==========================================
bot.on('message', async (msg) => {
    if (msg.from.id !== config.OWNER_ID) return;
    const state = getState(msg.from.id);
    if (!state) return;

    const text = msg.text;
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (state.state === 'AWAITING_BULK_PASSWORD') {
        if (text === '/skip') {
            clearState(userId);
            bot.sendMessage(chatId, "Password bulk diabaikan. Kembali ke menu.", { reply_markup: FACTORY_MENU_KEYBOARD });
        } else {
            setState(userId, 'BULK_PASSWORD_SET', { customPassword: text });
            bot.sendMessage(chatId, `Password bulk diset: ${text}\nSekarang pilih tombol generate.`, { reply_markup: FACTORY_MENU_KEYBOARD });
        }
        return;
    }

    if (state.state === 'SINGLE_AWAIT_FIRST_NAME') {
        const firstName = text === '/skip' ? null : text;
        setState(userId, 'SINGLE_AWAIT_LAST_NAME', { firstName });
        bot.sendMessage(chatId, "Masukkan Nama Belakang.\nKetik /skip untuk mengabaikan.");
        return;
    }

    if (state.state === 'SINGLE_AWAIT_LAST_NAME') {
        const lastName = text === '/skip' ? null : text;
        setState(userId, 'SINGLE_AWAIT_EMAIL', { firstName: state.firstName, lastName });
        bot.sendMessage(chatId, "Masukkan Email Kustom (contoh: target@gmail.com).\nKetik /skip untuk generate otomatis.");
        return;
    }

    if (state.state === 'SINGLE_AWAIT_EMAIL') {
        const customEmail = text === '/skip' ? null : text;
        setState(userId, 'SINGLE_AWAIT_PASSWORD', { firstName: state.firstName, lastName: state.lastName, customEmail });
        bot.sendMessage(chatId, "Masukkan Password.\nKetik /skip untuk password default.");
        return;
    }

    if (state.state === 'SINGLE_AWAIT_PASSWORD') {
        const customPassword = text === '/skip' ? null : text;
        setState(userId, 'SINGLE_AWAIT_DOB', { firstName: state.firstName, lastName: state.lastName, customEmail: state.customEmail, customPassword });
        bot.sendMessage(chatId, "Masukkan Tanggal Lahir (Format: BULAN-TANGGAL-TAHUN, cth: 5-15-1995).\nKetik /skip untuk abaikan.");
        return;
    }

    if (state.state === 'SINGLE_AWAIT_DOB') {
        let dobMonth, dobDay, dobYear;
        if (text !== '/skip') {
            const parts = text.split('-');
            if (parts.length === 3) {
                dobMonth = parts[0];
                dobDay = parts[1];
                dobYear = parts[2];
            }
        }

        const params = {
            firstName: state.firstName,
            lastName: state.lastName,
            customEmail: state.customEmail,
            customPassword: state.customPassword,
            dobMonth, dobDay, dobYear
        };
        
        clearState(userId);
        bot.sendMessage(chatId, "⏳ Memproses Single Identity (Ultra Stealth)...");
        
        const worker = new Worker(`SINGLE`, null);
        const res = await worker.createAccount(params);
        
        if (res.status === "success") {
            db.saveAccount(res);
            bot.sendMessage(chatId, 
                UI_BANNER + 
                `\n✅ SINGLE ACCOUNT CREATED\n` +
                `Email: ${res.email}\n` +
                `Pass: ${res.password}\n` +
                `Nama: ${res.firstName} ${res.lastName}\n` +
                `No HP: ${res.phone}`,
                { reply_markup: MAIN_MENU_KEYBOARD }
            );
        } else {
            bot.sendMessage(chatId, `❌ GAGAL: ${res.error}`, { reply_markup: MAIN_MENU_KEYBOARD });
        }
        return;
    }
});

// ==========================================
// CORE BULK JOB RUNNER (Ultra Engine)
// ==========================================
async function runJob(chatId, messageId, count, params = {}) {
    const jobId = crypto.randomBytes(4).toString('hex');
    db.createJob(jobId, count);

    let completed = 0;
    let failed = 0;
    let activeWorkers = 0;
    let currentIndex = 0;
    
    const resultFile = path.join(__dirname, `results_${jobId}.txt`);
    fs.writeFileSync(resultFile, "");

    const runNext = async () => {
        if (currentIndex >= count && activeWorkers === 0) {
            db.updateJob(jobId, completed, failed, 'FINISHED');
            bot.sendMessage(chatId, 
                `✅ JOB SELESAI: ${jobId}\n` +
                `Sukses: ${completed} | Gagal: ${failed}`
            );
            if (completed > 0) {
                await bot.sendDocument(chatId, resultFile, { caption: `Hasil Job ${jobId} (Email|Pass|Phone|Nama)` });
            }
            return;
        }

        if (currentIndex >= count) return;

        const proxy = config.PROXY_LIST.length > 0 
            ? config.PROXY_LIST[Math.floor(Math.random() * config.PROXY_LIST.length)] : null;

        const worker = new Worker(`W-${activeWorkers}`, proxy);
        currentIndex++;
        activeWorkers++;

        const bulkPassword = userStates[chatId]?.state === 'BULK_PASSWORD_SET' ? userStates[chatId].customPassword : null;
        
        worker.createAccount({ ...params, customPassword: bulkPassword }).then((res) => {
            if (res.status === "success") {
                completed++;
                db.saveAccount(res);
                fs.appendFileSync(resultFile, `${res.email}|${res.password}|${res.phone}|${res.firstName} ${res.lastName}\n`);
            } else {
                failed++;
                db.saveAccount({ ...res, status: 'FAILED' });
            }
            
            db.updateJob(jobId, completed, failed, 'RUNNING');
            
            if ((completed + failed) % 10 === 0) {
                bot.editMessageText(
                    `${UI_BANNER}\n` +
                    `⚙️ ULTRA PRODUCTION RUNNING [Job: ${jobId}]\n` +
                    `───────────────────────\n` +
                    `Progress: ${completed + failed}/${count}\n` +
                    `Sukses: ${completed} | Gagal: ${failed}`,
                    { chat_id: chatId, message_id: messageId }
                ).catch(() => {});
            }
        }).catch(() => {
            failed++;
            db.updateJob(jobId, completed, failed, 'RUNNING');
        }).finally(() => {
            activeWorkers--;
            runNext();
        });
    };

    for (let i = 0; i < config.CONCURRENT_WORKERS; i++) {
        if (currentIndex < count) runNext();
    }
}

console.log("Sovereign Factory Ultra berjalan...");
