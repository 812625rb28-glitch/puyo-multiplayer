# ぷよテト専用中継サーバー

## RenderなどのNode.jsホスティングへ配置
1. `puyo-relay-server.js` と `package.json` を同じフォルダに置く。
2. この2ファイルをGitHubリポジトリにアップロードする。
3. Renderで **New → Web Service** を選び、そのリポジトリを接続する。
4. Runtime: Node、Build Command: `npm install`、Start Command: `npm start`。
5. デプロイ後のHTTPS URL（例: `https://your-app.onrender.com`）をコピーする。
6. `puyo_tetris_custom_relay.html` 内の `https://YOUR-RELAY-SERVER.example.com` を、そのURLに一括置換する（URL末尾の `/` は付けない）。
7. HTMLを保存し、友達にも同じ修正版HTMLを渡す。2人とも同じ中継URLを使う必要がある。

## 注意
- このサーバーはゲームの「接続シグナリング」とロビー通信を中継する簡易サーバー。通常の対戦データはWebRTCで直接送信し、直接接続できない場合はゲーム内の低頻度中継モードに切り替わる。
- インメモリ保存のため、サーバー再起動時に部屋・ロビー情報は消える。
- これは簡易実装で、公開運用向けの認証や永続ストレージはない。公開URLを知る人はトピックを送受信できるため、個人情報やパスワードを送らないこと。必要ならアクセス制限を追加する。
- HTMLを `file://` から開いても CORS は許可する設計。ただしブラウザや学校ネットワークの制限によりWebRTCが使えない場合は中継モードになる。
- サーバーを起動するだけでは全世界から接続できない。Render等へデプロイしてHTTPSの公開URLを得る必要がある。
