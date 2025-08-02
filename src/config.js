// src/config.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const path = require('path');

// Google Cloud サービスアカウントキーのファイルパスを設定
const googleAppCredsFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS_FILENAME;
if (googleAppCredsFilename) {
    const fullPathToCredentials = path.resolve(__dirname, '../', googleAppCredsFilename);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = fullPathToCredentials;
    console.log(`[Config] Google Application Credentials set to: ${fullPathToCredentials}`);
} else {
    // GOOGLE_APPLICATION_CREDENTIALS 環境変数自体が設定されているか確認
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.warn('[Config] GOOGLE_APPLICATION_CREDENTIALS_FILENAME is not set in .env file, and GOOGLE_APPLICATION_CREDENTIALS is not set either. Google Cloud services may not be authenticated.');
    } else {
        console.log(`[Config] Using GOOGLE_APPLICATION_CREDENTIALS from environment: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    }
}

// 話者プロファイル定義
const personas = [
    {
        id: 'metan', // 識別子 (コマンドで使う)
        name: '四国めたん', // 表示名
        coeiroinkSpeakerId: 2, // VOICEVOX/COEIROINKのスピーカーID (要確認・修正)
        systemPrompt: "",
        greeting: "" // ボットの最初の挨拶
    },
    {
        id: 'zundamon', // 識別子
        name: 'ずんだもん', // 表示名
        coeiroinkSpeakerId: 1, // VOICEVOX/COEIROINKのスピーカーID (要確認・修正)
        systemPrompt: "",
        greeting: ""
    },
    {
        id: 'himari',
        name: '冥鳴ひまり',
        coeiroinkSpeakerId: 14, 
        systemPrompt: "",
        greeting: ""
    },
   
    // 必要であれば、他のキャラクターやデフォルトの標準話者も追加できます
    // {
    //     id: 'normal',
    //     name: '標準',
    //     coeiroinkSpeakerId: 3, // 例: 標準話者のID
    //     systemPrompt: "あなたは親切なAIアシスタントです。ユーザーの質問に的確かつ分かりやすく答えてください。",
    //     greeting: "こんにちは。何かお手伝いしましょうか？"
    // }
];

module.exports = {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    COEIROINK_API_BASE_URL: process.env.COEIROINK_API_BASE_URL || 'http://',//COEIROINKのAPIのURL
    DEFAULT_COEIROINK_SPEAKER_ID: parseInt(process.env.DEFAULT_COEIROINK_SPEAKER_ID || '0', 10), // デフォルトスピーカーID (つむぎをデフォルトに)

    SILENCE_THRESHOLD_MS: parseInt(process.env.SILENCE_THRESHOLD_MS || '2000', 10),
    MIN_SPEECH_DURATION_MS: parseInt(process.env.MIN_SPEECH_DURATION_MS || '750', 10),

    personas: personas, // 話者プロファイルをエクスポート
    DEFAULT_PERSONA_ID: 'tsumugi', // デフォルトの話者ID (つむぎをデフォルトに)

    BOT_PREFIX: process.env.BOT_PREFIX || '!vbot-', // bot.js でも参照できるようにエクスポート
};