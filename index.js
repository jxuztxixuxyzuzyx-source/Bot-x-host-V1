const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser
} = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const pino  = require('pino');
const fs    = require('fs');
const path  = require('path');
const axios = require('axios');
require('dotenv').config();

// ── Optional libs ──────────────────────────────
let yts = null;     try { yts = require('yt-search'); }            catch(e) {}
let ytdl = null;    try { ytdl = require('@distube/ytdl-core'); }  catch(e) {}
let playdl = null;  try { playdl = require('play-dl'); }           catch(e) {}

// NSFW detector (optional)
let nsfwjs = null, tf = null;
try {
    nsfwjs = require('nsfwjs');
    tf     = require('@tensorflow/tfjs-node');
} catch(e) {
    console.log('⚠️ nsfwjs/tfjs-node nahi mila — NSFW skip');
}

const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT = process.env.ADMIN_CHAT_ID;

if (!TG_TOKEN) { console.log('❌ TELEGRAM_BOT_TOKEN missing'); process.exit(1); }

// ══════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════
const CONFIG_PATH = path.join(__dirname, 'config.json');
const loadConfig = () => { try { return JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8')); } catch { return {}; } };
const saveConfig = (c) => fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2));
const getBotImg  = () => loadConfig().BOT_IMG || '';
const getIGLink  = () => loadConfig().IG_LINK || 'https://www.instagram.com/akash___exploit___';
const getBotName = () => loadConfig().BOT_NAME || 'AKASH EXPLOIT MD';
const getDevName = () => loadConfig().DEV_NAME || 'AKASH';
const getPrefix  = () => loadConfig().PREFIX || '.';

// ══════════════════════════════════════════════
// GLOBAL STATE
// ══════════════════════════════════════════════
const tgBot     = new TelegramBot(TG_TOKEN, { polling: true });
const sessions  = {};
const warns     = {};
const antispam  = {};
const pendingToken = {};

// ══════════════════════════════════════════════
// MULTI-TOKEN SYSTEM (users.json)
// ══════════════════════════════════════════════
const USERS_PATH = path.join(__dirname, 'users.json');
const userBots   = {};
const loadUsers = () => { try { return JSON.parse(fs.readFileSync(USERS_PATH,'utf8')); } catch { return {}; } };
const saveUsers = (u) => fs.writeFileSync(USERS_PATH, JSON.stringify(u, null, 2));

function spawnUserBot(token, chatId, sessionKey) {
    if (userBots[token]) {
        console.log(`⚠️ UserBot already running: ${token.slice(0,12)}...`);
        return userBots[token].bot;
    }
    const bot = new TelegramBot(token, { polling: true });
    bot.on('polling_error', e => console.log(`[UB ${token.slice(0,10)}]`, e.message));

    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const text = msg.text.trim();
        const from = msg.chat.id;

        if (text.startsWith('/pair')) {
            const phone = text.replace('/pair','').trim().replace(/[^0-9]/g,'');
            if (phone.length < 10) return bot.sendMessage(from, '❌ `/pair 919876543210`', { parse_mode:'Markdown' });
            const skey = `${sessionKey}_${phone}`;
            if (sessions[skey]) return bot.sendMessage(from, '⚠️ Already connected.');
            const s = new Session(String(from), skey); s.userBot = bot;
            sessions[skey] = s;
            await s.start(phone).catch(e => bot.sendMessage(from, `❌ ${e.message}`));
            bot.sendMessage(from, '⏳ Pairing code aayega...');
        }
        else if (text === '/status') {
            const a = Object.keys(sessions).filter(k => k.startsWith(sessionKey));
            bot.sendMessage(from, `📊 Active Sessions: ${a.length}\n\n⚡ ${getBotName()}`);
        }
        else if (text === '/menu' || text === '/start') {
            bot.sendMessage(from,
                `🖤⚡ *${getBotName()}* ⚡🖤\n\n` +
                `📌 *Commands:*\n` +
                `• \`/pair <phone>\` — WhatsApp connect\n` +
                `• \`/status\` — sessions\n` +
                `• \`/menu\` — help\n\n` +
                `👑 ${getDevName()}\n📸 ${getIGLink()}`,
                { parse_mode:'Markdown' });
        }
    });

    userBots[token] = { token, chatId, bot, sessionKey };
    console.log(`✅ UserBot spawned ${token.slice(0,12)}... chat=${chatId}`);
    return bot;
}

(function restore() {
    const users = loadUsers();
    for (const [chatId, d] of Object.entries(users)) {
        try { spawnUserBot(d.token, String(chatId), String(chatId)); }
        catch(e) { console.log('restore fail:', e.message); }
    }
})();

// ── Main bot admin commands ────────────────────
tgBot.on('message', async (msg) => {
    if (!msg.text) return;
    const from = String(msg.chat.id);
    const text = msg.text.trim();
    if (ADMIN_CHAT && from !== String(ADMIN_CHAT)) return;

    if (text.startsWith('/addtoken')) {
        const token = text.replace('/addtoken','').trim();
        if (!/^\d+:.+/.test(token)) return tgBot.sendMessage(from, '❌ Invalid token format');
        try {
            const r = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout:10000 });
            if (!r.data.ok) throw new Error('bad token');
            const u = loadUsers();
            u[from] = {
                token,
                botId: String(r.data.result.id),
                botUsername: r.data.result.username,
                addedAt: Date.now()
            };
            saveUsers(u);
            spawnUserBot(token, from, from);
            tgBot.sendMessage(from, `✅ Added @${r.data.result.username}`, { parse_mode:'Markdown' });
        } catch(e) {
            tgBot.sendMessage(from, `❌ ${e.message}`);
        }
    }
    else if (text === '/users') {
        const u = loadUsers();
        const l = Object.entries(u).map(([c,d],i)=>`${i+1}. ${c} → @${d.botUsername||'?'}`).join('\n') || 'none';
        tgBot.sendMessage(from, `👥 Users:\n${l}`);
    }
});

