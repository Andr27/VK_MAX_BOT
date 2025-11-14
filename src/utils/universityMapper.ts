import fs from 'fs';
import path from 'path';

// Маппинг популярных названий вузов в slug
const UNIVERSITY_MAPPING: Record<string, string> = {
    // ТОГУ
    'тогу': 'togu',
    'тогу': 'togu',
    'togu': 'togu',
    'тогу дв': 'togu',
    'тогу-дв': 'togu',
    'дальневосточный государственный университет': 'togu',
    'дальневосточный госуниверситет': 'togu',
    
    // МГУ
    'мгу': 'msu',
    'msu': 'msu',
    'московский государственный университет': 'msu',
    'мгу им. ломоносова': 'msu',
    
    // ПсковГУ
    'псковгу': 'pskovgu',
    'pskovgu': 'pskovgu',
    'псковский государственный университет': 'pskovgu',
    
    // ПетрГУ
    'петргу': 'petrsu',
    'petrsu': 'petrsu',
    'петрозаводский государственный университет': 'petrsu',
    
    // МГИМО
    'мгимо': 'mgimo',
    'mgimo': 'mgimo',
    'московский государственный институт международных отношений': 'mgimo',
    
    // МГТУ им. Баумана
    'мгту': 'bmstu',
    'bmstu': 'bmstu',
    'бауманка': 'bmstu',
    'мгту им. баумана': 'bmstu',
    
    // СПбГУ
    'спбгу': 'spbu',
    'spbu': 'spbu',
    'санкт-петербургский государственный университет': 'spbu',
    'лгу': 'spbu',
    
    // МИФИ
    'мифи': 'mephi',
    'mephi': 'mephi',
    'национальный исследовательский ядерный университет': 'mephi',
    
    // МФТИ
    'мфти': 'mipt',
    'mipt': 'mipt',
    'московский физико-технический институт': 'mipt',
    'физтех': 'mipt',
    
    // ВШЭ
    'вшэ': 'hse',
    'hse': 'hse',
    'высшая школа экономики': 'hse',
    
    // МГЮА
    'мгюа': 'msulaw',
    'msulaw': 'msulaw',
    'московский государственный юридический университет': 'msulaw',
    
    // ТПУ
    'тпу': 'tpu',
    'tpu': 'tpu',
    'томский политехнический университет': 'tpu',
    
    // НГУ
    'нгу': 'nsu',
    'nsu': 'nsu',
    'новосибирский государственный университет': 'nsu',
    
    // УрФУ
    'урфу': 'urfu',
    'urfu': 'urfu',
    'уральский федеральный университет': 'urfu',
    
    // КФУ
    'кфу': 'kfu',
    'kfu': 'kfu',
    'казанский федеральный университет': 'kfu',
    
    // СФУ
    'сфу': 'sibfu',
    'sibfu': 'sibfu',
    'сибирский федеральный университет': 'sibfu',
};

// Загружаем список доступных slug из providers_status.json
let availableSlugs: string[] = [];

function loadAvailableSlugs(): string[] {
    if (availableSlugs.length > 0) {
        return availableSlugs;
    }
    
    try {
        // Пробуем несколько путей к providers_status.json
        const paths = [
            path.resolve(__dirname, '../../parser/providers_status.json'),
            path.resolve(process.cwd(), 'parser/providers_status.json'),
            path.resolve(process.cwd(), '../parser/providers_status.json'),
        ];
        
        for (const jsonPath of paths) {
            if (fs.existsSync(jsonPath)) {
                const content = fs.readFileSync(jsonPath, 'utf-8');
                const providers = JSON.parse(content);
                
                if (Array.isArray(providers)) {
                    availableSlugs = providers
                        .map((p: any) => p.slug)
                        .filter((slug: string) => slug);
                    return availableSlugs;
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки списка вузов:', error);
    }
    
    return [];
}

/**
 * Преобразует название вуза в slug
 */
export function universityNameToSlug(name: string): string | null {
    const normalized = name.trim().toLowerCase();
    
    // Сначала проверяем точное совпадение в маппинге
    if (UNIVERSITY_MAPPING[normalized]) {
        return UNIVERSITY_MAPPING[normalized];
    }
    
    // Проверяем частичное совпадение
    for (const [key, slug] of Object.entries(UNIVERSITY_MAPPING)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return slug;
        }
    }
    
    // Если введенное название уже похоже на slug, возвращаем как есть
    if (/^[a-z]+$/.test(normalized) && normalized.length >= 3) {
        // Проверяем, существует ли такой slug
        const slugs = loadAvailableSlugs();
        if (slugs.includes(normalized)) {
            return normalized;
        }
    }
    
    return null;
}

/**
 * Получает список популярных вузов для подсказки
 */
export function getPopularUniversities(): Array<{ name: string; slug: string }> {
    return [
        { name: 'ТОГУ', slug: 'togu' },
        { name: 'МГУ', slug: 'msu' },
        { name: 'ПсковГУ', slug: 'pskovgu' },
        { name: 'ПетрГУ', slug: 'petrsu' },
        { name: 'МГИМО', slug: 'mgimo' },
        { name: 'МГТУ им. Баумана', slug: 'bmstu' },
        { name: 'СПбГУ', slug: 'spbu' },
        { name: 'ТПУ', slug: 'tpu' },
        { name: 'НГУ', slug: 'nsu' },
        { name: 'УрФУ', slug: 'urfu' },
    ];
}

/**
 * Ищет похожие названия вузов
 */
export function findSimilarUniversities(query: string): Array<{ name: string; slug: string }> {
    const normalized = query.trim().toLowerCase();
    const results: Array<{ name: string; slug: string }> = [];
    
    // Ищем в маппинге
    for (const [key, slug] of Object.entries(UNIVERSITY_MAPPING)) {
        if (key.includes(normalized) || normalized.includes(key)) {
            // Находим человекочитаемое название
            const popular = getPopularUniversities().find(u => u.slug === slug);
            if (popular && !results.find(r => r.slug === slug)) {
                results.push(popular);
            }
        }
    }
    
    return results.slice(0, 5); // Возвращаем максимум 5 результатов
}

