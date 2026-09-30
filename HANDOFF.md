# CHAIN RUSH V0.13 MULTIPLAYER FOUNDATION — 2026-09-30

## Goal
V0.12 FLOWを視覚・コースの基準として維持しつつ、固定 `YOU + BOT6` を廃止し、1〜7人の人間だけで同期テストできる構造へ変更。

## Added
- `source/network.js`
  - Supabase Realtime Presence / Broadcast
  - config未設定時の BroadcastChannel LOCAL TAB MODE
  - 4桁ROOM、最大7人、READY、HOST選定
- `config.js`
  - Supabase Project URL / anon or publishable key
  - poseHz / stateHz
- `RunnerMotion`
  - 個人のside / jump / duck / dash Poseをチーム進行から分離
- Host authoritative team flow
  - HOSTのみGameをstep
  - PLAYER PoseをHOSTへ集約
  - HOSTが障害物衝突 / TEAM STUCK / TEAM FALL / recoveryを判定
  - HOST state snapshotを他クライアントへ送信
- Dynamic roster visualization
  - ロビー人数 = キャラ人数
  - BOT補完なし
  - `slotOffset()`で1〜7人を中央揃え
  - 不要キャラ/ロープ/pumpを非表示
- Self-centered player camera
  - ワールド座標・キャラ順は全PC共通
  - camera X / lookAt Xのみ各クライアントのYOUへ追従
  - 端のPLAYERはコース端・崖側が大きく見える
- `offline.html`
  - V0.12の旧bundle `game.js`を使うオフライン退避版

## Transport
V0.13はDBを使わずPresence + Broadcastだけ。
目的はまず実機で「複数人として成立するか」を確認すること。
DB truth / reconnect self-heal / durable room stateは次段階。

## Important behavior
- ROOM作成者はhostPriority=0でHOST優先。
- Match開始時にrosterをfreeze。
- Match中のlive presence変化でslotを並べ替えない。
- local inputはRunnerMotionで即時描画。
- remote poseは20Hz程度、Three.js側でdamp。
- HOST game stateは12Hz程度で送信。
- non-hostはdistance/elapsedをtargetへdamp。

## Files
- `index.html`: multiplayer web version
- `offline.html`: V0.12 offline fallback
- `source/main.js`: V0.13 rendering + multiplayer orchestration
- `source/network.js`: transport / presence / rooms
- `source/engine.js`: Game + RunnerMotion + poseMatches + slotOffset
- `config.js`: Supabase credentials/config
- `game.js`: V0.12 bundled fallback only

## Known limitations / next hardening
- Browser multi-PC実機は未検証。
- Supabase Broadcast/PresenceだけなのでROOMはephemeral。
- HOSTがmatch中に落ちた場合のauthoritative failoverは未実装。
- network latency compensationは最小限。実測後にobstacle判定猶予を調整。
- mid-match joinはroster freezeのため次ゲームから参加。
- state snapshotは簡易。DB current truth + self healは次版。
- production版ではSupabase clientをローカルvendor化してCDN依存をなくす候補。

## Test
`npm test`
V0.12 flow regression + V0.13 motion/slot/pose tests.
