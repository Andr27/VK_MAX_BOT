# 🔧 Исправление падающего контейнера

## Проблема
Контейнер падает с ошибкой: `BOT_TOKEN не найден. Добавьте его в .env`

## Решение

### Вариант 1: Создать .env файл (рекомендуется)

1. Создайте файл `.env` в директории `VK_MAX_BOT`:

```powershell
cd VK_MAX_BOT
New-Item -Path .env -ItemType File
```

2. Добавьте в файл `.env`:

```env
BOT_TOKEN=your_bot_token_here
GIGACHAT_CREDENTIALS=your_gigachat_credentials_here
```

3. Перезапустите контейнер:

```powershell
docker-compose restart
```

### Вариант 2: Передать переменные через environment

Если не хотите создавать .env файл, можно передать переменные напрямую:

1. Остановите контейнер:
```powershell
docker-compose down
```

2. Запустите с переменными окружения:
```powershell
$env:BOT_TOKEN="your_bot_token"
$env:GIGACHAT_CREDENTIALS="your_credentials"
docker-compose up -d
```

### Вариант 3: Использовать docker run напрямую

```powershell
docker run -d `
  --name vk-max-bot `
  --restart unless-stopped `
  -e BOT_TOKEN="your_bot_token" `
  -e GIGACHAT_CREDENTIALS="your_credentials" `
  -v ${PWD}\VK_MAX_BOT\data:/app/data `
  vk-max-bot:latest
```

## Проверка

После исправления проверьте логи:

```powershell
docker logs vk-max-bot --tail 50
```

Контейнер должен запуститься без ошибок и показать:
```
✅ .env loaded successfully
✅ Парсер найден
```

## Текущий статус

Проверить статус контейнера:
```powershell
docker ps -a | Select-String "vk-max-bot"
```

Если статус `Restarting` - значит контейнер падает из-за отсутствия .env файла.


