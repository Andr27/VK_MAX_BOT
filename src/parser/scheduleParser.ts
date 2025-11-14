import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

// Путь к Python парсеру (пробуем несколько вариантов)
function findParserScript(): string | null {
    // Вариант 1: относительно текущего файла (в dev и production)
    const path1 = path.resolve(__dirname, '../../../parser/parser.py');
    // Вариант 2: относительно корня проекта
    const path2 = path.resolve(process.cwd(), 'parser/parser.py');
    // Вариант 3: если process.cwd() указывает на src/, поднимаемся на уровень выше
    const path3 = path.resolve(process.cwd(), '../parser/parser.py');
    
    for (const parserPath of [path1, path2, path3]) {
        if (fs.existsSync(parserPath)) {
            return parserPath;
        }
    }
    
    return null;
}

const PARSER_SCRIPT = findParserScript();

interface ParseScheduleOptions {
    slug: string; // идентификатор вуза (например, "togu", "pskovgu")
    group: string; // название группы
}

interface ParseScheduleResult {
    success: boolean;
    schedule?: any;
    error?: string;
}

/**
 * Проверяет доступность парсера
 */
export function isParserAvailable(): boolean {
    if (!PARSER_SCRIPT) {
        console.warn('⚠️ Python парсер не найден. Функция расписания будет недоступна.');
        return false;
    }
    return true;
}

/**
 * Получает список групп для указанного вуза
 */
export async function listGroups(slug: string): Promise<string[]> {
    if (!isParserAvailable()) {
        throw new Error('Python парсер не найден. Убедитесь, что директория parser/ находится в проекте.');
    }
    
    try {
        const { stdout, stderr } = await execAsync(
            `python "${PARSER_SCRIPT}" --slug "${slug}" --list-groups`,
            { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
        
        if (stderr && !stdout) {
            throw new Error(stderr);
        }
        
        // Парсим вывод: каждая строка - это группа
        const groups = stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        return groups;
    } catch (error: any) {
        console.error('Ошибка получения списка групп:', error);
        throw new Error(`Не удалось получить список групп: ${error.message}`);
    }
}

/**
 * Парсит расписание для указанного вуза и группы
 */
export async function parseSchedule(options: ParseScheduleOptions): Promise<ParseScheduleResult> {
    if (!isParserAvailable()) {
        return {
            success: false,
            error: 'Python парсер не найден. Убедитесь, что директория parser/ находится в проекте.'
        };
    }
    
    const { slug, group } = options;
    
    try {
        // Определяем директорию парсера
        const parserDir = path.dirname(PARSER_SCRIPT!);
        // Создаем временный файл для результата
        const tempFile = path.resolve(parserDir, 'temp_schedule.json');
        
        // Запускаем парсер
        const command = `python "${PARSER_SCRIPT}" --slug "${slug}" --group "${group}" --output "${tempFile}"`;
        
        console.log(`🔍 Парсинг расписания: ${slug} / ${group}`);
        console.log(`📝 Команда: ${command}`);
        
        const { stdout, stderr } = await execAsync(command, {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024 // 10MB
        });
        
        // Проверяем наличие файла результата
        if (!fs.existsSync(tempFile)) {
            throw new Error('Файл расписания не был создан');
        }
        
        // Читаем результат
        const scheduleContent = fs.readFileSync(tempFile, 'utf-8');
        const schedule = JSON.parse(scheduleContent);
        
        // Удаляем временный файл
        try {
            fs.unlinkSync(tempFile);
        } catch (e) {
            // Игнорируем ошибки удаления
        }
        
        console.log(`✅ Расписание успешно распарсено`);
        
        return {
            success: true,
            schedule
        };
    } catch (error: any) {
        console.error('Ошибка парсинга расписания:', error);
        
        let errorMessage = 'Не удалось получить расписание';
        if (error.stderr) {
            errorMessage = error.stderr.split('\n').filter((line: string) => line.trim()).pop() || errorMessage;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * Форматирует расписание для отправки пользователю
 */
export function formatSchedule(schedule: any, date?: string): string {
    if (!schedule) {
        return 'Расписание не найдено';
    }
    
    // Если это формат TOGU (с days)
    if (schedule.days && Array.isArray(schedule.days)) {
        return formatToguSchedule(schedule, date);
    }
    
    // Если это формат dnevuch (массив массивов)
    if (Array.isArray(schedule) && schedule.length > 0) {
        return formatDnevuchSchedule(schedule, date);
    }
    
    return 'Неизвестный формат расписания';
}

function formatToguSchedule(schedule: any, date?: string): string {
    let result = `📅 Расписание: ${schedule.group || 'Неизвестная группа'}\n\n`;
    
    if (schedule.source) {
        result += `🔗 Источник: ${schedule.source}\n\n`;
    }
    
    const days = schedule.days || [];
    
    for (const day of days) {
        if (!day.lessons || day.lessons.length === 0) {
            continue;
        }
        
        result += `\n📆 ${day.name}\n`;
        result += '─'.repeat(30) + '\n';
        
        for (const lesson of day.lessons) {
            if (!lesson.subject) {
                continue;
            }
            
            // Время пары
            if (lesson.pair?.time_range) {
                result += `⏰ ${lesson.pair.time_range}\n`;
            } else if (lesson.pair?.start) {
                result += `⏰ ${lesson.pair.start}\n`;
            }
            
            // Предмет
            result += `📚 ${lesson.subject}\n`;
            
            // Тип занятия
            if (lesson.lesson_type) {
                result += `   Тип: ${lesson.lesson_type}\n`;
            }
            
            // Преподаватели
            if (lesson.teachers && lesson.teachers.length > 0) {
                const teachers = lesson.teachers.map((t: any) => t.name).join(', ');
                result += `👤 ${teachers}\n`;
            }
            
            // Аудитории
            if (lesson.rooms && lesson.rooms.length > 0) {
                const rooms = lesson.rooms.map((r: any) => r.name).join(', ');
                result += `🏢 ${rooms}\n`;
            }
            
            // Тип недели
            if (lesson.week_type) {
                result += `📌 Неделя: ${lesson.week_type}\n`;
            }
            
            result += '\n';
        }
    }
    
    return result;
}

function formatDnevuchSchedule(schedule: any[], date?: string): string {
    let result = '📅 Расписание\n\n';
    
    // schedule - это массив массивов, где каждый внутренний массив - это день
    for (const daySchedule of schedule) {
        if (!Array.isArray(daySchedule) || daySchedule.length === 0) {
            continue;
        }
        
        const firstItem = daySchedule[0];
        if (firstItem.date) {
            result += `\n📆 ${firstItem.date}`;
            if (firstItem.week) {
                result += ` (${firstItem.week})`;
            }
            result += '\n';
            result += '─'.repeat(30) + '\n';
        }
        
        for (const item of daySchedule) {
            if (!item.classes || item.classes.length === 0) {
                continue;
            }
            
            // Время
            if (item.time) {
                result += `⏰ ${item.time}\n`;
            }
            
            // Занятия
            for (const cls of item.classes) {
                if (cls.name && cls.name !== 'Место для заметок') {
                    result += `📚 ${cls.name}\n`;
                }
                
                if (cls.teacher) {
                    result += `👤 ${cls.teacher}\n`;
                }
                
                if (cls.place) {
                    result += `🏢 ${cls.place}\n`;
                }
            }
            
            result += '\n';
        }
    }
    
    return result;
}

