import { Bot } from '@maxhub/max-bot-api';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Keyboard } from '@maxhub/max-bot-api';
// НЕ импортируем gigaChatService здесь, так как .env еще не загружен
// Импортируем после загрузки .env


// Загружаем .env из корня проекта (работает и в dev, и в production)
// Пробуем несколько путей для надежности
let envPath: string | null = null;

// Вариант 1: относительно __dirname (когда запускается из src/)
const path1 = path.resolve(__dirname, '..', '.env');
// Вариант 2: относительно process.cwd() (когда запускается из корня проекта)
const path2 = path.resolve(process.cwd(), '.env');
// Вариант 3: если process.cwd() указывает на src/, поднимаемся на уровень выше
const path3 = path.resolve(process.cwd(), '..', '.env');
// Вариант 4: ищем package.json и берем .env из той же директории
let path4: string | null = null;
try {
    const packageJsonPath = require.resolve('../package.json');
    path4 = path.resolve(path.dirname(packageJsonPath), '.env');
} catch (e) {
    // package.json не найден, пропускаем этот вариант
}

// Проверяем, какой путь существует
const pathsToCheck = [path1, path2, path3, path4].filter(p => p !== null) as string[];
for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
        envPath = p;
        break;
    }
}

// Если ни один путь не найден, используем путь относительно __dirname по умолчанию
if (!envPath) {
    envPath = path1;
}

console.log('📁 Trying to load .env from:');
console.log('   1. ', path1, fs.existsSync(path1) ? '✅ EXISTS' : '❌ NOT FOUND');
console.log('   2. ', path2, fs.existsSync(path2) ? '✅ EXISTS' : '❌ NOT FOUND');
console.log('   3. ', path3, fs.existsSync(path3) ? '✅ EXISTS' : '❌ NOT FOUND');
if (path4) {
    console.log('   4. ', path4, fs.existsSync(path4) ? '✅ EXISTS' : '❌ NOT FOUND');
}
console.log('📁 Selected path:', envPath);
console.log('📁 File exists:', fs.existsSync(envPath));
console.log('📁 Current working directory:', process.cwd());
console.log('📁 __dirname:', __dirname);

// Загружаем .env
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.error('❌ Error loading .env:', result.error.message);
} else {
    console.log('✅ .env loaded successfully from:', envPath);
    console.log('📋 Parsed variables from .env:', result.parsed ? Object.keys(result.parsed).join(', ') : 'none');
    console.log('📋 Loaded environment variables:');
    console.log('   - BOT_TOKEN:', process.env.BOT_TOKEN ? `✅ (length: ${process.env.BOT_TOKEN.length})` : '❌ NOT FOUND');
    console.log('   - GIGACHAT_CREDENTIALS:', process.env.GIGACHAT_CREDENTIALS ? `✅ (length: ${process.env.GIGACHAT_CREDENTIALS.length})` : '❌ NOT FOUND');
    
    // Показываем первые и последние символы для проверки (безопасно)
    if (process.env.BOT_TOKEN) {
        console.log('   - BOT_TOKEN preview:', process.env.BOT_TOKEN.substring(0, 10) + '...' + process.env.BOT_TOKEN.substring(process.env.BOT_TOKEN.length - 10));
    }
    if (process.env.GIGACHAT_CREDENTIALS) {
        console.log('   - GIGACHAT_CREDENTIALS preview:', process.env.GIGACHAT_CREDENTIALS.substring(0, 20) + '...' + process.env.GIGACHAT_CREDENTIALS.substring(process.env.GIGACHAT_CREDENTIALS.length - 10));
    }
    
    // Показываем все переменные окружения, начинающиеся с BOT_ или GIGA
    const envKeys = Object.keys(process.env).filter(key => 
        key.includes('BOT') || key.includes('GIGA') || key.includes('TOKEN') || key.includes('CREDENTIALS')
    );
    if (envKeys.length > 0) {
        console.log('🔍 Found related env vars:', envKeys.join(', '));
    }
    
    // Проверяем, что файл .env читается правильно
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
        console.log('📄 .env file lines (without comments):', lines.length);
        lines.forEach((line, index) => {
            const key = line.split('=')[0]?.trim();
            if (key) {
                console.log(`   Line ${index + 1}: ${key} = ${line.split('=')[1]?.substring(0, 20)}...`);
            }
        });
    } catch (e) {
        console.error('❌ Error reading .env file:', e);
    }
}

const botToken = process.env.BOT_TOKEN;
const gigachatCredentials = process.env.GIGACHAT_CREDENTIALS;

// Импортируем gigaChatService ПОСЛЕ загрузки .env
const { gigaChatService } = require('./utils/gigachat');

// Обновляем credentials в GigaChatService после загрузки .env
if (gigachatCredentials) {
    gigaChatService.updateCredentials();
}

if (!botToken) {
  throw new Error('BOT_TOKEN не найден. Добавьте его в .env');
}

