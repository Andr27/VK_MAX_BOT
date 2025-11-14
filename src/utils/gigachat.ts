import axios from 'axios';

export class GigaChatService {
    private accessToken: string;
    private baseURL = 'https://gigachat.devices.sberbank.ru/api/v1';
    
    constructor() {
        this.accessToken = process.env.GIGACHAT_TOKEN || '';
    }

    // Получение access token
    private async getAccessToken(): Promise<string> {
        try {
            const credentials = process.env.GIGACHAT_CREDENTIALS;
            
            const response = await axios.post(
                'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
                'scope=GIGACHAT_API_PERS',
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${credentials}`,
                        'Accept': 'application/json'
                    }
                }
            );
            
            this.accessToken = response.data.access_token;
            return this.accessToken;
        } catch (error) {
            console.error('Error getting GigaChat token:', error);
            throw error;
        }
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
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('Error sending message to GigaChat:', error);
            return 'Извините, произошла ошибка при обращении к нейросети. Попробуйте позже.';
        }
    }
}

export const gigaChatService = new GigaChatService();