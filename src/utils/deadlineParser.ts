/**
 * Утилита для парсинга дедлайнов из текста пользователя
 */

interface ParsedDeadline {
    title: string;
    subject?: string;
    dueDate: number; // timestamp
    description?: string;
}

/**
 * Парсит дедлайн из текста пользователя
 * Ищет ключевые слова: "дедлайн", "сдать", "сделать", "курсовая", "реферат", "домашка" и т.д.
 * Ищет даты в различных форматах
 */
export function parseDeadlineFromText(text: string): ParsedDeadline | null {
    const lowerText = text.toLowerCase();
    
    // Ключевые слова для определения дедлайна
    const deadlineKeywords = [
        'дедлайн', 'сдать', 'сделать', 'написать', 'подготовить',
        'курсовая', 'курсач', 'реферат', 'домашка', 'домашняя работа',
        'лабораторная', 'лаба', 'контрольная', 'диплом', 'дипломная',
        'проект', 'эссе', 'сочинение', 'отчет', 'презентация'
    ];
    
    // Проверяем, есть ли ключевые слова
    const hasDeadlineKeyword = deadlineKeywords.some(keyword => lowerText.includes(keyword));
    if (!hasDeadlineKeyword) {
        return null;
    }
    
    // Парсим дату
    const dueDate = parseDateFromText(text);
    if (!dueDate) {
        return null; // Если не нашли дату, не создаем дедлайн
    }
    
    // Извлекаем название работы
    const title = extractTitle(text);
    
    // Извлекаем предмет
    const subject = extractSubject(text);
    
    return {
        title,
        subject,
        dueDate: dueDate.getTime(),
        description: text.length > 200 ? text.substring(0, 200) + '...' : text
    };
}

/**
 * Парсит дату из текста
 */
function parseDateFromText(text: string): Date | null {
    const now = new Date();
    const lowerText = text.toLowerCase();
    
    // Паттерны для поиска дат
    const patterns = [
        // "через N дней/дня/день"
        /через\s+(\d+)\s+(день|дня|дней)/i,
        // "через неделю"
        /через\s+неделю/i,
        // "через N недель"
        /через\s+(\d+)\s+(неделю|недели|недель)/i,
        // "через месяц"
        /через\s+месяц/i,
        // "DD.MM" или "DD.MM.YYYY"
        /(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/,
        // "DD/MM" или "DD/MM/YYYY"
        /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/,
        // "DD-MM" или "DD-MM-YYYY"
        /(\d{1,2})-(\d{1,2})(?:-(\d{4}))?/,
        // "завтра"
        /завтра/i,
        // "послезавтра"
        /послезавтра/i,
        // "в понедельник", "во вторник" и т.д.
        /(?:в|во)\s+(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)/i,
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            if (pattern === patterns[0]) {
                // "через N дней"
                const days = parseInt(match[1]);
                const date = new Date(now);
                date.setDate(date.getDate() + days);
                return date;
            } else if (pattern === patterns[1]) {
                // "через неделю"
                const date = new Date(now);
                date.setDate(date.getDate() + 7);
                return date;
            } else if (pattern === patterns[2]) {
                // "через N недель"
                const weeks = parseInt(match[1]);
                const date = new Date(now);
                date.setDate(date.getDate() + weeks * 7);
                return date;
            } else if (pattern === patterns[3]) {
                // "через месяц"
                const date = new Date(now);
                date.setMonth(date.getMonth() + 1);
                return date;
            } else if (pattern === patterns[4] || pattern === patterns[5] || pattern === patterns[6]) {
                // Дата в формате DD.MM или DD.MM.YYYY
                const day = parseInt(match[1]);
                const month = parseInt(match[2]) - 1; // месяцы в JS начинаются с 0
                const year = match[3] ? parseInt(match[3]) : now.getFullYear();
                const date = new Date(year, month, day);
                // Если дата в прошлом и год не указан, считаем что это следующий год
                if (date < now && !match[3]) {
                    date.setFullYear(year + 1);
                }
                return date;
            } else if (pattern === patterns[7]) {
                // "завтра"
                const date = new Date(now);
                date.setDate(date.getDate() + 1);
                return date;
            } else if (pattern === patterns[8]) {
                // "послезавтра"
                const date = new Date(now);
                date.setDate(date.getDate() + 2);
                return date;
            } else if (pattern === patterns[9]) {
                // День недели
                const dayNames: { [key: string]: number } = {
                    'понедельник': 1,
                    'вторник': 2,
                    'среду': 3,
                    'среда': 3,
                    'четверг': 4,
                    'пятницу': 5,
                    'пятница': 5,
                    'субботу': 6,
                    'суббота': 6,
                    'воскресенье': 0
                };
                const targetDay = dayNames[match[1].toLowerCase()];
                if (targetDay !== undefined) {
                    const date = new Date(now);
                    const currentDay = date.getDay();
                    let daysToAdd = targetDay - currentDay;
                    if (daysToAdd <= 0) {
                        daysToAdd += 7; // следующая неделя
                    }
                    date.setDate(date.getDate() + daysToAdd);
                    return date;
                }
            }
        }
    }
    
    return null;
}

/**
 * Извлекает название работы из текста
 */
function extractTitle(text: string): string {
    const lowerText = text.toLowerCase();
    
    // Список возможных названий работ
    const workTypes: { [key: string]: string } = {
        'курсовая': 'Курсовая работа',
        'курсач': 'Курсовая работа',
        'реферат': 'Реферат',
        'домашка': 'Домашняя работа',
        'домашняя работа': 'Домашняя работа',
        'лабораторная': 'Лабораторная работа',
        'лаба': 'Лабораторная работа',
        'контрольная': 'Контрольная работа',
        'диплом': 'Дипломная работа',
        'дипломная': 'Дипломная работа',
        'проект': 'Проект',
        'эссе': 'Эссе',
        'сочинение': 'Сочинение',
        'отчет': 'Отчет',
        'презентация': 'Презентация'
    };
    
    // Ищем тип работы
    for (const [keyword, title] of Object.entries(workTypes)) {
        if (lowerText.includes(keyword)) {
            // Пытаемся найти предмет после типа работы
            const keywordIndex = lowerText.indexOf(keyword);
            const afterKeyword = text.substring(keywordIndex + keyword.length).trim();
            const words = afterKeyword.split(/\s+/).slice(0, 3);
            if (words.length > 0 && words[0].length > 2) {
                return `${title} по ${words[0]}`;
            }
            return title;
        }
    }
    
    // Если не нашли тип работы, берем первые слова
    const words = text.split(/\s+/).slice(0, 5);
    return words.join(' ').substring(0, 50);
}

/**
 * Извлекает предмет из текста
 */
function extractSubject(text: string): string | undefined {
    const lowerText = text.toLowerCase();
    
    // Ключевые слова перед предметом
    const subjectKeywords = ['по', 'предмет', 'дисциплина'];
    
    for (const keyword of subjectKeywords) {
        const index = lowerText.indexOf(keyword);
        if (index !== -1) {
            const afterKeyword = text.substring(index + keyword.length).trim();
            const words = afterKeyword.split(/\s+/);
            if (words.length > 0 && words[0].length > 2) {
                // Берем первое слово после ключевого слова
                return words[0].substring(0, 50);
            }
        }
    }
    
    return undefined;
}

