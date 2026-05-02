# 角色系统 + admin 后台 + staging 环境 Brainstorm 进行中状态（WIP）

**创建日期**: 2026-05-02
**状态**: ✅ **决策 1+2 已实施（2026-05-03）/ 决策 5-7 paused** — admin 骨架已落地到生产；决策 3+4 已锁但未落地（无 UI 就无路径/守卫要建）；决策 5-7（admin UI / 邀请码 / ban）等 MVP 上线前 resume brainstorm。
**用途**: compact 防御 + resume 入口（5-7 重启时按本文件「Resume 入口」段）
**最终产出**: `docs/superpowers/specs/2026-05-02-role-admin-staging-design.md` + `docs/superpowers/plans/2026-05-02-role-base.md` ✅ 已实施 commits 5a8d5da/ee76b54/3fe14a8/5a457b0/a4e15e7

## 节奏（2026-05-02 校准）

| 决策 | 状态 | 落地动作 |
|------|------|----------|
| 0 scope 拆分 | ✅ 已锁 | — |
| 1 role 字段 | ✅ 已锁 → **本轮落地** | ALTER TABLE + UPDATE user_id=1 |
| 2 bypass | ✅ 已锁 → **本轮落地** | entitlements.ts + 改 3 处入口 |
| 3 auth 模式 | ✅ 已锁 → 不落地 | 复用 cookie session = 0 行代码改 |
| 4 路径设计 | ✅ 已锁 → 不落地 | 无 UI 就无路径要建 |
| 5 admin UI | ⏸️ paused | brainstorm 待 resume |
| 6 邀请码生成 | ⏸️ paused | brainstorm 待 resume |
| 7 ban 实现 | ⏸️ paused | brainstorm 待 resume |

## Resume 入口（决策 5-7 重启时）

未来要做监控/admin UI 时：
1. 读本 WIP 文件「已拍死的决策」段（决策 0-4），不重新讨论
2. 直接进「决策 5：admin UI 信息架构」
3. 还需 brainstorm：决策 5 / 决策 6（邀请码生成）/ 决策 7（ban 实现）共 3 条
4. 触发条件：MVP 基础功能完成 + 用户开始评估上线时刻

> ⚠️ compact 后恢复时**先读这个文件**，不要从 summary 重建——summary 会丢细节。

---

## 基础设定（不会变）

- **触发时机**：MVP 上线前散事，跟 staging 收尾、Cloud Build trigger 余尾一并清。M4.7 已关闭（5/2），M5 留存机制推迟到 MVP 上线后。
- **触发原因**：开发自测被 D7 quota 拦（5/2 临时 SQL update 给 user_id=1 加到 99 解锁）；生产环境若没 admin 后台无法监控真实用户行为 / 调单点 quota / 应对 abuse 案例。
- **scope**：
  - 角色系统：`users.role` 字段 + presign 端点 dev/admin bypass + 邀请码 +1 hour 流控 bypass
  - admin 后台：UI 看流水 + 改单用户 quota + 邀请码生成 + ban/unban 用户
  - staging 环境：MVP 上线前必建，新 R2 bucket / 新 Neon branch / 新 Cloud Run service / 新 OCR token 一套
- **工程量预估**：角色 + admin 1-2 天，staging 0.5-1 天
- **CCB 角色**：Codex 后端（schema + API + bypass 逻辑） / Gemini 前端（admin UI） / Claude PM
- **不变量**：
  - 业务表只记事实，权限独立（沿用 04-13 subscription-downgrade 调研原则）
  - 不引入第三方 admin 框架（保持 stack 纯 Next.js）
  - admin 路径全部需要 server-side guard，不依赖客户端隐藏
  - 现有 D7 quota 拦截逻辑不变，admin 仅 bypass 不重构

---

## 调研

- `docs/research/2026-04-13-subscription-downgrade-patterns.md` — 业务表只记事实 / entitlement 与 pricing 解耦 / Atlassian 模式 "Visible Menu, Locked Access" / `canUseTeaching()` 函数模式。**对本 brainstorm 启示**：role 不应作为业务字段嵌入；admin 应通过独立守卫函数（如 `requireAdmin(req)`）调用，bypass 逻辑也应抽成函数。
- `docs/superpowers/specs/2026-05-01-cloud-build-trigger-design.md` §6 — staging 推迟决策的来源，明确说明 staging 是 M5 收尾前独立工程，跟 Cloud Build 不绑。本 brainstorm 决定是否把 staging 提前到本次一起做。
- 待补：admin auth 调研（轻调研，🟡）— 需要查 cookie session 复用 vs 二次验证 vs IP 白名单的最佳实践
- 待补：staging 环境调研（轻调研，🟡）— Vercel Preview Deployments 是否能当 staging 用 / Neon branch 数据复制策略

