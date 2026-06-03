# 3D Model Viewer

Next.js 16 應用程式，用於安全預覽 GLB/GLTF 3D 模型。採用四層安全架構，從靜態檔案到網路傳輸全程保護，防止模型資料被隨意提取。

## 功能

- **旋轉 / 縮放 / 平移**：OrbitControls 完整支援
- **動畫播放**：支援 GLB 內建骨架動畫與 morph target，含速度調整
- **燈光控制**：Studio / 戶外 / 夜間三種環境光預設，亮度可調
- **網格 / 陰影**：可即時切換
- **Session 快取**：同一分頁內切換模型不重新下載（關閉分頁即清除）

---

## Tech Stack

| 類別 | 套件 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| 3D | Three.js + @react-three/fiber + @react-three/drei |
| UI | shadcn/ui (Base UI + Tailwind CSS v4) |
| 加密 | Node.js `crypto` (AES-256-GCM, ECDH P-256, HKDF) |
| Web Crypto | `crypto.subtle` (ECDH, HKDF, AES-GCM，Worker 內執行) |
| 工具 | TypeScript、ESLint |

---

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 加密 GLB 模型

```bash
node scripts/encrypt-model.mjs path/to/your-model.glb
```

執行後會：
- 產生 `public/models/your-model.glbenc`（AES-256-GCM 加密檔）
- 自動在 `.env.local` 寫入 `MODEL_ENCRYPTION_KEY` 與 `MODEL_TOKEN_SECRET`

> **加密後請刪除原始 `.glb` 檔案**，不要放在 `public/` 目錄。

### 3. 在頁面加入模型

編輯 `src/app/page.tsx`，在 `DEMO_MODELS` 陣列加入：

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

---

## 檔案結構

```
model-viewer/
├── public/
│   └── models/
│       └── *.glbenc              # AES-256-GCM 加密的模型（原始 GLB 不放這裡）
│
├── scripts/
│   └── encrypt-model.mjs         # 一次性加密腳本
│
├── src/
│   ├── app/
│   │   ├── page.tsx               # 主頁面（模型清單 + 控制面板）
│   │   └── api/
│   │       ├── model-token/[id]/
│   │       │   └── route.ts       # POST：ECDH 交換 + 簽發 token
│   │       └── model/[id]/
│   │           ├── route.ts       # GET：manifest（chunk 總數 / 大小）
│   │           └── chunk/[n]/
│   │               └── route.ts   # GET：從 cache 取 chunk → AES-GCM 加密回傳
│   │
│   ├── components/viewer/
│   │   ├── ModelViewer.tsx        # R3F Canvas、OrbitControls
│   │   ├── ModelScene.tsx         # 3D 場景、動畫、燈光
│   │   ├── AnimationPanel.tsx     # 動畫清單 + 播放控制
│   │   └── LightingPanel.tsx      # 燈光預設 + 網格/陰影開關
│   │
│   ├── lib/
│   │   ├── useSecureModel.ts      # 驅動 Web Worker、session 記憶體快取
│   │   └── server/
│   │       ├── modelToken.ts      # createModelToken / verifyModelToken / deriveSessionKey
│   │       └── plaintextCache.ts  # Server-side 60s 明文快取（解決重複解密）
│   │
│   └── workers/
│       └── decrypt.worker.ts      # ECDH 交換 → 取 token → 取 chunks → 解密 → 重組
│
├── .env.local                     # MODEL_ENCRYPTION_KEY + MODEL_TOKEN_SECRET（不要 commit）
└── .gitignore
```

---

## 安全架構總覽

本專案採用四層保護，每層對應不同的攻擊面：

