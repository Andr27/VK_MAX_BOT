import { Keyboard } from '@maxhub/max-bot-api';

const keyboard_start = Keyboard.inlineKeyboard([

    [
        Keyboard.button.callback('Помощь❓', 'help')
    ],
]);

const keyboard_mainmenu = Keyboard.inlineKeyboard([

    [
        Keyboard.button.callback('Помощь❓', 'help')
    ],
]);

const keyboard_helpmenu = Keyboard.inlineKeyboard([
    [
        Keyboard.button.callback('Помощь❓', 'help'),
        Keyboard.button.callback('🔙Назад', 'back'),
    ],
]);