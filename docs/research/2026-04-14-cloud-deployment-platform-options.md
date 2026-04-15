# 云部署平台调研（Next.js 主 App）

**调研日期**：2026-04-14
**用途**：云部署里程碑决策 2（Next.js 部署平台）的选型依据
**关联文件**：
- [cloud-deployment-brainstorm-state.md](../superpowers/specs/2026-04-12-cloud-deployment-brainstorm-state.md)
- [2026-04-14-cloud-ocr-options.md](./2026-04-14-cloud-ocr-options.md)（决策 1 调研）

---

## 一、调研背景与约束演变

### 初始约束
- Next.js 15 App Router 应用
- MVP 预算 $10/月内
- 支持 push 自动部署
- 与 Neon Postgres 配合

### 中途澄清：墙内访问硬约束（2026-04-14 中段）

产品负责人指出：
- 本人在中国，需要自己能测试
- 计划在国内众筹，需要国内用户稳定访问
- **墙内外都要能用**

这把「不支持大陆」的附加决策翻掉，调研范围扩大：
- 加入墙内访问稳定性维度
- 扩大候选池（加 Cloudflare Pages/Workers、国内部署）

### 最终澄清：产品策略分层（2026-04-14 末段）

产品负责人进一步拍板：
- MVP 主服务：海外
- 产品形态：Web first
- 国内只做介绍页 / 众筹页 / 候补页 / 演示页
- 国内众筹卖的是"支持 + 抢先体验权益 + 共创资格"，不承诺国内支持者立即稳定使用完整版
- 技术架构提前预留国内版分区能力

这意味着**主 App 部署决策不再需要硬扛墙内稳定**——国内访问的痛点由独立的介绍/众筹/候补/演示链路承接（走第三方平台，不自建站）。

---

## 二、来源分级

- **S 级**（必须）：平台官方定价页、官方文档、官方状态页
- **A 级**（辅助）：2025-2026 官方社区讨论、平台官方博客、近期技术博客带明确日期
- **拒绝**：无日期老帖、凭记忆断言、训练数据推断

---

## 三、候选方案对比表