// ══════════════════════════════════════════════
// FOLDERS
// ══════════════════════════════════════════════
['tmp','temp','assets','sessions'].forEach(d =>
    fs.mkdirSync(path.join(__dirname, d), { recursive: true }));

// ══════════════════════════════════════════════
// FILTERS / DETECTORS
// ══════════════════════════════════════════════
const GALI = [
    'madarchod','maderchod','bhenchod','bsdk','chutiya','chutiye',
    'randi','harami','kamina','gandu','gaandu','bhosdike','bhosdi',
    'lauda','lund','fuck','fucker','fucking','bitch','bastard',
    'asshole','motherfucker','bc','mc','lode','sala','saala',
    'haramzada','kutte','kamine','ullu','gadha','sex','porn','xxx',
    'nude','nudes','boobs','dick','pussy','cipap','loda','chudai',
    'chodna','chod','gaand','gand','chut','choot'
];

const hasGali = (t) => {
    if (!t) return false;
    const l = t.toLowerCase().replace(/[^a-z\u0900-\u097f ]/g, ' ');
    return GALI.some(w => l.includes(w));
};

function isEmojiOnly(t) {
    if (!t?.trim()) return false;
    const c = t.replace(
        /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}]/gu, ''
    ).replace(/\s/g, '').trim();
    return c.length === 0;
}

const LINK_REGEX = /(https?:\/\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|t\.me\/[^\s]+|bit\.ly\/[^\s]+)/i;
const isLink = (t) => LINK_REGEX.test(t || '');

const isForwarded = (msg) => {
    const m = msg.message || {};
    const ctx = m.extendedTextMessage?.contextInfo
             || m.imageMessage?.contextInfo
             || m.videoMessage?.contextInfo
             || m.documentMessage?.contextInfo;
    return !!ctx?.isForwarded;
};

function isSpam(gid, sid) {
    const k = `${gid}_${sid}`;
    const now = Date.now();
    if (!antispam[k]) antispam[k] = [];
    antispam[k] = antispam[k].filter(t => now - t < 10000);
    antispam[k].push(now);
    return antispam[k].length >= 6;
}

let nsfwModel = null;
(async () => {
    if (!nsfwjs || !tf) return;
    try { nsfwModel = await nsfwjs.load(); console.log('✅ NSFW model loaded'); }
    catch(e) { console.log('⚠️ NSFW load fail:', e.message); }
})();

async function isNSFWImage(buffer) {
    if (!nsfwModel) return false;
    try {
        const img = await tf.node.decodeImage(buffer, 3);
        const preds = await nsfwModel.classify(img);
        img.dispose();
        const porn   = preds.find(p => p.className === 'Porn')?.probability   || 0;
        const hentai = preds.find(p => p.className === 'Hentai')?.probability || 0;
        const sexy   = preds.find(p => p.className === 'Sexy')?.probability   || 0;
        return (porn > 0.7) || (hentai > 0.7) || (sexy > 0.85);
    } catch(e) { return false; }
}

async function safeSend(sock, jid, content, opts = {}) {
    try {
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise(r => setTimeout(r, 300 + Math.random()*500));
        return await sock.sendMessage(jid, content, opts);
    } catch(e) {
        if (/rate|too many/i.test(e.message)) {
            await new Promise(r => setTimeout(r, 5000));
            return sock.sendMessage(jid, content, opts).catch(()=>{});
        }
        throw e;
    }
}

// ══════════════════════════════════════════════
// CARDS
// ══════════════════════════════════════════════
function welcomeCard(name, groupName, memberCount, desc) {
    return `╔══════════════════════════════════╗
║   ⚡  ${getBotName()}  ⚡   
║     👑  Welcome New Member       
╚══════════════════════════════════╝

🎉 *Welcome to ${groupName}!*
👋 Aayo *${name}* bhai!

👥 *Total Members:* ${memberCount}
📌 *Group:* ${groupName}
${desc ? `📝 *About:* ${desc}\n` : ''}
📌 *Rules:*
✅ Sabka izzat karo
🚫 Gali = 3 Warn → KICK
🚫 Link/Forward = KICK
🚫 NSFW Media = Instant KICK
🚫 Sirf Emoji = KICK
🚫 Spam = KICK

📋 Commands: *.menu*
👑 ${getDevName()}
📸 ${getIGLink()}
⚡ *${getBotName()}*`;
}

function goodbyeCard(name) {
    return `👋 *${name}* ne group chhod diya 😢
🖤 Umeed hai wapas aayega!

⚡ *${getBotName()}*`;
}

function groupAddedCard(meta) {
    return `╔══════════════════════════════════╗
║   ⚡  ${getBotName()}  ⚡   
║      📋 Group Joined Info        
╚══════════════════════════════════╝

✅ *Bot added to this group!*

📌 *Group Name:* ${meta.subject}
👥 *Total Members:* ${meta.participants.length}
📅 *Created:* ${new Date(meta.creation * 1000).toLocaleDateString('en-IN')}
👑 *Owner:* ${meta.owner ? '@' + meta.owner.split('@')[0] : 'Unknown'}
${meta.desc ? `📝 *Description:* ${meta.desc}\n` : ''}
🆔 *Group ID:* \`${meta.id}\`

🛡️ *Auto Protection Active:*
✅ Anti-Gali    ✅ Anti-Link
✅ Anti-NSFW    ✅ Anti-Spam
✅ Anti-Forward ✅ Anti-Emoji

📋 Type *.menu* for commands!
🔑 Type *.addtoken* to add your own Telegram bot

👑 ${getDevName()}
📸 ${getIGLink()}
⚡ *${getBotName()}*`;
}

