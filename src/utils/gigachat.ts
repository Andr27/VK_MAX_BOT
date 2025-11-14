import axios from 'axios';

export class GigaChatService {
    private accessToken: string = '';
    private tokenExpires: number = 0;
    private baseURL = 'https://gigachat.devices.sberbank.ru/api/v1';
    private credentials = process.env.GIGACHAT_CREDENTIALS || '';
    
    constructor() {
        console.log('🔐 GigaChat Service initialized');
        console.log('📝 Credentials loaded:', this.credentials ? '✅ YES' : '❌ NO');
        console.log('📏 Credentials length:', this.credentials.length);
        console.log('🔍 Credentials preview:', this.credentials.substring(0, 20) + '...');
        console.log('🏠 Base URL:', this.baseURL);
        
        if (!this.credentials) {
            console.error('❌ GIGACHAT_CREDENTIALS not found in environment variables!');
            console.log('💡 Check your .env file in project root');
        }
    }

    // Получение access token с кэшированием
    private async getAccessToken(): Promise<string> {
        // Если токен еще действителен (меньше 30 минут), возвращаем его
        if (this.accessToken && Date.now() < this.tokenExpires) {
            console.log('♻️ Using cached token');
            return this.accessToken;
        }
        
        try {
            console.log('🔄 Getting new GigaChat token...');
            console.log('📤 Making request to auth endpoint...');
            
            const rqUID = this.generateRqUID();
            console.log('📋 RqUID:', rqUID);
            
            const response = await axios.post(
                'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
                'scope=GIGACHAT_API_PERS',
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${this.credentials}`,
                        'Accept': 'application/json',
                        'RqUID': rqUID
                    },
                    httpsAgent: new (require('https').Agent)({
                        rejectUnauthorized: false
                    }),
                    timeout: 10000
                }
            );
            
            console.log('✅ Auth response status:', response.status);
            console.log('🔑 Token received:', response.data.access_token ? 'YES' : 'NO');
            
            this.accessToken = response.data.access_token;
            // Токен действует 30 минут - ставим 25 для надежности
            this.tokenExpires = Date.now() + (25 * 60 * 1000);
            
            console.log('🎉 GigaChat token refreshed successfully!');
            console.log('⏰ Token expires at:', new Date(this.tokenExpires).toLocaleTimeString());
            
            return this.accessToken;
        } catch (error: any) {
            console.error('❌ Error getting GigaChat token:');
            console.error('📛 Error message:', error.message);
            
            if (error.response) {
                console.error('📊 Response status:', error.response.status);
                console.error('📄 Response data:', error.response.data);
                console.error('🔤 Response headers:', error.response.headers);
            } else if (error.request) {
                console.error('🚫 No response received');
                console.error('📡 Request details:', error.request);
            }
            
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
        console.log('🤖 Sending message to GigaChat:');
        console.log('💬 Message length:', message.length);
        console.log('📝 Message preview:', message.substring(0, 50) + (message.length > 50 ? '...' : ''));
        
        try {
            const token = await this.getAccessToken();
            console.log('🔐 Using token for API request');
            
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
                    }),
                    timeout: 30000
                }
            );
            
            console.log('✅ GigaChat API response status:', response.status);
            console.log('📄 Response received successfully');
            
            const responseText = response.data.choices[0].message.content;
            console.log('💭 Response length:', responseText.length);
            console.log('📋 Response preview:', responseText.substring(0, 100) + (responseText.length > 100 ? '...' : ''));
            
            return responseText;
        } catch (error: any) {
            console.error('❌ Error sending message to GigaChat:');
            console.error('📛 Error message:', error.message);
            
            if (error.response) {
                console.error('📊 Response status:', error.response.status);
                console.error('📄 Response data:', JSON.stringify(error.response.data, null, 2));
                
                if (error.response.status === 401) {
                    console.log('🔄 Token expired, resetting and retrying...');
                    // Если токен просрочен, сбрасываем и пробуем еще раз
                    this.accessToken = '';
                    this.tokenExpires = 0;
                    return this.sendMessage(message);
                } else if (error.response.status === 429) {
                    return 'Превышен лимит запросов. Попробуйте позже.';
                }
            } else if (error.request) {
                console.error('🚫 No response received from GigaChat API');
            }
            
            console.error('🔧 Error config:', error.config?.url);
            return 'Извините, произошла ошибка при обращении к нейросети. Попробуйте позже.';
        }
    }
}

export const gigaChatService = new GigaChatService();