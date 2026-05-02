# 角色系统 + admin 后台 + staging 环境设计

**日期**：2026-05-02（启动）/ 2026-05-03（决策 1+2 落地）
**状态**：✅ **决策 1+2 已实施 / 决策 5-7 paused（2026-05-03）** — admin 骨架（role 字段 + 三层 bypass + entitlement 函数）已落地到生产。决策 3+4 已锁但未落地（无 UI 就无路径/守卫要建）。决策 5-7（admin UI / 邀请码 / ban）等 MVP 上线前 resume brainstorm。
**已锁决策**：
- 0（scope 拆分）✅
- 1（role enum）✅ **已落地 commits 5a8d5da + ee76b54**（schema migration + User type 扩展）
- 2（bypass 范围 + entitlement 函数）✅ **已落地 commits 3fe14a8 + 5a457b0 + a4e15e7**（entitlements.ts + presign route + confirm route 4 处 wrap）
- 3（cookie session + layout 守卫）✅ → 不落地（无 UI）
- 4（公开命名 `/admin/*`）✅ → 不落地（无 UI）

**待 brainstorm**（MVP 上线前 resume）：决策 5（admin UI 信息架构）/ 6（邀请码生成机制）/ 7（ban 实现）

**触发**：M4.7 D7 quota 拦开发自测（5/2 临时 SQL bump user_id=1 至 99 解锁）；MVP 上线前需 admin 监控真实用户（决策 5-7 处理）

**实施总结**：5 个 codex commit + 1 个 docs commit / 15 单元测试（5 presign + 9 confirm + 2 entitlements）双向覆盖 admin bypass 与 regular user D7 拦截。`users.role` schema migration 应用到生产 Neon main 分支；user_id=1（`frozenmooncak3@gmail.com`）已 seed 为 admin。`canBypassUploadLimits(user)` 在 presign 端点跳过 `checkQuotaAndRateLimit` + `isBudgetExceeded`；在 confirm 端点跳过 4 处 `consumeQuotaAndLogUpload`（PDF cache hit / non-cache / PPTX cache hit / non-cache）。

---

## 1. 背景与范围

（决策 0 锁定 2026-05-02）本次 spec **仅覆盖角色系统 + admin 后台**：
- `users.role` 字段 + presign 端点 dev/admin bypass + 邀请码 1h 流控 bypass
- admin 后台 UI（用户列表 / quota 调整 / 流水 / 邀请码生成 / ban-unban）

**不覆盖** staging 环境（M5 收尾、抖音/小红书引流前一天独立 brainstorm，已 parking T1）。staging 与本 spec 零 schema 依赖。

---

## 2. 数据模型

### 2.1 users 表新增字段（决策 1 锁定 2026-05-02）

```sql
ALTER TABLE users
  ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
```

应用层约束（TypeScript 联合类型）：

```typescript
// src/lib/auth.ts
export type UserRole = 'user' | 'admin';

export interface SessionUser {
  id: number;
  email: string;
  role: UserRole;
  book_quota_remaining: number;
  // ... existing fields
}
```

**枚举值语义**：
- `'user'`（默认）：普通用户，受 D7 全部 3 层 quota 拦截
- `'admin'`：管理员，绕过 quota / 1h limit / monthly budget（决策 2 定细节），可进 admin 后台（决策 3-4 定细节）

**Migration 策略**：
- DEFAULT 'user' 保证现有用户零冲击
- 部署后 1 条 SQL `UPDATE users SET role = 'admin' WHERE id = 1;` 把开发账号升级
- 未来要扩 `'staff'` / `'partner'` 时仅需扩 TypeScript 联合类型 + entitlement 函数加 case，schema 不动

**拒绝方案**：
- ❌ 多 boolean（`is_admin` + `is_dev`）：状态空间组合爆炸，code 散落判断
- ❌ 独立 `user_roles` 表（多对多）：MVP 过度工程，1-3 角色不需要 join

**ban 状态不进 role enum**：ban 是状态（可逆 / 可独立标记），role 是身份（持久 / 单值）。决策 7 单独处理。

### 2.2 invite_codes 表（如需扩展）

待定。

---

## 3. 后端 API

### 3.1 bypass 逻辑（决策 2 锁定 2026-05-02）

#### 3.1.1 bypass 范围

admin（`user.role === 'admin'`）绕过 D7 三层拦截：
1. `users.book_quota_remaining ≤ 0` → 跳过
2. `book_uploads_log` 1 小时内已 ≥1 本 → 跳过
3. `monthly_cost_meter` ≥ 500 元 → 跳过

但**不 bypass**：
- `cost_log` 表写入（每次 LLM 调用审计仍记录，admin 行为可追溯）
- `book_uploads_log` 表写入（INSERT 仍发生，否则历史日志会缺失 admin 测试痕迹；只是查询时 admin 跳过 1h 限制）

#### 3.1.2 entitlement 函数（新增 `src/lib/entitlements.ts`）

```typescript
import type { SessionUser } from './auth';

/**
 * Admin 完全绕过 D7 上传三层拦截（quota / 1h limit / monthly budget）。
 * 用于：presign 预检 / confirm quota 消耗 / cost-meter 增量。
 * cost_log（每次 LLM 调用审计）不走此函数，admin 行为始终留痕。
 */
export function canBypassUploadLimits(user: SessionUser): boolean {
  return user.role === 'admin';
}
```