// ══════════════════════════════════════════════
// MENU / RULES / JOKES
// ══════════════════════════════════════════════
function getMenuMsg() {
    return `
╔━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╗
┃  🖤⚡  *${getBotName()}*  ⚡🖤   
╚━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╝
▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰
         👑 *Dev: ${getDevName()}* 👑
▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰

🎵 *━━━[ MUSIC & VIDEO ]━━━*
╔════════════════════════════╗
║ 🎵 \`.play <song naam>\` (ya .song)
║ 🎬 \`.video <naam>\` (ya .ytv)
║ 🎧 \`.ytmp3 <link>\`
║ 📹 \`.ytmp4 <link>\`
║ 📸 \`.insta <link>\`
╚════════════════════════════╝

😂 *━━━[ FUN & INFO ]━━━*
╔════════════════════════════╗
║ 😂 \`.joke\`
║ 💡 \`.quote\`
║ 🕐 \`.time\`
║ ℹ️  \`.info\`
║ 📋 \`.about\`
╚════════════════════════════╝

👥 *━━━[ GROUP ONLY ]━━━*
╔════════════════════════════╗
║ 📢 \`.tagall\`
║ 📏 \`.rules\`
║ 👢 \`.kick @user\`
║ ⚠️  \`.warn @user\`
║ 🔓 \`.unwarn @user\`
║ 🆔 \`.groupinfo\`
╚════════════════════════════╝

🔑 *━━━[ TOKEN SYSTEM ]━━━*
╔════════════════════════════╗
║ 🔑 \`.addtoken\`
║    ➤ Apna Telegram bot token do
║ ⚡ \`.addtoken <token>\`
║    ➤ Seedha token bhi chalega
║ ❌ \`.cancel\`
║    ➤ Token request cancel
╚════════════════════════════╝

🛡️ *━━━[ AUTO PROTECTION ]━━━*
╔════════════════════════════╗
║ 🚫 Anti-Gali    ➤ 3 Warn → Kick
║ 🚫 Anti-Link    ➤ Warn/Kick
║ 🔞 Anti-NSFW    ➤ Instant Kick
║ 📤 Anti-Forward ➤ Kick
║ 🌊 Anti-Spam    ➤ Kick
║ 🔞 Anti-Emoji   ➤ Kick
╚════════════════════════════╝

⚙️ *━━━[ SETTINGS ]━━━*
╔════════════════════════════╗
║ 🖼️ \`.setbanner <url>\`
╚════════════════════════════╝

▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰
📸 *Instagram:* ${getIGLink()}
🖤 *Powered by ${getBotName()}* 🖤
▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰`;
}

function getRulesMsg() {
    return `╔══════════════════════════════════╗
║   ⚡  ${getBotName()}  ⚡   
║        📋  GROUP RULES           
╚══════════════════════════════════╝

1️⃣ Sabka izzat karo
2️⃣ Gali = 3 Warn → KICK
3️⃣ Link/Forward = KICK
4️⃣ NSFW media = Instant KICK
5️⃣ Sirf emoji = KICK
6️⃣ Spam = KICK
7️⃣ Topic pe raho

⚠️ *3 Warnings = Auto KICK!*

👑 ${getDevName()}
📸 ${getIGLink()}
⚡ *${getBotName()}*`;
}

const JOKES = [
    "Teacher: Future use karo!\nStudent: Main future mein school nahi aaunga! 😂",
    "Doctor: Kya problem?\nAadmi: Main invisible hun!\nDoctor: Next! 😂",
    "Wife: Prove pyaar!\nHusband: Maine remote uthaya! 😂"
];
const QUOTES = [
    "⚡ *Sapne wo nahi jo sote waqt aate hain!* — Kalam",
    "⚡ *Haar tabhi hoti hai jab khud maan lo!*",
    "⚡ *Jo girke uthta hai wahi aage jaata hai!*"
];

// ══════════════════════════════════════════════
// SESSION CLASS
// ══════════════════════════════════════════════
class Session {
    constructor(chatId, uniqueKey) {
        this.chatId   = chatId;
        this.uniqueKey = uniqueKey || chatId;
        this.authPath = path.join(__dirname, 'sessions', this.uniqueKey);
        this.sock     = null;
        this.userBot  = null;
        fs.mkdirSync(this.authPath, { recursive: true });
    }

