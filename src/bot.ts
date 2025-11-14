import { Bot, Context } from '@maxhub/max-bot-api';
import dotenv from 'dotenv';
import path from 'path';
import { 
    keyboard_start, 
    keyboard_mainmenu, 
    keyboard_helpmenu, 
    keyboard_gigachat 
} from './keyboard/mainmenu';
import { gigaChatService } from './utils/gigachat';
import { setUserState, getUserState } from './utils/userStates';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  throw new Error('BOT_TOKEN не найден. Добавьте его в .env');
}

const bot = new Bot(botToken);

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

// Команда старт
bot.command('start', async (ctx: Context) => {
  await ctx.reply(startMessage, { keyboard: keyboard_start });
});

// Обработка callback кнопок
bot.action('help', async (ctx) => {
  await ctx.reply(helpcomand, { keyboard: keyboard_helpmenu });
});

bot.action('contact', async (ctx) => {
  await ctx.reply('Контакты: ...', { keyboard: keyboard_helpmenu });
});

bot.action('backtomenu', async (ctx) => {
  const userId = ctx.message.from_id;
  setUserState(userId, 'main');
  await ctx.reply('Возвращаемся в главное меню', { keyboard: keyboard_mainmenu });
});

// НОВЫЙ ОБРАБОТЧИК GIGACHAT
bot.action('gigachat', async (ctx) => {
  const userId = ctx.message.from_id;
  setUserState(userId, 'gigachat_mode');
  
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
bot.on('message', async (ctx: Context) => {
  const userId = ctx.message.from_id;
  const userState = getUserState(userId);
  const messageText = ctx.message.text;
  
  // Пропускаем команды
  if (messageText?.startsWith('/')) {
    return;
  }
  
  // Если пользователь в режиме GigaChat и это не команда
  if (userState === 'gigachat_mode' && messageText && !messageText.startsWith('/')) {
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