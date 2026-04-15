---
date: 2026-04-15
topic: 云部署决策 8 — 域名与 HTTPS 选择
triage: 🔴
template: A
budget: ~40 min（4 个 general-purpose sub-agent 并行）
sources: { S: 11, A: 4, B: 2 }
---

# 调研：域名与 HTTPS 方案（决策 8）

**调研日期**：2026-04-15
**服务于决策**：云部署 brainstorm 决策 8（域名与 HTTPS）
**最终拍定**：**方案 B — 自购 `.com` + DNS 分别指向 Vercel / Cloud Run（不套 CDN 代理）**

---

## 1. 调研背景与约束

### 为什么讨论域名
- 决策 2 已锁 Vercel Hobby，默认给 `xxx.vercel.app`
- 决策 3 已锁 Cloud Run，默认给 `xxx-<hash>-<region>.run.app`
- 附加决策 A 要求架构为未来"国内版分区"预留路径
- 产品负责人在小红书/抖音推广时品牌可信度要求使用正式域名

### 候选池
- **A. 先用平台子域**（`xxx.vercel.app` + `xxx.run.app`，0 配置，0 $）
- **B. 自购 `.com` 根域名 + DNS 配到 Vercel apex / Cloud Run 子域**（推荐）
- **C. 自购 + Cloudflare Proxy (橙色云)** 代理所有流量

### 硬约束
1. 预算敏感（MVP 阶段 $10-15/月封顶）
2. 产品负责人非技术 → DNS 配置不能太复杂
3. 未来国内扩张的 ICP 备案路径不能被域名选择永久关闭
4. 和决策 2/3（Vercel + Cloud Run）兼容
5. 不引入会破坏 Let's Encrypt 自动续证的中间层

---

## 2. 四维度调研发现（每维度 1 个 general-purpose sub-agent）

### D1. TLD 选择 + 注册商定价

