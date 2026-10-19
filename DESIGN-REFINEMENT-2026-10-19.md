# 介面統一與設計 skill 驗收 · 2026-10-19

## 這次完成的介面

沿用落袋研究室的深淺色、Research TC 字體、品牌與功能分類，以 Taste Skill 的 app-screen / Data terminal 方向整理介面。目標是資料工具的可讀性與操作效率，不把全站改成行銷頁。方向 seed 為 562054459，保留 palette/type；保留有文字的三類導覽、現有深藍底與品牌字標，優先遵守使用者要求的產品一致性。

- 26 個正式 HTML 共用 `product-refinement.css?v=taste-1`，統一 1240px 外框、字級、標題、邊距、控制元件、圓角與焦點外框。`scripts/build-seo.mjs` 同步補上此資產，避免重建文章後失去樣式。
- 首頁依「研究鏈上數據／比較工具與費率／建立基本觀念」排列三個任務列，分清主要入口與相關工具。保留真實榜首、來源時間與等待更新提示。
- 排行榜期間、排序與顯示模式使用底線表示選取，減少控制區的視覺重量。沿用現有篩選、分頁、來源時間與中性樣本說明。
- 錢包頁縮短摘要與重複統計，保留預設四個維度、自訂欄位、Tier 篩選和所有資料說明。手機保留收錄範圍文字，省去重複的大型統計。
- 幣種頁統計合併為一列，縮短控制區；手機保留搜尋、排序與多錢包篩選。
- 返佣頁沿用全站底色，分配說明改為可鍵盤展開的原生 details；所有說明、具名來源連結與官方數字仍在。
- 學習頁直接標示「Web3 學習中心」，縮短裝飾區，閱讀路線更早出現；文章內容與插圖未修改。

## Skill 安裝

依使用者提供的 Taste 網站，以及 Facebook reel `2054561525451897` 公開說明中的四個名稱確認官方來源。安裝前使用 Agent Skillguard 掃描，安裝後逐檔確認與審查版本位元組相同。

| Skill | 官方來源與固定版本 | 結果 |
|---|---|---|
| Taste / design-taste-frontend | Leonxlnx/taste-skill，a9c73c3d5dbf401e3e47f86e7b41f29ede1687df | 新裝 38 檔；0 active findings |
| Impeccable | pbakaus/impeccable，2f46b7a8b059af00d20dd13b64dbe165e7c6a742 | 新裝 62 檔；4 項警示人工核對後做版本／指紋限定排除；0 active、4 suppressed |
| Emil Design Engineering | emilkowalski/skills，2d228630ba1446365f614a108cb8252f1feda202 | 新裝主 skill 1 檔；0 active findings |
| UI/UX Pro Max | 已存在於使用者的 `.agents/skills/ui-ux-pro-max` | 保留現有安裝，不重複覆蓋 |

Impeccable 的四項警示分別涉及：舊命令別名說明、面向使用者的輸出格式、單條設計規則與檔案的例外，以及 localhost 預覽 token 的事件端點。不是傳送帳號密鑰到外部網站。記錄完整判讀理由與精確指紋；沒有宣稱掃描能證明絕對安全。其可選 engine、hooks 和常駐預覽服務沒有啟用。新 skill 會在下一回合可用。

## 驗證結果

- `node scripts/check-ui.mjs`：70 項既有回歸全部通過，涵蓋資料解析、排序、來源時間、導覽、幣種、返佣、課程及 SEO。
- `node --check scripts/build-seo.mjs`、`git diff --check`：通過。
- 42 個基本畫面：首頁／排行榜／對比／幣種／錢包／返佣／學習；1440×960、390×844 各深淺色，另有 768×1024 與 320×844 深色。紀錄實際 `innerWidth/innerHeight`，均無整頁水平溢出；axe 4.10.3 未回報 violations。
- 26 項實際互動檢查通過：三個首頁主入口、近七日交易量排序、表格與卡片、篩選空結果／重設、錢包詳情與 Escape、兩錢包比較、SOL 搜尋／明細／返回、幣種排序及清除、自訂欄位／恢復預設／Tier、返佣說明鍵盤展開／搜尋／具名來源彈窗、課程搜尋／文章、手機欄位與返佣操作。
- 表格按現有分頁呈現十列。一次測試把可見列數誤當全量 100 筆，已改為核對「100 / 100」樣本與非空分頁，而非修改產品迎合錯誤斷言。
- QA 工具曾同時啟動兩次 axe，造成兩筆測試工具錯誤；已將學習頁四個深淺色畫面依序重驗通過。這些工具只在 localhost 注入，不進正式 HTML。

同一組 1440×960 視窗及資料狀態，表格第一列距頁面頂端：

| 頁面 | 調整前 | 調整後 |
|---|---:|---:|
| 排行榜 | 659.66px | 617.88px |
| 幣種交易 | 815.91px | 721.22px |
| 錢包比較 | 868.16px | 712.47px |

Taste 靜態 lint：0 FAIL、32 WARN。兩項 glass 提示實際是 `backdrop-filter:none`；其餘是資料工具的區域標籤與現有內容／缺值破折號。保留合理的 app-screen 語意，不機械刪除。依工具限制，沒有執行 Taste 自帶的外部瀏覽器 inspector，改用 CUA 實際瀏覽器截圖、DOM 尺寸、互動與 axe；不宣稱該 inspector 通過。

## 證據、限制與維護

工作區證據位於 `../artifacts/taste-redesign/`：`installed-skills.json`、各 skill 掃描與 suppression 報告、`direction/direction.json`、`taste-lint.txt`、`before-metrics.json`、`final-browser-audit.json`、`interaction-checks.json`、`final-*.png`。`final-` 是最終驗收圖；早期 `round1-`、`after-` 留作修正過程，不作最終證據。最初因瀏覽器選中的暫存影片分頁不同，視窗設定未落在被測頁；最終紀錄已改為保存並核對實際視窗尺寸。

此輪不是全站 WCAG 認證，未做實機 Safari、實體手機或螢幕閱讀器測試；自動掃描未涵蓋所有互動狀態。沒有新增使用者成效或轉換率的主張。

這次沒有人工更改正式 JSON、付費 API、抓取程式、workflow、排程、concurrency 或唯一寫入者。變更集中於 HTML、共用 CSS 與 SEO 樣板。後續修改共用 CSS 時應更新快取版本並再次核對七頁；若需回復，revert 本輪 UI commit，保留之後自動更新的資料提交，不用 reset 或 force push。

正式 Pages 發布核對結果另記於 HANDOFF.md。
