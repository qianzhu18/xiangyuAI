# SecondMe 集成重构说明（YueAgent）

## 目标

在不改变 `问卷 -> 匹配 -> 聊天` 主流程的前提下，引入 SecondMe 的 OAuth + 记忆机制，解决用户数据无法持续沉淀的问题。

## 当前架构

1. 用户层（前端）
- `questionnaire`：采集结构化问卷
- `match`：多 Agent 竞赛匹配（赛道3）
- `chat`：你 ↔ TA Agent / 你Agent ↔ TA Agent

2. 记忆层（SecondMe）
- OAuth 登录：`/api/secondme/oauth/start` -> `/api/secondme/oauth/callback`
- 状态查询：`/api/secondme/status`
- 记忆写入：`/api/secondme/ingest`
- 会话断开：`/api/secondme/disconnect`

3. 匹配引擎层
- `POST /api/match`
- 数据源优先级：Supabase 实际用户 -> 模拟用户池（至少12人）
- 评分融合：LLM + 规则 + SecondMe记忆信号（长沙标签、长期关系偏好、兴趣关键词）
- 输出：候选人、建议、可验证哈希、决策 JSON

4. 聊天代理层
- `POST /api/agent-chat`
- `user_to_partner`：SecondMe 生成“你的代理建议” + 本地 TA Agent 回复
- `agent_to_agent`：你的 SecondMe Agent 与 TA Agent 轮次对话

## 数据闭环

1. 问卷提交后写入 `questionnaires`
2. 同时异步写入 SecondMe 记忆事件（`questionnaire_submitted`）
3. 匹配完成后写入 `matches`
4. 同时异步写入 SecondMe 记忆事件（`match_generated`）
5. 聊天完成后写入 SecondMe 记忆事件（`agent_chat_session`）

## 端口与回调

项目默认端口已固定为 `3002`：
- `npm run dev` -> `http://localhost:3002`
- `SECONDME_REDIRECT_URI` 建议固定为：
  `http://localhost:3002/api/secondme/oauth/callback`

## 最小联调步骤

1. 配置 `.env.local` 中的 Supabase + LLM + SecondMe 凭证
2. 登录后先到 `/match` 页面点击「连接 SecondMe」
3. 返回后查看 `SecondMe 已连接` 状态
4. 填问卷 -> 匹配 -> 进入聊天
5. 在 SecondMe 平台侧验证记忆事件增长

## 后续可扩展

- 将 `verificationHash` 同步上链（赛道3可验证性增强）
- 将 SecondMe 的 shades 作为“人格分身对战”输入
- 增加后台“模拟用户池管理”和真实用户切换策略
