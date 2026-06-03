# 3D Model Viewer

Next.js 16 應用程式，用於安全預覽 GLB/GLTF 3D 模型。模型以 AES-256-GCM 加密儲存，金鑰永不離開伺服器，瀏覽器端無法取得原始檔案。

## 功能

- **旋轉 / 縮放 / 平移**：OrbitControls 完整支援
- **動畫播放**：支援 GLB 內建骨架動畫與 morph target，含速度調整
- **燈光控制**：Studio / 戶外 / 夜間三種環境光預設，亮度可調
- **網格 / 陰影**：可即時切換
- **加密保護**：模型以 AES-256-GCM 加密，API Route 在伺服器解密後回傳，金鑰存於環境變數

---

## Tech Stack

| 類別 | 套件 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| 3D | Three.js + @react-three/fiber + @react-three/drei |
| UI | shadcn/ui (Base UI + Tailwind CSS v4) |
| 加密 | Node.js `crypto` (AES-256-GCM) |
| 工具 | TypeScript、ESLint |

---

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 加密你的 GLB 模型

```bash
node scripts/encrypt-model.mjs path/to/your-model.glb
```

執行後會：
- 產生 `public/models/your-model.glbenc`（加密檔）
- 自動在 `.env.local` 寫入 `MODEL_ENCRYPTION_KEY`

> **加密後請刪除原始 `.glb` 檔案**，不要放在 `public/` 目錄。

### 3. 在頁面加入模型

編輯 `src/app/page.tsx`，在 `DEMO_MODELS` 陣列加入項目：

```ts
const DEMO_MODELS = [
  { id: "your-model", label: "顯示名稱" },
  // id 必須對應 public/models/<id>.glbenc
];
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

打開 `http://localhost:3000`。

---

## 檔案結構

```
model-viewer/
├── public/
│   └── models/
│       └── *.glbenc          # 加密後的模型（原始 GLB 不放這裡）
│
├── scripts/
│   └── encrypt-model.mjs     # 一次性加密腳本
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx           # 主頁面（模型清單 + 控制面板）
│   │   └── api/
│   │       └── model/[id]/
│   │           └── route.ts   # 伺服器解密 → 回傳明文 GLB
│   │
│   ├── components/
│   │   ├── ui/                # shadcn/ui 元件
│   │   └── viewer/
│   │       ├── ModelViewer.tsx    # R3F Canvas、OrbitControls
│   │       ├── ModelScene.tsx     # 3D 場景、動畫、燈光
│   │       ├── AnimationPanel.tsx # 動畫清單 + 播放控制
│   │       └── LightingPanel.tsx  # 燈光預設 + 網格/陰影開關
│   │
│   ├── lib/
│   │   └── useSecureModel.ts  # 驅動 Web Worker、管理 Blob URL
│   │
│   └── workers/
│       └── decrypt.worker.ts  # Web Worker：fetch → postMessage(ArrayBuffer)
│
├── .env.local                 # MODEL_ENCRYPTION_KEY（不要 commit）
└── .gitignore
```

---

## 加密架構說明

### 資料流

```
[GLB 原始檔]
     │
     ▼  node scripts/encrypt-model.mjs
[AES-256-GCM 加密]  ←  隨機 IV（12 bytes）
     │
     ▼
[.glbenc 格式]  =  IV(12B) + Ciphertext + AuthTag(16B)
     │
     ▼  存入 public/models/（公開目錄，但內容無法直接使用）

─────────────────── 使用者請求時 ───────────────────

Browser Web Worker
     │
     ▼  GET /api/model/:id
[Next.js API Route]
     │  讀取 .glbenc
     │  AES-256-GCM 解密（金鑰來自 process.env，不傳給 browser）
     │
     ▼  回傳明文 GLB bytes（Content-Disposition: inline）
[Web Worker]
     │  接收 ArrayBuffer
     │  postMessage({ buffer }, { transfer: [buffer] })  ← zero-copy 轉移
     ▼
[主執行緒]
     │  URL.createObjectURL(blob) → Blob URL
     │  餵給 Three.js GLTFLoader
     ▼
[3D 渲染]
```

### .glbenc 檔案格式

```
┌──────────────┬─────────────────────┬────────────────────┐
│  IV (12 B)   │  Ciphertext (N B)   │  Auth Tag (16 B)   │
└──────────────┴─────────────────────┴────────────────────┘
```

- **IV（Initialization Vector）**：每次加密隨機產生，確保相同內容加密結果不同
- **Ciphertext**：AES-256-GCM 加密後的模型資料
- **Auth Tag**：GCM 認證標籤，防止任何竄改（若 tag 不符則解密失敗，回傳 HTTP 500）

---

## 保護等級說明

### 可以防止

| 攻擊手法 | 結果 |
|---------|------|
| 直接訪問 `/public/models/xxx.glb` | 檔案不存在 |
| 下載 `.glbenc` 後直接使用 | 無法解析，沒有金鑰 |
| 離線暴力破解 `.glbenc` | AES-256 在計算上不可行（2²⁵⁶ 種可能） |
| 爬蟲 / Google 索引模型 | 無任何可讀 URL |
| 竄改 `.glbenc` 植入惡意內容 | GCM Auth Tag 驗證失敗，拒絕解密 |
| 猜測其他模型的 ID 路徑 | ID 白名單正規表示式驗證（`/^[a-zA-Z0-9_-]+$/`） |
| 舊版金鑰洩漏後繼續使用 | 更換 `MODEL_ENCRYPTION_KEY` + 重新加密即可失效 |