    async start(phone) {
        const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
        const { version } = await fetchLatestBaileysVersion();

        this.sock = makeWASocket({
            version, auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            retryRequestDelayMs: 800,
            maxMsgRetryCount: 5,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            markOnlineOnConnect: false,
            browser: ['Ubuntu','Chrome','20.0.04'],
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
            const notify = async (t) => {
                const bot = this.userBot || tgBot;
                try { await bot.sendMessage(this.chatId, t, { parse_mode:'Markdown' }); } catch {}
            };

            if (connection === 'open') {
                this._reconnectCount = 0;
                if (this._keepAlive) clearInterval(this._keepAlive);
                this._keepAlive = setInterval(async () => {
                    try { await this.sock.sendPresenceUpdate('available'); } catch {}
                }, 5 * 60 * 1000);
                await notify(`✅ *${getBotName()} CONNECTED!*\n⚡ Ready!\n👑 ${getDevName()}`);
            }

            if (connection === 'close') {
                if (this._keepAlive) clearInterval(this._keepAlive);
                const code = lastDisconnect?.error?.output?.statusCode;
                if (code === DisconnectReason.loggedOut) {
                    await notify('❌ Logged out! /pair again.');
                    fs.rmSync(this.authPath, { recursive:true, force:true });
                    delete sessions[this.uniqueKey];
                } else {
                    this._reconnectCount = (this._reconnectCount || 0) + 1;
                    const delay = Math.min(4000 * this._reconnectCount, 40000);
                    console.log(`Reconnect #${this._reconnectCount} in ${delay}ms`);
                    setTimeout(() => this.start(null), delay);
                }
            }
        });

        if (phone && !this.sock.authState.creds.registered) {
            await new Promise(r => setTimeout(r, 3500));
            try {
                const code = await this.sock.requestPairingCode(phone);
                const bot = this.userBot || tgBot;
                await bot.sendMessage(this.chatId,
                    `🔑 *PAIRING CODE:*\n\n\`${code}\`\n\n*WhatsApp:*\nSettings → Linked Devices → Link with phone number → Code daalo`,
                    { parse_mode:'Markdown' });
            } catch(e) {
                const bot = this.userBot || tgBot;
                await bot.sendMessage(this.chatId, `❌ ${e.message}`);
            }
        }

        // ══════════════════════════════════════
        // MESSAGES
        // ══════════════════════════════════════
        this.sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const msg of messages) {
                try {
                    if (!msg.message) continue;
                    const from    = msg.key.remoteJid;
                    if (!from) continue;
                    const isGroup  = from.endsWith('@g.us');
                    const isFromMe = msg.key.fromMe;
                    const sender   = msg.key.participant || from;
                    const senderN  = sender.split('@')[0];

                    const msgType = Object.keys(msg.message)[0];
                    let text = '';
                    if (msgType === 'conversation') text = msg.message.conversation || '';
                    else if (msgType === 'extendedTextMessage') text = msg.message.extendedTextMessage?.text || '';
                    else if (msgType === 'imageMessage') text = msg.message.imageMessage?.caption || '';
                    else if (msgType === 'videoMessage') text = msg.message.videoMessage?.caption || '';

                    // ══════════════════════════════════════
                    // 🔑 TOKEN FLOW
                    // ══════════════════════════════════════
                    if (pendingToken[sender] && pendingToken[sender].step === 'waiting_token') {

                        if (text.toLowerCase() === '.cancel') {
                            delete pendingToken[sender];
                            await safeSend(this.sock, from, {
                                text: `❌ Token request cancel kar di.\n\n⚡ ${getBotName()}`
                            }, { quoted: msg });
                            continue;
                        }

                        if (text.startsWith('.')) {
                            delete pendingToken[sender];
                        } else {
                            const token = text.trim();
                            if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
                                await safeSend(this.sock, from, {
                                    text: `❌ Valid Telegram token nahi lag raha.\n\n*Format:* \`1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ\`\n\nDobara try karo ya \`.cancel\` likho.\n\n⚡ ${getBotName()}`
                                }, { quoted: msg });
                                continue;
                            }

                            await safeSend(this.sock, from, {
                                text: `⏳ Token verify ho raha hai...\n\n⚡ ${getBotName()}`
                            }, { quoted: msg });

                            try {
                                const r = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 10000 });
                                if (!r.data.ok) throw new Error('Invalid token response');
                                const botInfo = r.data.result;

                                const chatId = sender;
                                const users = loadUsers();
                                users[chatId] = {
                                    token,
                                    botId: String(botInfo.id),
                                    botUsername: botInfo.username,
                                    addedFrom: 'whatsapp-group',
                                    groupId: from,
                                    senderName: pendingToken[sender].senderName,
                                    addedAt: Date.now()
                                };
                                saveUsers(users);

                                spawnUserBot(token, chatId, chatId);
                                delete pendingToken[sender];

                                await safeSend(this.sock, from, {
                                    text: `✅ *TOKEN ACCEPTED!*\n\n` +
                                          `🤖 *Bot:* ${botInfo.first_name}\n` +
                                          `🆔 *Username:* @${botInfo.username}\n` +
                                          `📛 *ID:* \`${botInfo.id}\`\n\n` +
                                          `📌 *Ab kya karo:*\n` +
                                          `1️⃣ Telegram pe @${botInfo.username} kholo\n` +
                                          `2️⃣ \`/pair 919876543210\` bhejo\n` +
                                          `3️⃣ Pairing code aayega\n` +
                                          `4️⃣ WhatsApp → Linked Devices → Link → code daalo\n\n` +
                                          `⚡ *${getBotName()}*`
                                }, { quoted: msg });

                                console.log(`✅ Group token added by ${senderN} → @${botInfo.username}`);
                            } catch (e) {
                                await safeSend(this.sock, from, {
                                    text: `❌ *Token verify nahi hua!*\n\n${e.message}\n\n` +
                                          `*Check:*\n• Token sahi copy hua?\n• @BotFather se naya banaya?\n\n` +
                                          `Dobara try karo ya \`.cancel\` likho.\n\n⚡ ${getBotName()}`
                                }, { quoted: msg });
                            }
                            continue;
                        }
                    }

                    // ══════════════════════════════════════
                    // 🛡️ AUTO PROTECTION
                    // ══════════════════════════════════════
                    if (isGroup && !isFromMe) {

                        if (isSpam(from, sender)) {
                            try {
                                await this.sock.groupParticipantsUpdate(from, [sender], 'remove');
                                await safeSend(this.sock, from, {
                                    text: `🚫 *${senderN}* spam → kick!\n\n⚡ ${getBotName()}`
                                });
                            } catch {}
                            continue;
                        }

                        if (text && isLink(text)) {
                            try {
                                await this.sock.sendMessage(from, { delete: msg.key });
                                await safeSend(this.sock, from, {
                                    text: `🚫 *${senderN}* link → kick!\n\n⚡ ${getBotName()}`
                                });
                                await this.sock.groupParticipantsUpdate(from, [sender], 'remove');
                            } catch {}
                            continue;
                        }

                        if (text && (hasGali(text) || isEmojiOnly(text))) {
                            const reason = hasGali(text) ? 'Gali' : 'Sirf Emoji';
                            const wid = `${from}_${sender}`;
                            warns[wid] = (warns[wid] || 0) + 1;
                            const wc = warns[wid];
                            try {
                                if (wc >= 3) {
                                    await this.sock.groupParticipantsUpdate(from, [sender], 'remove');
                                    delete warns[wid];
                                    await safeSend(this.sock, from, {
                                        text: `👢 *${senderN}* 3 warnings → kick!\nReason: ${reason}\n\n⚡ ${getBotName()}`
                                    });
                                } else {
                                    await safeSend(this.sock, from, {
                                        text: `⚠️ *Warning ${wc}/3*\n@${senderN}\nReason: ${reason}\n\n⚡ ${getBotName()}`,
                                        mentions: [sender]
                                    });
                                }
                            } catch {}
                            continue;
                        }

                        if (isForwarded(msg)) {
                            try {
                                await this.sock.sendMessage(from, { delete: msg.key });
                                await safeSend(this.sock, from, {
                                    text: `📤 *${senderN}* forward → kick!\n\n⚡ ${getBotName()}`
                                });
                                await this.sock.groupParticipantsUpdate(from, [sender], 'remove');
                            } catch {}
                            continue;
                        }

                        if (msgType === 'imageMessage') {
                            try {
                                const buf = await this.sock.downloadMediaMessage(msg);
                                if (buf && buf.length > 5000) {
                                    const bad = await isNSFWImage(buf);
                                    if (bad) {
                                        await this.sock.sendMessage(from, { delete: msg.key });
                                        await safeSend(this.sock, from, {
                                            text: `🔞 *${senderN}* NSFW → kick!\n\n⚡ ${getBotName()}`
                                        });
                                        await this.sock.groupParticipantsUpdate(from, [sender], 'remove');
                                        continue;
                                    }
                                }
                            } catch(e) {}
                        }

                        if (msgType === 'videoMessage' && text && (hasGali(text) || isLink(text))) {
                            try {
                                await this.sock.sendMessage(from, { delete: msg.key });
                                await safeSend(this.sock, from, {
                                    text: `🚫 *${senderN}* video remove + kick\n\n⚡ ${getBotName()}`
                                });
                                await this.sock.groupParticipantsUpdate(from, [sender], 'remove');
                            } catch {}
                            continue;
                        }
                    }

                    // ══════════════════════════════════════
                    // ⚙️ COMMANDS
                    // ══════════════════════════════════════
                    if (!text.startsWith('.')) continue;
                    const args = text.trim().split(/\s+/);
                    const cmd  = args[0].toLowerCase();
                    const q    = args.slice(1).join(' ');

                    switch (cmd) {

                        case '.addtoken': {
                            if (q && /^\d+:[A-Za-z0-9_-]+$/.test(q.trim())) {
                                const token = q.trim();
                                await safeSend(this.sock, from, {
                                    text: `⏳ Token verify ho raha hai...\n\n⚡ ${getBotName()}`
                                }, { quoted: msg });
                                try {
                                    const r = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 10000 });
                                    if (!r.data.ok) throw new Error('Invalid');
                                    const botInfo = r.data.result;
                                    const users = loadUsers();
                                    users[sender] = {
                                        token,
                                        botId: String(botInfo.id),
                                        botUsername: botInfo.username,
                                        addedFrom: 'whatsapp-group',
                                        groupId: from,
                                        addedAt: Date.now()
                                    };
                                    saveUsers(users);
                                    spawnUserBot(token, sender, sender);
                                    await safeSend(this.sock, from, {
                                        text: `✅ *TOKEN ACCEPTED!*\n\n🤖 @${botInfo.username}\n\nAb Telegram pe @${botInfo.username} kholo aur \`/pair <phone>\` bhejo.\n\n⚡ ${getBotName()}`
                                    }, { quoted: msg });
                                } catch(e) {
                                    await safeSend(this.sock, from, {
                                        text: `❌ Token invalid: ${e.message}\n\n⚡ ${getBotName()}`
                                    }, { quoted: msg });
                                }
                                break;
                            }

                            pendingToken[sender] = {
                                step: 'waiting_token',
                                group: from,
                                senderName: senderN,
                                createdAt: Date.now()
                            };

                            const helpText = `🔑 *TELEGRAM BOT TOKEN CHAHIYE*

Bhai, apna *Telegram Bot Token* bhejo.

📌 *Token kaise banaye?*
1️⃣ Telegram → *@BotFather*
2️⃣ \`/newbot\` bhejo
3️⃣ Bot ka naam do (jaise: \`Akash MD Bot\`)
4️⃣ Username do jo \`bot\` se end ho (jaise: \`akash_md_bot\`)
5️⃣ BotFather tumhe token dega — copy karo
6️⃣ Yahan paste karke bhejo 👇

*Format:*
\`1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ\`

⚠️ *Note:* Token kisi ko mat do. Ye tumhara hai.

❌ Cancel: \`.cancel\`

⏳ *Bot tumhara token 2 minute tak wait karega...*

⚡ *${getBotName()}*`;

                            try {
                                const img = getBotImg();
                                if (img) await this.sock.sendMessage(from, { image:{url:img}, caption: helpText }, { quoted: msg });
                                else await this.sock.sendMessage(from, { text: helpText }, { quoted: msg });
                            } catch { await this.sock.sendMessage(from, { text: helpText }, { quoted: msg }); }

                            setTimeout(() => {
                                if (pendingToken[sender] && pendingToken[sender].step === 'waiting_token') {
                                    delete pendingToken[sender];
                                    this.sock.sendMessage(from, {
                                        text: `⏰ Token request timeout. Dobara \`.addtoken\` likho.\n\n⚡ ${getBotName()}`
                                    }).catch(()=>{});
                                }
                            }, 2 * 60 * 1000);
                            break;
                        }

                        case '.cancel': {
                            if (pendingToken[sender]) {
                                delete pendingToken[sender];
                                await safeSend(this.sock, from, {
                                    text: `❌ Cancelled.\n\n⚡ ${getBotName()}`
                                }, { quoted: msg });
                            } else {
                                await safeSend(this.sock, from, {
                                    text: `ℹ️ Koi pending request nahi hai.\n\n⚡ ${getBotName()}`
                                }, { quoted: msg });
                            }
                            break;
                        }

                        case '.menu': {
                            try {
                                const img = getBotImg();
                                if (img) await this.sock.sendMessage(from, { image:{url:img}, caption: getMenuMsg() }, { quoted: msg });
                                else await this.sock.sendMessage(from, { text: getMenuMsg() }, { quoted: msg });
                            } catch { await this.sock.sendMessage(from, { text: getMenuMsg() }, { quoted: msg }); }
                            break;
                        }
                        case '.play': case '.song':
                            await songDownload(this.sock, from, msg, q, 'name'); break;
                        case '.video': case '.ytv':
                            await ytVideoDownload(this.sock, from, msg, q, 'name'); break;
                        case '.ytmp3':
                            await songDownload(this.sock, from, msg, q, 'link'); break;
                        case '.ytmp4':
                            await ytVideoDownload(this.sock, from, msg, q, 'link'); break;
                        case '.insta': case '.ig':
                            await instaDownload(this.sock, from, msg, q); break;
                        case '.joke':
                            await this.sock.sendMessage(from, { text:`😂 ${JOKES[Math.floor(Math.random()*JOKES.length)]}\n\n⚡ ${getBotName()}` }, { quoted: msg }); break;
                        case '.quote':
                            await this.sock.sendMessage(from, { text:`${QUOTES[Math.floor(Math.random()*QUOTES.length)]}\n\n⚡ ${getBotName()}` }, { quoted: msg }); break;
                        case '.time':
                            await this.sock.sendMessage(from, { text:`🕐 ${new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}\n\n⚡ ${getBotName()}` }, { quoted: msg }); break;
                        case '.rules':
                            await this.sock.sendMessage(from, { text: getRulesMsg() }, { quoted: msg }); break;
                        case '.about':
                            await this.sock.sendMessage(from, { text:`📋 *${getBotName()}*\n👑 Dev: ${getDevName()}\n\n🎵 YT/IG Download\n🛡️ Auto Protection\n🔑 Token System\n\n📸 ${getIGLink()}` }, { quoted: msg }); break;
                        case '.tagall': {
                            if (!isGroup) { await this.sock.sendMessage(from, { text:'❌ Group only' }, { quoted: msg }); break; }
                            try {
                                const meta = await this.sock.groupMetadata(from);
                                const mentions = meta.participants.map(p => p.id);
                                const tt = mentions.map(m => `@${m.split('@')[0]}`).join(' ');
                                await this.sock.sendMessage(from, { text:`📢 *Attention!*\n\n${tt}\n\n⚡ ${getBotName()}`, mentions });
                            } catch {}
                            break;
                        }
                        case '.kick': {
                            if (!isGroup) break;
                            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                            if (!mentioned.length) { await this.sock.sendMessage(from, { text:'❌ @user mention karo' }, { quoted: msg }); break; }
                            try {
                                await this.sock.groupParticipantsUpdate(from, mentioned, 'remove');
                                await this.sock.sendMessage(from, { text:`👢 Kicked!\n\n⚡ ${getBotName()}` }, { quoted: msg });
                            } catch(e) { await this.sock.sendMessage(from, { text:`❌ ${e.message}` }, { quoted: msg }); }
                            break;
                        }
                        case '.warn': {
                            if (!isGroup) break;
                            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                            if (!mentioned.length) { await this.sock.sendMessage(from, { text:'❌ @user mention karo' }, { quoted: msg }); break; }
                            const wid = `${from}_${mentioned[0]}`;
                            warns[wid] = (warns[wid] || 0) + 1;
                            const wc = warns[wid];
                            const nm = mentioned[0].split('@')[0];
                            if (wc >= 3) {
                                try { await this.sock.groupParticipantsUpdate(from, mentioned, 'remove'); } catch {}
                                delete warns[wid];
                                await this.sock.sendMessage(from, { text:`👢 ${nm} kick (3 warns)\n\n⚡ ${getBotName()}` }, { quoted: msg });
                            } else {
                                await this.sock.sendMessage(from, { text:`⚠️ Warning ${wc}/3 → @${nm}\n\n⚡ ${getBotName()}`, mentions:[mentioned[0]] }, { quoted: msg });
                            }
                            break;
                        }
                        case '.unwarn': {
                            if (!isGroup) break;
                            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                            if (!mentioned.length) break;
                            const wid = `${from}_${mentioned[0]}`;
                            warns[wid] = 0;
                            await this.sock.sendMessage(from, { text:`✅ Warnings cleared for @${mentioned[0].split('@')[0]}\n\n⚡ ${getBotName()}`, mentions:[mentioned[0]] }, { quoted: msg });
                            break;
                        }
                        case '.groupinfo': {
                            if (!isGroup) { await this.sock.sendMessage(from, { text:'❌ Group only' }, { quoted: msg }); break; }
                            try {
                                const meta = await this.sock.groupMetadata(from);
                                const pp = await this.sock.profilePictureUrl(from, 'image').catch(()=>null);
                                const cap = `📋 *GROUP INFO*\n\n📌 ${meta.subject}\n👥 ${meta.participants.length} members\n📅 Created: ${new Date(meta.creation*1000).toLocaleDateString('en-IN')}\n👑 Owner: ${meta.owner?'@'+meta.owner.split('@')[0]:'?'}\n🆔 \`${meta.id}\`\n${meta.desc?`\n📝 ${meta.desc}`:''}\n\n⚡ ${getBotName()}`;
                                if (pp) await this.sock.sendMessage(from, { image:{url:pp}, caption: cap, mentions: meta.owner?[meta.owner]:[] }, { quoted: msg });
                                else await this.sock.sendMessage(from, { text: cap }, { quoted: msg });
                            } catch(e) { await this.sock.sendMessage(from, { text:`❌ ${e.message}` }, { quoted: msg }); }
                            break;
                        }
                        case '.info':
                            await this.sock.sendMessage(from, { text:`ℹ️ ${getBotName()}\n👑 ${getDevName()}\n📸 ${getIGLink()}` }, { quoted: msg }); break;
                        case '.setbanner':
                            if (!q) { await this.sock.sendMessage(from, { text:'❌ URL do' }, { quoted: msg }); break; }
                            { const c = loadConfig(); c.BOT_IMG = q; saveConfig(c); }
                            await this.sock.sendMessage(from, { text:`✅ Banner set\n\n⚡ ${getBotName()}` }, { quoted: msg });
                            break;
                    }
                } catch(e) { console.log('msg err:', e.message); }
            }
        });

        // ── GROUP PARTICIPANTS ──
        this.sock.ev.on('group-participants.update', async (ev) => {
            try {
                const { id, participants, action } = ev;
                const meta = await this.sock.groupMetadata(id);
                for (const p of participants) {
                    const nm = p.split('@')[0];
                    if (action === 'add') {
                        const pp = await this.sock.profilePictureUrl(p, 'image').catch(()=>null);
                        const cap = welcomeCard(nm, meta.subject, meta.participants.length, meta.desc);
                        try {
                            if (pp) await this.sock.sendMessage(id, { image:{url:pp}, caption: cap, mentions:[p] });
                            else await this.sock.sendMessage(id, { text: cap, mentions:[p] });
                        } catch { await this.sock.sendMessage(id, { text: cap, mentions:[p] }); }
                    }
                    else if (action === 'remove') {
                        await this.sock.sendMessage(id, { text: goodbyeCard(nm), mentions:[p] }).catch(()=>{});
                    }
                }
            } catch(e) { console.log('grp-part err:', e.message); }
        });

        // ── BOT ADDED TO GROUP ──
        this.sock.ev.on('groups.upsert', async (groups) => {
            for (const g of groups) {
                try {
                    const meta = await this.sock.groupMetadata(g.id).catch(()=>g);
                    const cap = groupAddedCard(meta);
                    const pp = await this.sock.profilePictureUrl(g.id, 'image').catch(()=>null);
                    if (pp) await this.sock.sendMessage(g.id, { image:{url:pp}, caption: cap });
                    else await this.sock.sendMessage(g.id, { text: cap });
                } catch(e) { console.log('grp upsert err:', e.message); }
            }
        });
    }
}

