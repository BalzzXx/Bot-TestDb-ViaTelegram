require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql2/promise');

// ===== Koneksi DB =====
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// ===== Bot =====
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Simpan state percakapan user
const sessions = {};

// ===== Helper =====
const isRegistered = async (telegramId) => {
  const [rows] = await db.query(
    'SELECT * FROM users WHERE telegram_id = ?',
    [telegramId]
  );
  return rows[0] || null;
};

const saveUser = async (data) => {
  await db.query(
    `INSERT INTO users (telegram_id, username, full_name, phone, email)
     VALUES (?, ?, ?, ?, ?)`,
    [data.telegram_id, data.username, data.full_name, data.phone, data.email]
  );
};

// ===== Command /start =====
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const user = await isRegistered(telegramId);

    if (user) {
      return bot.sendMessage(
        chatId,
        `✅ Anda sudah terdaftar!\n\n` +
        `👤 Nama: ${user.full_name}\n` +
        `📧 Email: ${user.email}\n` +
        `📱 HP: ${user.phone}\n` +
        `📅 Terdaftar: ${user.registered_at}`
      );
    }

    sessions[telegramId] = { step: 'full_name' };
    bot.sendMessage(
      chatId,
      `👋 Selamat datang!\nMari daftar dulu.\n\nSilakan kirim *Nama Lengkap* Anda:`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '❌ Terjadi error. Coba lagi nanti.');
  }
});

// ===== Command /profil =====
bot.onText(/\/profil/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await isRegistered(msg.from.id);
    if (!user) return bot.sendMessage(chatId, '❌ Anda belum terdaftar. Kirim /start');
    bot.sendMessage(
      chatId,
      `👤 *Profil Anda*\n\n` +
      `Nama: ${user.full_name}\n` +
      `Username: @${user.username || '-'}\n` +
      `Email: ${user.email}\n` +
      `HP: ${user.phone}\n` +
      `Terdaftar: ${user.registered_at}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '❌ Error mengambil data.');
  }
});

// ===== Command /hapus =====
bot.onText(/\/hapus/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await db.query('DELETE FROM users WHERE telegram_id = ?', [msg.from.id]);
    bot.sendMessage(chatId, '🗑️ Data Anda berhasil dihapus.');
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '❌ Gagal menghapus data.');
  }
});

// ===== Handler pesan biasa (alur registrasi) =====
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;
  const session = sessions[telegramId];
  if (!session) return;

  try {
    switch (session.step) {
      case 'full_name':
        session.full_name = text.trim();
        session.step = 'phone';
        return bot.sendMessage(chatId, '📱 Kirim *nomor HP* Anda:', { parse_mode: 'Markdown' });

      case 'phone':
        if (!/^[0-9+\-\s]{8,20}$/.test(text)) {
          return bot.sendMessage(chatId, '❌ Format nomor HP tidak valid. Coba lagi:');
        }
        session.phone = text.trim();
        session.step = 'email';
        return bot.sendMessage(chatId, '📧 Kirim *email* Anda:', { parse_mode: 'Markdown' });

      case 'email':
        if (!/^\S+@\S+\.\S+$/.test(text)) {
          return bot.sendMessage(chatId, '❌ Format email tidak valid. Coba lagi:');
        }
        session.email = text.trim();

        await saveUser({
          telegram_id: telegramId,
          username: msg.from.username || null,
          full_name: session.full_name,
          phone: session.phone,
          email: session.email,
        });

        delete sessions[telegramId];

        return bot.sendMessage(
          chatId,
          `✅ *Registrasi berhasil!*\n\n` +
          `👤 Nama: ${session.full_name}\n` +
          `📱 HP: ${session.phone}\n` +
          `📧 Email: ${session.email}\n\n` +
          `Ketik /profil untuk melihat data Anda.`,
          { parse_mode: 'Markdown' }
        );
    }
  } catch (err) {
    console.error(err);
    delete sessions[telegramId];
    bot.sendMessage(chatId, '❌ Terjadi error saat registrasi. Coba /start lagi.');
  }
});

// ===== Error handling =====
bot.on('polling_error', (err) => console.error('Polling error:', err.message));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));

console.log('🤖 Bot Telegram berjalan...');