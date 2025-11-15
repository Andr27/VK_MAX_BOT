# Мультистейдж Dockerfile для VK MAX BOT
# Использует Node.js для основного бота и Python для парсера расписания

# ============================================
# Этап 1: Сборка TypeScript проекта
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
COPY tsconfig.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY src ./src

# Собираем TypeScript проект
RUN npm run build

# ============================================
# Этап 2: Финальный образ
# ============================================
FROM node:20-alpine

WORKDIR /app

# Устанавливаем Python и pip для парсера
RUN apk add --no-cache python3 py3-pip

# Копируем собранный JavaScript из builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Копируем requirements.txt и устанавливаем Python зависимости
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Копируем парсер и необходимые файлы
COPY parser ./parser

# Создаем директорию для данных
RUN mkdir -p /app/data

# Устанавливаем переменные окружения
ENV NODE_ENV=production

# Открываем порт (если нужен)
# EXPOSE 3000

# Запускаем бота
CMD ["npm", "start"]

