import { Bot } from '@maxhub/max-bot-api';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Keyboard } from '@maxhub/max-bot-api';
import { 
    getUserData, 
    setUserUniversity, 
    setUserGroup, 
    cacheSchedule, 
    getCachedSchedule, 
    hasCompleteUserData,
    getUserDeadlines,
    addDeadline,
    removeDeadline,
    completeDeadline,
    getActiveDeadlines,
    updateDeadline
} from './database/userData';
import { parseDeadlineFromText } from './utils/deadlineParser';
import { parseSchedule, formatSchedule, listGroups, isParserAvailable } from './parser/scheduleParser';
import { getUserState, setUserState, clearUserState } from './utils/userStates';
import { universityNameToSlug, getPopularUniversities, findSimilarUniversities } from './utils/universityMapper';

let envPath: string | null = null;

const path1 = path.resolve(__dirname, '..', '.env');
const path2 = path.resolve(process.cwd(), '.env');
const path3 = path.resolve(process.cwd(), '..', '.env');
let path4: string | null = null;
try {
    const packageJsonPath = require.resolve('../package.json');
    path4 = path.resolve(path.dirname(packageJsonPath), '.env');
} catch (e) {
}

const pathsToCheck = [path1, path2, path3, path4].filter(p => p !== null) as string[];
for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
        envPath = p;
        break;
    }
}

if (!envPath) {
    envPath = path1;
}

if (path4) {
    console.log('   4. ', path4, fs.existsSync(path4) ? '✅ EXISTS' : '❌ NOT FOUND');
}

