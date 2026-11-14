module.exports = {
    BOT_TOKEN: "YOUR_TELEGRAM_BOT_TOKEN",
    OWNER_ID: 123456789,
    DB_PATH: "./private_creator.db",
    
    SMS_API_BASE: "https://api.sms24.me/api/v1",
    SMS_COUNTRY: "indonesia",
    
    DEFAULT_PASSWORD: "UltraSecure123!",
    OTP_TIMEOUT_MS: 120000,

    // ULTRA PERFORMANCE SETTINGS
    CONCURRENT_WORKERS: 10,    // Naikkan ke 10-20 jika RAM server > 8GB
    BATCH_SIZE: 100,
    MAX_RETRIES: 3,            // Retry maksimal per akun jika gagal
    RETRY_DELAY_MS: 2000,      // Jeda sebelum retry
    HEADLESS_MODE: "new",      // Gunakan mode headless baru (lebih cepat & stealthy)
    
    // Proxy List (Wajib untuk skala 1000. Format: ip:port atau user:pass@ip:port)
    PROXY_LIST: [
        // "192.168.1.100:8080",
        // "user:pass@10.0.0.5:3128",
    ]
};