// ── YouTube helpers ────────────────────────────
const yt = require('./lib/youtube');
const { toAudio } = require('./lib/converter');
const YT_MAX_ACTIVE = 3;
let ytActive = 0;
const YT_USAGE = {
    'audio:name':'❌ Song ka naam likho\n.play Tum Hi Ho',
    'video:name':'❌ Video ka naam likho\n.video Faded',
    'audio:link':'❌ Link do\n.ytmp3 https://youtu.be/xxx',
    'video:link':'❌ Link do\n.ytmp4 https://youtu.be/xxx'
};
const YT_BAD_LINK = '❌ Invalid YouTube link';
const safeFileName = (t, fb) => (String(t||'').replace(/[^\p{L}\p{N}\s-]/gu,'').trim().slice(0,60)) || fb;

function detectAudioFormat(buf) {
    if (!buf || buf.length < 12) return 'mp3';
    const hex = buf.slice(0,4).toString('hex');
    if (buf.slice(4,8).toString('ascii') === 'ftyp') return 'm4a';
    if (buf.slice(0,4).toString('ascii') === 'OggS') return 'ogg';
    if (buf.slice(0,4).toString('ascii') === 'RIFF') return 'wav';
    if (hex === '1a45dfa3') return 'webm';
    return 'mp3';
}

