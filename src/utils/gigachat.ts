import axios from 'axios';

export class GigaChatService {
    private accessToken: string = '';
    private tokenExpires: number = 0;
    private baseURL = 'https://gigachat.devices.sberbank.ru/api/v1';
    private credentials: string = '';
    
    constructor() {
        // Получаем credentials заново, так как .env может загрузиться после инициализации класса
        this.credentials = process.env.GIGACHAT_CREDENTIALS || '';
        
        console.log('\n🔐 ========== GIGACHAT SERVICE INIT ==========');
        console.log('📝 Credentials loaded:', this.credentials ? '✅ YES' : '❌ NO');
        console.log('📏 Credentials length:', this.credentials.length);
        if (this.credentials) {
            console.log('🔍 Credentials preview:', this.credentials.substring(0, 30) + '...' + this.credentials.substring(this.credentials.length - 10));
        } else {
            console.log('🔍 Credentials full: (empty)');
        }
        console.log('🏠 Base URL:', this.baseURL);
        console.log('📁 Current directory:', process.cwd());
        console.log('🌐 Node version:', process.version);
        console.log('🔍 process.env.GIGACHAT_CREDENTIALS:', process.env.GIGACHAT_CREDENTIALS ? `✅ (length: ${process.env.GIGACHAT_CREDENTIALS.length})` : '❌ NOT FOUND');
        console.log('🔐 ==========================================\n');
        
        if (!this.credentials) {
            console.error('❌ CRITICAL: GIGACHAT_CREDENTIALS not found!');
            console.log('💡 Check .env file in:', process.cwd());
            console.log('💡 All env vars with GIGA:', Object.keys(process.env).filter(k => k.includes('GIGA')).join(', '));
        }
    }
    
    // Метод для обновления credentials (на случай, если .env загрузится позже)
    public updateCredentials(): void {
        this.credentials = process.env.GIGACHAT_CREDENTIALS || '';
        console.log('🔄 Credentials updated:', this.credentials ? `✅ (length: ${this.credentials.length})` : '❌ NOT FOUND');
    }

    // Получение access token с кэшированием
    private async getAccessToken(): Promise<string> {
        // Если токен еще действителен (меньше 30 минут), возвращаем его
        const now = Date.now();
        const timeLeft = this.tokenExpires - now;
        
        if (this.accessToken && timeLeft > 0) {
            console.log(`♻️ Using cached token (expires in ${Math.round(timeLeft / 1000 / 60)} min)`);
            return this.accessToken;
        }
        
        try {
            console.log('\n🔄 ========== GETTING NEW TOKEN ==========');
            console.log('📤 Making request to: https://ngw.devices.sberbank.ru:9443/api/v2/oauth');
            console.log('🔐 Using credentials length:', this.credentials.length);
            
            const rqUID = this.generateRqUID();
            console.log('📋 Generated RqUID:', rqUID);
            
            console.log('⏰ Request configuration:');
            console.log('   - URL: https://ngw.devices.sberbank.ru:9443/api/v2/oauth');
            console.log('   - Method: POST');
            console.log('   - Headers: Content-Type, Authorization, Accept, RqUID');
            console.log('   - Timeout: 10000ms');
            
            const requestTime = Date.now();
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
            
            const responseTime = Date.now() - requestTime;
            console.log(`✅ Auth request completed in ${responseTime}ms`);
            console.log('📊 Response details:');
            console.log('   - Status:', response.status);
            console.log('   - Status Text:', response.statusText);
            console.log('   - Headers:', JSON.stringify(response.headers));
            console.log('   - Has access_token:', !!response.data.access_token);
            console.log('   - Token length:', response.data.access_token?.length || 'NO TOKEN');
            console.log('   - Full response keys:', Object.keys(response.data));
            
            if (!response.data.access_token) {
                console.error('❌ NO ACCESS TOKEN IN RESPONSE!');
                console.log('🔍 Full response:', JSON.stringify(response.data, null, 2));
                throw new Error('No access token in response');
            }
            
            this.accessToken = response.data.access_token;
            // Токен действует 30 минут - ставим 25 для надежности
            this.tokenExpires = now + (25 * 60 * 1000);
            
            console.log('🎉 Token refreshed successfully!');
            console.log('⏰ Token expires at:', new Date(this.tokenExpires).toLocaleString());
            console.log('🔑 Token preview:', this.accessToken.substring(0, 50) + '...');
            console.log('🔄 ======================================\n');
            
            return this.accessToken;
        } catch (error: any) {
            console.error('\n❌ ========== TOKEN ERROR ==========');
            console.error('📛 Error name:', error.name);
            console.error('📜 Error message:', error.message);
            console.error('🏷️ Error code:', error.code);
            
            if (error.response) {
                console.error('📊 Response status:', error.response.status);
                console.error('📄 Response status text:', error.response.statusText);
                console.error('🔤 Response headers:', JSON.stringify(error.response.headers));
                console.error('📋 Response data:', JSON.stringify(error.response.data, null, 2));
                
                if (error.response.data) {
                    console.error('🚨 Error details:');
                    if (error.response.data.error) {
                        console.error('   - Error:', error.response.data.error);
                    }
                    if (error.response.data.error_description) {
                        console.error('   - Description:', error.response.data.error_description);
                    }
                }
            } else if (error.request) {
                console.error('🚫 No response received - request only:');
                console.error('   - Request method:', error.request.method);
                console.error('   - Request path:', error.request.path);
                console.error('   - Request host:', error.request.host);
            }
            
            console.error('🔧 Config details:');
            console.error('   - URL:', error.config?.url);
            console.error('   - Method:', error.config?.method);
            console.error('   - Headers:', JSON.stringify(error.config?.headers));
            console.error('❌ =================================\n');
            
            throw error;
        }
    }

