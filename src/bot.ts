import { Bot } from '@maxhub/max-bot-api';
import dotenv from 'dotenv';
import path from 'path';
import { Keyboard } from '@maxhub/max-bot-api';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  throw new Error('BOT_TOKEN не найден. Добавьте его в .env');
}

const bot = new Bot(botToken);

const keyboard = Keyboard.inlineKeyboard([

  [
    Keyboard.button.callback('Помощь❓', 'help')
  ],
]);

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
  '🤖 GigaChat — точные ответы на любые нетривиальные вопросы.',
  '',
  'Начни работу:',
  'Отправь свою группу, предмет или вопрос.',
].join('\n');

const helpcomand = [
  'Z',
  'Z',
  'Z',
].join('\n');

bot.command('start', (ctx: Context) => {
  ctx.reply(startMessage,{attachments: [keyboard]});
});

bot.action('help', async (ctx) => {
  ctx.reply(helpcomand,{attachments: [keyboard]});
});

bot.start();