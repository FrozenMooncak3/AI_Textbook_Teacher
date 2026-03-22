# CCB 操作规范

> Claude 在与 Codex / Gemini 协作时必须遵守的操作规则。
> 每次会话开始时必读。

---

## 1. 语言规则

- 派发指令给 Codex / Gemini 时一律使用**英文**
- 与用户沟通用**中文**
- Claude 负责翻译

## 2. 任务派发流程

- **派发前必须给用户看中文翻译**，用户批准后再发英文指令
- **不在 Codex / Gemini 执行任务时往他们的 session 发消息**——会打断正在执行的任务
- 要查进度只通过 `git diff` / `git log` / 读文件，不碰他们的 session
- 等用户主动告知完成后再介入 review

## 3. 模型调度规则

根据任务复杂度分 3 档，Claude 派发指令时必须标注推荐档位 `[轻/标准/重]`，由用户切换模型：

| 档位 | Codex 配置 | Gemini 配置 | 适用场景 |
|------|-----------|-------------|---------|
| **轻档** | gpt-5.4-mini, medium | gemini-2.5-flash | 计划里代码写好了照抄、简单重命名、模板生成、格式调整 |
| **标准档** | gpt-5.4-mini, high | gemini-2.5-pro | 有明确需求的常规开发、小范围重构、已知 pattern 的 API 实现 |
| **重档** | gpt-5.4, high | gemini-2.5-pro | Bug 诊断（原因未知）、新 API 设计、跨模块重构、需要独立判断的架构决策 |

原则：默认用轻档，只在需要时升档。不用 xhigh——边际收益低，额度消耗高。

## 4. Git 规则

- **提交后必须 push**：commit 后必须 `git push origin master`，不得等用户提醒
- **GitHub**：`https://github.com/FrozenMooncak3/AI_Textbook_Teacher.git`，分支 `master`，git 身份 `zs2911@nyu.edu` / `FrozenMooncak3`

## 5. Review 规则

- Codex / Gemini 完成任务后，Claude 必须**真正读文件内容**做 review，不能只跑一个验证命令就说通过
- Review 通过后 push，然后更新 `docs/project_status.md` 和 `docs/changelog.md`