// Загружаем .env
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.error('❌ Error loading .env:', result.error.message);
} else {

    if (process.env.BOT_TOKEN) {
        console.log('   - BOT_TOKEN preview:', process.env.BOT_TOKEN.substring(0, 10) + '...' + process.env.BOT_TOKEN.substring(process.env.BOT_TOKEN.length - 10));
    }
    if (process.env.GIGACHAT_CREDENTIALS) {
        console.log('   - GIGACHAT_CREDENTIALS preview:', process.env.GIGACHAT_CREDENTIALS.substring(0, 20) + '...' + process.env.GIGACHAT_CREDENTIALS.substring(process.env.GIGACHAT_CREDENTIALS.length - 10));
    }

    const envKeys = Object.keys(process.env).filter(key => 
        key.includes('BOT') || key.includes('GIGA') || key.includes('TOKEN') || key.includes('CREDENTIALS')
    );
    if (envKeys.length > 0) {
        console.log('🔍 Found related env vars:', envKeys.join(', '));
    }

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

const { gigaChatService } = require('./utils/gigachat');

if (gigachatCredentials) {
    gigaChatService.updateCredentials();
}

if (!botToken) {
  throw new Error('BOT_TOKEN не найден. Добавьте его в .env');
}

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
    Keyboard.button.callback('⏰ Дедлайны', 'deadlines'),
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

const keyboard_schedule_short = Keyboard.inlineKeyboard([
  [
    Keyboard.button.callback('📅 Расписание на неделю', 'schedule_week')
  ],
  [
    Keyboard.button.callback('🔙 В главное меню', 'back')
  ],
]);

const keyboard_deadlines = Keyboard.inlineKeyboard([
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
  'Главное меню:',
].join('\n')

const helpcomand = [
  'Возможности бота:',
  '',
  '📅 Расписание — показывает актуальные пары по вашему университету. Можно запросить расписание по группе, по конкретной дате или по преподавателю. Бот выдаёт только точную информацию без лишних деталей.',
  '',
  '🧠 Учебная поддержка — использует генеративный ИИ, чтобы разбирать задачи, объяснять теорию, выводить формулы и отвечать на любые вопросы. Работает жёстко и по фактам: если ошибка — укажет, если данных нет — скажет прямо.',
  '',
  '⏰ Дедлайны и задачи — помогает составлять список важных дел, фиксировать дедлайны и следить за сроками. Может напомнить, структурировать и упорядочить задачи, чтобы ничего не потерять.'
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
  const chatId = ctx.message?.recipient?.chat_id || ctx.update?.callback_query?.message?.recipient?.chat_id || userId;
  
  if (userId) {
    userGigachatMode.set(userId, false);
  }
  
  console.log('\n🔙 ========== RETURN TO MAIN MENU ==========');
  console.log('👤 User ID:', userId);
  console.log('🔧 Setting GigaChat mode: false');
  console.log('🔙 =======================================\n');
  
  await ctx.api.sendMessageToChat(chatId, mainmenu, { attachments: [keyboard_mainmenu] });
});

bot.action('help', async (ctx: any) => {
  const userId = ctx.update?.callback_query?.from?.id || ctx.message?.recipient?.user_id;
  const chatId = ctx.message?.recipient?.chat_id || ctx.update?.callback_query?.message?.recipient?.chat_id || userId;
  await ctx.api.sendMessageToChat(chatId, helpcomand, { attachments: [keyboard_helpmenu] });
});

bot.action('schedule', async (ctx: any) => {
  const userId = ctx.message?.recipient?.user_id || ctx.update?.callback_query?.from?.id;
  const chatId = ctx.message?.recipient?.chat_id || ctx.update?.callback_query?.message?.recipient?.chat_id || userId;
  
  if (!userId) {
    await ctx.api.sendMessageToChat(chatId, 'Не удалось определить пользователя', {
      attachments: [keyboard_mainmenu]
    });
    return;
  }

  if (!isParserAvailable()) {
    await ctx.api.sendMessageToChat(chatId,
      '❌ Парсер расписания недоступен.\n\n' +
      'Убедитесь, что директория parser/ находится в проекте и содержит parser.py',
      { attachments: [keyboard_mainmenu] }
    );
    return;
  }
  
  const userData = getUserData(userId);
  
  if (!hasCompleteUserData(userId)) {
    await ctx.api.sendMessageToChat(chatId,
      '❌ Расписание не настроено.\n\n' +
      'Для начала настройте расписание:\n' +
      '1. Укажите университет (slug)\n' +
      '2. Укажите группу\n\n' +
      'Нажмите кнопку "Начать" для настройки.',
      { attachments: [keyboard_start] }
    );
    return;
  }

  let scheduleData = getCachedSchedule(userId);
  
  if (!scheduleData) {
    await ctx.api.sendMessageToChat(chatId, '⏳ Загружаю расписание...', {
      attachments: [keyboard_mainmenu]
    });
    
    const result = await parseSchedule({
      slug: userData!.university!,
      group: userData!.group!
    });
    
    if (!result.success) {
      await ctx.api.sendMessageToChat(chatId, 
        `❌ Ошибка при загрузке расписания:\n${result.error}\n\nПроверьте правильность указанных данных.`,
        { attachments: [keyboard_mainmenu] }
      );
      return;
    }
    
    scheduleData = result.schedule;
    cacheSchedule(userId, scheduleData);
  }

  const formatted = formatSchedule(scheduleData, undefined, 3);

  if (formatted.length > 4096) {
    const chunks = formatted.match(/[\s\S]{1,4000}/g) || [];
    for (let i = 0; i < chunks.length; i++) {
      if (i === chunks.length - 1) {
        await ctx.api.sendMessageToChat(chatId, chunks[i], {
          attachments: [keyboard_schedule_short]
        });
      } else {
        await ctx.api.sendMessageToChat(chatId, chunks[i]);
      }
    }
  } else {
    await ctx.api.sendMessageToChat(chatId, formatted, {
      attachments: [keyboard_schedule_short]
    });
  }
});

bot.action('deadlines', async (ctx: any) => {
  const userId = ctx.message?.recipient?.user_id || ctx.update?.callback_query?.from?.id;
  const chatId = ctx.message?.recipient?.chat_id || ctx.update?.callback_query?.message?.recipient?.chat_id || userId;
  
  if (!userId) {
    await ctx.api.sendMessageToChat(chatId, 'Не удалось определить пользователя', {
      attachments: [keyboard_mainmenu]
    });
    return;
  }
  
  const activeDeadlines = getActiveDeadlines(userId);
  
  if (activeDeadlines.length === 0) {
    await ctx.api.sendMessageToChat(chatId,
      '📋 У вас пока нет активных дедлайнов.\n\n' +
      '💡 Вы можете добавить дедлайн, написав об этом в GigaChat, например:\n' +
      '• "Мне нужно сдать курсовую по математике через неделю"\n' +
      '• "Дедлайн на реферат по истории завтра"\n' +
      '• "Сделать домашнюю работу по физике 25.12"',
      { attachments: [keyboard_deadlines] }
    );
    return;
  }

  let message = '⏰ Ваши дедлайны:\n\n';
  
  activeDeadlines.forEach((deadline, index) => {
    const dueDate = new Date(deadline.dueDate);
    const now = new Date();
    const daysLeft = Math.ceil((deadline.dueDate - now.getTime()) / (1000 * 60 * 60 * 24));
    
    message += `${index + 1}. 📌 ${deadline.title}\n`;
    if (deadline.subject) {
      message += `   Предмет: ${deadline.subject}\n`;
    }
    message += `   📅 Срок: ${dueDate.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })}\n`;
    
    if (daysLeft < 0) {
      message += `   ⚠️ Просрочено на ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'день' : 'дней'}\n`;
    } else if (daysLeft === 0) {
      message += `   🔴 Срок сегодня!\n`;
    } else if (daysLeft === 1) {
      message += `   🟡 Остался 1 день\n`;
    } else if (daysLeft <= 3) {
      message += `   🟡 Осталось ${daysLeft} дня\n`;
    } else {
      message += `   ✅ Осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}\n`;
    }
    
    if (deadline.description) {
      message += `   📝 ${deadline.description.substring(0, 100)}${deadline.description.length > 100 ? '...' : ''}\n`;
    }
    
    message += '\n';
  });
  
  message += '\n💡 Чтобы добавить дедлайн, напишите об этом в GigaChat!';
  message += '\n\n📝 Для изменения или удаления дедлайна используйте кнопки ниже:';

  const deadlineButtons: any[] = [
    [
      Keyboard.button.callback('✏️ Изменить дедлайн', 'edit_deadline'),
      Keyboard.button.callback('🗑️ Удалить дедлайн', 'delete_deadline')
    ],
    [
      Keyboard.button.callback('🔙 В главное меню', 'back')
    ]
  ];
  
  const keyboard_with_actions = Keyboard.inlineKeyboard(deadlineButtons);
  
  await ctx.api.sendMessageToChat(chatId, message, {
    attachments: [keyboard_with_actions]
  });
});

bot.action('edit_deadline', async (ctx: any) => {
  const userId = ctx.message?.recipient?.user_id || ctx.update?.callback_query?.from?.id;
  const chatId = ctx.message?.recipient?.chat_id || ctx.update?.callback_query?.message?.recipient?.chat_id || userId;
  
  if (!userId) {
    await ctx.api.sendMessageToChat(chatId, 'Не удалось определить пользователя', {
      attachments: [keyboard_mainmenu]
    });
    return;
  }
  
  const activeDeadlines = getActiveDeadlines(userId);
  
  if (activeDeadlines.length === 0) {
    await ctx.api.sendMessageToChat(chatId, '❌ У вас нет активных дедлайнов для редактирования', {
      attachments: [keyboard_mainmenu]
    });
    return;
  }

  setUserState(userId, 'waiting_deadline_edit_number');
  
  let message = '✏️ Редактирование дедлайна\n\n';
  message += '📋 Ваши дедлайны:\n';
  activeDeadlines.forEach((deadline, index) => {
    message += `${index + 1}. ${deadline.title}\n`;
  });
  message += '\n📝 Напишите номер дедлайна, который хотите изменить, и новое описание, например:\n';
  message += '"1 сдать курсовую по математике через 3 дня"\n\n';
  message += '💡 Или напишите "отмена" для отмены операции.';
  
  await ctx.api.sendMessageToChat(chatId, message, {
    attachments: [keyboard_deadlines]
  });
});

bot.action('delete_deadline', async (ctx: any) => {
  const userId = ctx.message?.recipient?.user_id || ctx.update?.callback_query?.from?.id;
  const chatId = ctx.message?.recipient?.chat_id || ctx.update?.callback_query?.message?.recipient?.chat_id || userId;
  
  if (!userId) {
    await ctx.api.sendMessageToChat(chatId, 'Не удалось определить пользователя', {
      attachments: [keyboard_mainmenu]
    });
    return;
  }
  
  const activeDeadlines = getActiveDeadlines(userId);
  
  if (activeDeadlines.length === 0) {
    await ctx.api.sendMessageToChat(chatId, '❌ У вас нет активных дедлайнов для удаления', {
      attachments: [keyboard_mainmenu]
    });
    return;
  }

  setUserState(userId, 'waiting_deadline_delete_number');
  
  let message = '🗑️ Удаление дедлайна\n\n';
  message += '📋 Ваши дедлайны:\n';
  activeDeadlines.forEach((deadline, index) => {
    message += `${index + 1}. ${deadline.title}\n`;
  });
  message += '\n⚠️ Напишите номер дедлайна, который хотите удалить:\n\n';
  message += '💡 Или напишите "отмена" для отмены операции.';
  
  await ctx.api.sendMessageToChat(chatId, message, {
    attachments: [keyboard_deadlines]
  });
});

bot.action('schedule_week', async (ctx: any) => {
  const userId = ctx.message?.recipient?.user_id || ctx.update?.callback_query?.from?.id;
  const chatId = ctx.message?.recipient?.chat_id || ctx.update?.callback_query?.message?.recipient?.chat_id || userId;
  
  if (!userId) {
    await ctx.api.sendMessageToChat(chatId, 'Не удалось определить пользователя', {
      attachments: [keyboard_mainmenu]
    });
    return;
  }
  
  const userData = getUserData(userId);
  
  if (!hasCompleteUserData(userId)) {
    await ctx.api.sendMessageToChat(chatId,
      '❌ Расписание не настроено.',
      { attachments: [keyboard_mainmenu] }
    );
    return;
  }

  let scheduleData = getCachedSchedule(userId);
  
  if (!scheduleData) {
    await ctx.api.sendMessageToChat(chatId, '⏳ Загружаю расписание...', {
      attachments: [keyboard_mainmenu]
    });
    
    const result = await parseSchedule({
      slug: userData!.university!,
      group: userData!.group!
    });
    
    if (!result.success) {
      await ctx.api.sendMessageToChat(chatId, 
        `❌ Ошибка при загрузке расписания:\n${result.error}`,
        { attachments: [keyboard_mainmenu] }
      );
      return;
    }
    
    scheduleData = result.schedule;
    cacheSchedule(userId, scheduleData);
  }

  const formatted = formatSchedule(scheduleData, undefined, 7);

  if (formatted.length > 4096) {
    const chunks = formatted.match(/[\s\S]{1,4000}/g) || [];
    for (let i = 0; i < chunks.length; i++) {
      if (i === chunks.length - 1) {
        await ctx.api.sendMessageToChat(chatId, chunks[i], {
          attachments: [keyboard_mainmenu]
        });
      } else {
        await ctx.api.sendMessageToChat(chatId, chunks[i]);
      }
    }
  } else {
    await ctx.api.sendMessageToChat(chatId, formatted, {
      attachments: [keyboard_schedule_short]
    });
  }
});

bot.action('first_time', async (ctx: any) => {
  const userId = ctx.message?.recipient?.user_id || ctx.update?.callback_query?.from?.id;
  const chatId = ctx.message?.recipient?.chat_id || ctx.update?.callback_query?.message?.recipient?.chat_id || userId;

  if (!isParserAvailable()) {
    await ctx.api.sendMessageToChat(chatId,
      '❌ Парсер расписания недоступен.\n\n' +
      'Убедитесь, что директория parser/ находится в проекте и содержит parser.py',
      { attachments: [keyboard_mainmenu] }
    );
    return;
  }
  
  if (userId) {
    setUserState(userId, 'waiting_university');
  }
  
  const popular = getPopularUniversities();
  const popularList = popular.map(u => `• ${u.name}`).join('\n');
  
  await ctx.api.sendMessageToChat(chatId,
    'Введите название вашего университета:\n\n' +
    '📚 Примеры популярных вузов:\n' +
    popularList +
    '\n\n💡 Можно вводить как полное название (ТОГУ, МГУ), так и сокращение (togu, msu)'
  );
});

bot.action('gigachat', async (ctx: any) => {
  const userId = ctx.update?.callback_query?.from?.id
    || ctx.callback_query?.from?.id
    || ctx.message?.recipient?.user_id  // ВАЖНО: recipient, а не sender!
    || ctx.update?.callback_query?.message?.sender?.user_id;
  const chatId = ctx.message?.recipient?.chat_id || ctx.update?.callback_query?.message?.recipient?.chat_id || userId;
  
  if (userId) {
    userGigachatMode.set(userId, true);
  }
  
  console.log('\n🎯 ========== GIGACHAT MODE ACTIVATED ==========');
  console.log('👤 User ID:', userId);
  console.log('🕒 Time:', new Date().toLocaleString());
  console.log('🔧 Setting GigaChat mode: true');
  console.log('🎯 ===========================================\n');
  
  await ctx.api.sendMessageToChat(chatId, gigachatWelcome, { attachments: [keyboard_gigachat] });
});

bot.on('message_created', async (ctx: any) => {
  // Получаем user ID и текст сообщения из правильной структуры max-bot-api
  const userId = ctx.message?.sender?.user_id;
  const messageText = ctx.message?.body?.text;
  const isGigachatMode = userId ? (userGigachatMode.get(userId) || false) : false;

  console.log('\n📨 ========== NEW MESSAGE ==========');
  console.log('👤 User ID (sender):', userId);
  console.log('💬 Message:', messageText);
  console.log('🔧 GigaChat mode:', isGigachatMode);
  console.log('📨 ================================\n');

  if (!userId) {
    console.log('⚠️ Skipping message: no user ID found');
    return;
  }

  if (messageText?.startsWith('/')) {
    return;
  }

  if (!messageText) {
    console.log('⚠️ Skipping message: no text content');
    return;
  }

  const userState = getUserState(userId);

  if (userState === 'waiting_deadline_edit_number') {
    if (messageText.toLowerCase().trim() === 'отмена' || messageText.toLowerCase().trim() === 'cancel') {
      clearUserState(userId);
      await ctx.reply('❌ Редактирование отменено', { attachments: [keyboard_mainmenu] });
      return;
    }
    
    const activeDeadlines = getActiveDeadlines(userId);
    const text = messageText.trim();
    const numberMatch = text.match(/^(\d+)\s+(.+)$/);
    
    if (!numberMatch) {
      await ctx.reply(
        '❌ Неверный формат. Напишите номер дедлайна и новое описание, например:\n' +
        '"1 сдать курсовую по математике через 3 дня"\n\n' +
        '💡 Или напишите "отмена" для отмены.',
        { attachments: [keyboard_deadlines] }
      );
      return;
    }
    
    const deadlineNumber = parseInt(numberMatch[1], 10);
    const newDescription = numberMatch[2];
    
    if (deadlineNumber < 1 || deadlineNumber > activeDeadlines.length) {
      await ctx.reply(
        `❌ Неверный номер дедлайна. Доступные номера: 1-${activeDeadlines.length}\n\n` +
        '💡 Или напишите "отмена" для отмены.',
        { attachments: [keyboard_deadlines] }
      );
      return;
    }
    
    const deadline = activeDeadlines[deadlineNumber - 1];
    const parsedDeadline = parseDeadlineFromText(newDescription);
    
    if (!parsedDeadline) {
      await ctx.reply(
        '❌ Не удалось распознать дедлайн в вашем сообщении.\n\n' +
        '💡 Попробуйте еще раз, например:\n' +
        `"${deadlineNumber} сдать курсовую по математике через 3 дня"\n\n` +
        'Или напишите "отмена" для отмены.',
        { attachments: [keyboard_deadlines] }
      );
      return;
    }

    const updated = updateDeadline(userId, deadline.id, {
      title: parsedDeadline.title,
      subject: parsedDeadline.subject,
      dueDate: parsedDeadline.dueDate,
      description: parsedDeadline.description
    });
    
    if (updated) {
      clearUserState(userId);
      const dueDate = new Date(parsedDeadline.dueDate);
      await ctx.reply(
        `✅ Дедлайн успешно обновлен!\n\n` +
        `📌 ${parsedDeadline.title}\n` +
        (parsedDeadline.subject ? `📚 Предмет: ${parsedDeadline.subject}\n` : '') +
        `📅 Новый срок: ${dueDate.toLocaleDateString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        })}\n\n` +
        `💡 Нажмите "⏰ Дедлайны" для просмотра обновленного списка`,
        { attachments: [keyboard_mainmenu] }
      );
    } else {
      clearUserState(userId);
      await ctx.reply('❌ Ошибка при обновлении дедлайна', { attachments: [keyboard_mainmenu] });
    }
    return;
  }
  
  if (userState === 'waiting_deadline_delete_number') {
    if (messageText.toLowerCase().trim() === 'отмена' || messageText.toLowerCase().trim() === 'cancel') {
      clearUserState(userId);
      await ctx.reply('❌ Удаление отменено', { attachments: [keyboard_mainmenu] });
      return;
    }
    
    const activeDeadlines = getActiveDeadlines(userId);
    const inputNumber = parseInt(messageText.trim(), 10);
    
    if (isNaN(inputNumber) || inputNumber < 1 || inputNumber > activeDeadlines.length) {
      await ctx.reply(
        `❌ Неверный номер дедлайна. Доступные номера: 1-${activeDeadlines.length}\n\n` +
        '💡 Или напишите "отмена" для отмены операции.',
        { attachments: [keyboard_deadlines] }
      );
      return;
    }
    
    const deadline = activeDeadlines[inputNumber - 1];
    const removed = removeDeadline(userId, deadline.id);
    
    if (removed) {
      clearUserState(userId);
      const remainingDeadlines = getActiveDeadlines(userId);
      
      let message = `✅ Дедлайн "${deadline.title}" успешно удален!`;
      
      if (remainingDeadlines.length > 0) {
        message += `\n\n📋 Осталось дедлайнов: ${remainingDeadlines.length}`;
        message += `\n💡 Нажмите "⏰ Дедлайны" для просмотра обновленного списка`;
      } else {
        message += `\n\n📋 У вас больше нет активных дедлайнов.`;
      }
      
      await ctx.reply(message, { attachments: [keyboard_mainmenu] });
    } else {
      clearUserState(userId);
      await ctx.reply('❌ Ошибка при удалении дедлайна', { attachments: [keyboard_mainmenu] });
    }
    return;
  }
  
  if (userState === 'waiting_university') {
    const universityName = messageText.trim();
    const slug = universityNameToSlug(universityName);
    
    if (!slug) {
      const similar = findSimilarUniversities(universityName);
      if (similar.length > 0) {
        const similarList = similar.map(u => `• ${u.name} (${u.slug})`).join('\n');
        await ctx.reply(
          `❌ Университет "${universityName}" не найден.\n\n` +
          `💡 Возможно, вы имели в виду:\n${similarList}\n\n` +
          `Попробуйте ввести одно из предложенных названий или slug.`,
          { attachments: [keyboard_mainmenu] }
        );
      } else {
        await ctx.reply(
          `❌ Университет "${universityName}" не найден.\n\n` +
          `💡 Попробуйте ввести:\n` +
          `• Полное название (например: ТОГУ, МГУ)\n` +
          `• Или slug (например: togu, msu)\n\n` +
          `Список доступных вузов: dnevuch.ru`,
          { attachments: [keyboard_mainmenu] }
        );
      }
      return;
    }
    const popular = getPopularUniversities().find(u => u.slug === slug);
    const displayName = popular ? popular.name : slug.toUpperCase();
    
    setUserUniversity(userId, slug);
    setUserState(userId, 'waiting_group');
    
    await ctx.reply(
      `✅ Университет сохранен: ${displayName} (${slug})\n\n` +
      `Теперь введите название вашей группы:`,
      { attachments: [keyboard_mainmenu] }
    );
    return;
  }
  
  if (userState === 'waiting_group') {
    const group = messageText.trim();
    setUserGroup(userId, group);
    clearUserState(userId);
    
    const userData = getUserData(userId);

    if (!isParserAvailable()) {
      await ctx.reply(
        `✅ Группа сохранена: ${group}\n\n` +
        `❌ Парсер недоступен. Расписание не может быть загружено.\n` +
        `Убедитесь, что директория parser/ находится в проекте.`,
        { attachments: [keyboard_mainmenu] }
      );
      return;
    }
    
    await ctx.reply(
      `✅ Группа сохранена: ${group}\n\n` +
      `⏳ Парсинг расписания для ${userData?.university} / ${group}...`,
      { attachments: [keyboard_mainmenu] }
    );

    const result = await parseSchedule({
      slug: userData!.university!,
      group: group
    });
    
    if (!result.success) {
      await ctx.reply(
        `❌ Ошибка при парсинге расписания:\n${result.error}\n\n` +
        `Проверьте правильность указанных данных и попробуйте снова.`,
        { attachments: [keyboard_mainmenu] }
      );
      return;
    }

    cacheSchedule(userId, result.schedule);
    
    await ctx.reply(
      `✅ Расписание успешно загружено и сохранено!\n\n` +
      `Теперь вы можете просматривать расписание через кнопку "📅 Расписание"`,
      { attachments: [keyboard_mainmenu] }
    );
    return;
  }

  if (isGigachatMode && userId) {
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

    const parsedDeadline = parseDeadlineFromText(messageText);

    await ctx.reply('🤔 Думаю...', { attachments: [keyboard_gigachat] });
    
    try {
      const response = await gigaChatService.sendMessage(messageText);
      if (parsedDeadline) {
        try {
          const deadline = addDeadline(userId, parsedDeadline);
          const dueDate = new Date(deadline.dueDate);
          const deadlineInfo = `\n\n✅ Дедлайн сохранен!\n` +
            `📌 ${deadline.title}\n` +
            (deadline.subject ? `📚 Предмет: ${deadline.subject}\n` : '') +
            `📅 Срок: ${dueDate.toLocaleDateString('ru-RU', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            })}\n` +
            `💡 Вы можете посмотреть все дедлайны в меню "⏰ Дедлайны"`;
          if ((response + deadlineInfo).length > 4096) {
            const chunks = response.match(/[\s\S]{1,4000}/g) || [];
            for (let i = 0; i < chunks.length; i++) {
              await ctx.reply(chunks[i], { 
                attachments: i === chunks.length - 1 ? keyboard_gigachat : undefined 
              });
            }
            await ctx.reply(deadlineInfo, { attachments: [keyboard_gigachat] });
          } else {
            await ctx.reply(response + deadlineInfo, { attachments: [keyboard_gigachat] });
          }
        } catch (deadlineError) {
          console.error('Ошибка при сохранении дедлайна:', deadlineError);
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
        }
      } else {
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
    if (messageText !== '/start' && messageText !== '/help') {
      await ctx.reply(unknown);
      await ctx.reply(mainmenu,{attachments: [keyboard_mainmenu]});
    }
  }
});

bot.start();