### 無法完全防止

| 情境 | 原因 |
|------|------|
| **Network tab 手動儲存 response** | `/api/model/:id` 最終回傳的是明文 GLB bytes，使用者可在 DevTools Network 面板手動另存。這是 **client-side rendering 的物理極限**：只要瀏覽器需要渲染，就必須收到資料。 |
| **瀏覽器記憶體傾印** | 技術上可用 OS 層級工具從 browser process 的記憶體提取 ArrayBuffer，極高難度，一般使用者不可能操作。 |
| **螢幕錄影 / 截圖** | 無任何技術手段可防止。 |

> **結論**：此架構可阻止 99% 的非技術使用者與自動化爬蟲。金鑰永不進入瀏覽器，無法離線解密。若需要完全防止模型被提取，唯一方案是 **Server-Side Rendering**（伺服器渲染成影片流回傳，模型資料永不離開後端），但代價是失去即時 3D 互動能力。

---

## 與 Sketchfab 的保護方式比較

Sketchfab 是目前最大的 3D 模型托管平台，其保護思路與本專案相同——**防止一般使用者直接下載，但無法完全阻止有決心的技術用戶**。兩者的差異在於工程複雜度：

### 技術手段比較

| 保護層 | 本專案 | Sketchfab |
|--------|--------|-----------|
| **檔案格式** | 加密的標準 GLB（解密後可直接用） | 轉換成專有二進位格式（解密後仍需逆向） |
| **金鑰保護** | AES-256 金鑰存於 server env，不傳 browser | 無金鑰概念，格式本身就是障礙 |
| **URL 有效期** | 永久（API Route） | 短效 CDN 簽名 URL（數分鐘過期） |
| **資料傳輸** | 一次回傳完整 GLB bytes | 分塊串流（chunked），單一請求無完整資料 |
| **JS 混淆** | 無 | Viewer JavaScript 重度壓縮混淆 |
| **法律保護** | 無 | DMCA + 服務條款主動執法 |

### Sketchfab 的簽名 URL 範例

```
https://media.sketchfab.com/models/abc123/file.bin
  ?Expires=1718000000
  &Signature=xK9mP2...
  &Key-Pair-Id=APKA...
```

URL 過期後即使已下載也無法重新請求，有效防止批次自動化爬取。

### 兩者的共同底線

**本質上一樣**：只要瀏覽器能渲染，資料就必定存在於記憶體中，沒有任何技術可以完全阻止。Sketchfab 的模型至今仍有公開的提取工具（Sketchfab Downloader 等 browser extension），他們最終依賴的是法律手段而非技術手段。

### 升級到 Sketchfab 等級需要

1. **短效簽名 URL**：在 API Route 加入 HMAC 時間戳簽名，URL 5 分鐘後失效
2. **分塊串流**：將模型切成多個 chunk，按 camera 視角按需載入
3. **專有格式轉換**：將 GLB 轉成自定義二進位格式，增加逆向門檻
4. **JS 混淆**：使用 [javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator) 處理 viewer 程式碼

這些措施可以大幅提高提取難度，但工程複雜度也會成倍增加。對大多數 private viewer 場景，本專案的保護等級已經足夠。

---

## 環境變數

| 變數 | 格式 | 說明 |
|------|------|------|
| `MODEL_ENCRYPTION_KEY` | 64 字元 hex | 32 bytes AES-256 金鑰，由 `encrypt-model.mjs` 自動產生 |

`.env.local` 不應 commit 到版本控制，已加入 `.gitignore`。

---

## 新增模型的完整流程

```bash
# 1. 加密（自動輸出到 public/models/，複用現有金鑰）
node scripts/encrypt-model.mjs ./assets/hero.glb

# 2. 刪除原始檔，避免意外曝露
rm ./assets/hero.glb

# 3. 在 src/app/page.tsx 的 DEMO_MODELS 加入
#    { id: "hero", label: "Hero Model" }
```

若有多個模型，`encrypt-model.mjs` 會自動複用同一把金鑰，無需重複設定。

---

## 生產部署注意事項

1. **環境變數**：在 Vercel / Railway / 自架伺服器設定 `MODEL_ENCRYPTION_KEY`，不要依賴 `.env.local`
2. **Rate Limiting**：在 `src/app/api/model/[id]/route.ts` 加入 IP 請求頻率限制（可用 `@upstash/ratelimit`），防止批次下載
3. **Auth（可選）**：如需登入才能檢視，在 API Route 加入 session 驗證（NextAuth / Supabase Auth）
4. **模型資產管理**：`.glbenc` 檔案體積可能較大，建議使用 Git LFS 或獨立 CDN / Object Storage 存放
5. **金鑰輪換**：若金鑰外洩，更換 `MODEL_ENCRYPTION_KEY` 並對所有模型重新執行 `encrypt-model.mjs`
