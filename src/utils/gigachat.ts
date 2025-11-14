import axios from 'axios';

export class GigaChatService {
    private accessToken: string = '';
    private baseURL = 'https://gigachat.devices.sberbank.ru/api/v1';
    private credentials = 'MDE5YTY4OGQtN2MzNy03MmNlLWFlMzAtYWZhOGU1ZDFkMTBkOmFlZjYzNTU1LTM4NWYtNGI4ZS1hNGRlLWJmMWUzMDM4NDY0OQ==';
    
    // Получение access token
    private async getAccessToken(): Promise<string> {
        try {
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
                return 'Ошибка авторизации. Проверьте токен GigaChat.';
            } else if (error.response?.status === 429) {
                return 'Превышен лимит запросов. Попробуйте позже.';
            } else {
                return 'Извините, произошла ошибка при обращении к нейросети. Попробуйте позже.';
            }
        }
    }
}

export const gigaChatService = new GigaChatService();