#### 3.1.3 调用点改造（3 处）

| 文件 | 修改 |
|------|------|
| `src/app/api/uploads/presign/route.ts:38-52` | 把 `checkQuotaAndRateLimit` + `isBudgetExceeded` 用 `if (!canBypassUploadLimits(user)) { ... }` 包住 |
| `src/app/api/books/confirm/route.ts` | `consumeQuotaAndLogUpload` 用同样 if 包住（需查清当前调用位置） |
| `src/lib/services/cost-meter-service.ts` 的 `incrementCost` | bypass 写入 `monthly_cost_meter`，但保留 `cost_log` INSERT（审计） |

**拒绝方案**：
- ❌ 改 4 个 service 函数签名加 `role` 参数：判断散落，未来加新 service 容易忘传
- ❌ service 内部查 `users.role`：每次多 1 次 DB query，违反 service 函数单一职责

### 3.2 admin auth 守卫（决策 3 锁定 2026-05-02）

#### 3.2.1 方案

复用现有 cookie session（`src/lib/auth.ts` httpOnly + sameSite=lax + secure），admin 路径加 middleware 检查 `user.role === 'admin'`。

#### 3.2.2 实现位置（决策 4 拍板后定 2026-05-02）

**关键约束**：`src/middleware.ts` 跑在 Vercel Edge runtime 不能连 Postgres，所以 role 检查不能在 middleware 做。

**落点**：
- **页面端守卫**：`src/app/admin/layout.tsx` 顶部 server-side function 调 `requireUser(req)` + 检查 `user.role === 'admin'` → 不是踢回 `/login`
- **API 端守卫**：每个 `/api/admin/*` endpoint 顶部调 `requireAdmin(req)` helper（新增到 `src/lib/auth.ts` 或 `src/lib/entitlements.ts`）

middleware 保留现状（只查 cookie 存在性），不改。

#### 3.2.3 失败路径

- 未登录访问 `/admin/*`：middleware 已先一步 redirect `/login?next=/admin/...`
- 登录但 role !== 'admin'：layout 守卫 redirect `/login`（直接踢出，不显示 admin 路径存在/不存在）
- API 失败：`{ success: false, error: 'Forbidden', code: 'FORBIDDEN' }` 403

#### 3.2.4 拒绝方案

- ❌ 二次密码：工程量大 + 自己用增加摩擦
- ❌ IP 白名单：网络环境不固定，维护烦 + 配错锁外面

#### 3.2.5 未来加固

发生异常（access log 显示爆破尝试）时，middleware 增量加：(a) admin 二次密码 / (b) TOTP 2FA / (c) IP 白名单。可叠加层数，无需重构。

### 3.3 admin endpoints（决策 4 路径设计 锁定 2026-05-02；具体 endpoints 待决策 5/6/7 细化）

**路径前缀**：`/api/admin/*`

**通用守卫**：每个 endpoint 顶部 `await requireAdmin(req)`（新增 helper），失败抛 `UserError('Forbidden', 'FORBIDDEN', 403)`。

**已规划 endpoints**（具体行为待决策 5 信息架构 + 决策 6 邀请码 + 决策 7 ban 拍板细化）：
- `GET /api/admin/users` — 用户列表（搜邮箱 / 看 quota / role / suspicious_flag）
- `PATCH /api/admin/users/[userId]/quota` — 修改单用户 `book_quota_remaining`
- `PATCH /api/admin/users/[userId]/ban` — ban / unban（决策 7 定字段）
- `GET /api/admin/uploads` — `book_uploads_log` 流水
- `GET /api/admin/cost` — `cost_log` + `monthly_cost_meter` 流水汇总
- `POST /api/admin/invite-codes` — 生成邀请码（决策 6 定生成模式）
- `GET /api/admin/invite-codes` — 邀请码列表（已用 / 未用）

## 4. 前端 UI

### 4.1 admin 路径与布局（决策 4 锁定 2026-05-02）

**路径模式**：`/admin/*` 公开命名，layout 守卫强制 admin。

**目录结构**：

```
src/app/admin/
├── layout.tsx        # server-side guard：requireUser + role check
├── page.tsx          # admin 首页（流水汇总，决策 5 细化）
├── users/
│   ├── page.tsx      # 用户列表
│   └── [userId]/
│       └── page.tsx  # 用户详情（改 quota / ban）
├── uploads/
│   └── page.tsx      # 上传流水
├── cost/
│   └── page.tsx      # 成本流水
└── invite-codes/
    └── page.tsx      # 邀请码管理
```

**导航**：admin layout 包含简易侧边栏（首页 / 用户 / 上传 / 成本 / 邀请码），普通用户的 `AppSidebar` 不出现 admin 入口。

**拒绝路径**：
- ❌ `/internal/<random>/*` 隐藏命名（security through obscurity 边际收益小）
- ❌ 子域 `admin.xxx`（部署架构改动大，跟 staging 一档推迟）

---

## 4. 前端 UI

（决策 4 / 5 / 6 待定）

### 4.1 admin 路径与布局

待定。

### 4.2 用户列表 / quota 调整 / 流水 / 邀请码 / ban

待定。

---

## 5. staging 环境

（决策 8-11 待定，仅合并 scope 时生效）

---

## 6. 测试策略

待定。

---

## 7. 实施顺序

待定（writing-plans 阶段处理）。

---

## 附录：变更 architecture.md 清单

待 brainstorm 结束后填。