async function ytResolve(sock, from, msg, query, mode, kind) {
    const q = (query||'').trim();
    const reply = t => sock.sendMessage(from, { text: t + `\n\n⚡ ${getBotName()}` }, { quoted: msg });
    if (!q) { await reply(YT_USAGE[`${kind}:${mode}`]); return null; }
    const direct = yt.normalizeUrl(q);
    if (direct) {
        const id = yt.extractVideoId(direct);
        return { url: direct, title:'', thumb: yt.thumbnailFor(id), duration:'', seconds:0 };
    }
    if (mode === 'link') { await reply(YT_BAD_LINK); return null; }
    const found = await yt.search(q);
    if (!found) { await reply(`❌ ${kind==='audio'?'Song':'Video'} nahi mila`); return null; }
    return { url: found.url, title: found.title, thumb: found.thumbnail, duration: found.duration, seconds: found.seconds };
}

async function ytWithSlot(sock, from, msg, fn) {
    if (ytActive >= YT_MAX_ACTIVE) {
        await sock.sendMessage(from, { text:'⏳ Busy, try later' }, { quoted: msg }); return;
    }
    ytActive++;
    try { await fn(); } finally { ytActive--; }
}

const YT_FAIL_TIPS = '\n\n💡 1-2 min baad try karo';