---

## 已拍死的决策（不再讨论）

### 决策 0：scope 拆分（2026-05-02 拍板）

本 brainstorm 只覆盖**角色系统 + admin 后台**（8 决策内）。staging 环境推迟到 MVP 上线前一天单独 brainstorm。

**理由**：(a) 零 schema 依赖；(b) 触发时机不同；(c) 决策数膨胀风险；(d) staging 已有部分上下文可复用。

**拒绝合并的代价**：用户在 MVP 上线前再启动一次 staging brainstorm（预计 0.5 session，4 决策）。

### 决策 1：role 字段 schema（2026-05-02 拍板）

**方案 A**：`users.role TEXT NOT NULL DEFAULT 'user'`，应用层 enum 限两值 `'user' | 'admin'`。

**实施要点**：1 行 ALTER TABLE migration（含 DEFAULT 无需 backfill）；TypeScript 增加 `type UserRole = 'user' | 'admin'`；seed 时 `user_id=1` 写入 `'admin'`；ban 状态独立（决策 7）。

**拒绝**：多 boolean（状态空间膨胀）/ 独立 `user_roles` 表（MVP 过度工程）。

**未来扩展**：扩 `'staff'` / `'partner'` 仅扩 enum 值，无需迁表。

### 决策 2：bypass 实现位置 + 范围（2026-05-02 拍板）

**2A. bypass 范围**：admin 三层全 bypass（quota / 1h limit / monthly budget），但 `cost_log` 仍写（审计）。理由：admin 是高频测试身份，任一层不 bypass 都卡。

**2B. 实现位置**：抽 `src/lib/entitlements.ts` 的 `canBypassUploadLimits(user)` 函数；`presign route` / `confirm route` / `cost-meter incrementCost` 全调用。

**实施要点**：
- 新增 `src/lib/entitlements.ts`（导出 `canBypassUploadLimits(user: SessionUser): boolean`，内部 `return user.role === 'admin'`）
- `src/app/api/uploads/presign/route.ts` line 38-52：用 `if (!canBypassUploadLimits(user)) { ... }` 包住 `checkQuotaAndRateLimit` + `isBudgetExceeded`
- `src/app/api/books/confirm/route.ts`：用 `if (!canBypassUploadLimits(user))` 包住 `consumeQuotaAndLogUpload`
- `src/lib/services/cost-meter-service.ts` 的 `incrementCost`：bypass 写入但保留 `cost_log` 写入

**拒绝**：(B2) 改 4 个 service 函数签名加 role 参数 — 散落易漏；(B3) service 函数内部查 role — 多 1 次 DB query + 违反单一职责。

**调研档**：🟢 不调研（已有 `getTeacherModel(tier)` 同类付费墙模式可参照）。

### 决策 3：admin 后台 auth 模式（2026-05-02 拍板）

**方案 A**：复用现有 cookie session + 守卫层检查 `user.role === 'admin'`。

**关键约束**：现有 `src/middleware.ts` 跑在 Vercel Edge runtime，**不能连 Postgres**（pg 驱动需 Node runtime）。因此 admin role 检查不能在 middleware 层做，要放在 layout（决策 4 定具体位置）或 page server-side。

**实施要点**：
- 复用项目 cookie session（`src/lib/auth.ts` httpOnly + sameSite=lax + secure），不引入新 auth 概念
- admin 用普通邮箱+密码登录到 `/login`，登录后 cookie 中带 user_id；访问 admin 路径时 layout 查 DB 拿 role 判定
- 失败路径：未登录 → redirect `/login?next=...`；登录但 role !== 'admin' → redirect `/login`（决策 4 路径明示设计下，无需 404 隐身）

**威胁模型**：admin = user_id=1（你自己），唯一攻击面 = cookie 被盗。后果：改 quota / 偷邀请码 / ban，无金钱损失。损失可控（事后 admin 自己改回 5 分钟）。

**拒绝**：B 二次密码（工程量大+自己用增加摩擦）；C IP 白名单（网络不固定+维护烦+配错锁外）。

**未来加固路径**：异常时（access log 显示爆破）→ middleware 多 1 段或 admin layout 加二次密码 / 2FA / IP 白名单可叠加。

