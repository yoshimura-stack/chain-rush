CHAIN RUSH V0.13 — MULTIPLAYER FOUNDATION

■ 今回の目的
V0.12の景観・コースを維持したまま、BOT固定をやめて「1〜7人の実プレイヤー」で走れる土台へ切り替えました。
ロビー入室人数 = ゲーム内キャラクター人数です。3人なら3キャラ、5人なら5キャラ、7人なら7キャラだけを生成表示します。
空席をBOTでは埋めません。

■ 重要：起動方法
V0.13の index.html はマルチプレイ用です。
ES Modules + Realtime通信を使うため、ダブルクリック(file://)ではなくWebサーバー上で開いてください。
Cloudflare Pagesへフォルダ一式をアップロードする方法を推奨します。

V0.12のオフライン版も offline.html と game.js に残しています。
offline.html は従来どおりZIPを展開してダブルクリックできます（SOLO + BOT6 / V0.12）。

■ Supabase設定（複数PCテスト）
1. config.js を開く
2. supabaseUrl に Project URL
3. supabaseAnonKey に anon key / publishable key
4. フォルダ一式をCloudflare Pagesへ配置

このV0.13では Supabase Realtime の Presence + Broadcast のみを使用します。
DBテーブルやSQLはまだ不要です。
ROOMは参加者がいる間だけ存在する軽量なテストルームです。

config.js が空の場合は LOCAL TAB MODE になります。
同じ公開URLを同一PCの複数タブで開き、3人・5人などの見た目と同期を先に確認できます。
LOCAL TAB MODEは別PC間では通信しません。

■ ロビー
・PLAYER NAME入力
・4桁ROOM ID
・新規ROOM作成 / ROOM参加
・最大7人
・Presenceで参加者一覧を同期
・READY
・HOSTのみSTART
・全員READYで開始可能
・HOSTはROOM作成者を優先。退出時は残ったメンバーへHOSTが移ります（ロビー中）。

■ 人数可変
キャラクターは人数に応じて自動センタリングします。
例：3人 = -4.22 / 0 / +4.22
7人 = -12.66 〜 +12.66
ロープも実参加者の隣同士だけ生成表示します。

■ SELF-CENTERED CAMERA
全PCで同じワールド座標・同じ並び順を共有しますが、カメラだけ各PLAYER専用です。
自分のキャラクター（YOU）のX位置へカメラが滑らかに追従し、YOUが常に画面中央付近になります。
7人目（右端）ならカメラも右端へ寄るため、画面右側に崖・谷・天空が大きく見えます。
並び替えて中央へ持ってくる方式ではありません。

■ リアルタイム同期
・各PLAYERの A/D/W/S/Shift の結果（side / jump / duck等）を20Hz目安でBroadcast
・HOSTがゲーム進行を管理
・ゲーム状態を12Hz目安で全PLAYERへBroadcast
・各PCでは自分の入力を即時反映し、他PLAYERは滑らかに追従
・HOSTが障害物成功/失敗を全PLAYERのPoseから判定
・誰かが失敗するとTEAM STUCK / TEAM FALL
・失敗したPLAYERが正しいアクションをすると再開
・BALLOON PUMPは各PCのSPACE入力をHOSTへ集約

■ 現在の設計上の位置づけ
V0.13は「本番ネットワーク完成版」ではなく MULTIPLAYER FOUNDATION です。
まず3台程度で、入室・READY・同時開始・個別操作・YOUカメラ・ロープ・障害物判定を実機確認するための版です。

次フェーズでは実機結果を見て、DBによる現在状態の永続化 / Self Heal / HOST再接続 / 通信遅延猶予 / 途中参加・切断などを固めます。

■ 操作
A / ←：左
D / →：右
W / ↑：ジャンプ（短押し低く / 長押し高く）
S / ↓：しゃがむ
Shift：ダッシュ入力（V0.13では個人Poseとして同期。チーム前進速度はHOST基準）
SPACE：TEAM MISSION
P / Esc：一時停止（HOSTのみ）
H：HUD表示切替

■ テスト
npm test
・V0.12 FLOW既存テスト
・人数別slotOffset
・RunnerMotion
・マルチプレイ用Pose判定
を通過済み。
ブラウザ上の複数PC Realtime実機テストはまだ未実施です。
