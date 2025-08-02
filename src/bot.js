// src/bot.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client, GatewayIntentBits, Partials, ChannelType, EmbedBuilder } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    entersState,
    StreamType,
    VoiceConnectionStatus,
    AudioPlayerStatus,
    NoSubscriberBehavior,
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const { DISCORD_BOT_TOKEN, personas, DEFAULT_PERSONA_ID, BOT_PREFIX } = config;

// 文字起こしハンドラは使用しない
// const { transcribeAudioGoogle } = require('./googleSpeechHandler');
const { getGeminiResponse, clearConversationHistory } = require('./llmHandler');
const { synthesizeSpeechCoeiroink } = require('./ttsHandler');
const { ensureDirectoryExistence } = require('./voiceUtils');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Channel],
});

const voiceConnections = new Map();
const audioPlayers = new Map(); // { guildId: AudioPlayer }
const TEMP_AUDIO_DIR = path.join(__dirname, '..', 'public', 'temp_audio');
const botSpeakingState = new Map(); // { guildId: boolean } // ボットが全体的な応答処理中か (テキスト生成～再生完了まで)
const chatResponseMode = new Map(); // { guildId: boolean }
const currentPersonas = new Map(); // { guildId: personaId }

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    ensureDirectoryExistence(path.join(TEMP_AUDIO_DIR, 'dummy.txt'));
    console.log(`Temporary audio directory: ${TEMP_AUDIO_DIR}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    const guildId = message.guild.id;
    const prefix = BOT_PREFIX;

    // --- コマンド処理 ---
    if (message.content.startsWith(prefix)) {
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'join') {
            chatResponseMode.set(guildId, true);
            const voiceChannel = message.member?.voice.channel;
            if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
                chatResponseMode.delete(guildId);
                return message.reply('参加可能なボイスチャンネルに接続してください。');
            }

            let connection = voiceConnections.get(guildId);
            if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
                if (connection.joinConfig.channelId === voiceChannel.id) return message.reply("既に同じチャンネルに接続済みです。");
                connection.destroy();
                voiceConnections.delete(guildId);
                audioPlayers.get(guildId)?.stop(true); // 強制停止
                audioPlayers.delete(guildId);
                botSpeakingState.delete(guildId);
            }

            try {
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guildId,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    selfDeaf: false,
                });
                voiceConnections.set(guildId, connection);
                botSpeakingState.set(guildId, false);
                currentPersonas.set(guildId, DEFAULT_PERSONA_ID);

                await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
                const currentPersona = personas.find(p => p.id === DEFAULT_PERSONA_ID) || personas[0];
                console.log(`Successfully connected to ${voiceChannel.name}! Default Persona: ${currentPersona.name}`);
                message.reply(`${voiceChannel.name} に接続しました。現在の話者は **${currentPersona.name}** です。\nチャットで話しかけてください。\n話者変更: \`${prefix}persona <ID>\`\n終了: \`${prefix}leave\``);

                // 音声認識関連のリスナーは完全にコメントアウト
                /*
                connection.receiver.speaking.on('start', (userId) => {
                    // ...音声認識のロジックはここにあった...
                });
                */

                connection.on(VoiceConnectionStatus.Disconnected, async () => {
                    console.log(`ボイス接続 (ギルド ${guildId}) が切断されました。`);
                    chatResponseMode.delete(guildId);
                    try {
                        await Promise.race([
                            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                        ]);
                    } catch (error) {
                        if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
                        voiceConnections.delete(guildId);
                        audioPlayers.get(guildId)?.stop(true);
                        audioPlayers.delete(guildId);
                        botSpeakingState.delete(guildId);
                        clearConversationHistory(); // 全ユーザーの履歴をクリア (またはギルド単位)
                        console.log(`ボイス接続 (ギルド ${guildId}) が完全に破棄されました。`);
                    }
                });
                connection.on('error', error => {
                    console.error(`ボイス接続エラー (ギルド ${guildId}): ${error.message}`, error);
                    chatResponseMode.delete(guildId);
                });

            } catch (error) {
                console.error('ボイスチャンネルへの接続または設定中にエラー:', error);
                message.reply('ボイスチャンネルへの接続に失敗しました。');
                chatResponseMode.delete(guildId);
                if (voiceConnections.has(guildId) && voiceConnections.get(guildId).state.status !== VoiceConnectionStatus.Destroyed) {
                    voiceConnections.get(guildId).destroy();
                }
                voiceConnections.delete(guildId);
                botSpeakingState.delete(guildId);
            }
        } // End of 'join'

        else if (command === 'leave') {
            chatResponseMode.delete(guildId);
            const connection = voiceConnections.get(guildId);
            if (connection) {
                if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
                voiceConnections.delete(guildId);
                audioPlayers.get(guildId)?.stop(true);
                audioPlayers.delete(guildId);
                botSpeakingState.delete(guildId);
                clearConversationHistory();
                message.reply('ボイスチャンネルから切断しました。');
            } else {
                message.reply('ボットは現在ボイスチャンネルに接続していません。');
            }
        } // End of 'leave'

        else if (command === 'persona') {
            if (args.length === 0 || args[0].toLowerCase() === 'list') {
                const embed = new EmbedBuilder().setColor(0x0099FF).setTitle('利用可能な話者リスト');
                personas.forEach(p => {
                    embed.addFields({ name: `${p.name} (\`${p.id}\`)`, value: p.systemPrompt.substring(0, 100) + '...' });
                });
                const currentGuildPersonaId = currentPersonas.get(guildId) || DEFAULT_PERSONA_ID;
                const currentPersona = personas.find(p => p.id === currentGuildPersonaId) || personas[0];
                embed.setFooter({ text: `現在の話者: ${currentPersona.name} (${currentPersona.id}) | 変更: ${prefix}persona <ID>` });
                return message.reply({ embeds: [embed] });
            }

            const requestedPersonaId = args[0].toLowerCase();
            const selectedPersona = personas.find(p => p.id === requestedPersonaId);

            if (selectedPersona) {
                currentPersonas.set(guildId, selectedPersona.id);
                clearConversationHistory(message.author.id, selectedPersona.id);
                message.reply(`話者を **${selectedPersona.name}** に変更しました。\n会話履歴がリセットされました。`);
                const connection = voiceConnections.get(guildId);
                if (connection && selectedPersona.greeting && !botSpeakingState.get(guildId)) {
                    await speakText(selectedPersona.greeting, guildId, connection, selectedPersona.id, false); // AI応答ではないのでfalse
                }
            } else {
                message.reply(`指定された話者ID「${requestedPersonaId}」は見つかりません。\`${prefix}persona list\` で確認してください。`);
            }
            return;
        } // End of 'persona'

        else if (command === 'speak') {
            const textToSpeak = args.join(' ');
            if (!textToSpeak) return message.reply("話す内容を指定してください。");
            const connection = voiceConnections.get(guildId);
            if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed || connection.state.status === VoiceConnectionStatus.Disconnected) {
                return message.reply("ボイスチャンネルに接続していません。");
            }
            if (botSpeakingState.get(guildId)) {
                return message.reply("現在ボットが他の応答を処理中です。");
            }
            const currentGuildPersonaId = currentPersonas.get(guildId) || DEFAULT_PERSONA_ID;
            await speakText(textToSpeak, guildId, connection, currentGuildPersonaId, false); // AI応答ではないのでfalse
        } // End of 'speak'

        else if (command === 'clearhistory') {
            const currentGuildPersonaId = currentPersonas.get(guildId) || DEFAULT_PERSONA_ID;
            clearConversationHistory(message.author.id, currentGuildPersonaId);
            message.reply(`現在の話者(${currentGuildPersonaId})との会話履歴をクリアしました。`);
        } // End of 'clearhistory'

    } else { // --- プレフィックスなしのメッセージ処理 ---
        if (voiceConnections.has(guildId) && chatResponseMode.get(guildId)) {
            const userText = message.content.trim();
            if (!userText) return;

            if (botSpeakingState.get(guildId)) {
                message.channel.send("（応答生成・再生中です...少々お待ちください。）").then(msg => {
                    setTimeout(() => msg.delete().catch(console.error), 3000);
                }).catch(console.error);
                return;
            }

            const currentGuildPersonaId = currentPersonas.get(guildId) || DEFAULT_PERSONA_ID;
            const currentSelectedPersona = personas.find(p => p.id === currentGuildPersonaId) || personas[0];
            const connection = voiceConnections.get(guildId);

            if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed || connection.state.status === VoiceConnectionStatus.Disconnected) {
                // VCにいない場合はテキスト応答のみ (AIは呼び出す)
                botSpeakingState.set(guildId, true);
                console.log(`[TextOnly User ${message.author.id}][Persona: ${currentSelectedPersona.name}] Text: "${userText}"`);
                try {
                    const aiResponseText = await getGeminiResponse(userText, message.author.id, message.author.username, currentGuildPersonaId);
                    if (aiResponseText && aiResponseText.trim().length > 0) {
                        message.reply(`**${client.user.username} (${currentSelectedPersona.name})**: ${aiResponseText}`);
                    } else {
                        message.reply("AIが応答できませんでした。");
                    }
                } catch (error) {
                    console.error("[TextOnly] Error getting Gemini response:", error);
                    message.reply("AI応答取得中にエラーが発生しました。");
                } finally {
                    botSpeakingState.set(guildId, false);
                }
                return;
            }

            try {
                botSpeakingState.set(guildId, true); // 応答処理開始
                console.log(`[ChatInput User ${message.author.id}][Persona: ${currentSelectedPersona.name}] Text: "${userText}"`);
                const thinkingMessage = await message.channel.send(`**${client.user.username} (${currentSelectedPersona.name})が応答中...** 🧠`);

                const aiResponseText = await getGeminiResponse(userText, message.author.id, message.author.username, currentGuildPersonaId);

                if (!aiResponseText || aiResponseText.trim().length === 0) {
                    if (thinkingMessage) await thinkingMessage.delete().catch(console.error);
                    message.reply("AIが応答を生成できませんでした。");
                    botSpeakingState.set(guildId, false);
                    return;
                }

                if (thinkingMessage) await thinkingMessage.edit(`**${client.user.username} (${currentSelectedPersona.name})**: ${aiResponseText}`).catch(console.error);
                else message.channel.send(`**${client.user.username} (${currentSelectedPersona.name})**: ${aiResponseText}`);

                await speakText(aiResponseText, guildId, connection, currentGuildPersonaId, true); // AI応答なのでtrue

            } catch (error) {
                console.error("[ChatToSpeech] 処理中にエラー:", error);
                message.reply("処理中にエラーが発生しました。");
                botSpeakingState.set(guildId, false); // エラー時も必ず解除
            }
            // speakTextが非同期で再生するため、botSpeakingStateの解除はspeakText内で行う
        }
        // ... (VC未参加時のメンション応答など)
    }
});

