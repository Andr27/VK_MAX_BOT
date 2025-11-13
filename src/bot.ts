import { Bot, Keyboard } from '@maxhub/max-bot-api';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден');
  process.exit(1);
}

const bot = new Bot(process.env.BOT_TOKEN);

// Команда /start - показывает reply клавиатуру
bot.command('start', async (ctx: any) => {
  // Создаем reply клавиатуру
  const replyMarkup = {
    keyboard: [
      [
        { text: '📋 Инфо', type: 'message' },
        { text: '🛠️ Помощь', type: 'message' }
      ],
      [
        { text: '🎮 Тест', type: 'message' },
        { text: '⚙️ Настройки', type: 'message' }
      ]
    ],
    resize: true,
    one_time: false
  };

  await ctx.reply(
    `🤖 **Бот с REPLY кнопками**\n\n` +
    `Кнопки появятся под полем ввода!\n\n` +
    `Просто нажимай на них 👇`,
    { 
      format: 'markdown',
      reply_markup: replyMarkup 
    }
  );
});

// Обработчики reply кнопок
bot.hears('📋 Инфо', async (ctx: any) => {
  await ctx.reply('ℹ️ **Информация:**\nЭто бот с reply кнопками под полем ввода');
});

bot.hears('🛠️ Помощь', async (ctx: any) => {
  await ctx.reply('🛠️ **Помощь:**\nНажимай на кнопки ниже для быстрых действий');
});

bot.hears('🎮 Тест', async (ctx: any) => {
  await ctx.reply('🎮 **Тест:**\nReply кнопки работают отлично! 🎉');
});

bot.hears('⚙️ Настройки', async (ctx: any) => {
  // Показываем другую reply клавиатуру
  const settingsKeyboard = {
    keyboard: [
      [
        { text: '🔐 Безопасность', type: 'message' },
        { text: '🔔 Уведомления', type: 'message' }
      ],
      [
        { text: '🎨 Тема', type: 'message' },
        { text: '🔙 Назад', type: 'message' }
      ]
    ],
    resize: true
  };

  await ctx.reply('⚙️ **Настройки**\nВыберите опцию:', {
    reply_markup: settingsKeyboard
  });
});

// Обработчики для второй клавиатуры
bot.hears('🔐 Безопасность', async (ctx: any) => {
  await ctx.reply('🔐 Настройки безопасности');
});

bot.hears('🔔 Уведомления', async (ctx: any) => {
  await ctx.reply('🔔 Настройки уведомлений');
});

bot.hears('🎨 Тема', async (ctx: any) => {
  await ctx.reply('🎨 Выбор темы оформления');
});

bot.hears('🔙 Назад', async (ctx: any) => {
  // Возвращаем основную клавиатуру
  const mainKeyboard = {
    keyboard: [
      [
        { text: '📋 Инфо', type: 'message' },
        { text: '🛠️ Помощь', type: 'message' }
      ],
      [
        { text: '🎮 Тест', type: 'message' },
        { text: '⚙️ Настройки', type: 'message' }
      ]
    ],
    resize: true
  };

  await ctx.reply('Возвращаемся назад 👇', {
    reply_markup: mainKeyboard
  });
});

// Команда для скрытия клавиатуры
bot.command('hide', async (ctx: any) => {
  await ctx.reply('⌨️ Клавиатура скрыта\nИспользуй /start чтобы показать снова', {
    reply_markup: { remove_keyboard: true }
  });
});

// Обработчик обычных сообщений (если не кнопка)
bot.on('message_created', async (ctx: any) => {
  const text = ctx.message?.body?.text;
  
  // Игнорируем команды и текст кнопок
  const buttonTexts = ['📋 Инфо', '🛠️ Помощь', '🎮 Тест', '⚙️ Настройки', 
                      '🔐 Безопасность', '🔔 Уведомления', '🎨 Тема', '🔙 Назад'];
  
  if (text && !text.startsWith('/') && !buttonTexts.includes(text)) {
    await ctx.reply(`Ты написал: "${text}"\n\nИспользуй /start для кнопок`);
  }
});

// Обработчик ошибок
bot.catch((error: any) => {
  console.error('❌ Ошибка бота:', error);
});

// Запуск бота
async function startBot() {
  try {
    console.log('🚀 Запуск бота с REPLY кнопками...');
    await bot.start();
    console.log('✅ Бот запущен! Используй /start');
  } catch (error) {
    console.error('❌ Ошибка при запуске:', error);
  }
}

startBot();