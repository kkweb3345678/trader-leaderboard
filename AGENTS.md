# 排行榜更新與交接規則

以下是使用者於 2026-10-15 明確指定的運作限制。修改榜單更新流程時必須遵守。

## 唯一寫入者

- 目前 `data.json` 與 `today-flash.json` 的唯一寫入者是 **GitHub Actions `leaderboard-fetch.yml`**。Ren 已於 2026-10-15 15:05 台北在 HANDOFF.md 確認 VM 退役、timer 不復存在且不會再寫入；Codex 已完成手動正式 flash 發布與 Pages hash 驗證，再開啟新制排程。
- 依 2026-10-15 HANDOFF 新規格，台北 08:00 每日全量（Solana today100/week100、Base today 最多 20 筆）寫 `data.json`；02:00／14:00／20:00 抓 Solana today20 寫 `today-flash.json`。舊半小時全量制已停用，不可重新啟用。
- 2026-10-21 kk 明確批准 Base 改為「最多 20 筆，照實顯示實收筆數與不足提示」。Base 1–20 筆有效樣本可發布，不補造、不混入舊資料；空資料、無效數值、重複地址仍停止發布。此項取代舊 Base 必須 20 筆的門檻，Solana today100/week100／flash20 門檻不變。
- 現有 `leaderboard-snapshots.yml` 只封存已推送的資料；不得把它視為榜單抓取／寫入流程，也不得順便啟用第二個寫入者。
- `BIRDEYE_API_KEY` GitHub Secret 配妥、Actions 抓取流程上線且驗證成功後，才可協調將唯一寫入者切換為 Actions。切換完成前不得讓兩端同時寫入。

## Actions 抓取流程

- 必須設定共用的 concurrency group，避免手動與排程 run 同時抓取／寫入／推送；執行中的工作不應被另一個 run 任意取消。
- 沿用 `sync.sh` 的同步順序：先 `git fetch`，再 `git merge --ff-only`，成功後才抓資料、寫檔、commit、push。不得用 force push 或覆蓋遠端來解分歧。
- Actions concurrency 不涵蓋 VM 的 flock。真正會推送 `data.json` 的手動驗證，須先在本對話協調不與 VM 執行重疊的交接安排；不可自行假定兩端已互斥。
- Secret 配妥後先手動驗證全量與快照候選檔的 **`updated_at`** 確實更新、筆數與內容正常。此時候選檔只進 artifact，正式檔不寫入。
- production 程式完成並通過手動驗證後，在 HANDOFF.md「給 Ren」區通知。Ren 確認 VM timer 停用、執行中程序結束並回覆最後正式資料時間／commit 後，才開啟 Actions 寫入與排程；收到先前 validation 驗收通過並不等於 timer 已停。
- Actions 全量 UTC cron 為 `0 0 * * *`，快照為 `0 6,12,18 * * *`。依觸發的 cron 決定模式，不能依延遲開跑時的時鐘判斷。排程延遲正常，應以檔案內時間驗收。
- 金鑰只放 Secret／受保護環境，不寫進 repo、前端、日誌或對話。

## 變更通知

- 以後凡修改任何 workflow 或 `sync.sh`，push 後必須在本對話明確告知改了什麼、是否影響寫入或排程，以及驗證結果。
- VM 每次執行會同步遠端，因此 push 不是單純保存程式；變更可能在下一輪直接被 VM 採用。
- 正確遠端為 `https://github.com/kkweb3345678/trader-leaderboard.git`。本機 origin 可能仍指向舊 owner；使用正確 URL，不依賴未核對的 origin。

## 最近一次中斷紀錄

使用者回報：VM 更換清空 `/etc` 的 timer 設定，且 VM 本地 8 筆未推送資料與遠端 39 筆錢包工作分歧。Ren 已重裝 timer、以遠端為準處理分歧、保留強化版 `sync.sh`，並手動推送 2026-10-15 12:14:35（台北）資料。

Codex 隨後獨立核對：12:31:23（台北）的下一筆資料已推上 main、封存 Actions 成功，公開 Pages 也顯示同一時間，今日／近週各 100 筆。這可確認新一輪更新成功；持續半小時更新仍以後續資料時間及 24 小時驗收為準。未推送的 8 筆 VM 本地資料不在這次已驗證的 GitHub 快照範圍內。

## 問題先自排

- 檢查或實作遇到問題（被擋、網址搬家、轉址、暫時性錯誤等），先自己排查排除：重試確認是否暫時性 → 找免費替代抓取方式 → 檢查網址搬家／轉址並更新來源 URL；排除不了才如實回報（來源、錯誤、已試方法），走待審／無法檢查機制。
- 紅線：不自動改返佣數字、不碰榜單寫入流程與排程、不宣稱沒驗證的事；要動這些先在 HANDOFF.md 回報等確認。