// --- 音声再生処理を共通化する関数 ---
// isAiResponse フラグを追加し、AI応答の場合のみ再生終了後に botSpeakingState を解除
async function speakText(text, guildId, connection, personaId = DEFAULT_PERSONA_ID, isAiResponse = false) {
    if (!isAiResponse && botSpeakingState.get(guildId)) { // AI応答でないspeakコマンドが、AI応答処理中に割り込まないように
        console.log(`[SpeakText] Bot is busy with AI response. Dropping speak command for: "${text.substring(0,20)}..."`);
        return;
    }
    if (!isAiResponse) { // speakコマンドの場合は、ここでビジー状態にする
        botSpeakingState.set(guildId, true);
    }

    let synthesizedWavPath;
    let player = audioPlayers.get(guildId);

    if (player && player.state.status !== AudioPlayerStatus.Idle && player.state.status !== AudioPlayerStatus.AutoPaused) {
        console.log(`[SpeakText][Persona: ${personaId}] Player is busy. Request for "${text.substring(0, 20)}..." will be dropped or queued (not implemented).`);
        if (!isAiResponse) botSpeakingState.set(guildId, false); // AI応答でなければ、再生できないのでビジー解除
        return;
    }

    try {
        console.log(`[SpeakText][Persona: ${personaId}] Synthesizing: "${text.substring(0, 50)}..."`);
        synthesizedWavPath = await synthesizeSpeechCoeiroink(text, TEMP_AUDIO_DIR, personaId);

        if (synthesizedWavPath && fs.existsSync(synthesizedWavPath)) {
            if (!player) {
                player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });
                audioPlayers.set(guildId, player);
                try {
                    connection.subscribe(player);
                } catch (subError) {
                    console.error(`[SpeakText][Persona: ${personaId}] Failed to subscribe player:`, subError);
                    if (fs.existsSync(synthesizedWavPath)) fs.unlinkSync(synthesizedWavPath);
                    if (isAiResponse || !isAiResponse) botSpeakingState.set(guildId, false); // どちらのケースでも解除
                    return;
                }
            }
            const resource = createAudioResource(synthesizedWavPath, { inputType: StreamType.Arbitrary });
            player.play(resource);
            console.log(`[SpeakText][Persona: ${personaId}] Playing: ${path.basename(synthesizedWavPath)}`);

            const onIdle = () => {
                console.log(`[SpeakText][Persona: ${personaId}] Finished (Idle): ${path.basename(synthesizedWavPath)}`);
                if (fs.existsSync(synthesizedWavPath)) fs.unlinkSync(synthesizedWavPath);
                // AI応答の再生が完了した場合のみ、メインのbotSpeakingStateを解除
                if (isAiResponse) {
                    botSpeakingState.set(guildId, false);
                }
                // speakコマンドの場合は、この関数の冒頭で設定したものがここで解除されることになる
                // (ただし、AI応答と競合しないように、上のガード条件が重要)
                else {
                     botSpeakingState.set(guildId, false);
                }
                player.off(AudioPlayerStatus.Idle, onIdle);
                player.off('error', onError);
            };
            const onError = (error) => {
                console.error(`[SpeakText][Persona: ${personaId}] Player Error for ${path.basename(synthesizedWavPath)}: ${error.message}`, error);
                if (fs.existsSync(synthesizedWavPath)) fs.unlinkSync(synthesizedWavPath);
                if (isAiResponse || !isAiResponse) botSpeakingState.set(guildId, false);
                player.off(AudioPlayerStatus.Idle, onIdle);
                player.off('error', onError);
            };
            player.removeAllListeners(AudioPlayerStatus.Idle);
            player.removeAllListeners('error');
            player.on(AudioPlayerStatus.Idle, onIdle);
            player.on('error', onError);

        } else {
            console.error(`[SpeakText][Persona: ${personaId}] Synthesis failed for text: "${text.substring(0, 50)}..."`);
            if (isAiResponse || !isAiResponse) botSpeakingState.set(guildId, false);
        }
    } catch (error) {
        console.error(`[SpeakText][Persona: ${personaId}] Error during synthesis or playback:`, error);
        if (fs.existsSync(synthesizedWavPath)) fs.unlinkSync(synthesizedWavPath);
        if (isAiResponse || !isAiResponse) botSpeakingState.set(guildId, false);
    }
}

client.login(DISCORD_BOT_TOKEN).catch(err => {
    console.error("Failed to login to Discord:", err);
    process.exit(1);
});