    // Генерация RqUID
    private generateRqUID(): string {
        const rqUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        console.log('🎲 Generated RqUID:', rqUID);
        return rqUID;
    }

    // Отправка сообщения в GigaChat
    async sendMessage(message: string): Promise<string> {
        // Проверяем наличие credentials
        if (!this.credentials) {
            throw new Error('GIGACHAT_CREDENTIALS не настроен. Добавьте его в .env файл.');
        }
        
        console.log('\n🤖 ========== SENDING TO GIGACHAT ==========');
        console.log('💬 Message details:');
        console.log('   - Length:', message.length, 'characters');
        console.log('   - Preview:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
        console.log('   - Full message:', message);
        
        try {
            console.log('🔐 Getting access token...');
            const token = await this.getAccessToken();
            console.log('✅ Token obtained, making API request...');
            
            const requestData = {
                model: "GigaChat",
                messages: [
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: 0.7,
                max_tokens: 1024
            };
            
            console.log('📦 Request payload:');
            console.log('   - Model:', requestData.model);
            console.log('   - Temperature:', requestData.temperature);
            console.log('   - Max tokens:', requestData.max_tokens);
            console.log('   - Messages count:', requestData.messages.length);
            
            const requestTime = Date.now();
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                requestData,
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
            
            const responseTime = Date.now() - requestTime;
            console.log(`✅ API request completed in ${responseTime}ms`);
            console.log('📊 Response details:');
            console.log('   - Status:', response.status);
            console.log('   - Status Text:', response.statusText);
            console.log('   - Has choices:', !!response.data.choices);
            console.log('   - Choices count:', response.data.choices?.length || 0);
            
            if (!response.data.choices || response.data.choices.length === 0) {
                console.error('❌ No choices in response');
                throw new Error('GigaChat API вернул пустой ответ');
            }
            
            const choice = response.data.choices[0];
            console.log('   - Finish reason:', choice.finish_reason);
            console.log('   - Has message:', !!choice.message);
            console.log('   - Message role:', choice.message?.role);
            console.log('   - Content length:', choice.message?.content?.length || 0);
            
            if (!choice.message || !choice.message.content) {
                console.error('❌ No message content in response');
                throw new Error('GigaChat API вернул ответ без содержимого');
            }
            
            const responseText = choice.message.content;
            console.log('💭 Response content:');
            console.log('   - Length:', responseText.length, 'characters');
            console.log('   - Preview:', responseText.substring(0, 150) + (responseText.length > 150 ? '...' : ''));
            console.log('🤖 ========================================\n');
            
            return responseText;
        } catch (error: any) {
            console.error('\n❌ ========== GIGACHAT API ERROR ==========');
            console.error('📛 Error name:', error.name);
            console.error('📜 Error message:', error.message);
            console.error('🏷️ Error code:', error.code);
            
            if (error.response) {
                console.error('📊 Response status:', error.response.status);
                console.error('📄 Response data:', JSON.stringify(error.response.data, null, 2));
                
                if (error.response.status === 401) {
                    console.log('🔄 Token expired, resetting and retrying...');
                    this.accessToken = '';
                    this.tokenExpires = 0;
                    return this.sendMessage(message);
                } else if (error.response.status === 429) {
                    console.log('🚫 Rate limit exceeded');
                    return 'Превышен лимит запросов. Попробуйте позже.';
                }
            } else if (error.request) {
                console.error('🚫 No response received from GigaChat API');
                console.error('🔧 Request details:', {
                    url: error.config?.url,
                    method: error.config?.method,
                    timeout: error.config?.timeout
                });
            }
            
            console.error('❌ =========================================\n');
            return 'Извините, произошла ошибка при обращении к нейросети. Попробуйте позже.';
        }
    }
}

export const gigaChatService = new GigaChatService();