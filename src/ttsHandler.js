// src/ttsHandler.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
// configからpersonasとデフォルト設定を読み込む
const { COEIROINK_API_BASE_URL, personas, DEFAULT_PERSONA_ID, DEFAULT_COEIROINK_SPEAKER_ID } = require('./config');
const { ensureDirectoryExistence } = require('./voiceUtils');

// personaId と text を引数に追加
async function synthesizeSpeechCoeiroink(text, outputDir, personaId = DEFAULT_PERSONA_ID) {
    if (!COEIROINK_API_BASE_URL) {
        console.error("VOICEVOX/COEIROINK API URL is not set.");
        return null;
    }

    // 指定されたpersonaIdまたはデフォルトのpersonaIdでペルソナ情報を検索
    const selectedPersona = personas.find(p => p.id === personaId) || personas.find(p => p.id === DEFAULT_PERSONA_ID);
    // スピーカーIDを取得。見つからなければデフォルトのスピーカーIDを使用
    const speakerIdToUse = selectedPersona ? selectedPersona.coeiroinkSpeakerId : DEFAULT_COEIROINK_SPEAKER_ID;

    const queryUrl = `${COEIROINK_API_BASE_URL}/audio_query`;
    const synthesisUrl = `${COEIROINK_API_BASE_URL}/synthesis`;

    console.log(`[TTS Handler][Persona: ${selectedPersona?.name || 'Default'}] Requesting synthesis for speaker ID: ${speakerIdToUse}`);

    try {
        const queryResponse = await axios.post(queryUrl, null, {
            params: { text: text, speaker: speakerIdToUse }, // ★ 選択されたスピーカーIDを使用
            timeout: 10000,
        });
        const audioQueryJson = queryResponse.data;

        const synthesisResponse = await axios.post(synthesisUrl, audioQueryJson, {
            params: { speaker: speakerIdToUse }, // ★ 選択されたスピーカーIDを使用
            headers: { 'Content-Type': 'application/json', 'Accept': 'audio/wav' },
            responseType: 'arraybuffer',
            timeout: 20000, // 長めのタイムアウト
        });

        if (synthesisResponse.status === 200 && synthesisResponse.data) {
            ensureDirectoryExistence(path.join(outputDir, 'dummy.txt'));
            const timestamp = Date.now();
            // ファイル名にペルソナIDやスピーカーIDを含めるとデバッグしやすい
            const filePath = path.join(outputDir, `coeiroink_output_${timestamp}_${selectedPersona?.id || 'default'}_spk${speakerIdToUse}.wav`);
            fs.writeFileSync(filePath, Buffer.from(synthesisResponse.data), 'binary');
            console.log(`[TTS Handler][Persona: ${selectedPersona?.name || 'Default'}] Synthesis successful (Speaker ID: ${speakerIdToUse}). Saved to ${filePath}`);
            return filePath;
        } else {
            console.error(`[TTS Handler][Persona: ${selectedPersona?.name || 'Default'}] Synthesis failed with status: ${synthesisResponse.status}`);
            return null;
        }
    } catch (error) {
        console.error(`[TTS Handler][Persona: ${selectedPersona?.name || 'Default'}] Error communicating with API (Speaker ID: ${speakerIdToUse}):`, error.message);
        if (error.response) {
            console.error("API Response Status:", error.response.status);
            const responseDataText = error.response.data ? (Buffer.isBuffer(error.response.data) ? Buffer.from(error.response.data).toString() : JSON.stringify(error.response.data)) : 'No data';
            console.error("API Response Data:", responseDataText);
        }
        return null;
    }
}

module.exports = { synthesizeSpeechCoeiroink };