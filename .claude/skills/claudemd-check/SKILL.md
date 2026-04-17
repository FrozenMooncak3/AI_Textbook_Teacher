---
name: claudemd-check
description: CLAUDE.md 合规自检。自动触发：每次声称任务完成、准备 commit、或即将结束会话时，必须先跑此检查。手动触发：用户输入 /claudemd-check 时执行。
---

# CLAUDE.md 合规自检

动态读取 CLAUDE.md 作为唯一真相源，不硬编码任何规则。CLAUDE.md 变了，检查自动跟着变。

## 执行步骤

1. **读 CLAUDE.md**（使用 Read 工具）

2. **检查：会话初始化**
   找到「每次会话开始时」部分，提取所有必读文件。检查本次会话是否已读过每一个。未读的立即读取。

3. **检查：任务完成更新**
   读 `docs/project_status.md`、`docs/changelog.md` 和 `docs/architecture.md`，确认最后一条记录覆盖了本次工作。如果本次工作涉及页面、API、数据库、AI 角色或跨模块接口变化，architecture.md 必须已同步更新。

4. **检查：Git 状态**
   运行 `git status` 和 `git log origin/master..HEAD --oneline`。
   - 有属于本次工作的未 commit 文件 → 修复
   - 有未 push 的 commit → 立即 push

5. **检查：文件边界**
   找到「Claude 的文件边界」部分，提取可写和不可写的路径。回顾本次会话中自己写入或修改的文件列表，确认没有越界。用户明确授权越界的除外。

6. **检查：产品不变量**
   找到「产品不变量」部分，逐条回顾本次改动是否违反。

7. **检查：技术红线**
   找到「技术红线」部分，逐条回顾本次改动是否触碰。

8. **检查：禁止事项**
   找到「禁止事项」部分，逐条回顾本次改动是否违反：
   1. 禁止引入多用户 / 登录 / 注册系统
   2. 禁止添加 MVP 范围外的功能（社区、个性化推荐、游戏化等）
   3. 禁止未经确认就修改产品不变量
   4. 禁止在未更新 `docs/project_status.md` 和 `docs/changelog.md` 的情况下声称任务完成

9. **检查：沟通协议**（仅在本次涉及技术选项汇报时）
   找到「沟通协议」部分，检查是否遵守了汇报格式。

10. **检查：milestone-audit（仅里程碑收尾时）**
    如果本次会话涉及里程碑收尾，检查 `docs/journal/` 中是否有对应的 `m<N>-milestone-audit.md` 审计记录。没有则报 ✗ 并要求先执行 milestone-audit skill。

11. **检查：Skill 合规**
    读 session-rules skill（通过 CLAUDE.md @import 始终加载），回顾本次 session 实际发生的事件，逐条检查是否遵守。只审计实际发生的事，未发生的跳过。检查依据是 session-rules 的运行规则，不硬编码——规则变了，审计自动跟着变。

12. **检查：INDEX 同步**
    扫描以下目录，每个目录里的文件必须在对应 INDEX 中有一行：

    | 目录 | INDEX |
    |------|-------|
    | `docs/journal/*.md`（除 INDEX.md） | `docs/journal/INDEX.md` |
    | `docs/research/*.md`（除 INDEX.md / README.md） | `docs/research/INDEX.md` |
    | `docs/superpowers/specs/*.md` | `docs/superpowers/INDEX.md` |
    | `docs/superpowers/plans/*.md` | `docs/superpowers/INDEX.md` |

    ```bash
    # journal
    for f in docs/journal/*.md; do
      bn=$(basename "$f" .md)
      [ "$bn" = "INDEX" ] && continue
      grep -q "$bn" docs/journal/INDEX.md || echo "MISSING in journal INDEX: $bn"
    done
    # research
    for f in docs/research/*.md; do
      bn=$(basename "$f" .md)
      [ "$bn" = "INDEX" -o "$bn" = "README" ] && continue
      grep -q "$bn" docs/research/INDEX.md || echo "MISSING in research INDEX: $bn"
    done
    # superpowers
    for f in docs/superpowers/specs/*.md docs/superpowers/plans/*.md; do
      bn=$(basename "$f" .md)
      grep -q "$bn" docs/superpowers/INDEX.md || echo "MISSING in superpowers INDEX: $bn"
    done
    ```

    任一项报 MISSING → 检查失败，补 INDEX 后重跑。

13. **检查：Frontmatter schema**
    扫描 `docs/journal/*.md`、`docs/research/*.md`、`docs/superpowers/specs/*.md`、`docs/superpowers/plans/*.md` 中**本次新增或修改的文件**，检查是否含 `keywords:` 字段。缺失 → 报错并要求补齐。

14. **检查：MCP 占用**
    项目主工作区默认应 0 MCP 占用（参考 `docs/mcp-routing.md`）。扫描：

    ```bash
    # 项目级
    test -f .mcp.json && echo "PROJECT-MCP: $(cat .mcp.json | grep -oP '"[a-z_-]+": \{' | head -5)"
    # 用户级 mcpServers
    node -e "const c=JSON.parse(require('fs').readFileSync(process.env.USERPROFILE+'/.claude.json','utf8')); const k=Object.keys(c.mcpServers||{}); if(k.length)console.log('USER-MCP: '+k.join(','))"
    # Claude.ai connectors 开关
    node -e "const c=JSON.parse(require('fs').readFileSync(process.env.USERPROFILE+'/.claude.json','utf8')); if(c.cachedGrowthBookFeatures?.tengu_claudeai_mcp_connectors===true)console.log('CONNECTORS: on (Gmail/Calendar/Drive ~1.8k)')"
    ```

    如任一输出非空，向用户确认：
    ```
    检测到 MCP 占用：[列出来源与名字]
    用完了吗？y = 我帮你清理 / n = 保留
    ```
    用户回 y → 按来源分别清理：项目级 `.mcp.json` 直接 `rm`；用户级 `mcpServers` 改为 `{}`；connectors 开关改为 `false`。清理前先 `cp ~/.claude.json ~/.claude.json.bak-$(date +%Y%m%d-%H%M%S)` 备份。
    用户回 n → 跳过，不报错。

## 输出格式

```
CLAUDE.md 自检完成
✓/✗ 会话初始化：N/N 文件已读
✓/✗ 禁止事项：未违反 / 违反第 X 条
✓/✗ 状态文件：已更新 / 需更新
✓/✗ Git：已 commit + 已 push / 有遗漏
✓/✗ 文件边界：未越界 / 已授权越界 / 违规
✓/✗ 产品不变量：未违反 / 违反第 X 条
✓/✗ 技术红线：未违反 / 违反 X
⚠/✓ 沟通协议：本次无技术汇报，跳过 / 已遵守
✓/✗ 架构审计：已完成 milestone-audit / 非里程碑收尾，跳过
✓/✗ Skill 合规：
  - 派发任务：走了完整流程 / 未派发，跳过
  - 想法分流：已分流 N 条 / 无新想法，跳过
  - brainstorming 后记录：已写 journal / 未 brainstorm，跳过
  - 完成前验证：已执行 / 本次未声称完成，跳过
  - Git 隔离：在隔离分支上 / 无进行中里程碑，跳过
✓/✗ INDEX 同步：全部在索引中 / MISSING N 条
✓/✗ Frontmatter：新文件含 keywords / 缺 N 个
✓/⚠ MCP 占用：主项目 0 MCP / 检测到 [来源]（已询问用户）

结果：全部通过 / N 项需修复
```

如果有未通过项，先修复，再重新运行检查，直到全部通过。