**调研档**：🟢 不调研。

### 决策 4：admin 路径设计（2026-05-02 拍板）

**方案 A**：admin 后台用公开命名 `/admin/*` 路径，守卫放在 `src/app/admin/layout.tsx` server-side function。

**实施要点**：
- 页面路径：`src/app/admin/page.tsx`（首页）、`src/app/admin/users/page.tsx`（用户列表，决策 5 细化）、其余 admin 子页同 pattern
- 守卫：`src/app/admin/layout.tsx` 顶部调 `requireUser(req)` + 检查 `user.role === 'admin'` → 不是踢回 `/login`
- API 路径：`/api/admin/*` 前缀；新增 helper `requireAdmin(req)`（在 `src/lib/auth.ts` 或 `src/lib/entitlements.ts`）
- middleware 不变（继续只查 cookie 存在性，不改）

**拒绝**：
- B 隐藏路径 `/internal/<random>/*`：security through obscurity 边际收益小，自己每次记隐藏 URL 烦
- C 子域 `admin.xxx`：部署架构改动大（DNS+cookie 跨域+独立 project），跟 staging 一档推迟

**调研档**：🟢 不调研（Next.js 15 App Router 标准）。

**未来扩展**：真要切隐藏路径仅改文件夹名 + 导航链接 10 分钟；真要切子域则 `/admin/*` 抽到独立 project。

---

## 待 brainstorm 的决策（按依赖顺序）

### 决策 5：admin UI 信息架构【下一个】

`users.role` enum vs `is_admin` / `is_dev` 多 boolean 列；nullable vs default 'user'；migration 策略。

### 决策 2：bypass 实现位置

presign 端点单点判断 / 中间件统一拦截 / service 层 entitlement 函数。涉及 D7 三层拦截（quota / 1h limit / monthly budget）哪些需要 bypass。

### 决策 3：admin 后台 auth 模式

复用现有 cookie session vs 二次密码确认 vs IP 白名单 vs 三者组合。需要 🟡 轻调研。

### 决策 4：admin 路径设计

`/admin` route group / `/(admin)` private route / 子域 `admin.xxx`。涉及 middleware 拦截位置 + auth flow 入口。

### 决策 5：admin UI 信息架构

哪些 dashboard / 列表页 / 详情页：用户列表（搜邮箱、看 quota、改 quota、ban）/ 流水（cost_log per user）/ 上传日志（book_uploads_log）/ 邀请码池 / 月度预算。

### 决策 6：邀请码生成机制

admin 手动单条 vs 批量生成 N 条 vs 自动随机池；过期机制（已用过期 / 时间过期 / 永久）；展示哪些字段（code / created_at / used_by）。

### 决策 7：ban/unban 实现

`is_banned` 新列 / `suspicious_flag` 复用 / `users.role='banned'`；ban 后用户行为（登录 / 看历史数据 / 上传新书）。

---

## 当前进度

- ✅ 决策 0（scope 拆分，2026-05-02）
- ✅ 决策 1（role enum，2026-05-02）→ **已落地 commits 5a8d5da + ee76b54**
- ✅ 决策 2（三层全 bypass + entitlement 函数，2026-05-02）→ **已落地 commits 3fe14a8 + 5a457b0 + a4e15e7**
- ✅ 决策 3（cookie session + layout role 检查，2026-05-02）→ 不落地（无 UI 就无守卫需建）
- ✅ 决策 4（公开命名 `/admin/*` + layout server-side guard，2026-05-02）→ 不落地（无 UI 就无路径要建）
- ⏸️ 决策 5（admin UI 信息架构）— MVP 上线前 resume
- ⏸️ 决策 6（邀请码生成机制）— MVP 上线前 resume
- ⏸️ 决策 7（ban 实现）— MVP 上线前 resume
- ✅ 决策 1+2 实施完成（2026-05-03）；下一步：MVP 上线前 brainstorm resume 决策 5-7

---

## 最终产出

- 角色系统 + admin 后台 spec：`docs/superpowers/specs/2026-05-02-role-admin-staging-design.md`（保留原文件名作历史 trail，但内容只覆盖角色 + admin；staging 段标注"已拆出，见后续单独 brainstorm"）
- 实施 plan：`docs/superpowers/plans/2026-05-02-role-admin.md`
- staging brainstorm 推迟入口：parking T1，触发条件 = MVP 上线评估时刻
- WIP 文件迁移完毕后保留作决策 trail，不删除