```
┌─────────────────────────────────────────────────────────────────┐
│                        攻擊面 vs 保護層                           │
│                                                                   │
│  直接存取 public/   ──►  Layer 0：.glbenc 靜態加密               │
│  呼叫 API 無授權    ──►  Layer 1：HMAC 簽名 Token（5 分鐘 TTL）  │
│  Network tab 存檔   ──►  Layer 2 + 3：分塊 + Chunk 加密          │
│  重複大量下載       ──►  Layer 2：分塊強制多次請求               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 完整請求流程

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                      加密模型準備（離線）                          │
  │                                                                    │
  │  原始 GLB                                                          │
  │     │  node scripts/encrypt-model.mjs                             │
  │     ▼                                                              │
  │  AES-256-GCM(GLB, MODEL_ENCRYPTION_KEY, randomIV)                 │
  │     │                                                              │
  │     ▼  格式: [IV 12B][Ciphertext][AuthTag 16B]                    │
  │  public/models/<id>.glbenc  ← 公開 URL 可達，但內容無法解讀        │
  └──────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │               使用者點選模型（瀏覽器 Web Worker 執行）              │
  │                                                                    │
  │  Worker                             Server                         │
  │  ──────────────────────────────────────────────────────────────  │
  │                                                                    │
  │  ① 生成 P-256 ECDH keypair                                        │
  │    clientPriv（non-extractable）                                   │
  │    clientPub（可匯出為 hex）                                        │
  │                                                                    │
  │  ② POST /api/model-token/{id}                                     │
  │    body: { clientPublicKey: "04ab..." } ─────────────────────────►│
  │                                          生成 serverPriv/serverPub │
  │                                          sharedSecret =            │
  │                                            ECDH(serverPriv,        │
  │                                                 clientPub)         │
  │                                          wrappingKey =             │
  │                                            HKDF(sharedSecret,      │
  │                                                 "key-wrap")        │
  │                                          sessionKey =              │
  │                                            HMAC(tokenSecret,       │
  │                                                 id.exp:session-key)│
  │                                          wrappedKey =              │
  │                                            AES-GCM(sessionKey,     │
  │                                                    wrappingKey)    │
  │    { token, serverPublicKey, wrappedKey } ◄──────────────────────┤│
  │                                                                    │
  │  ③ 本機推導（完全離線，不需再次聯網）                               │
  │    sharedSecret = ECDH(clientPriv, serverPub)  ← 與 server 相同值 │
  │    wrappingKey  = HKDF(sharedSecret, "key-wrap")                  │
  │    sessionKey   = AES-GCM-decrypt(wrappedKey, wrappingKey)        │
  │    ✅ sessionKey 從未在網路上出現過                                 │
  │                                                                    │
  │  ④ GET /api/model/{id}?token=... ───────────────────────────────►│
  │    ◄── { totalChunks: 57, totalSize: 3876352 } ──────────────────┤│
  │                                                                    │
  │  ⑤ 並行請求所有 chunks                                             │
  │    GET /chunk/0?token  ─────────────────────────────────────────►│
  │    GET /chunk/1?token  ─────────────────────────────────────────►│  首次請求:
  │    GET /chunk/2?token  ─────────────────────────────────────────►│  讀 .glbenc
  │    ...（同時發出，不等順序）                                        │  解密一次
  │                                                                    │  存 Map(60s)
  │    ◄── [IV][ciphertext][authTag] ×57 ─────────────────────────────│  slice+加密
  │         加密 binary，Network tab 無法直接使用                       │
  │                                                                    │
  │  ⑥ 每個 chunk:                                                    │
  │    plainChunk = AES-GCM-decrypt(iv, sessionKey, data)             │
  │                                                                    │
  │  ⑦ 重組                                                           │
  │    assembled[0..64KB]   = chunk 0                                 │
  │    assembled[64..128KB] = chunk 1                                 │
  │    ...                                                             │
  │    postMessage(assembled.buffer, [transfer])  ← zero-copy 轉移    │
  └──────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │                        主執行緒渲染                                │
  │                                                                    │
  │  ArrayBuffer → Blob → URL.createObjectURL → GLTFLoader → 渲染    │
  │  sessionCache.set(modelId, buffer)  ← session 記憶體快取           │
  └──────────────────────────────────────────────────────────────────┘
```

---

## Layer 0：靜態檔案加密（.glbenc）

### 保護對象

`public/` 目錄在 Next.js 是靜態公開路徑。沒有這一層，任何人都可以直接 `GET /models/helmet.glb` 下載完整模型。

### 加密格式

```
┌──────────────┬─────────────────────┬────────────────────┐
│  IV (12 B)   │  Ciphertext (N B)   │  Auth Tag (16 B)   │
└──────────────┴─────────────────────┴────────────────────┘
```

- **IV**：每次加密隨機產生（12 bytes，符合 AES-GCM 建議）
- **Ciphertext**：AES-256-GCM 加密後的 GLB bytes
- **Auth Tag**：GCM 認證標籤，任何竄改都會導致解密失敗（HTTP 500）

### 金鑰管理

