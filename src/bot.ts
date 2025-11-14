import { Bot } from '@maxhub/max-bot-api';
import dotenv from 'dotenv';
import path from 'path';
import { Keyboard } from '@maxhub/max-bot-api';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  throw new Error('BOT_TOKEN не найден. Добавьте его в .env');
}

GigachatBool = true

const bot = new Bot(botToken);

//*****************************
//********INLINE KEYBOARD******
//*****************************

const keyboard_start = Keyboard.inlineKeyboard([

  [
    Keyboard.button.callback('Помощь❓', 'help')
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

const keyboard_unknown = Keyboard.inlineKeyboard([
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
  'Начни работу:',
  'Отправь свою группу, предмет или вопрос.',
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

bot.command('start', async (ctx: Context) => {
  await ctx.reply(startMessage,{attachments: [keyboard_start]});
});

bot.command('help', async (ctx: Context) => {
  await ctx.reply(helpcomand,{attachments: [keyboard_helpmenu]});
});

//************************************************
//********ИНИЦИАЛИЗАЦИЯ INLINE КНОПОК*************
//************************************************

bot.action('back', async (ctx: Context) => {
  await ctx.reply(mainmenu,{attachments: [keyboard_mainmenu]});
});

bot.action('help', async (ctx) => {
  await ctx.reply(helpcomand,{attachments: [keyboard_helpmenu]});
});

bot.action('schedule', async (ctx) => {
  await ctx.reply(schedule,{attachments: [keyboard_helpmenu]});
});

bot.action('gigachat', async (ctx) => {
  await ctx.reply(gigachat,{attachments: [keyboard_helpmenu]});
});

//Обработчик неизвестных команд
if (GigachatBool == true) {
  bot.on('message_created', async (ctx) => {
    await ctx.reply(unknown, {attachments: [keyboard_unknown]});
  });
} else {
  // код для случая, когда GigachatBool false
}
bot.start();