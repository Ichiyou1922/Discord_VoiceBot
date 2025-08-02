# Discord音声チャットボット

Discordでチャットを通じてAIと会話できるボットです。Gemini APIを使用した自然言語処理とCOEIROINKを使用した音声合成を組み合わせています。

## 🚀 機能

- **音声チャット**: DiscordのボイスチャンネルでAIと音声で会話
- **複数話者**: 四国めたん、ずんだもん、冥鳴ひまりなどの話者を選択可能
- **自然言語処理**: Google Gemini APIを使用した高度な会話機能
- **音声合成**: COEIROINKを使用した高品質な音声合成
- **会話履歴**: ユーザーごとの会話履歴を保持

## 📋 必要条件

- Node.js 18.0以上
- Discord Bot Token
- Google Gemini API Key
- COEIROINK API（ローカルまたはリモート）
- Google Cloud Speech-to-Text API（オプション）

## 🛠️ セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd my-discord-js-bot
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example`ファイルを`.env`にコピーして、必要な値を設定してください：

```bash
cp .env.example .env
```

#### 必要な環境変数

```env
# Discord Bot設定
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# Gemini API設定
GEMINI_API_KEY=your_gemini_api_key_here

# Google Cloud設定（オプション）
GOOGLE_APPLICATION_CREDENTIALS_FILENAME=your_google_credentials_file.json

# COEIROINK設定
COEIROINK_API_BASE_URL=http://localhost:50032
DEFAULT_COEIROINK_SPEAKER_ID=0

# 音声認識設定
SILENCE_THRESHOLD_MS=2000
MIN_SPEECH_DURATION_MS=750

# Bot設定
BOT_PREFIX=!vbot-
```

### 4. APIキーの取得

#### Discord Bot Token
1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. 新しいアプリケーションを作成
3. Botセクションでトークンを取得
4. 必要な権限を設定（音声チャンネルへの接続、メッセージ送信など）

#### Gemini API Key
1. [Google AI Studio](https://makersuite.google.com/app/apikey)にアクセス
2. APIキーを作成

#### COEIROINK API
1. [COEIROINK](https://coeiroink.com/)をダウンロード
2. ローカルでAPIサーバーを起動（デフォルトポート: 50032）

### 5. Botの起動

```bash
node src/bot.js
```

## 🎮 使用方法

### 基本コマンド

| コマンド | 説明 |
|---------|------|
| `!vbot-join` | ボイスチャンネルに参加 |
| `!vbot-leave` | ボイスチャンネルから退出 |
| `!vbot-persona <ID>` | 話者を変更 |
| `!vbot-clear` | 会話履歴をクリア |

### 利用可能な話者

| ID | 名前 | 説明 |
|----|------|------|
| `metan` | 四国めたん | 明るく元気なキャラクター |
| `zundamon` | ずんだもん | かわいらしいキャラクター |
| `himari` | 冥鳴ひまり | 落ち着いたキャラクター |

その他話者も設定により利用可能です
詳細は話者のカスタマイズ欄にて

### 会話の開始

1. ボイスチャンネルに参加
2. `!vbot-join`コマンドでボットを呼び出し
3. テキストチャンネルで話しかけると、ボットが音声で応答

## 🔧 設定

### 話者のカスタマイズ

`src/config.js`の`personas`配列を編集して、新しい話者を追加できます：

```javascript
{
    id: 'custom',
    name: 'カスタム話者',
    coeiroinkSpeakerId: 0,
    systemPrompt: "あなたの役割設定",
    greeting: "挨拶メッセージ"
}
```

### 音声認識の設定

- `SILENCE_THRESHOLD_MS`: 無音判定の閾値（ミリ秒）
- `MIN_SPEECH_DURATION_MS`: 最小音声認識時間（ミリ秒）

## 🔒 セキュリティ

### 重要な注意事項

- **APIキーの管理**: 環境変数を使用し、コードに直接記述しないでください
- **認証情報ファイル**: Google Cloud認証情報は`.gitignore`で除外されています
- **環境変数ファイル**: `.env`ファイルはGitにコミットされません

### 推奨設定

1. 定期的にAPIキーをローテーション
2. 本番環境では適切な権限設定
3. ログファイルに機密情報が出力されないよう注意

## 📁 プロジェクト構造

```
my-discord-js-bot/
├── src/
│   ├── bot.js              # メインのボットファイル
│   ├── config.js           # 設定ファイル
│   ├── llmHandler.js       # Gemini API処理
│   ├── ttsHandler.js       # 音声合成処理
│   ├── googleSpeechHandler.js # 音声認識処理
│   └── voiceUtils.js       # 音声ユーティリティ
├── public/
│   └── temp_audio/         # 一時音声ファイル
├── models/                 # Whisperモデル
├── .env.example           # 環境変数の例
├── .gitignore            # Git除外設定
└── README.md             # このファイル
```

## 🐛 トラブルシューティング

### よくある問題

1. **ボットが音声チャンネルに参加できない**
   - Discord Botの権限を確認
   - ボイスチャンネルへの接続権限が必要

2. **音声が再生されない**
   - COEIROINK APIが起動しているか確認
   - ポート50032が利用可能か確認

3. **APIキーエラー**
   - 環境変数が正しく設定されているか確認
   - APIキーが有効か確認

## 📄 ライセンス

このプロジェクトはISCライセンスの下で公開されています。

## 🤝 貢献

プルリクエストやイシューの報告を歓迎します。

## 📞 サポート

問題が発生した場合は、GitHubのイシューを作成してください。

---

**注意**: このボットを使用する際は、Discordの利用規約とAPI利用規約を遵守してください。 