```
MODEL_ENCRYPTION_KEY（.env.local）
     │
     ▼  只存在於 process.env
Server API Route 在記憶體解密
     │
     ▼  明文 bytes 只存在於 Node.js process 記憶體
     從不傳給 browser
```

### 防止的攻擊

| 攻擊 | 結果 |
|------|------|
| `GET /models/helmet.glbenc` | 下載到加密 binary，無法解析 |
| 離線暴力破解 | AES-256 理論上不可行（2²⁵⁶ 種可能） |
| 竄改 .glbenc 植入惡意內容 | GCM Auth Tag 驗證失敗，解密拒絕 |

---

## Layer 1：HMAC 簽名 Token（5 分鐘 TTL）

### 保護對象

API Route 的訪問控制。沒有這一層，任何知道 URL 格式的人都可以直接呼叫 `/api/model/helmet/chunk/0`。

### 流程

```
  Worker                              Server
  ────────────────────────────────────────────────────────
  POST /api/model-token/{id}
  body: { clientPublicKey }  ────────────────────────────►
                                       existsSync(.glbenc)?  ← 只為存在的模型簽發
                                       exp = now + 300
                                       sig = HMAC-SHA256(
                                         MODEL_TOKEN_SECRET,
                                         "helmet.{exp}"
                                       ).slice(0, 32)
                             ◄──── { token: "helmet.{exp}.{sig}", ... }

  GET /api/model/helmet/chunk/3
  ?token=helmet.{exp}.{sig}  ────────────────────────────►
                                       解析 id / exp / sig
                                       exp > now?            ← 過期檢查
                                       HMAC 重算 → timingSafeEqual  ← 防 timing attack
                             ◄──── 通過 → 加密 chunk bytes
```

### Token 格式

```
helmet.1718000300.a3f9c2d1e4b5f6a7b8c9d0e1f2a3b4c5

└──┬──┘ └────┬───┘ └────────────────┬──────────────┘
  modelId  expiresAt(Unix sec)    HMAC-SHA256前32 hex字元
```

### 防止的攻擊

| 攻擊 | 結果 |
|------|------|
| 直接呼叫 chunk API 無 token | 401 Unauthorized |
| 使用 5 分鐘前的過期 token | 401 Unauthorized |
| 竄改 expiresAt 延長有效期 | HMAC 驗證失敗，401 |
| 暴力猜 HMAC（timing attack）| `timingSafeEqual` 無論對錯耗時一致 |

---

## Layer 2：分塊串流（64 KB chunks）

### 保護對象

防止 Network tab 單一請求得到完整模型。配合 Server 記憶體快取解決效能問題。

### 請求流程

```
  Worker                                Server
  ──────────────────────────────────────────────────────────────────
  GET /api/model/helmet?token  ────────────────────────────────────►
  ◄── { totalChunks: 57, chunkSize: 65536, totalSize: 3721216 } ───

  ┌─────────────────────────────── 並行發出 ──────────────────────┐
  │  GET /chunk/0?token  ──────────────────────────────────────►   │
  │  GET /chunk/1?token  ──────────────────────────────────────►   │
  │  GET /chunk/2?token  ──────────────────────────────────────►   │
  │  ...                                                            │
  └─────────────────────────────────────────────────────────────┘

  ◄── encrypted_chunk_0 ──────── ◄── encrypted_chunk_1 ────────
```

### Server 記憶體快取（解決重複解密）

沒有快取時，每個 chunk 請求都要讀整個 .glbenc 並全部解密：

```
  沒有快取（舊做法）：
  ─────────────────────────────────────────────────────────────
  chunk/0  → 讀 helmet.glbenc(3.7MB) → 解密 → slice [0..64KB]
  chunk/1  → 讀 helmet.glbenc(3.7MB) → 解密 → slice [64..128KB]
  chunk/2  → 讀 helmet.glbenc(3.7MB) → 解密 → slice [128..192KB]
  ×57 chunks → 解密 57 × 3.7MB = 211MB 的工作量

  有快取（現在）：
  ─────────────────────────────────────────────────────────────
  chunk/0  → 讀 .glbenc → 解密一次 → 存 Map(60s) → slice [0..64KB]
  chunk/1  → Map 命中 ─────────────────────────── → slice [64..128KB]
  chunk/2  → Map 命中 ─────────────────────────── → slice [128..192KB]
  ...（56 次快取命中，共 1 次解密）
  60秒後   → Map.delete() → GC 回收
```

