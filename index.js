require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');

const TOKEN = process.env.BOT_TOKEN;
const URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

// Setup bot with webhook mode
const bot = new TelegramBot(TOKEN, { webHook: true });
bot.setWebHook(`${URL}/bot${TOKEN}`);

// Express server to handle webhook
const app = express();
app.use(bodyParser.json());
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});
app.get("/", (req, res) => res.send("Bot is live."));
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});

// ---- YOUR EXISTING BOT LOGIC BELOW ----

const KEY_FILE = path.join(__dirname, 'key.json');
const DB_FILE = path.join(__dirname, 'db.json');
const QR_FILE = path.join(__dirname, 'QR.png');

let keys = fs.readJsonSync(KEY_FILE);
let db = fs.readJsonSync(DB_FILE);

function saveDB() {
  fs.writeJsonSync(DB_FILE, db, { spaces: 2 });
}

function saveKeys() {
  fs.writeJsonSync(KEY_FILE, keys, { spaces: 2 });
}

function createUser(id) {
  if (!db.users[id]) {
    db.users[id] = {
      balance: 0,
      username: ''
    };
    saveDB();
  }
}

const mainMenu = {
  reply_markup: {
    keyboard: [
      [{ text: 'BUY KEY 🔑' }],
      [{ text: 'WALLET 👛' }, { text: 'STOCK 📦' }],
      [{ text: 'ADD FUNDS 💵' }, { text: 'CONTACT 📞' }]
    ],
    resize_keyboard: true
  }
};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  createUser(chatId);
  db.users[chatId].username = msg.chat.username || '';
  saveDB();
  bot.sendMessage(chatId, `👑 Welcome to KEY SHOP — Where Access Meets Exclusivity 🔑

Step into premium territory with our trusted keys:
✨ 1-Day | 3-Day | 7-Day | 30-Day Access — Delivered Instantly!

💼 Manage your Wallet
📊 Check Live Stock
💳 Add Funds Securely
🤝 Get 24/7 Support

Your exclusive journey starts now. Choose your option below! 🚀`, mainMenu);
});

bot.onText(/BUY KEY 🔑/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '✨ Choose a key to unlock access ✨:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔑 1 DAY KEY - 100₹', callback_data: 'buy_1_day' },
          { text: '🔑 3 DAY KEY - 250₹', callback_data: 'buy_3_day' }
        ],
        [
          { text: '🔑 7 DAY KEY - 500₹', callback_data: 'buy_7_day' },
          { text: '🔑 30 DAY KEY - 1200₹', callback_data: 'buy_30_day' }
        ]
      ]
    },
    parse_mode: 'Markdown'
  });
});

bot.onText(/WALLET 👛/, (msg) => {
  const chatId = msg.chat.id;
  createUser(chatId);
  bot.sendMessage(chatId, `💰 Your Wallet Balance: ${db.users[chatId].balance}₹\n\n🔧 Need to add more funds? Contact @KIDDO_OG`, { parse_mode: 'Markdown' });
});

bot.onText(/STOCK 📦/, (msg) => {
  const chatId = msg.chat.id;
  const stockMessage = `📦 Key Stock Availability:\n\n🔑 1 DAY KEY: ${keys['1_day'].length} KEYS\n🔑 3 DAY KEY: ${keys['3_day'].length} KEYS\n🔑 7 DAY KEY: ${keys['7_day'].length} KEYS\n🔑 30 DAY KEY: ${keys['30_day'].length} KEYS`;
  bot.sendMessage(chatId, stockMessage, { parse_mode: 'Markdown' });
});

bot.onText(/ADD FUNDS 💵/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendPhoto(chatId, QR_FILE, { caption: '🔗 Complete the payment and send the screenshot for approval.\n\nOnce we verify your payment, we will credit your wallet.', parse_mode: 'Markdown' });
});

bot.onText(/CONTACT 📞/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '📩 For assistance or inquiries, contact @KIDDO_OG', { parse_mode: 'Markdown' });
});

bot.on('photo', (msg) => {
  const chatId = msg.chat.id;
  const username = msg.chat.username || 'NoUsername';
  bot.forwardMessage(process.env.ADMIN_ID, chatId, msg.message_id);
  bot.sendMessage(process.env.ADMIN_ID, `📸 Screenshot received from @${username} (ID: ${chatId})`);
  bot.sendMessage(chatId, `✅ Screenshot sent for verification.\n\n🕒 Please wait for approval from our support team.`, { parse_mode: 'Markdown' });
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const username = query.message.chat.username || 'NoUsername';
  const data = query.data;

  let keyType = '';
  let price = 0;

  if (data === 'buy_1_day') { keyType = '1_day'; price = 100; }
  else if (data === 'buy_3_day') { keyType = '3_day'; price = 250; }
  else if (data === 'buy_7_day') { keyType = '7_day'; price = 500; }
  else if (data === 'buy_30_day') { keyType = '30_day'; price = 1200; }

  createUser(chatId);

  if (db.users[chatId].balance >= price) {
    if (keys[keyType].length === 0) {
      bot.sendMessage(chatId, `🚫 Sorry, no keys available for this option.`, { parse_mode: 'Markdown' });
      return;
    }

    const key = keys[keyType].shift();
    db.users[chatId].balance -= price;
    saveDB();
    saveKeys();

    bot.sendMessage(chatId, `🎉 Your key: ${key}\n\nThank you for your purchase! Your access is granted. 🔓`, { parse_mode: 'Markdown' });
    bot.sendMessage(process.env.ADMIN_ID, `🛍 New Key Sold:\nBuyer: @${username}\nChat ID: ${chatId}\nKey: ${key}`, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, `⚠️ Insufficient balance. Please add funds to your wallet.`, { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/broadcast (.+)/, (msg, match) => {
  if (msg.chat.id.toString() !== process.env.ADMIN_ID) return;
  const text = match[1];
  for (const id in db.users) {
    bot.sendMessage(id, `📢 Broadcast Message:\n\n${text}`, { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/add_key_([13730]+)_(.+)/, (msg, match) => {
  if (msg.chat.id.toString() !== process.env.ADMIN_ID) return;
  const day = match[1];
  const key = match[2];

  if (day === '1') keys['1_day'].push(key);
  if (day === '3') keys['3_day'].push(key);
  if (day === '7') keys['7_day'].push(key);
  if (day === '30') keys['30_day'].push(key);

  saveKeys();
  bot.sendMessage(msg.chat.id, `🗝️ Key added to ${day}-day list successfully.`, { parse_mode: 'Markdown' });
});

bot.onText(/\/add_balance (\d+) (\d+)/, (msg, match) => {
  if (msg.chat.id.toString() !== process.env.ADMIN_ID) return;
  const userId = match[1];
  const amount = parseInt(match[2]);

  createUser(userId);
  db.users[userId].balance += amount;
  saveDB();

  bot.sendMessage(msg.chat.id, `💸 Added ${amount}₹ to ${userId}'s account.`, { parse_mode: 'Markdown' });
  bot.sendMessage(userId, `💰 Your wallet has been credited with ${amount}₹.`, { parse_mode: 'Markdown' });
});
