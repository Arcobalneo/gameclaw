# 2026-03-12 AI-native 设计准则迁移计划

## Goal

将 `gameclaw` 仓库中的旧 GDC 参考文档替换为一份更适合作为长期唯一准则的 `AI-native` 设计规则清单，并在仓库规则中明确：以后设计任何新游戏或优化任何老游戏前，都必须先参考这份文档。

## Scope

- 删除旧的 `docs/references/gdc-game-design-insights.md`
- 新增唯一设计准则参考文档（精炼版 20 条规则）
- 更新 `AGENTS.md`，明确该文档是唯一设计准则参考文档
- 不修改现有游戏代码与 release 资产

## Assumptions

- 用户提供的 `ai-native-game-design.md` 适合作为原始研究素材，但不适合作为仓库内最终稳定参考稿原样保存
- 最终文档应无脏标记、无检索引用噪声、适合长期离线阅读
- “唯一参考文档”是指设计准则层面的唯一主参考，不排斥未来保留普通实现文档或发行文档

## Risks

- 过度压缩后会损失研究背景与论证细节
- 若 AGENTS 里写得太硬，后续 agent 可能忽略其他实现性文档
- 旧 GDC 文档删除后，部分历史上下文只保留在提交历史中

## Checklist

- [x] 写迁移 plan
- [x] 从原始 AI-native 设计文档中提炼最精炼的 20 条规则
- [x] 新增唯一设计准则参考文档
- [x] 删除旧 GDC 参考文档
- [x] 更新 `AGENTS.md` 中的设计前置要求
- [x] review diff
- [ ] git commit