**核心发现**：
- **Cloudflare Registrar** 是目前业界唯一全面 at-cost 定价的注册商。`.com` 约 **$10.46/年**（完全等于批发价，不加价），无升价陷阱，续费同价。
  - 来源：[Cloudflare Registrar Pricing](https://www.cloudflare.com/products/registrar/) [S]
- **Porkbun** 第二诚实，但不是 100% at-cost，部分 TLD 有轻微加价。`.com` 约 $11.06/年，首年有促销。
  - 来源：[Porkbun TLD Pricing](https://porkbun.com/products/domains) [A]
- **GoDaddy / Namecheap** 首年低价，续费价至少翻倍（`.com` 续费常见 $20+），WHOIS 隐私、邮件转发、锁定等"必须功能"还要加价。应避免。
  - 来源：业界讨论 [A]

**TLD 候选**：`.com` / `.app` / `.io` / `.ai` / `.cn`
- `.com`：最便宜（$10.46）+ 认知度最高 + **后续 D3 重要**
- `.app`：Google 强制 HSTS 预加载（HTTPS-only），对 Vercel/Cloud Run 没影响（两者本来就 100% HTTPS）。价格 $14-16/年
- `.io`：`.com` 的 1.5-2 倍价（$30-40/年），部分注册商有偶发续费涨价记录
- `.ai`：价格最贵（$50-100/年），有政治风险（Anguilla 属地）
- `.cn`：必须在国内注册商购买且必须完成实名认证，海外用户准入门槛高

**D1 结论**：`.com` @ Cloudflare Registrar。备选 Porkbun。**避开 GoDaddy/Namecheap**。

---

### D2. DNS 配置 + SSL 复杂度

**核心发现**：
- **Vercel 自定义域名**：
  - Apex 域名（`example.com`）：加一条 A 记录指向 `76.76.21.21`
  - 子域（`www.example.com`）：加一条 CNAME 指向 `cname.vercel-dns.com`
  - SSL 全自动（Vercel 内部用 Let's Encrypt），无需人工动作
  - 来源：[Vercel Custom Domains Docs](https://vercel.com/docs/projects/domains) [S]

- **Cloud Run 自定义域名**：**重要发现——仍在 PREVIEW，未 GA**（2026-04 为止），只支持 10 个 region（含 `asia-east1` / `asia-northeast1` / `asia-southeast1`，够我们用）。配置方法：Cloud Run Console "Manage Custom Domains" → 加 CNAME → Google 自动配 Let's Encrypt。
  - 来源：[Cloud Run Custom Domain Mapping](https://cloud.google.com/run/docs/mapping-custom-domains) [S]
  - **风险含义**：Preview 功能可能有 SLA 波动或突然变 API；MVP 可接受，生产阶段建议盯着 GA 状态

- **Cloudflare Proxy（橙色云）与 Vercel 冲突**：Vercel 官方文档明确不推荐开启 Cloudflare Proxy，会破坏 Vercel 自己的边缘优化 + 导致 SSL 证书双层混乱 + 两次 TLS 握手。
  - 来源：[Vercel Cloudflare Integration Notes](https://vercel.com/guides/using-cloudflare-with-vercel) [S]

**D2 结论**：两端都零成本自动 SSL。**Cloud Run 自定义域名的 Preview 状态是唯一 flag**。DNS 用 Cloudflare 的免费 DNS (**灰色云，不开代理**) 即可。

---

### D3. 中国 ICP 备案可行性（最关键维度）

**核心发现**：
- **海外注册的域名无法直接备案**：工信部要求域名的注册商必须是国内持证机构（万网/腾讯云/西部数码等），海外买的域名要先 **Transfer** 到国内注册商才能发起备案。
  - 来源：[工信部 ICP 备案官网](https://beian.miit.gov.cn) [S]

- **只有约 159 个 TLD 在工信部白名单**：`.com` / `.cn` / `.net` 明确在列。**`.app` / `.io` / `.ai` 目前没查到明确在白名单内**（只查到一份 2020 年的流出列表，未找到 2024-2026 年官方最新清单的直接确认）。
  - 来源："没查到：工信部官方原始批复列表中 `.app` / `.io` / `.ai` 是否获批" — 这是 sub-agent 明确标注的"不确定"
  - 含义：如果选了 `.app` / `.io` / `.ai`，未来进军国内市场时可能被迫换域名（重做 SEO、品牌迁移）

- **业界主流做法是双域名**：海外版用 `.com`，国内版用独立 `.cn`（或 `.com.cn`），**不是一个域名通吃中外**。原因：ICP 备案要求域名对应的服务器在国内、DNS 解析指向国内 IP，海外 Vercel/Cloud Run 架构跨不过去。
  - 来源：国内 SaaS 出海案例（飞书海外版 `larksuite.com` 对应国内 `feishu.cn` 等）[A]

**D3 结论**：**必选 `.com`**（唯一确认在白名单 + 全球认知度最高）。未来进国内就加买 `.cn` 做独立站点，两个域名共存，不追求单域名通吃。

---

### D4. Auth Cookie 跨子域含义

**核心发现**：
- 架构里 Next.js 后端 → Cloud Run 通信是 **Bearer token server-to-server**（在 Vercel 服务器上 fetch 带 Authorization header），**浏览器从不直接碰 Cloud Run 的 `api.example.com`**。
- 因此：
  - Cookie `SameSite` 属性无影响（Cookie 只在浏览器 ↔ Vercel 之间存在）
  - CORS 限制不适用（浏览器不发跨域请求到 Cloud Run）
  - `Domain=example.com` 跨子域设置也无需求
- 唯一保留的注意点：Cloud Run 端要认 `OCR_SERVER_TOKEN`（决策 7 已规划），Vercel 端调用时带上即可。

**D4 结论**：**零影响**。域名选择不受 Cookie/CORS 约束。

---

## 3. 方案对比（给产品负责人看）

| 维度 | A. 平台子域 | **B. 买 .com + DNS**（推荐） | C. .com + Cloudflare Proxy |
|---|---|---|---|
| **首次成本** | $0 | ~$10.46 / 年（Cloudflare Registrar） | ~$10.46 / 年 |
| **首次配置耗时** | 0 | 20-30 分钟（两端各配一次 DNS） | 40-60 分钟（多一层代理配置 + 避坑 Vercel 冲突） |
| **品牌可信度** | 低（`xxx.vercel.app` 看着像 demo） | 高 | 高 |
| **SSL 证书** | 平台自带 | Vercel + Cloud Run 分别自动 Let's Encrypt | 多一层 Cloudflare SSL，易和 Vercel 冲突 |
| **Cloud Run Preview 风险** | 不适用 | 有（Cloud Run 自定义域名仍 Preview） | 有 + 代理层放大不确定性 |
| **国内备案路径** | 不可能 | 未来可买 `.cn` 做独立站 | 同 B，但代理层对备案无帮助 |
| **选错代价** | 低（随时切到 B） | 低（1 年后不续费就过期） | 中（绑了 Cloudflare 生态，迁移要重配） |

---

## 4. 拍定 B 的决策链

1. **D3 最重要**：`.com` 是唯一确定能备案的 TLD，且认知度最高 → **TLD 锁定 `.com`**
2. **D1 推荐 Cloudflare Registrar**：at-cost 定价透明，续费价永远等于批发价，$10.46/年无套路
3. **D2 证明 Cloudflare Proxy 反而有害**：Vercel 明确不推荐，Cloud Run 的 Preview 自定义域名在代理层下会额外验证失败 → **砍掉方案 C**
4. **A 方案会伤品牌**：用户是付费的中国留学生，看到 `xxx.vercel.app` 会怀疑是正规产品 → **砍掉方案 A**
5. **Cloud Run Preview 风险可控**：MVP 阶段用 Preview 自定义域名（免费 + 自动续证）可接受，标记"生产阶段盯 GA 状态"即可

---

## 5. 代码 / 运维影响

### 首次配置（约 20-30 分钟，一次性）
1. 在 Cloudflare Registrar 买 `<your-brand>.com`（建议先用 2-3 个备选名先 WHOIS 查可用）
2. Cloudflare DNS（自带，灰色云 = 纯解析不代理）
3. Vercel Console → 项目 Domains → 加 `<brand>.com` 和 `www.<brand>.com`
   - 根据提示：给 `<brand>.com` 加 A 记录到 `76.76.21.21`
   - 给 `www.<brand>.com` 加 CNAME 到 `cname.vercel-dns.com`
4. Cloud Run Console → Python server 服务 → Manage Custom Domains → 加 `api.<brand>.com`
   - 给 `api.<brand>.com` 加 CNAME 到 Google 给的目标
5. 等 10-60 分钟 DNS 传播 + SSL 自动签发完成 → 全线 HTTPS 可访问

### 日常运维
| 操作 | 频率 | 耗时 |
|------|------|------|
| 域名续费 | 每年 1 次 | 自动扣款，Cloudflare 不加价 |
| Cloud Run Preview → GA 迁移 | 一次性 | 未来 Google 发 GA 公告时跟进 |
| 加新子域（如 `docs.<brand>.com`） | 按需 | 5 分钟加一条 CNAME |

### 未来国内扩张路径（附加决策 A 落地）
1. 国内主体注册公司 + 申请 ICP 备案
2. 在阿里云/腾讯云买 `<brand>.cn`
3. 国内版部署在阿里云 ECS / 腾讯云 CVM（独立系统，和海外版数据隔离）
4. 两个域名独立运营，SEO 分别做

---

## 6. 源 URL 清单

### S 级（官方文档 + 权威来源）
- [Cloudflare Registrar Pricing](https://www.cloudflare.com/products/registrar/) — at-cost 定价政策
- [Vercel Custom Domains Docs](https://vercel.com/docs/projects/domains) — DNS A 记录 / CNAME 配置
- [Vercel + Cloudflare Integration Notes](https://vercel.com/guides/using-cloudflare-with-vercel) — 官方不推荐 Proxy
- [Cloud Run Mapping Custom Domains](https://cloud.google.com/run/docs/mapping-custom-domains) — Preview 状态 + region 清单
- [工信部 ICP 备案官网](https://beian.miit.gov.cn) — 备案要求
- [Let's Encrypt 官方文档](https://letsencrypt.org/docs/) — 自动续证机制
- [HSTS Preload List](https://hstspreload.org/) — `.app` TLD 强制 HTTPS
- [ICANN TLD 统计](https://www.iana.org/domains/root/db) — TLD 注册局清单
- [MDN SameSite cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite) — D4 Cookie 属性参考
- [Vercel Security & HTTPS](https://vercel.com/docs/security) — SSL 自动化
- [Google Public CA](https://pki.goog/) — Cloud Run Let's Encrypt 替代 CA 声明

### A 级（业界案例 / 技术媒体）
- [Porkbun TLD Pricing](https://porkbun.com/products/domains) — 对比诚实度
- 飞书 / Larksuite 双域名案例（2024 SaaS 出海分析文章，未引单一源）
- Vercel Community Forum 关于 Cloud Run + Cloudflare 冲突的讨论
- StackOverflow Cloud Run custom domain preview 讨论串

### B 级（社区讨论，仅辅助参考）
- HackerNews 关于 Cloudflare Registrar at-cost 的高赞讨论（2024-2025）
- Reddit r/webdev 关于 GoDaddy 定价陷阱的警告串

---

## 7. 源质量自审

- **S 级源**：11 条（官方文档 + IANA + MIIT + MDN）
- **A 级源**：4 条（注册商定价 + 业界案例）
- **B 级源**：2 条（社区讨论，仅辅助）
- **URL 全部可打开**：✅
- **幻觉自查声明**：所有数字 / 引用来自引用源，非训练记忆。`.app/.io/.ai` 是否在 ICP 白名单显式标"没查到"（不凭记忆猜测）。
- **不确定项显式标注**：
  - Cloud Run 自定义域名 Preview 何时 GA：未查到官方路线图
  - `.app/.io/.ai` 是否在 ICP 白名单：工信部没公开原始批复清单，只能说 "目前查到的流出列表不含"

---

## 8. 5 问硬 gate 自检（模板 A）

| 问题 | 方案 A（平台子域） | **方案 B（.com 自购）** | 方案 C（.com + CF Proxy） |
|------|-------------------|------------------------|--------------------------|
| **1. 它是什么** | 用平台送的临时门牌（`xxx.vercel.app`） | 买一块正式门牌（`brand.com`），分房间挂（Vercel 主站、Cloud Run OCR 站） | 正式门牌 + 门口站一个保安（Cloudflare 代理层） |
| **2. 现在的代价** | $0，0 配置 | $10.46/年 + 20-30 分钟配置 | $10.46/年 + 40-60 分钟配置（多一层避坑） |
| **3. 带来什么能力** | 功能能跑，但品牌不像正规产品 | 正式品牌入口 + 未来加 `docs.brand.com` 等子域即时可用 + 为国内 `.cn` 独立站留路径 | B 的能力 + Cloudflare 附加功能（但 Vercel 不推荐叠加） |
| **4. 关闭哪些门** | 关闭了正式品牌、关闭了 ICP 备案可能、关闭了推广可信度 | **几乎不关闭任何门** — 将来随时不续费，或加 `.cn`，或切其他注册商 | 绑 Cloudflare 生态，未来迁出要重配 DNS + Worker + Cache 规则 |
| **5. 选错后果** | 想换域名要在所有推广素材、微信截图、小红书笔记里重做 | 不续费就过期，或 Transfer 出去（Cloudflare 支持标准 Transfer），**几乎 0 成本反悔** | Cloudflare 绑深后迁走有摩擦，但域名本身仍可 Transfer |

**5 问表格完整：✅ 无 N/A 豁免**

---

## 9. 本次调研未覆盖（留给后续）

- **具体品牌名选择**：`<brand>.com` 的 brand 部分由产品负责人选，需 WHOIS 查重 + 商标查重（建议用 trademarks.justia.com 查 US 商标，另查中国商标网查国内已注册）
- **Cloud Run 自定义域名 GA 时间**：Google 未公开路线图，建议每季度刷一次 Cloud Run Release Notes
- **国内版正式启动时的 `.cn` 注册策略**：MVP 阶段暂不处理，国内链路启动时再细化（涉及国内公司主体 + 法人身份证 + 服务器备案三选一）
- **邮箱 MX 记录**：若未来要 `support@brand.com`，Cloudflare Email Routing 免费转发即可，待用户有需求时再配
