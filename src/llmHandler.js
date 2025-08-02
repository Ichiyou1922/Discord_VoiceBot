// src/llmHandler.js
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { GEMINI_API_KEY, personas, DEFAULT_PERSONA_ID } = require('./config'); // configから設定を読み込む

if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not set. LLM functionality will be disabled.");
}
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    safetySettings: [ // 必要に応じて調整してください
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
    generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
    }
}) : null;

const conversationHistories = new Map(); // { "userId_personaId": [{role: "user", ...}, ...] }

async function getGeminiResponse(userText, userId, userName = "User", personaId = DEFAULT_PERSONA_ID) {
    if (!model) return "Geminiモデルが利用できません (APIキー未設定など)。";

    const selectedPersona = personas.find(p => p.id === personaId) || personas.find(p => p.id === DEFAULT_PERSONA_ID);
    if (!selectedPersona) {
        console.error(`Persona with ID '${personaId}' or default '${DEFAULT_PERSONA_ID}' not found in config.`);
        return "話者設定が見つかりませんでした。管理者に連絡してください。";
    }
    const currentPersonaId = selectedPersona.id;

    const historyKey = `${userId}_${currentPersonaId}`;
    let history = conversationHistories.get(historyKey) || [];
    const MAX_HISTORY_TURNS = 5; // 往復のターン数

    const systemInstruction = selectedPersona.systemPrompt;
    const botGreeting = selectedPersona.greeting || "はい、こんにちは！";

    // APIに渡すメッセージリストを毎回構築する
    // 先頭にシステムインストラクションと、それに対するモデルの最初の応答（挨拶）を配置
    const messagesForApi = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: botGreeting }] }
    ];

    // 実際のユーザーとモデルの会話履歴をシステムインストラクションの後に追加
    // 履歴が長くなりすぎないように制限する
    const startIndex = Math.max(0, history.length - (MAX_HISTORY_TURNS * 2));
    for (let i = startIndex; i < history.length; i++) {
        messagesForApi.push(history[i]);
    }

    const currentUserTurn = { role: "user", parts: [{ text: userText }] };

    try {
        const chat = model.startChat({
            history: messagesForApi, // システムインストラクションを含む完全なコンテキスト
        });
        const result = await chat.sendMessage(userText); // 今回のユーザーメッセージのみを送信
        const botResponse = result.response.text();

        console.log(`[LLM Handler][Persona: ${selectedPersona.name}] Gemini Response: ${botResponse}`);

        // ボット内部で保持する履歴を更新 (ユーザーの今回の発言と、それに対するモデルの応答)
        history.push(currentUserTurn);
        history.push({ role: "model", parts: [{ text: botResponse }] });

        // ボット内部の履歴も長くなりすぎないように制限
        if (history.length > MAX_HISTORY_TURNS * 2) {
            history = history.slice(-MAX_HISTORY_TURNS * 2);
        }
        conversationHistories.set(historyKey, history);

        return botResponse;
    } catch (error) {
        console.error(`[LLM Handler][Persona: ${selectedPersona.name}] Error communicating with Gemini API:`, error);
        if (error.response && error.response.promptFeedback) {
            console.error("Gemini Prompt Feedback:", error.response.promptFeedback);
            return `Gemini APIで問題が発生しました: ${error.response.promptFeedback.blockReason || '不明な理由'}`;
        }
        return "Gemini APIとの通信でエラーが発生しました。";
    }
}

function clearConversationHistory(userId, personaIdToClear) {
    if (userId && personaIdToClear) {
        const historyKey = `${userId}_${personaIdToClear}`;
        const deleted = conversationHistories.delete(historyKey);
        if (deleted) {
            console.log(`Conversation history for user ${userId} with persona ${personaIdToClear} cleared.`);
        } else {
            console.log(`No conversation history found for user ${userId} with persona ${personaIdToClear}.`);
        }
    } else if (userId) {
        let clearedCount = 0;
        for (const key of conversationHistories.keys()) {
            if (key.startsWith(userId + '_')) {
                conversationHistories.delete(key);
                clearedCount++;
            }
        }
        console.log(`Cleared ${clearedCount} conversation histories for user ${userId}.`);
    } else {
        conversationHistories.clear();
        console.log("All conversation histories cleared.");
    }
}

module.exports = { getGeminiResponse, clearConversationHistory };