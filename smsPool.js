const axios = require('axios');
const config = require('./config');

class SMSPool {
    constructor() {
        this.client = axios.create({
            baseURL: config.SMS_API_BASE,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
    }

    async getFreeNumber(country = config.SMS_COUNTRY) {
        try {
            const res = await this.client.get('/numbers', { params: { country } });
            if (res.data && res.data.length > 0) {
                return res.data[0].number;
            }
            return null;
        } catch (err) {
            return null;
        }
    }

    async pollOtp(number) {
        const start = Date.now();
        while (Date.now() - start < config.OTP_TIMEOUT_MS) {
            try {
                const res = await this.client.get('/messages', { params: { number } });
                if (res.data && res.data.length > 0) {
                    const match = (res.data[0].text || "").match(/\b\d{6}\b/);
                    if (match) return match[0];
                }
            } catch (err) {}
            await new Promise(r => setTimeout(r, 5000));
        }
        return null;
    }
}
module.exports = SMSPool;
