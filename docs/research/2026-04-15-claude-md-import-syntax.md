---
date: 2026-04-15
topic: Claude Code CLAUDE.md @import 语法核实
type: research
status: resolved
keywords: [CLAUDE.md, import语法, 文件引用, Claude Code]
triage: 🟡
scope: 单点事实 / 易反悔 / 只服务当前决策
budget: 8 分钟
sources: { S: 1, A: 0, B: 0 }
---

## 问题
Claude Code 的 CLAUDE.md 是否支持 `@path` 导入机制自动内联引用文件，如果支持，确切语法和行为是什么？

## 发现

- **确切语法是 `@path/to/import`**（单个 `@` + 路径，无花括号、无空格、无引号）——
  > "CLAUDE.md files can import additional files using `@path/to/import` syntax. Imported files are expanded and loaded into context at launch alongside the CLAUDE.md that references them."
  [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) [S]

- **相对路径和绝对路径均支持；相对路径相对于"包含 import 的文件"解析，不是 cwd**——
  > "Both relative and absolute paths are allowed. Relative paths resolve relative to the file containing the import, not the working directory."
  [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) [S]

- **家目录 `~` 扩展受支持**（用于跨 worktree 共享个人指令）——
  > "To share personal instructions across worktrees, import a file from your home directory instead: `- @~/.claude/my-project-instructions.md`"
  [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) [S]

- **可嵌套 import，最大深度 5 hops**——
  > "Imported files can recursively import other files, with a maximum depth of five hops."
  [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) [S]

- **文件类型限制：文档举的例子是 README、package.json、`.md` 文件，即任何文本文件都可以**——官方示例：
  > "See @README for project overview and @package.json for available npm commands for this project."
  > "- git workflow @docs/git-instructions.md"
  [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) [S]

- **Token 成本：和直接写在 CLAUDE.md 里一样——启动时整份内联注入**——
  > "Imported files are expanded and loaded into context at launch alongside the CLAUDE.md that references them."
  [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) [S]

- **首次遇到"外部"import 需要弹窗批准；拒绝后永久禁用且不再提示**——
  > "The first time Claude Code encounters external imports in a project, it shows an approval dialog listing the files. If you decline, the imports stay disabled and the dialog does not appear again."
  [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) [S]

- **`@` import 在 CLAUDE.md 文件"任何位置"均可出现**，可嵌在散文中：
  > "reference them with `@` syntax anywhere in your CLAUDE.md"
  [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) [S]

- **常见用法是用它给 AGENTS.md 建桥**——
  > "create a `CLAUDE.md` that imports it ... Claude loads the imported file at session start, then appends the rest"
  示例：`@AGENTS.md`
  [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) [S]

- **失败行为：官方文档未明确说明"文件不存在会怎样"**（既没说"静默跳过"也没说"报错中止"）。推测从"import stays disabled"和 `InstructionsLoaded` 调试 hook 的存在看，缺失文件多半是"跳过并在加载日志里标记"而非启动失败，但**这是推断而非文档验证**。用户可以用 `/memory` 命令查看哪些文件实际被加载了。
  [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) [S]

## 结论
语法是 `@path`（无修饰，路径紧跟 `@`）；相对路径相对 import 所在文件解析，支持 `~` 和绝对路径；嵌套上限 5 层；token 开销与直接内联等价；文件不存在时的行为官方文档未明说，用 `/memory` 命令核实实际加载列表。

---

## 源质量审计

- **S 级来源数**：1（Anthropic 官方 Claude Code 文档 https://code.claude.com/docs/en/memory，原 https://docs.anthropic.com/en/docs/claude-code/memory 301 重定向到此）
- **A 级**：0（未调用社区二手源，因为官方 S 级已覆盖全部 6 问中的 5 问）
- **B 级**：0

**S 级满足的权威信号**（≥3）：
1. ✅ 一手（Anthropic 自己的产品文档）
2. ✅ 明确的产品拥有者（Claude Code 团队）
3. ✅ 提供可验证代码示例
4. ✅ 描述精确行为（5 hop 上限、审批弹窗、相对路径语义）
5. ✅ 时效性（含 v2.1.59、`CLAUDE_CODE_NEW_INIT` 等新特性，2026 年内容）

**URL 可达性**：
- https://code.claude.com/docs/en/memory ✅（200 OK，WebFetch 成功返回完整 markdown）
- https://docs.anthropic.com/en/docs/claude-code/memory ✅（301 → 上述新域）
- https://docs.claude.com/en/docs/claude-code/memory ✅（301 → 上述新域）

**声明**：所有数字/引用来自上述引用源，非训练记忆。失败行为一段已明确标注为"推断而非文档验证"。
