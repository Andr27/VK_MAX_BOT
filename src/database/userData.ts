import fs from 'fs';
import path from 'path';

export interface Deadline {
    id: string; // уникальный ID дедлайна
    title: string; // название работы (например, "Курсовая работа")
    subject?: string; // предмет (например, "Математика")
    dueDate: number; // timestamp дедлайна
    createdAt: number; // timestamp создания
    description?: string; // дополнительное описание
    completed?: boolean; // выполнено ли
}

interface UserScheduleData {
    university: string; // slug вуза (например, "togu", "pskovgu")
    group: string; // название группы
    schedule?: any; // расписание (кэшированное)
    cachedAt?: number; // timestamp последнего обновления
    deadlines?: Deadline[]; // список дедлайнов
}

interface UserData {
    userId: number;
    university?: string;
    group?: string;
    schedule?: any;
    cachedAt?: number;
}

const DATA_FILE = path.resolve(__dirname, '../../data/users.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах

// Создаем директорию data если её нет
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Загружаем данные пользователей
function loadUserData(): Map<number, UserScheduleData> {
    if (!fs.existsSync(DATA_FILE)) {
        return new Map();
    }
    
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(content);
        const map = new Map<number, UserScheduleData>();
        
        if (Array.isArray(data)) {
            // Старый формат (массив)
            data.forEach((item: UserData) => {
                if (item.userId) {
                    map.set(item.userId, {
                        university: item.university || '',
                        group: item.group || '',
                        schedule: item.schedule,
                        cachedAt: item.cachedAt
                    });
                }
            });
        } else if (typeof data === 'object') {
            // Новый формат (объект)
            Object.entries(data).forEach(([userIdStr, userData]) => {
                const userId = parseInt(userIdStr, 10);
                if (!isNaN(userId) && userData) {
                    map.set(userId, userData as UserScheduleData);
                }
            });
        }
        
        return map;
    } catch (error) {
        console.error('Ошибка загрузки данных пользователей:', error);
        return new Map();
    }
}

// Сохраняем данные пользователей
function saveUserData(data: Map<number, UserScheduleData>): void {
    try {
        const obj: Record<string, UserScheduleData> = {};
        data.forEach((value, key) => {
            obj[key.toString()] = value;
        });
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (error) {
        console.error('Ошибка сохранения данных пользователей:', error);
    }
}

// Получаем данные пользователя
export function getUserData(userId: number): UserScheduleData | null {
    const data = loadUserData();
    return data.get(userId) || null;
}

// Сохраняем данные пользователя
export function setUserData(userId: number, userData: Partial<UserScheduleData>): void {
    const data = loadUserData();
    const existing = data.get(userId) || { university: '', group: '' };
    
    data.set(userId, {
        ...existing,
        ...userData
    });
    
    saveUserData(data);
}

// Устанавливаем университет
export function setUserUniversity(userId: number, university: string): void {
    setUserData(userId, { university });
}

// Устанавливаем группу
export function setUserGroup(userId: number, group: string): void {
    setUserData(userId, { group });
}

// Сохраняем расписание в кэш
export function cacheSchedule(userId: number, schedule: any): void {
    setUserData(userId, {
        schedule,
        cachedAt: Date.now()
    });
}

// Проверяем, нужно ли обновить кэш
export function isScheduleCacheValid(userId: number): boolean {
    const userData = getUserData(userId);
    if (!userData || !userData.cachedAt || !userData.schedule) {
        return false;
    }
    
    const age = Date.now() - userData.cachedAt;
    return age < CACHE_TTL;
}

// Получаем кэшированное расписание
export function getCachedSchedule(userId: number): any | null {
    const userData = getUserData(userId);
    if (!userData || !userData.schedule) {
        return null;
    }
    
    if (!isScheduleCacheValid(userId)) {
        return null; // Кэш устарел
    }
    
    return userData.schedule;
}

// Проверяем, есть ли у пользователя полные данные (вуз и группа)
export function hasCompleteUserData(userId: number): boolean {
    const userData = getUserData(userId);
    return !!(userData && userData.university && userData.group);
}

// Получаем дедлайны пользователя
export function getUserDeadlines(userId: number): Deadline[] {
    const userData = getUserData(userId);
    return userData?.deadlines || [];
}

// Добавляем дедлайн
export function addDeadline(userId: number, deadline: Omit<Deadline, 'id' | 'createdAt'>): Deadline {
    const userData = getUserData(userId) || { university: '', group: '' };
    const deadlines = userData.deadlines || [];
    
    const newDeadline: Deadline = {
        ...deadline,
        id: `deadline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        completed: false
    };
    
    deadlines.push(newDeadline);
    setUserData(userId, { deadlines });
    
    return newDeadline;
}

// Удаляем дедлайн
export function removeDeadline(userId: number, deadlineId: string): boolean {
    const userData = getUserData(userId);
    if (!userData || !userData.deadlines) {
        return false;
    }
    
    const deadlines = userData.deadlines.filter(d => d.id !== deadlineId);
    setUserData(userId, { deadlines });
    
    return true;
}

// Отмечаем дедлайн как выполненный
export function completeDeadline(userId: number, deadlineId: string): boolean {
    const userData = getUserData(userId);
    if (!userData || !userData.deadlines) {
        return false;
    }
    
    const deadlines = userData.deadlines.map(d => 
        d.id === deadlineId ? { ...d, completed: true } : d
    );
    setUserData(userId, { deadlines });
    
    return true;
}

// Получаем активные (не выполненные) дедлайны
export function getActiveDeadlines(userId: number): Deadline[] {
    const deadlines = getUserDeadlines(userId);
    return deadlines.filter(d => !d.completed).sort((a, b) => a.dueDate - b.dueDate);
}

