# 操作細節驗收 · 2026-10-19

接續上一對話因模型容量中斷的未提交修改，依 Impeccable、Emil Design Engineering 與既有 Taste 設計方向完成驗證。保留全站品牌、資料口徑與功能。

| Before | After | Why |
| --- | --- | --- |
| 長對話框捲走關閉按鈕，背景仍可捲動 | 固定標題、鎖定背景；欄位視窗只捲動選項 | 手機直向與橫向都能關閉或套用 |
| 幣種有搜尋結果時沒有清除入口 | 結果數旁提供清除條件，保留排序並返回搜尋焦點 | 減少重新輸入與鍵盤操作 |
| 重新讀取只有停用按鈕 | 顯示讀取中及 aria-busy，完成後恢復 | 慢速與失敗時都有明確回饋 |
| 高頻排序淡入、觸控套用 hover 位移 | 資料立即顯示；位移限滑鼠並尊重減少動態 | 保持可讀性與操作穩定 |
| 鍵盤離開導覽仍留著選單 | 焦點離開即收合；手機讓目前項目進入可視範圍 | 導覽狀態跟隨使用位置 |

## 驗證

- `node scripts/check-ui.mjs`：70 項既有回歸、JS 語法與快取版本檢查通過。修正 `tokens.test.mjs` 寫死舊快取版本的斷言，仍要求載入帶版本的共用 shell；版本是否隨變更更新由既有 preflight 負責。
- `node --check scripts/build-seo.mjs`、`git diff --check` 通過。
- 18 項瀏覽器操作通過：清除與排序保留、慢速重讀、重讀失敗保留資料、首次錯誤重試、手機直向／橫向欄位視窗、來源視窗捲動、背景鎖定、Escape 與焦點返回、鍵盤導覽、排行榜排序。
- 21 組頁面／尺寸／主題狀態，無整頁水平溢出、axe 4.10.3 未報 violations。涵蓋七個主要頁面的 1440px 深色及 390px 淺色；幣種／錢包另驗 320／768／1440px 淺色、幣種 390px 深色。欄位視窗另測 844×390。
- Impeccable 靜態 detect 提示兩項：hover 色彩組合與表格外框無 padding。人工核對幣種頁沒有 `.button.primary`，一般按鈕 hover 使用淺色表面與深色文字；表格內距由儲存格提供（桌面 14px 18px），不是文字貼邊。保留合理的資料表結構，記錄提示，不宣稱掃描全綠。
- 獨立只讀審查未發現阻擋發布問題；審查者未重跑瀏覽器操作。
- 測試工具曾遇到 selector 角色差異、受限 DOM API 與短等待期限，已改用明確 selector／可讀 CSS 狀態再驗證。錯誤情境由 localhost 模擬 503，正式站不含測試注入。

證據在工作區 `../artifacts/skill-polish/`：`preflight.txt`、`interaction-checks.json`、`browser-audit.json`、`source-verification.json`、`impeccable-detect.txt`、`detector-review.json` 與 `verified-*.png`。未做實體手機、Safari／Firefox 或螢幕閱讀器完整認證。

## 本次工具安裝

使用者提供的 Facebook Reel `1249265464083377` 公開說明列出 Caveman、Ultracave 與官方 `JuliusBrussee/caveman`。固定來源提交 `bad48a0e1df55e05e3f52249afa35ecc1909ee76`，Agent Skillguard 安裝前掃描四個 Markdown 檔案，0 active、0 suppressed；人工核對後以 Skill Installer 安裝 `skills/caveman`、`skills/ultracave` 至使用者 Codex skills 目錄，四檔 SHA-256 與審查內容一致。

安裝範圍為影片的回覆風格 skills；沒有安裝 proxy、Auto、hooks、CLI 常駐服務或修改帳號設定。下個回合可用 `$caveman`、`$ultracave`；`stop caveman` 恢復一般風格。此回合僅審查／安裝，未啟用其風格。安裝證據在 `../artifacts/caveman-install/`。

## 發布與資料完整性

發布前以 fast-forward 整合遠端 `6cb6697` 自動來源檢查紀錄。本輪 UI diff 不含正式 JSON、抓取程式、workflow、sync.sh、排程或 concurrency，沒有呼叫付費 API。26 個正式 HTML 與 SEO 產生器同步資產版本 `polish-1`。正式 Pages 成功狀態及公開資產核對另記 HANDOFF.md。