| 方案 | 月费（MVP 规模） | Next.js 15 支持 | 墙内访问 | 代码改动 | 来源 |
|---|---|---|---|---|---|
| **Vercel Hobby** ⭐ 拍定 | $0（100GB 带宽） | ✅ 原生零配置 | ❌ *.vercel.app 封，自定义域名慢 3-8 倍 | **0** | [Vercel Pricing](https://vercel.com/pricing) |
| Vercel Pro | $20/人/月（1TB） | ✅ 原生 | 同上 | 0 | 同上 |
| Cloudflare Workers + OpenNext | $5/月起 | ✅ OpenNext adapter | ❌ 非 Enterprise 走 GFW 过滤 | ~1 天（db + uploads） | [CF Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) + [OpenNext](https://opennext.js.org/cloudflare) |
| Cloudflare Pages | 含在 Workers 里 | ⚠️ CF 2025 底已不推荐，迁 Workers | 同上 | 同上 | [Pages vs Workers](https://www.thetombomb.com/posts/nextjs-pages-cloudflare-pages) |
| Fly.io 香港 1GB | $5.92/月 + 亚太 egress $0.04/GB | ✅ Node 原生 | ❌ 路由经常绕 SYD/LAS/日本 | 0 | [Fly Pricing](https://fly.io/docs/about/pricing/) + [Fly 路由社区帖](https://community.fly.io/t/traffic-routing-issues-choosing-farther-paths-instead-of-closer-ones/23913) |
| 阿里云/腾讯云国内 | 备案 + 国内云费 | ⚠️ 非原生 | ✅ 国内最快（海外会慢） | 大（国内 serverless 差异） | [阿里云 ICP 备案](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/icp-filing-application-overview) |

---

## 四、主要候选方案详细数据

### 方案 1：Vercel Hobby（拍定）

**官方定价** [来源：[Vercel Pricing](https://vercel.com/pricing) + [Vercel Hobby Plan Docs](https://vercel.com/docs/plans/hobby)]：
- Hobby $0/月：100GB 带宽（超了就停，无 overage option）
- Pro $20/人/月：1TB 带宽 + 10M edge 请求 + $20 flexible credit，overage $0.15/GB
- Hobby → Pro 是 10x 资源跃升

**Next.js 支持**：
- Next.js 官方母公司，所有新特性零延迟支持
- 每个 push 自动 preview URL（MVP 调试很香）
- 标配 Edge + Serverless Function

**墙内访问** [来源：[Vercel KB: China Access](https://vercel.com/kb/guide/accessing-vercel-hosted-sites-from-mainland-china) + [vercel/community #803](https://github.com/vercel/community/discussions/803)]：
- `*.vercel.app` DNS 污染 + SNI 443 阻挡（官方 KB 确认）
- 自定义域名慢 3-8 倍，"不保证可用性"
- 官方**反对**在 Vercel 前叠 Cloudflare 代理（Firewall 失效）
- 推荐：自定义域名 + 自备海外 CDN（不指名 Cloudflare）

### 方案 2：Cloudflare Workers + OpenNext

**官方定价** [来源：[CF Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)]：
- Free: 10 万请求/天，10ms CPU/次，1GB KV 存储
- Paid: $5/月起，10M 请求/月内含，超出 $0.30/M
- **无 egress 费用**（所有流量免费）
- Hyperdrive: 10 万查询/天免费，**需 Paid 计划**

**Next.js 支持** [来源：[OpenNext Cloudflare docs](https://opennext.js.org/cloudflare) + [CF Next.js Workers docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)]：
- Next.js 15 App Router 通过 OpenNext adapter
- Node.js runtime（vs Pages 的 Edge runtime 限制更多）
- **包大小限制**：Free 3MiB / Paid 10MiB
- **不支持**：Node Middleware 15.2 新特性
- 2025-12 CF 官方已不推荐 Pages 部署 Next.js，迁 Workers

**Postgres 连接** [来源：[Neon + Hyperdrive](https://neon.com/docs/guides/cloudflare-hyperdrive)]：
- 需配 Hyperdrive（Cloudflare 连接池产品）
- 用 `pg` 驱动连 Hyperdrive（不要用 Neon serverless driver）
- 性能：全球连接池 + 最近节点路由

**墙内访问** [来源：[CF Free vs Paid China](https://community.cloudflare.com/t/free-vs-paid-option/895170) + [CF China Network](https://www.cloudflare.com/application-services/products/china-network/)]：
- Free / Pro $20 / Business $200 墙内都走 GFW 过滤
- **China Network 仅 Enterprise**：$2000+/月，且必须 ICP 备案，且合作伙伴 JD Cloud
- 墙内表现和 Vercel 自定义域名无本质差别

### 方案 3：Fly.io 香港

**官方定价** [来源：[Fly.io Pricing](https://fly.io/docs/about/pricing/)]：
- shared-cpu-1x 256MB: $2.02/月
- shared-cpu-1x 1GB: **$5.92/月**
- shared-cpu-1x 2GB: $11.11/月
- 亚太 egress $0.04/GB
- 无固定订阅，按秒计费
- 不再有免费层（2024-10 取消）

**墙内访问** [来源：[Fly 社区: 路由问题 2025](https://community.fly.io/t/traffic-routing-issues-choosing-farther-paths-instead-of-closer-ones/23913)]：
- 香港节点（hkg）存在
- **实测路由经常绕 SYD（悉尼） / LAS（拉斯维加斯） / 日本**，不直连 HKG
- 社区 2025 报告明确："network condition between Fly and mainland China is not good"
- 结论：名义在墙边，实际 = 普通海外部署，没买到价值

### 方案 4：国内部署（阿里云/腾讯云）

**ICP 备案要求** [来源：[阿里云 ICP 备案流程](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/icp-filing-application-overview) + [阿里云备案资料](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/required-materials)]：
- 个人备案材料：身份证 + 域名证书
- 异地户籍可能要居住证（地区差异）
- **2026 新规**：大部分地区要求人脸识别核验
- 耗时：阿里云初审 1-2 天 + 工信部短信 5 分钟 + 管局审核最长 20 天，总 3-22 个工作日
- 备案期间：**网站无法访问**（域名在备案期内禁止解析）
- 备案后义务：30 天内公安联网备案 + 网站首页悬挂备案号
- 订单有效期 45 天

**Next.js 支持**：
- 阿里云函数计算 / 腾讯云 serverless 对 Next.js 非原生，需适配
- 或选传统 ECS，运维成本高

**结论**：成本（时间 + 合规）对 MVP 太重，核心用户（海外留学生）访问还会变慢，排除。

---

## 五、决策理由（为什么最终选 Vercel Hobby）

### 产品策略分层后的新权衡

产品负责人给出了清晰的产品策略：
- MVP 海外优先
- 国内走第三方平台（摩点 / 开始吧 + 微信公众号 + 小红书 / 视频号）承接
- MVP 完成后才启动国内链路

这让主 App 决策不用再硬扛"墙内稳定"，三个关键变量的相对权重变化：

| 维度 | 产品策略澄清前 | 产品策略澄清后 |
|---|---|---|
| 墙内稳定 | 必须 | 锦上添花 |
| 上线速度 | 次要 | **最优先** |
| 月费 | 次要 | 次要 |
| 代码改动成本 | 可接受 1 天 | **越少越好** |
| 未来可迁移 | 重要 | 重要 |

### Vercel Hobby 在新权重下胜出的 4 个理由

1. **上线速度最快**：零改动 = 当天可部署
2. **价格最低**：$0/月，MVP 100GB 带宽够长时间不升级
3. **Next.js 原生**：母公司平台，新特性零延迟，坑最少
4. **反悔容易**：代码零修改，将来迁 CF Workers / Fly / 自建都不锁死

### 为什么不选 CF Workers（之前推荐过）

之前（墙内稳定是硬约束时）推 CF Workers 的核心理由：
- CF Anycast 多节点比 Vercel 单服务器稍好
- $5/月流量免费

但策略变化后：
- 墙内稍好不再关键（都差）
- $5 > $0 的差异在 MVP 阶段不值得 1 天代码改动
- OpenNext 适配成本 + 包大小限制 + Node Middleware 15.2 不支持都是附加摩擦

### 为什么排除 Fly.io

香港节点路由实测绕路（Fly 社区 2025 确认），名义优势没兑现，加 $5.92 没买到价值。

### 为什么排除国内部署

- ICP 备案 3-22 天 + 人脸识别 + 网站无法访问
- 海外核心用户体验变差
- MVP 阶段时间和合规成本都不划算

---

## 六、附加决策：架构预留国内版分区能力

产品策略要求"技术架构提前预留国内版分区能力"。这不是立刻要做的代码，是**后续决策时不得锁死**的 4 条硬约束：

1. **DB 连接配置化**（已做）：`DATABASE_URL` 环境变量，未来可切 Neon 国内 project 或阿里云 RDS
2. **文件存储选 S3 兼容接口**（影响决策 4）：如 R2 / B2，未来可无缝切阿里云 OSS / 腾讯云 COS
3. **OCR provider 抽象**（决策 1 已做）：`OCR_PROVIDER=google|paddle|aliyun`
4. **前端 i18n 就位**：文案走 `next-intl` 之类，避免硬编码

---

## 七、国内链路策略（MVP 完成后启动）

**方向**：不自建国内站，全走第三方平台

| 需求 | 走哪里 | 为什么 |
|---|---|---|
| 众筹支付 | 摩点 / 开始吧 / 好好众筹 | 平台自带主体资质 + 国内支付，抽佣 5-8% |
| 候补登记 | 微信公众号粉丝沉淀 | 墙内最稳 + $0 + 后续可推送 |
| 介绍内容 | 小红书 / 视频号 / 公众号文章 | 避开 ICP 备案 + 算法分发 |
| 演示页 | **录屏视频 + 截图**（发小红书/B 站/众筹项目页） | 不接真 API，不涉及墙内访问主站 |

**好处**：
- 不用 ICP 备案（不碰国内服务器）
- 不用自己解决国内支付
- 自带流量（平台算法分发）
- 一天能上线（vs 自建 1-2 周）

**代价**：
- 平台抽佣（众筹平台 5-8%）
- 用户名单在平台手里
- 页面设计自由度低

**启动时点**：MVP 主 App 完成、具备可演示状态后启动。当前阶段只记策略方向。

---

## 八、后续 gap（本次调研没查 / 需要实测的事）

1. **Vercel Hobby 100GB 带宽实际消耗率**：MVP 100 用户场景能撑几个月需实测
2. **Vercel 自定义域名墙内实际延迟数据**：调研未拿到具体毫秒数，只有定性"3-8 倍慢"
3. **Next.js 15 的 serverExternalPackages 在 Vercel 部署时的完整行为**：之前 MEMORY 记过 Turbopack 外部包问题，要验证 Vercel 部署是否受影响
4. **uploads 目录和文件存储**：Vercel Hobby 不提供持久化文件系统，PDF 上传必须走对象存储（决策 4 处理）

---

## 九、参考资料汇总

### Vercel
- [Vercel Pricing](https://vercel.com/pricing)
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby)
- [Vercel Pricing 2026 深度分析](https://schematichq.com/blog/vercel-pricing)
- [Accessing Vercel from Mainland China](https://vercel.com/kb/guide/accessing-vercel-hosted-sites-from-mainland-china)
- [Vercel Community: Cloudflare 代理问题](https://vercel.com/kb/guide/cloudflare-with-vercel)
- [vercel/community #803: vercel.app 封锁](https://github.com/vercel/community/discussions/803)

### Cloudflare
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [OpenNext for Cloudflare](https://opennext.js.org/cloudflare)
- [Cloudflare Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [CF Blog: Deploying Next.js with OpenNext](https://blog.cloudflare.com/deploying-nextjs-apps-to-cloudflare-workers-with-the-opennext-adapter/)
- [Cloudflare China Network (Enterprise only)](https://www.cloudflare.com/application-services/products/china-network/)
- [CF Free vs Paid 墙内对比](https://community.cloudflare.com/t/free-vs-paid-option/895170)
- [Pages 不再推荐部署 Next.js](https://www.thetombomb.com/posts/nextjs-pages-cloudflare-pages)

### Neon + Hyperdrive
- [Neon with Cloudflare Hyperdrive](https://neon.com/docs/guides/cloudflare-hyperdrive)
- [Neon with Cloudflare Workers](https://neon.com/docs/guides/cloudflare-workers)

### Fly.io
- [Fly.io Pricing](https://fly.io/docs/about/pricing/)
- [Fly.io Regions](https://fly.io/docs/reference/regions/)
- [Fly 社区: 香港路由绕路 2025](https://community.fly.io/t/traffic-routing-issues-choosing-farther-paths-instead-of-closer-ones/23913)
- [Fly 社区: 减少墙内延迟的方法](https://community.fly.io/t/i-found-a-way-to-reduce-the-network-latency-between-mainland-china-and-fly-hkg-region/24451)

### 国内部署 / ICP 备案
- [阿里云个人 ICP 备案全流程](https://help.aliyun.com/zh/icp-filing/basic-icp-service/getting-started/quick-start-for-icp-filing-for-personal-websites)
- [阿里云 ICP 备案流程总览](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/icp-filing-application-overview)
- [阿里云 ICP 备案所需材料](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/required-materials)

### Vercel 墙内加速方案
- [21YunBox: Vercel 墙内加速](https://21yunbox.medium.com/how-to-improve-the-access-speed-of-vercel-in-china-864428f16503)
- [Vercel + 阿里云 CDN 配置](https://community.vercel.com/t/how-to-configure-vercel-domains-with-alibaba-cdn-for-china-mainland/36072)