if (!gigachatCredentials) {
  console.warn('⚠️ GIGACHAT_CREDENTIALS не найден. Функция GigaChat будет недоступна.');
  console.warn('💡 Для работы GigaChat добавьте GIGACHAT_CREDENTIALS в .env файл');
  console.warn('💡 Получите Client ID и Client Secret в личном кабинете GigaChat API');
  console.warn('💡 Закодируйте их в Base64 в формате "Client ID:Client Secret"');
}

// Храним состояния для каждого пользователя
const userGigachatMode = new Map<number, boolean>();

const bot = new Bot(botToken);

//*****************************
//********INLINE KEYBOARD******
//*****************************

const keyboard_start = Keyboard.inlineKeyboard([
  [
    Keyboard.button.callback('Начать', 'first_time')
  ],
]);

const keyboard_mainmenu = Keyboard.inlineKeyboard([
  [
    Keyboard.button.callback('📅 Расписание', 'schedule'),
    Keyboard.button.callback('🤖 GigaChat', 'gigachat')
  ],
  [
    Keyboard.button.callback('Помощь❓', 'help')
  ],
]);

const keyboard_helpmenu = Keyboard.inlineKeyboard([
  [
    Keyboard.button.callback('🔙Назад', 'back'),
  ],
]);

const keyboard_gigachat = Keyboard.inlineKeyboard([
  [
    Keyboard.button.callback('🔙 В главное меню', 'back')
  ],
]);

//*****************************
//********ТЕКСТИКИ*************
//*****************************

const startMessage = [
  'Приветствую. Ты здесь впервые?',
  '',
  'Это учебный бот для студентов.',
  'Он показывает расписание, напоминает о парах и помогает по учёбе.',
  'Внутри встроена нейросеть GigaChat, способная разбирать нестандартные и сложные запросы.',
  '',
  'Возможности бота:',
  '📅 Расписание — выдача пар по группе, дате или преподавателю.',
  '📘 Учебная помощь — объяснения, разбор задач, теория, формулы.',
  '⏰ Напоминания — уведомления о занятиях, дедлайнах и событиях.',
  '',
  'Чтобы начать работу нажмите кнопку "Начать"',
].join('\n');

const mainmenu = [
  'Главное меню',
  '',
  'Выберите нужный раздел:',
  '',
  '📅 Расписание — просмотр пар по группе, дате или преподавателю',
  '🤖 GigaChat — вопросы по учёбе и не только',
  '❓ Помощь — инструкции и поддержка',
].join('\n')

const helpcomand = [
  '/start - стартовая программа',
  '/help - помощь',
  '/расписание',
  '',
].join('\n');

const schedule = [
  'Расписание типа',
].join('\n');

const gigachatWelcome = [
  '🤖 Добро пожаловать в чат с GigaChat!',
  '',
  'Задайте любой вопрос нейросети:',
  '• Объяснение сложных тем',
  '• Помощь с домашними заданиями', 
  '• Разбор теорий и концепций',
  '• Решение задач',
  '• И многое другое...',
  '',
  'Просто напишите ваш вопрос в чат!',
  'Для возврата в главное меню нажмите кнопку ниже 👇'
].join('\n');

const unknown = [
  'Возможно, я вас не правильно понял, повторите свой запрос!',
  'Либо воспользуйтесь меню "Помощь❓"'
].join('\n');

//************************************************
//********ИНИЦИАЛИЗАЦИЯ КОМАНД ЧЕРЕЗ SLASH*************
//************************************************

bot.command('start', async (ctx) => {
  // @ts-ignore
  await ctx.reply(startMessage,{attachments: [keyboard_start]});
});

bot.command('help', async (ctx) => {
  // @ts-ignore
  await ctx.reply(helpcomand,{attachments: [keyboard_helpmenu]});
});

//************************************************
//********ИНИЦИАЛИЗАЦИЯ INLINE КНОПОК*************
//************************************************

bot.action('back', async (ctx: any) => {
  // В callback-кнопках используем recipient.user_id (ID пользователя)
  const userId = ctx.update?.callback_query?.from?.id
    || ctx.callback_query?.from?.id
    || ctx.message?.recipient?.user_id  // ВАЖНО: recipient, а не sender!
    || ctx.update?.callback_query?.message?.sender?.user_id;
  
  if (userId) {
    userGigachatMode.set(userId, false);
  }
  
  console.log('\n🔙 ========== RETURN TO MAIN MENU ==========');
  console.log('👤 User ID:', userId);
  console.log('🔧 Setting GigaChat mode: false');
  console.log('🔙 =======================================\n');
  
  await ctx.reply(mainmenu,{attachments: [keyboard_mainmenu]});
});

bot.action('help', async (ctx: any) => {
  await ctx.reply(helpcomand,{attachments: [keyboard_helpmenu]});
});

