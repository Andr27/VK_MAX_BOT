import { Keyboard } from '@maxhub/max-bot-api';

const keyboard_start = Keyboard.inlineKeyboard([
    [
        Keyboard.button.callback('🤖 GigaChat', 'gigachat'),
        Keyboard.button.callback('Помощь❓', 'help')
    ],
]);

const keyboard_mainmenu = Keyboard.inlineKeyboard([
    [
        Keyboard.button.callback('🤖 GigaChat', 'gigachat'),
        Keyboard.button.callback('Помощь❓', 'help')
    ],
]);

const keyboard_helpmenu = Keyboard.inlineKeyboard([
    [
        Keyboard.button.callback('Контакты', 'contact'),
        Keyboard.button.callback('🔙Назад', 'backtomenu'),
    ],
]);

const keyboard_gigachat = Keyboard.inlineKeyboard([
    [
        Keyboard.button.callback('🔙 В главное меню', 'backtomenu')
    ],
]);

export { 
    keyboard_start, 
    keyboard_mainmenu, 
    keyboard_helpmenu, 
    keyboard_gigachat 
};