快取使用 `Promise<Buffer>` 作為 Map 值，確保同時多個 chunk 請求不會觸發多次解密。

### 防止的攻擊

| 攻擊 | 結果 |
|------|------|
| 直接訪問 manifest URL | 只拿到 JSON（chunk 數量），沒有模型資料 |
| 只下載 chunk/0 | 只有前 64KB，無法組成完整 GLB |
| 腳本自動組合所有 chunk | 需有效 token + 解析 manifest + 57 次請求 + 按序重組，大幅增加自動化難度 |

---

## Layer 3：ECDH 金鑰交換 + Chunk AES-256-GCM 加密

### 保護對象

Network tab 中每個 chunk 的 response body。沒有這一層，即使有 token 驗證，chunk response 仍是可讀的 raw GLB binary。

### 金鑰永不傳輸的原理

ECDH（橢圓曲線 Diffie-Hellman）允許兩端各自計算出相同的 `sharedSecret`，而不需要在網路上傳輸它。

```
  Client Worker                         Server
  ──────────────────────────────────────────────────────────────────
  clientPriv (secret)                   serverPriv (secret, ephemeral)
  clientPub  (public)                   serverPub  (public)

  POST /api/model-token
  body: { clientPublicKey } ──────────────────────────────────────►
                                         serverECDH.generateKeys()
                                         共享秘密 = serverPriv × clientPub
                                         ↑ 橢圓曲線點乘法（交換律）
                             ◄──── { token, serverPublicKey, wrappedKey }

  共享秘密 = clientPriv × serverPub  ← 數學上與 server 計算結果相同！
  ──────────────────────────────────────────────────────────────────

  兩端各自推導，secert 從未在網路上傳輸 ✅
```

### Session Key 推導鏈

```
  sharedSecret（ECDH，雙方自行計算）
       │
       ▼  HKDF(SHA-256, salt=[], info="key-wrap")
  wrappingKey（32 bytes AES-256 key）
       │
       ├── Server：sessionKey = HMAC(tokenSecret, "id.exp:session-key")
       │                         │ 確定性：同一 token 每次結果相同
       │   AES-GCM(sessionKey, wrappingKey, randomIV) → wrappedKey → 傳給 client
       │
       └── Client：AES-GCM-decrypt(wrappedKey, wrappingKey) → sessionKey
                    ✅ sessionKey 到手，且從未出現在任何網路請求中

  Chunk endpoint 不需 ECDH：
  sessionKey = HMAC(tokenSecret, "id.exp:session-key")  ← 從 token 重新推導即可
```

### Chunk 傳輸格式

```
  Server 傳出（每個 chunk）：
  ┌──────────────┬──────────────────────────┬────────────────────┐
  │  IV (12 B)   │  Ciphertext (chunk 大小) │  Auth Tag (16 B)   │
  └──────────────┴──────────────────────────┴────────────────────┘
          ↑ 每個 chunk 獨立隨機 IV

  Client Worker 解密：
  crypto.subtle.decrypt({ name: "AES-GCM", iv }, sessionKey, data)
         │ sessionKey 是 non-extractable CryptoKey
         ▼
  plaintext chunk bytes（64 KB）
```

### 防止的攻擊

| 攻擊 | 結果 |
|------|------|
| Network tab 存 chunk response | 加密 binary，沒有 sessionKey 無法使用 |
| 攔截 token response 取 sessionKey | Response 中只有 `wrappedKey`（加密過的 sessionKey），沒有明文 sessionKey |
| 從 DevTools 取出 sessionKey | `CryptoKey` 設為 non-extractable，JS 無法讀取其原始 bytes |
| 重放舊 token 的 wrappedKey | Token 5 分鐘過期，HMAC 驗證失敗 |

---

## Session 記憶體快取（客戶端）

**不是安全層，是效能最佳化。**

```ts
// module-level Map，隨分頁存活
const sessionCache = new Map<string, ArrayBuffer>();
```

| 行為 | 說明 |
|------|------|
| 第一次點選模型 | 走完全部 Layer 0–3，解密後存入 Map |
| 同 session 再點同一模型 | Map 命中 → 直接建 Blob URL，0 網路請求 |
| 重新整理頁面 | module 重新載入，Map 清空，重新下載 |
| 關閉分頁 | 資料消失，無持久化 |

