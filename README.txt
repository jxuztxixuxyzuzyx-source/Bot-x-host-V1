╔══════════════════════════════════════════╗
║      ⚡ AKASH EXPLOIT MD - Setup Guide  ║
║         👑 Developer: AKASH             ║
╚══════════════════════════════════════════╝

INSTALL (ek baar):
  npm install
  npm install nsfwjs @tensorflow/tfjs-node

START:
  npm start

═══════════════════════════════════════════
  🔰 PEHLI BAAR SETUP
═══════════════════════════════════════════

1. Telegram pe bot kholo
2. /start karo
3. WhatsApp number type karo (jaise 917086852797)
4. Pairing code aayega Telegram pe
5. WhatsApp > Linked Devices > Link with phone number > Code daalo
6. Bot connected! ✅

═══════════════════════════════════════════
  🔑 APNA TELEGRAM BOT TOKEN ADD KARO
═══════════════════════════════════════════

OPTION 1 (WhatsApp Group se):
  1. WhatsApp group mein type karo:  .addtoken
  2. Bot token maangega
  3. @BotFather se token banao:
     - Telegram → @BotFather
     - /newbot bhejo
     - Naam do (jaise: Akash MD Bot)
     - Username do (jaise: akash_md_bot)
     - Token copy karo
  4. Group mein token paste karo
  5. Bot khud verify karke naya Telegram bot start kar dega ✅

OPTION 2 (Telegram Admin se):
  /addtoken <token>   →  Main bot pe bhejo

OPTION 3 (.env file):
  .env mein TELEGRAM_BOT_TOKEN= ke aage token daalo
  (Ye main/fixed bot ke liye)

Cancel karna ho:  .cancel

═══════════════════════════════════════════
  ✨ FEATURES
═══════════════════════════════════════════

🛡️ GROUP SAFETY (Auto Protection):
  ✅ Auto Welcome   - koi join kare to profile pic + info card
  ✅ Auto Goodbye   - koi leave kare to bye message
  📋 Bot Added Card - naye group mein poora info (members, owner, ID)
  🚫 Anti-Gali      - gali = 3 warn → kick
  🚫 Anti-Link      - link = instant kick
  🔞 Anti-NSFW      - AI se 18+ photo detect → kick
  📤 Anti-Forward   - forwarded message = kick
  🌊 Anti-Spam      - 6 msg / 10 sec = kick
  🔞 Anti-Emoji     - sirf emoji = 3 warn → kick
  ⚠️  Warn System   - 3 warnings = auto kick

🎵 MEDIA DOWNLOAD:
  🎵 Song naam se   : .play <naam>  (ya .song <naam>)
  🎬 Video naam se  : .video <naam> (ya .ytv <naam>)
  🎧 MP3 link se    : .ytmp3 <YouTube link>
  📹 MP4 link se    : .ytmp4 <YouTube link>
  📸 Instagram      : .insta <link>

😂 FUN & INFO:
  😂 .joke      - random joke
  💡 .quote     - motivation quote
  🕐 .time      - current time
  ℹ️  .info      - bot info
  📋 .about     - about bot

👥 GROUP COMMANDS:
  📢 .tagall         - sabko tag
  📏 .rules          - group rules
  👢 .kick @user     - kick (admin)
  ⚠️  .warn @user     - warn (admin)
  🔓 .unwarn @user   - warnings clear
  🆔 .groupinfo      - group detail card

🔑 TOKEN SYSTEM:
  🔑 .addtoken       - apna Telegram bot token do
  ⚡ .addtoken <tk>  - seedha token bhi chalega
  ❌ .cancel         - token request cancel

⚙️ SETTINGS:
  🖼️  .setbanner <url>  - bot banner change

═══════════════════════════════════════════
  ⚠️ ANTI-BAN TIPS
═══════════════════════════════════════════

WhatsApp account ban na ho iske liye:

1. Naya number pehle 2-3 din normal chat karo
2. Ek number pe pehle hafte 1-2 group hi add karo
3. Mass broadcast mat bhejo
4. .tagall din mein 1-2 baar hi
5. Reconnect pe wait karo (bot khud handle karta hai)
6. Baileys update rakho:  npm update @whiskeysockets/baileys
7. LoggedOut aaye to 24hr wait karke naya number try karo

═══════════════════════════════════════════
  📁 PROJECT STRUCTURE
═══════════════════════════════════════════

project/
├── index.js           ← main bot
├── README.txt         ← ye file
├── .env               ← TELEGRAM_BOT_TOKEN + ADMIN_CHAT_ID
├── users.json         ← auto (tokens saved)
├── config.json        ← auto (banner/menu song)
├── sessions/          ← WhatsApp auth sessions
├── tmp/               ← temp files
├── temp/              ← temp files
├── assets/            ← banner images, menu song
└── lib/
    ├── youtube.js     ← YouTube download engine
    └── converter.js   ← ffmpeg audio converter

═══════════════════════════════════════════
  🎬 YOUTUBE ENGINE
═══════════════════════════════════════════

lib/youtube.js mein saara download logic hai.

Naya API add karna ho to PROVIDERS list mein ek line jodo.

Order:
  1. eliteprotech API
  2. ytdl-core
  3. play-dl
  4. backup APIs
  5. cobalt

═══════════════════════════════════════════
  🔧 TOKEN CHANGE
═══════════════════════════════════════════

Main bot ka token badalna ho:
  .env file mein TELEGRAM_BOT_TOKEN= ke aage naya token daalo
  phir: npm start

Group member ka token badalna ho:
  Wahi group mein dobara:  .addtoken

═══════════════════════════════════════════
  🌐 LINKS
═══════════════════════════════════════════

📺 YT Channel: https://www.youtube.com/@geniushacker29
👑 Developer: AKASH
⚡ Powered by AKASH EXPLOIT MD

═══════════════════════════════════════════
  ✅ QUICK START (TL;DR)
═══════════════════════════════════════════

1. npm install
2. npm install nsfwjs @tensorflow/tfjs-node
3. .env mein TELEGRAM_BOT_TOKEN daalo
4. npm start
5. Telegram bot pe /pair <phone>
6. Pairing code → WhatsApp link
7. Done! 🎉

⚡ AKASH EXPLOIT MD
🖤 Developed by AKASH
