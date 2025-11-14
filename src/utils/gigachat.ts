import axios from 'axios';

export class GigaChatService {
    private accessToken: string = '';
    private tokenExpires: number = 0;
    private baseURL = 'https://gigachat.devices.sberbank.ru/api/v1';
    private credentials = process.env.GIGACHAT_CREDENTIALS || '';
    
    constructor() {
        console.log('GigaChat credentials loaded:', this.credentials ? 'YES' : 'NO');
        if (!this.credentials) {
            console.error('GIGACHAT_CREDENTIALS not found in environment!');
        }
    }
    
    // Получение access token с кэшированием
    private async getAccessToken(): Promise<string> {
        // Если токен еще действителен (меньше 30 минут), возвращаем его
        if (this.accessToken && Date.now() < this.tokenExpires) {
            return this.accessToken;
        }
        
        try {
            console.log('Получаем новый токен GigaChat...');
            
            const response = await axios.post(
                'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
                'scope=GIGACHAT_API_PERS',
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${this.credentials}`,
                        'Accept': 'application/json',
                        'RqUID': this.generateRqUID()
                    },
                    httpsAgent: new (require('https').Agent)({
                        rejectUnauthorized: false
                    })
                }
            );
            
            this.accessToken = response.data.access_token;
            // Токен действует 30 минут - ставим 25 для надежности
            this.tokenExpires = Date.now() + (25 * 60 * 1000);
            
            console.log('Токен GigaChat обновлен!');
            return this.accessToken;
        } catch (error: any) {
            console.error('Error getting GigaChat token:', error.response?.data || error.message);
            throw error;
        }
    }

    // Генерация RqUID
    private generateRqUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Отправка сообщения в GigaChat
    async sendMessage(message: string): Promise<string> {
        try {
            const token = await this.getAccessToken();
            
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: "GigaChat",
                    messages: [
                        {
                            role: "user",
                            content: message
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1024
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    },
                    httpsAgent: new (require('https').Agent)({
                        rejectUnauthorized: false
                    })
                }
            );
            
            return response.data.choices[0].message.content;
        } catch (error: any) {
            console.error('Error sending message to GigaChat:', error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                // Если токен просрочен, сбрасываем и пробуем еще раз
                this.accessToken = '';
                this.tokenExpires = 0;
                return this.sendMessage(message);
            } else if (error.response?.status === 429) {
                return 'Превышен лимит запросов. Попробуйте позже.';
            } else {
                return 'Извините, произошла ошибка при обращении к нейросети. Попробуйте позже.';
            }
        }
    }
}

export const gigaChatService = new GigaChatService();