**安全取捨**：IndexedDB 會持久化解密後的模型（可從 DevTools 取出）。記憶體快取避免這個問題，以犧牲跨 session 快取為代價。

---

## 各層保護的攻擊面對照

| 攻擊手法 | L0 .glbenc | L1 Token | L2 分塊 | L3 ECDH+加密 |
|---------|:---:|:---:|:---:|:---:|
| 直接訪問 `/models/x.glbenc` | ✅ | | | |
| 呼叫 chunk API 無 token | | ✅ | | |
| 使用過期 token | | ✅ | | |
| Network tab 存單一 chunk | | | ⚠️ 部分 | ✅ |
| 下載所有 chunks 重組 | | | ⚠️ 增加難度 | ✅ 加密 binary |
| 竄改 .glbenc 植入惡意內容 | ✅ GCM | | | |

> **無法完全防止**：Heap snapshot / Worker message 攔截 / WebGL buffer 攔截。只要瀏覽器渲染，資料就必須存在記憶體中。這是 client-side rendering 的物理極限，Sketchfab 也面臨相同問題。

---

## 與 Sketchfab 的保護比較

### 技術手段對照

| 保護層 | 本專案 | Sketchfab |
|--------|--------|-----------|
| **靜態檔案加密** | ✅ AES-256-GCM (.glbenc) | ✅ 專有格式（.binz） |
| **短效簽名 URL** | ✅ HMAC token（5 分鐘） | ✅ CDN 簽名 URL（數分鐘）|
| **分塊串流** | ✅ 64 KB chunks | ✅ 分塊串流 |
| **傳輸層加密** | ✅ ECDH + AES-256-GCM | ✅（方式不公開）|
| **解密位置** | JavaScript Worker（可讀） | WebAssembly（難讀）|
| **程式碼混淆** | ❌ | ✅ 重度混淆 |
| **專有格式逆向難度** | 低（解密後即標準 GLB） | 高（.binz 需額外逆向）|
| **法律保護** | ❌ | ✅ DMCA + 服務條款執法 |

### 共同底線

兩者都面對相同的根本限制：**瀏覽器渲染必須取得明文資料，明文資料在記憶體中可被提取。**

Sketchfab 的模型至今仍有公開提取工具（browser extension），他們最終依賴法律手段而非純技術手段。本專案與 Sketchfab 在傳輸層的保護思路一致，差距在於解密端的混淆程度（JS vs WASM）。

### 若要進一步提升（非本專案範疇）

- **WASM 解密**：將 Worker 解密邏輯編譯為 WebAssembly，提高逆向難度
- **JS 混淆**：使用 `javascript-obfuscator` 處理 viewer 程式碼
- **專有格式**：轉換 GLB 為自定義二進位格式，解密後仍需逆向

---

## 環境變數

| 變數 | 格式 | 說明 |
|------|------|------|
| `MODEL_ENCRYPTION_KEY` | 64 字元 hex | 32 bytes AES-256 金鑰，由 `encrypt-model.mjs` 自動產生 |
| `MODEL_TOKEN_SECRET` | 64 字元 hex | HMAC-SHA256 簽名密鑰 + session key 推導基礎 |

`.env.local` 不應 commit 到版本控制，已加入 `.gitignore`。

---

## 新增模型

```bash
# 1. 加密（自動輸出到 public/models/，複用現有金鑰）
node scripts/encrypt-model.mjs ./assets/hero.glb

# 2. 刪除原始檔
rm ./assets/hero.glb

# 3. 在 src/app/page.tsx 加入
#    { id: "hero", label: "Hero Model" }
```

---

## 生產部署注意

1. **環境變數**：在 Vercel / Railway 設定 `MODEL_ENCRYPTION_KEY` 與 `MODEL_TOKEN_SECRET`
2. **Rate Limiting**：在 API Route 加入 IP 頻率限制（如 `@upstash/ratelimit`），防止批次爬取
3. **Auth（可選）**：如需登入才能檢視，在 token endpoint 加入 session 驗證
4. **大型模型**：`.glbenc` 建議用 Git LFS 或獨立 Object Storage 存放
5. **金鑰輪換**：若 `MODEL_ENCRYPTION_KEY` 外洩，更換後對所有模型重新執行 `encrypt-model.mjs`；若 `MODEL_TOKEN_SECRET` 外洩，更換後所有在途 token 立即失效