async function songDownload(sock, from, msg, query, mode='name') {
    if (!(query||'').trim()) { await ytResolve(sock, from, msg, '', mode, 'audio'); return; }
    await ytWithSlot(sock, from, msg, async () => {
        try { await sock.sendMessage(from, { react:{text:'🎵',key:msg.key} }); } catch {}
        const t = await ytResolve(sock, from, msg, query, mode, 'audio');
        if (!t) return;
        if (t.seconds && t.seconds > yt.LIMITS.maxAudioSeconds) {
            await sock.sendMessage(from, { text:'❌ Audio bahut lamba' }, { quoted: msg }); return;
        }
        const caption = `🎵 *Song mila!*\n📌 ${t.title||'YouTube audio'}${t.duration?`\n⏱ ${t.duration}`:''}\n\n⏳ Download ho raha hai...\n\n⚡ ${getBotName()}`;
        try { await sock.sendMessage(from, { image:{url:t.thumb||getBotImg()||'https://i.imgur.com/6lMRPqo.png'}, caption }, { quoted: msg }); }
        catch { await sock.sendMessage(from, { text:caption }, { quoted: msg }); }
        const res = await yt.download('audio', t.url, m => console.log('[YT-AUDIO]',m));
        if (!res.ok) { await sock.sendMessage(from, { text:`❌ Download fail${YT_FAIL_TIPS}\n\n⚡ ${getBotName()}` }, { quoted: msg }); return; }
        let audioBuf = res.buffer;
        const finalTitle = res.title || t.title || 'YouTube audio';
        const ext = detectAudioFormat(audioBuf);
        if (ext !== 'mp3') { try { audioBuf = await toAudio(audioBuf, ext); } catch(e){} }
        await sock.sendMessage(from, { audio: audioBuf, mimetype:'audio/mpeg', fileName:`${safeFileName(finalTitle,'song')}.mp3`, ptt:false }, { quoted: msg });
        await sock.sendMessage(from, { text:`✅ *${finalTitle}*\n\n👑 ${getDevName()}\n⚡ ${getBotName()}` });
    });
}

