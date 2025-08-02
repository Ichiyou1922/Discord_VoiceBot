// src/googleSpeechHandler.js
const { SpeechClient } = require('@google-cloud/speech');
const fs = require('fs');
// const config = require('./config'); // GCPプロジェクトIDが必要な場合など

// SpeechClient のインスタンスを作成
// GOOGLE_APPLICATION_CREDENTIALS 環境変数が設定されていれば、引数なしで初期化可能
const speechClient = new SpeechClient();

/**
 * WAVファイルをGoogle Cloud Speech-to-Textで文字起こしする
 * @param {string} wavFilePath - WAVファイルのパス
 * @param {string} languageCode - 言語コード (例: 'ja-JP')
 * @param {number} sampleRateHertz - 音声ファイルのサンプルレート (例: 16000)
 * @returns {Promise<string|null>} 文字起こし結果のテキスト、またはエラー時null
 */
async function transcribeAudioGoogle(wavFilePath, languageCode = 'ja-JP', sampleRateHertz = 16000) {
    if (!fs.existsSync(wavFilePath)) {
        console.error(`Audio file not found: ${wavFilePath}`);
        return null;
    }

    try {
        const audioFile = fs.readFileSync(wavFilePath);
        const audioBytes = audioFile.toString('base64');

        const audio = {
            content: audioBytes,
        };
        const recognizerConfig = {
            // encoding: 'LINEAR16', // WAVファイルの場合、通常は自動検出されるが明示も可能
            sampleRateHertz: sampleRateHertz, // voiceUtils.jsのpcmToWavで16000Hzに変換している前提
            languageCode: languageCode,
            model: 'default', // または 'telephony', 'medical_dictation' など用途に応じて
                              // 最新のモデルオプションはドキュメントを確認してください (例: 'latest_long', 'chirp' など)
            // Diarization (話者分離) や句読点の自動挿入なども有効にできる
            // "enableAutomaticPunctuation": true,
        };

        const request = {
            audio: audio,
            config: recognizerConfig,
        };

        console.log(`[GoogleSpeech] Sending request for ${wavFilePath}`);
        const [response] = await speechClient.recognize(request);
        // console.log('[GoogleSpeech] Raw response:', JSON.stringify(response, null, 2)); // 詳細なレスポンス確認用

        if (response.results && response.results.length > 0) {
            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n');
            console.log(`[GoogleSpeech] Transcription: "${transcription}"`);
            return transcription;
        } else {
            console.log('[GoogleSpeech] No transcription results found.');
            return ''; // 空の文字列を返す（nullではなく）
        }
    } catch (error) {
        console.error(`[GoogleSpeech] Error during transcription: ${error.message}`, error);
        if (error.code === 7) { // DEADLINE_EXCEEDED or UNAVAILABLE (Quota exceeded, etc.)
             console.error("[GoogleSpeech] API request failed, possibly due to quota issues or network problems.");
        }
        return null; // エラー時はnullを返す
    }
}

module.exports = { transcribeAudioGoogle };