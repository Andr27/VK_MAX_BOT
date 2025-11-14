import { Bot } from '@maxhub/max-bot-api';
import dotenv from 'dotenv';
import path from 'path';
import { Keyboard } from '@maxhub/max-bot-api';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  throw new Error('BOT_TOKEN не найден. Добавьте его в .env');
}

let GigachatBool:boolean = false;

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
    Keyboard.button.callback('Помощь❓', 'help'),
    Keyboard.button.callback('🔙Назад', 'back'),
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
  '/расписание' +
  '',
].join('\n');

const schedule = [
  'Расписание типа',
].join('\n');

const gigachat = [
  'GigaChat типа',
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
  await ctx.reply(mainmenu,{attachments: [keyboard_mainmenu]});
});

bot.action('help', async (ctx: any) => {
  await ctx.reply(helpcomand,{attachments: [keyboard_helpmenu]});
});

bot.action('schedule', async (ctx: any) => {
  await ctx.reply(schedule,{attachments: [keyboard_helpmenu]});
});

bot.action('first_time', async (ctx: any) => {
  await ctx.reply('Введите свой университет:');
});
const keyboard_gigachat = Keyboard.inlineKeyboard([
    [
        Keyboard.button.callback('🔙 В главное меню', 'backtomenu')
    ],
]);
//Обработчик неизвестных команд
if (GigachatBool == false) {
  bot.on('message_created', async (ctx: any) => {
    await ctx.reply(unknown);
    await ctx.reply(mainmenu,{attachments: [keyboard_mainmenu]});
  });
} else {
  // код для случая, когда GigachatBool false
}
// НОВЫЙ ОБРАБОТЧИК GIGACHAT
bot.action('gigachat', async (ctx:any) => {
  const userId = ctx.message.from_id;
  GigachatBool = true;
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
  
  await ctx.reply(gigachatWelcome, { keyboard: keyboard_gigachat });
});

// Обработка текстовых сообщений для GigaChat
bot.on('message_callback', async (ctx: any) => {
  const userId = ctx.message.from_id;
  const messageText = ctx.message.text;
  
  // Пропускаем команды
  if (messageText?.startsWith('/')) {
    return;
  }
  
  // Если пользователь в режиме GigaChat и это не команда
  if (GigachatBool == true && messageText && !messageText.startsWith('/')) {
    // Показываем, что бот думает
    await ctx.reply('🤔 Думаю...', { keyboard: keyboard_gigachat });
    
    try {
      // Отправляем запрос в GigaChat
      const response = await gigaChatService.sendMessage(messageText);
      
      // Отправляем ответ (разбиваем если слишком длинный)
      if (response.length > 4096) {
        const chunks = response.match(/[\s\S]{1,4096}/g) || [];
        for (let i = 0; i < chunks.length; i++) {
          await ctx.reply(chunks[i], { 
            keyboard: i === chunks.length - 1 ? keyboard_gigachat : undefined 
          });
        }
      } else {
        await ctx.reply(response, { keyboard: keyboard_gigachat });
      }
      
    } catch (error) {
      console.error('GigaChat error:', error);
      await ctx.reply(
        '⚠️ Произошла ошибка при обращении к нейросети. Попробуйте еще раз.', 
        { keyboard: keyboard_gigachat }
      );
    }
  }
});
bot.start();

