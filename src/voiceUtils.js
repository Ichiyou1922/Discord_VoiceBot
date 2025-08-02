// src/voiceUtils.js
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname); // 再帰的に親ディレクトリを作成
    fs.mkdirSync(dirname);
}

ffmpeg.setFfmpegPath(ffmpegStatic);

function pcmToWav(pcmFilePath, wavFilePath, inputSampleRate, inputChannels, inputBitDepth) {
    return new Promise((resolve, reject) => {
        const inputFormat = `s${inputBitDepth}le`; // signed 16-bit little-endian
        ffmpeg(pcmFilePath)
            .inputFormat(inputFormat)
            .inputOptions([
                `-ar ${inputSampleRate}`, // 入力サンプリングレート
                `-ac ${inputChannels}`,   // 入力チャンネル数
            ])
            .audioCodec('pcm_s16le')     // 出力WAVのPCM形式
            .audioChannels(1)           // ★★★ モノラルに変換 ★★★
            .audioFrequency(16000)      // ★★★ 16kHzにリサンプリング ★★★
            .toFormat('wav')
            .on('error', (err) => {
                console.error(`ffmpeg error during pcmToWav (${pcmFilePath} to ${wavFilePath}):`, err.message);
                reject(err);
            })
            .on('end', () => {
                console.log(`ffmpeg: ${pcmFilePath} converted to ${wavFilePath} (16kHz mono)`);
                if (fs.existsSync(wavFilePath)) {
                    resolve(wavFilePath);
                } else {
                    reject(new Error(`ffmpeg conversion finished but output file not found: ${wavFilePath}`));
                }
            })
            .save(wavFilePath);
    });
}
module.exports = { ensureDirectoryExistence, pcmToWav };