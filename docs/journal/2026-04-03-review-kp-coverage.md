---
date: 2026-04-03
topic: 复习出题KP覆盖率改进方案
type: journal
status: parked
keywords: [复习, KP覆盖率, cluster, 出题策略]
urgency: normal
---

# 复习出题 KP 覆盖率

**类型**: idea
**状态**: parked
**日期**: 2026-04-03

## 想法

当前复习按 cluster 粒度出题（每 cluster 出 P 值数量的题），一个 cluster 内可能有多个 KP 但只出少量题，导致部分 KP 长期未被复习到。

两个改进方向：
1. **KP 轮换**：cluster 内每次复习选不同的 KP，几轮下来全覆盖
2. **全 KP 出题**：直接按 KP 粒度出题，弱 KP 多出、强 KP 少出

## 评估

- 纯后端逻辑调整，不影响前端和数据库 schema
- 可逆性：容易反悔
- 当前 cluster 粒度的设计意图是"短而频繁的复习"，改动需权衡复习时长
- 建议在用户实际使用复习系统后，根据体验反馈决定改法
