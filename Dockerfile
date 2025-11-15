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
# Этап 2: Python зависимости для парсера
# ============================================
FROM python:3.11-slim AS python-deps

WORKDIR /app

# Копируем requirements.txt для парсера
COPY requirements.txt ./

# Устанавливаем Python зависимости
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# Этап 3: Финальный образ
# ============================================
FROM node:20-alpine

WORKDIR /app

# Устанавливаем Python для парсера
RUN apk add --no-cache python3 py3-pip

# Копируем собранный JavaScript из builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Копируем Python зависимости из python-deps
COPY --from=python-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

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

