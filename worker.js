const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AnonymizeUA = require('puppeteer-extra-plugin-anonymize-ua');
const UserAgent = require('user-agents');
const { faker } = require('@faker-js/faker');
const SMSPool = require('./smsPool');
const config = require('./config');

// Konfigurasi Ultra Stealth
puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUA({
    customFn: () => new UserAgent({ deviceCategory: 'desktop' }).toString(),
}));

class Worker {
    constructor(workerId, proxy = null) {
        this.workerId = workerId;
        this.proxy = proxy;
        this.smsPool = new SMSPool();
    }

    generateHumanIdentity(customData = {}) {
        let firstName = customData.firstName;
        let lastName = customData.lastName;
        
        if (!firstName || !lastName) {
            const name = faker.person.fullName().split(" ");
            firstName = firstName || name[0];
            lastName = lastName || name[name.length - 1];
        }

        firstName = firstName.replace(/[^a-zA-Z]/g, '');
        lastName = lastName.replace(/[^a-zA-Z]/g, '');
        const email = customData.customEmail ? customData.customEmail : `${firstName.toLowerCase()}${lastName.toLowerCase()}@gmail.com`;
        const month = customData.dobMonth || "5"; 
        const day = customData.dobDay || "15";
        const year = customData.dobYear || "1995";
        
        return { firstName, lastName, email, month, day, year };
    }

    async createAccount(params = {}) {
        const identity = this.generateHumanIdentity(params);
        const password = params.customPassword 
            ? params.customPassword 
            : (config.DEFAULT_PASSWORD + Math.floor(Math.random() * 900) + 100);

        let browser;
        let phone = null;

        try {
            const launchArgs = [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-dev-shm-usage'
            ];
            if (this.proxy) launchArgs.push(`--proxy-server=http://${this.proxy}`);

            browser = await puppeteer.launch({ 
                headless: config.HEADLESS_MODE, 
                args: launchArgs,
                ignoreDefaultArgs: ['--enable-automation']
            });
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            
            // Bypass Webdriver & WebRTC Leak
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.RTCPeerConnection = undefined;
            });

            await page.goto('https://accounts.google.com/signup/v2/webcreateaccount?flowName=GlifWebSignIn&flowEntry=SignUp', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);

            await page.type('input[name="firstName"]', identity.firstName);
            await page.type('input[name="lastName"]', identity.lastName);
            await page.click('button[type="submit"]');
            await page.waitForTimeout(1500);

            await page.select('select[id="month"]', identity.month); 
            await page.type('input[id="day"]', identity.day);
            await page.type('input[id="year"]', identity.year);
            await page.select('select[id="gender"]', '1'); 
            await page.click('button[type="submit"]');
            await page.waitForTimeout(1500);

            const hasCustomEmailField = await page.$('input[name="Username"]');
            if (hasCustomEmailField && params.customEmail) {
                await page.click('input[name="Username"]', { clickCount: 3 });
                await page.type('input[name="Username"]', params.customEmail.split('@')[0]);
                await page.click('button[type="submit"]');
                await page.waitForTimeout(1500);
            }

            phone = await this.smsPool.getFreeNumber();
            if (!phone) throw new Error("POOL_EMPTY");
            
            await page.type('input[name="phoneNumber"]', phone);
            await page.click('button[type="submit"]');
            await page.waitForTimeout(2000);

            const hasCaptcha = await page.$('iframe[src*="recaptcha"]');
            if (hasCaptcha) throw new Error("CAPTCHA_BLOCK");

            const otp = await this.smsPool.pollOtp(phone);
            if (!otp) throw new Error("OTP_TIMEOUT");

            await page.type('input[name="code"]', otp);
            await page.click('button[type="submit"]');
            await page.waitForTimeout(3000);

            return { 
                status: "success", 
                email: identity.email, 
                password, 
                phone,
                firstName: identity.firstName,
                lastName: identity.lastName,
                dobMonth: identity.month,
                dobDay: identity.day,
                dobYear: identity.year
            };

        } catch (err) {
            return { 
                status: "failed", 
                email: identity.email, 
                password, 
                phone, 
                error: err.message,
                firstName: identity.firstName,
                lastName: identity.lastName
            };
        } finally {
            if (browser) await browser.close();
        }
    }
}
module.exports = Worker;