bot.action('schedule', async (ctx: any) => {
  await ctx.reply(schedule,{attachments: [keyboard_mainmenu]});
});

bot.action('first_time', async (ctx: any) => {
  await ctx.reply('Введите свой университет:');
});

// НОВЫЙ ОБРАБОТЧИК GIGACHAT
bot.action('gigachat', async (ctx: any) => {
  // В callback-кнопках:
  // - ctx.message.sender - это БОТ (is_bot: true)
  // - ctx.message.recipient.user_id - это ПОЛЬЗОВАТЕЛЬ, который нажал кнопку
  // Также пробуем update.callback_query.from.id (стандартная структура Telegram)
  const userId = ctx.update?.callback_query?.from?.id
    || ctx.callback_query?.from?.id
    || ctx.message?.recipient?.user_id  // ВАЖНО: recipient, а не sender!
    || ctx.update?.callback_query?.message?.sender?.user_id;
  
  if (userId) {
    userGigachatMode.set(userId, true);
  }
  
  console.log('\n🎯 ========== GIGACHAT MODE ACTIVATED ==========');
  console.log('👤 User ID:', userId);
  console.log('🕒 Time:', new Date().toLocaleString());
  console.log('🔧 Setting GigaChat mode: true');
  console.log('🎯 ===========================================\n');
  
  await ctx.reply(gigachatWelcome, { attachments: [keyboard_gigachat] });
});


// Обработка текстовых сообщений для GigaChat
bot.on('message_created', async (ctx: any) => {
  // Получаем user ID и текст сообщения из правильной структуры max-bot-api
  const userId = ctx.message?.sender?.user_id;
  const messageText = ctx.message?.body?.text;
  const isGigachatMode = userId ? (userGigachatMode.get(userId) || false) : false;
  
  // В текстовых сообщениях sender.user_id - это ID пользователя
  // Отладочный вывод (можно убрать позже)
  console.log('\n📨 ========== NEW MESSAGE ==========');
  console.log('👤 User ID (sender):', userId);
  console.log('💬 Message:', messageText);
  console.log('🔧 GigaChat mode:', isGigachatMode);
  console.log('📨 ================================\n');
  
  // Если нет user ID, пропускаем (это может быть системное сообщение)
  if (!userId) {
    console.log('⚠️ Skipping message: no user ID found');
    return;
  }
  
  // Пропускаем команды
  if (messageText?.startsWith('/')) {
    return;
  }
  
  // Если это не текст сообщения (например, callback или другое событие)
  if (!messageText) {
    console.log('⚠️ Skipping message: no text content');
    return;
  }
  
  // Если пользователь в режиме GigaChat
  if (isGigachatMode && userId) {
    // Проверяем наличие credentials
    if (!gigachatCredentials) {
      console.error('❌ GIGACHAT_CREDENTIALS не найден в переменных окружения');
      console.log('🔍 Проверяем process.env:', {
        BOT_TOKEN: process.env.BOT_TOKEN ? '✅' : '❌',
        GIGACHAT_CREDENTIALS: process.env.GIGACHAT_CREDENTIALS ? '✅' : '❌'
      });
      await ctx.reply(
        '⚠️ GigaChat не настроен. Обратитесь к администратору бота.', 
        { attachments: [keyboard_gigachat] }
      );
      return;
    }
    
    // Показываем, что бот думает
    await ctx.reply('🤔 Думаю...', { attachments: [keyboard_gigachat] });
    
    try {
      // Отправляем запрос в GigaChat
      const response = await gigaChatService.sendMessage(messageText);
      
      // Отправляем ответ (разбиваем если слишком длинный)
      if (response.length > 4096) {
        const chunks = response.match(/[\s\S]{1,4096}/g) || [];
        for (let i = 0; i < chunks.length; i++) {
          await ctx.reply(chunks[i], { 
            attachments: i === chunks.length - 1 ? keyboard_gigachat : undefined 
          });
        }
      } else {
        await ctx.reply(response, { attachments: [keyboard_gigachat] });
      }
      
    } catch (error: any) {
      console.error('GigaChat error:', error);
      let errorMessage = '⚠️ Произошла ошибка при обращении к нейросети. Попробуйте еще раз.';
      
      if (error.message && error.message.includes('GIGACHAT_CREDENTIALS')) {
        errorMessage = '⚠️ GigaChat не настроен. Обратитесь к администратору бота.';
      } else if (error.message && error.message.includes('Rate limit')) {
        errorMessage = '⚠️ Превышен лимит запросов. Попробуйте позже.';
      }
      
      await ctx.reply(errorMessage, { attachments: [keyboard_gigachat] });
    }
  } else {
    // Если не в режиме GigaChat и неизвестная команда
    if (messageText !== '/start' && messageText !== '/help') {
      await ctx.reply(unknown);
      await ctx.reply(mainmenu,{attachments: [keyboard_mainmenu]});
    }
  }
});

bot.start();