async function ytVideoDownload(sock, from, msg, query, mode='name') {
    if (!(query||'').trim()) { await ytResolve(sock, from, msg, '', mode, 'video'); return; }
    await ytWithSlot(sock, from, msg, async () => {
        try { await sock.sendMessage(from, { react:{text:'🎬',key:msg.key} }); } catch {}
        const t = await ytResolve(sock, from, msg, query, mode, 'video');
        if (!t) return;
        if (t.seconds && t.seconds > yt.LIMITS.maxVideoSeconds) {
            await sock.sendMessage(from, { text:'❌ Video bahut lamba' }, { quoted: msg }); return;
        }
        const caption = `🎬 *Video mila!*\n📌 ${t.title||''}${t.duration?`\n⏱ ${t.duration}`:''}\n\n⏳ Download ho raha hai...\n\n⚡ ${getBotName()}`;
        try { await sock.sendMessage(from, { image:{url:t.thumb||getBotImg()||'https://i.imgur.com/6lMRPqo.png'}, caption }, { quoted: msg }); }
        catch { await sock.sendMessage(from, { text:caption }, { quoted: msg }); }
        const res = await yt.download('video', t.url, m => console.log('[YT-VIDEO]',m));
        if (!res.ok) { await sock.sendMessage(from, { text:`❌ Download fail${YT_FAIL_TIPS}\n\n⚡ ${getBotName()}` }, { quoted: msg }); return; }
        const finalTitle = res.title || t.title || 'YouTube video';
        const cap = `✅ *${finalTitle}*\n\n👑 ${getDevName()}\n⚡ ${getBotName()}`;
        if (res.buffer.length > yt.LIMITS.videoInlineMaxBytes) {
            await sock.sendMessage(from, { document: res.buffer, mimetype:'video/mp4', fileName:`${safeFileName(finalTitle,'video')}.mp4`, caption: cap }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { video: res.buffer, mimetype:'video/mp4', caption: cap }, { quoted: msg });
        }
    });
}

async function instaDownload(sock, from, msg, url) {
    if (!url || !url.includes('instagram.com')) {
        await sock.sendMessage(from, { text:'❌ Instagram link do\n.insta https://instagram.com/reel/xxx' }, { quoted: msg }); return;
    }
    for (const e of ['📥','⏳','📸']) { try { await sock.sendMessage(from, { react:{text:e,key:msg.key} }); } catch {} }
    await sock.sendMessage(from, { text:'📥 Instagram download...\n⏳ Wait' }, { quoted: msg });
    const AX = { timeout:60000, headers:{ 'User-Agent':'Mozilla/5.0' } };
    const apis = [
        async () => { const r = await axios.get(`https://api.vreden.my.id/api/igdownload?url=${encodeURIComponent(url)}`, AX); if (r?.data?.result?.length) return r.data.result; throw 0; },
        async () => { const r = await axios.get(`https://okatsu-rolezapiiz.vercel.app/downloader/instagram?url=${encodeURIComponent(url)}`, AX); if (r?.data?.result?.length) return r.data.result; throw 0; },
        async () => { const r = await axios.get(`https://api.yupra.my.id/api/downloader/ig?url=${encodeURIComponent(url)}`, AX); if (r?.data?.data?.length) return r.data.data; throw 0; }
    ];
    let list = null;
    for (const a of apis) { try { list = await a(); if (list?.length) break; } catch {} }
    if (!list?.length) { await sock.sendMessage(from, { text:'❌ Download fail' }, { quoted: msg }); return; }
    for (const item of list.slice(0,5)) {
        const mUrl = item.url || item.download_url || item.src;
        const isVid = item.type === 'video' || /\.(mp4|mov)/i.test(mUrl);
        try {
            await sock.sendMessage(from, isVid
                ? { video:{url:mUrl}, caption:`✅ IG Video\n\n👑 ${getDevName()}\n⚡ ${getBotName()}` }
                : { image:{url:mUrl}, caption:`✅ IG Image\n\n👑 ${getDevName()}\n⚡ ${getBotName()}` }
            , { quoted: msg });
        } catch {}
    }
}

// ── Main bot fallback ──────────────────────────
tgBot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = String(msg.chat.id);
    const text = msg.text.trim();
    if (ADMIN_CHAT && chatId === String(ADMIN_CHAT)) return;

    if (text === '/start' || text === '/menu') {
        return tgBot.sendMessage(chatId,
            `🖤⚡ *${getBotName()}* ⚡🖤\n\n/pair <phone>\n/status\n/menu\n\n👑 ${getDevName()}\n📸 ${getIGLink()}`,
            { parse_mode:'Markdown' });
    }
    if (text.startsWith('/pair ')) {
        const phone = text.replace('/pair','').trim().replace(/[^0-9]/g,'');
        if (phone.length < 10) return tgBot.sendMessage(chatId, '❌ /pair 919876543210', { parse_mode:'Markdown' });
        const skey = chatId;
        if (sessions[skey]) return tgBot.sendMessage(chatId, '⚠️ Already connected');
        const s = new Session(chatId, skey); sessions[skey] = s;
        await s.start(phone).catch(e => tgBot.sendMessage(chatId, `❌ ${e.message}`));
        tgBot.sendMessage(chatId, '⏳ Pairing code aayega...');
    }
    if (text === '/status') {
        const a = Object.keys(sessions).filter(k => k.startsWith(chatId) || k === chatId);
        tgBot.sendMessage(chatId, `📊 Active: ${a.length}\n\n⚡ ${getBotName()}`);
    }
});

console.log(`🖤⚡ ${getBotName()} STARTED ⚡🖤`);
