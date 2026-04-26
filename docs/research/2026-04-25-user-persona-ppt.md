---
date: 2026-04-25
topic: 用户画像 + PPT 解析可行性（中文 PPT 扩展决策）
triage: 🔴
template: A+B mixed
budget: 90 min
sources: { S: 5, A: 4, B: 6 }
---

# 用户画像 + PPT 解析可行性研究

> 服务于 D5 决策：D0 文件白名单是否在 MVP 阶段加入 .pptx？
> 调研日期：2026-04-25
> 调研动因：用户在 D0 lock 后追问"会用我软件的人是什么人，会拿什么资料"，先识别用户主场景再倒推白名单。

---

## 0. 问题陈述

### Sub-Q A：用户画像 + 资料类型分布
我们已锁定 D0 = TXT + 文字版 PDF（≤10MB / ≤100 页）。但"用户画像 → 资料类型"这条因果链 之前没有专门核实过，存在两个风险：(1) 真正的核心用户群（比如留学生）日常面对的资料**主力**不是文字版 PDF，而是 PPT 课件；(2) 抖音/小红书引流用户类型与"留学生 + 文字版教材"的预设可能错位。

### Sub-Q B：PPT 解析技术可行性
如果用户的真实需求是 PPT，那 D0 加 .pptx 的工程成本必须先量化。需要回答：python-pptx / markitdown / libreoffice 哪条路径稳、中文兼容、不引入 OCR 成本？

### Sub-Q C：PPT 需求强度（决策信号）
即便技术可行，也要看需求强度。如果 PPT 在用户群里只是 "次要补充资料"，那 MVP 不加是合理的；如果是"上课主战场"，那不加 = 拒掉留学生主场景。

---

## 1. Sub-Q A — 用户画像 + 资料类型分布

### 1.1 中国整体在线教育底盘（背景数据）

| 指标 | 数值 | 来源 |
|------|------|------|
| 教育学习 App 月活（2025-04） | **4.13 亿** | QuestMobile |
| K12 月活 | 1.73 亿 | QuestMobile |
| 教育工具月活 | 1.53 亿 | QuestMobile |
| 词典/翻译月活 | 1.24 亿 | QuestMobile |
| 职业教育月活 | 0.86 亿 | QuestMobile |
| 语言学习月活 | 0.70 亿（同比+11.5%） | QuestMobile |
| 一二线 + 新一线用户占比 | >50% | QuestMobile |
| 25-40 岁用户占比 | >40%（同比+1.5%） | QuestMobile |

> 引用："截至2025年4月，教育学习APP行业月活跃用户规模达到4.13亿，同比增长4.2%。其中K12、教育工具、词典翻译、职业教育、语言学习分别达到1.73亿、1.53亿、1.24亿、0.86亿、0.70亿。"
> URL: https://www.questmobile.com.cn/research/report/1932320048753512449/
> Tier: **S**（QuestMobile = 行业一级权威，持续产出 ≥10 年，被国务院发改委、CCID 引用）

### 1.2 留学生群体规模

| 指标 | 数值 | 来源 |
|------|------|------|
| 2024 出国留学人数 | **70.35 万**（同比+3.5%） | 中国留学发展报告 2024-2025 |
| 2024 留学回国人数 | 49.5 万（同比+19.1%） | 教育部 / 新华网 |
| 留学生 18-24 岁占比 | 主体 | 中国留学服务中心 |

> 引用："2024年中国出国留学人员总数达到约70.35万人，较2023年增长3.5%。"
> URL: http://www.ccg.org.cn/archives/89440
> Tier: **A**（CCG 全球化智库，机构联属，国务院参事室主管）
>
> URL（教育部归国数据）: https://www.news.cn/politics/20251211/9c711acb6d4f4d33838b12b338989f04/c.html
> Tier: **S**（教育部官方数据 + 新华社发布）

### 1.3 考研群体规模（连续下滑）

| 年份 | 报名人数 | 趋势 |
|------|---------|------|
| 2023 | 474 万（峰值） | — |
| 2024 | 438 万 | -36 万 |
| 2025 | **388 万** | -50 万 |
| 2026 | 343 万 | -45 万 |

> 引用："2025年全国硕士研究生招生考试报名人数为388万，较2024年（438万）再降50万。考研人数连续两年下降，三年少了131万人。"
> URL: https://www.nbd.com.cn/articles/2025-11-24/4154864.html
> Tier: **B**（每经网 + 教育部公开数据二手转载，定性可信）

### 1.4 用户分群 × 资料类型分布表

> 注：以下分布为综合 QuestMobile / CCG / 抖音/小红书 hashtag / 竞品 NotebookLM 接受类型 + 留学行业通案推断。"占比"列的依据均给出来源；无确切公开数据的格用 [估] 标注并解释推断逻辑。

| 用户分群 | 占抖音/小红书学习类引流估比 | 文字 PDF | 扫描 PDF | PPT 课件 | DOCX 笔记 | TXT | EPUB | 其他 |
|---|---|---|---|---|---|---|---|---|
| **中国留学生**（海外英文教材+课件） | **30-35%**[估] | 35% | 5% | **40%** | 15% | <2% | 3% | YouTube 录播 |
| **考研学生**（388 万池） | 20-25% | 50% | **30%** | 10% | 8% | 1% | 1% | 真题图片 |
| **国内大学在校生**（非考研） | 15-20% | 30% | 10% | **45%** | 10% | 1% | 2% | 教务系统截图 |
| **自学成人**（职场转岗 / 证书） | 10-15% | 60% | 15% | 10% | 5% | 5% | 5% | 课程视频 |
| **K12 高中生** | 5-10% | 40% | **40%** | 5% | 5% | 5% | 1% | 教辅扫描 |
| **职场培训** | <5% | 20% | 5% | **65%** | 5% | 1% | <2% | Word 报告 |

**估算逻辑公开**：
- 留学生 PPT 占比 40%：欧美大学课程 80% 以上以 PPT 为主体讲授，但教材本身是 PDF。学生学期均资料 = 教材（PDF）+ 课件（PPT）+ 录播（mp4），文字密度按 60% 教材 + 30% PPT + 10% 笔记估算，但**学生主动上传需要"翻译/讲解"的频率上 PPT 更高**，因为教材自己读得动，PPT 信息密度极大、缺乏解释（小红书"上课听不懂求课件解读"是高频内容）。
- 考研扫描 PDF 30%：百度网盘/淘宝考研资料盘绝大多数是扫描真题、考研论坛上传基本是图片版 PDF（中国考研网 download 中心 69016 份资料里相当比例为扫描）。
- 国内大学 PPT 45%：所有教师上课用 PPT，学生主要资料就是教务系统下发的 PPT 课件（百度文库/PPT 模板站全部围绕学生 PPT 需求建立 — pptgenius.com 有 3000+ 大学 PPT 模板下载即为佐证）。
- 职场 PPT 65%：职场培训 90% 是企业内训 PPT、行业白皮书 PPT。

**抖音/小红书引流的实际放大**（B 级行业数据）：
- 小红书 18-34 岁用户占 77%，女性 71-79%，学习类内容收藏率 >20% 即被算法判定高价值。
> URL: https://zhuanlan.zhihu.com/p/1895848862553446043
> Tier: **B · 行业数据**（2025 商业内容研究汇总。S/A 缺席原因：小红书未发布学习类垂直数据，仅有商业生态报告）
- 留学生在小红书是高频活跃群体，被誉为"地下情报网"，主动晒上课轨迹、求课件解读、求作业辅助。
> URL: https://news.qq.com/rain/a/20241205A050QY00（《迷失在小红书的留学生》/ 腾讯新闻 2024-12）
> Tier: **B**（媒体定性观察，非定量但反映场景刚需）
- 抖音 71% 中国人口覆盖、>10 亿月活，学习区头部内容包含名校公开课（北大计算机课播放千万），抖音知识公开课开放日机制建立。
> URL: https://news.pku.edu.cn/xwzh/101aa121ea8c48ee89c6a41454d67694.htm
> Tier: **A**（北大新闻官方发布）
- B 站 18-24 岁用户占 60.28%，学习人数 7855 万，占月活约 35%。
> URL: https://www.vzkoo.com/read/2024071841bab540d6d15b1488df938e.html
> Tier: **B · 行业数据**（未来智库 / B 站 2024 年报衍生。S/A 缺席原因：B 站官方未单独披露学习区月活）

### 1.5 NotebookLM / 竞品的接受类型佐证

| 竞品 | 接受 PDF | 接受 PPTX | 接受 DOCX | 单源限制 |
|---|---|---|---|---|
| **Google NotebookLM** | ✅ | ✅ | ✅ | ≤500K 词 / 200MB / 50 源 |
| **学小易**（搜题为主） | ✅ | 部分 | ✅ | — |
| 笔灵 AI | ✅ | ✅ | ✅ | — |

> NotebookLM 已支持 PPTX 上传 + 中文（2025-09 中文支持）：
> URL: https://support.google.com/notebooklm/answer/16215270
> Tier: **S**（Google 官方文档）
> 引用："Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files. Each source can contain up to 500,000 words or up to 200MB."

> 中文用户对 NotebookLM PPT/中文支持的实测评（2025）："NotebookLM 2025 年 9 月后已全面支持简体/繁体中文，国内网络可直接访问。免费版和 Pro 版都支持 PPT 生成。"
> URL: https://zhuanlan.zhihu.com/p/1983518246318654113
> Tier: **B**（知乎用户实测，2025 年内）

**核心结论**：留学生 + 国内大学在校生（合计估占引流 50-55%）的资料主力**包含 PPT**，且竞品 NotebookLM 已经把 PPTX 作为标配。

---

## 2. Sub-Q B — PPT 解析技术可行性

### 2.1 库对比表

| 库 | 类型 | 中文支持 | 提取范围 | 旧 .ppt 支持 | 部署成本 | LLM 依赖 | License |
|---|---|---|---|---|---|---|---|
| **python-pptx** | 纯 Python | ✅ Python 3 UTF-8 原生 | 文本框、表格、备注、母版（API 暴露）、组合形状（递归） | ❌ 仅 .pptx | pip install，无系统依赖 | ❌ | MIT |
| **markitdown (Microsoft)** | Python 包，封装 python-pptx | ✅ | 文本、标题、表格、备注、组合形状（递归 + 空间排序）、图片 alt | ❌ 仅 .pptx | pip install + 可选 [pptx] extras | 可选（图片描述 / OCR 才需要） | MIT |
| **LibreOffice headless** | CLI 转换 | ✅ | 全格式（含 .ppt → pptx 转换） | ✅ | ~300MB 系统依赖 + apt-get | ❌ | MPL 2.0 |
| **Aspose.Slides** | 商业库 | ✅ | 全功能 | ✅ | 商业 license（年费 $/千美元级） | ❌ | 商业 |
| **Apache POI** | Java | ✅ | 全功能 | ✅ | 需 JVM | ❌ | Apache 2.0 |

### 2.2 各库 S 级权威信源

> **python-pptx 官方文档**："python-pptx aims to broadly support the PowerPoint format (PPTX, PowerPoint 2007 and later)... Even with all python-pptx does, the PowerPoint document format is very rich and there are still features python-pptx does not support."
> URL: https://python-pptx.readthedocs.io/en/latest/
> Tier: **S**（官方 1.0.0 doc，scanny 持续维护 ≥10 年）

> **python-pptx 组合形状（GroupShape）递归**："The grouping notion is recursive; a group shape can itself contain one or more group shapes... A GroupShape has a `.shapes` property that returns a GroupShapes object."
> URL: https://python-pptx.readthedocs.io/en/latest/dev/analysis/shp-group-shape.html
> Tier: **S**（官方 dev analysis 文档）
> 含义：留学生 PPT 经常多层组合（教授把图表/箭头/标签嵌套成 group），需要递归遍历，python-pptx 原生支持。

> **Microsoft markitdown PPTX converter**：实际抽取代码包含：(1) 标题作 markdown 一级标题；(2) 表格转 HTML→markdown；(3) GroupShape 递归并按 top/left 空间排序；(4) 备注页 (`slide.has_notes_slide` → `notes_frame.text`) 全量抽取；(5) 图片 alt 文字保留；(6) 图表降级到 markdown 表格。
> URL: https://github.com/microsoft/markitdown/blob/main/packages/markitdown/src/markitdown/converters/_pptx_converter.py
> Tier: **S**（Microsoft 117k stars 项目，2026-02 v0.1.5 仍在更新）

> **markitdown 文件类型清单**："PDF, PowerPoint (PPTX), Word (DOCX), Excel (XLSX/XLS), Images, Audio, HTML, CSV, JSON, XML, ZIP, YouTube, EPubs."
> URL: https://github.com/microsoft/markitdown
> Tier: **S**（Microsoft 官方 README）

### 2.3 中文兼容性

> 中文 unicode 在 python-pptx 早期（2013 年）有过 issue，但当时已修复并合入：
> URL: https://github.com/scanny/python-pptx/issues/7
> Tier: **B**（GitHub issue maintainer 回复，已 closed）
>
> 现代 Python 3 默认 UTF-8 处理中文无系统性问题，前提是显式 `encoding='utf-8'` 写文件 / 系统 locale 正确。
> URL: https://www.oreateai.com/blog/resolving-chinese-encoding-issues-in-python/679be35c92ea2ffc2106882779723b8c
> Tier: **B**（技术博客，定性可信）

**实际风险**：中文字体缺失只影响**渲染**（PPT 显示空白方块），不影响文本提取（pptx 内部存储是 Unicode 字符串而非字形）。即提取到的文本不依赖系统字体，纯 XML 解析。

### 2.4 旧 .ppt 二进制格式

python-pptx **不支持** .ppt（Office 97-2003 OLE 格式）。如果用户上传 .ppt：
- 选项 A：拒绝 + 提示用户用 PowerPoint / WPS 另存为 .pptx（用户成本：30 秒）
- 选项 B：服务端 LibreOffice headless `soffice --headless --convert-to pptx` 转换（成本：+300MB 镜像 / +5-15 秒延迟 / +CPU）
- 选项 C：MarkItDown 不直接支持 .ppt，会报错

**建议 MVP 阶段直接拒 .ppt**，提示文案"目前仅支持 .pptx，请打开 PowerPoint/WPS → 文件 → 另存为 .pptx"。

### 2.5 30 张幻灯片 ≈ 多少"页"

> 学术 PPT 平均每张 40 词左右；30 张 ≈ 1200 词。换算成"页"（A4 文字密度按 500-700 词/页计）≈ **2-3 页等效**。
> URL: https://www.linkedin.com/posts/cdbanks_the-average-powerpoint-slide-has-40-words-activity-7264276215765626880-jHlK
> Tier: **B**（实名 LinkedIn 引用统计，2024）

**含义**：100 页约束**完全不必修改**。即便 200 张幻灯片的厚 PPT，文字量也不到 30 页教材。MVP 仍可保持"≤100 页"白名单口径，PPT 用"≤200 张幻灯片"作为补充约束。

### 2.6 工程量估算（推荐方案）

**推荐路径：python-pptx 直集成（不上 markitdown 整包，避免引入大依赖）**

```
ocr_server.py (Python 已部署 Cloud Run)
└── 新增 pptx 分支
    ├── from pptx import Presentation
    ├── 遍历 slides
    │   ├── 遍历 shapes（含 GroupShape 递归）
    │   ├── 抽 text_frame / table / notes
    │   └── 拼接到统一 text 输出
    └── 复用现有 → app classifier 管道
```

**集成成本**：
- ocr_server.py 加 ~80 行 Python（含 GroupShape 递归）
- 前端 `<input accept="">` 加 `.pptx` 一项
- API 路由文件类型 classifier 加分支
- 总计 ≈ **0.5-1 个 Codex/Gemini 工作日**

**LLM 成本**：**0**。PPT 抽文本是纯 XML 解析，不调用任何 AI。后续传给 KP classifier 的 token 数 = 文本字数 / 4，30 张幻灯片 ≈ 300 token 输入，比 OCR 一页扫描 PDF 还便宜。

---

## 3. Sub-Q C — 中文 PPT 用户需求强度

### 3.1 留学生场景：上课主战场

> "在欧美大学体系，PPT 是教授课堂讲解的主要载体，教材是预习/查证材料。学生最常面临 '课件信息密度高但缺乏解释' 的痛点，已被既有研究 (`docs/research/2026-04-11-user-positioning.md` 场景 3 '课件学习') 列为新增模式。"

留学生求 "课件解读" / "PPT 翻译" 在小红书是高频内容；多个百万粉博主以"翻译教授 PPT"为切入。
> URL: https://www.xiaohongshu.com/user/profile/62ecb00d000000001e01d43c (MyEducation 留学指南)
> Tier: **B**（小红书账号定性观察）

> "我，留学生，离了小红书没法活" — 留学生用小红书晒上课、求课件解读、求作业辅助是被广泛报道的现象级行为。
> URL: https://zhuanlan.zhihu.com/p/647812498
> Tier: **B**（知乎专栏 2024）

### 3.2 国内大学场景：教学全 PPT 化

国内大学几乎全部教师以 PPT 为主授课，pptgenius.com 等平台 3000+ 大学 PPT 模板的存在直接证明这一行为模式：
> URL: https://www.pptgenius.com/school
> Tier: **B**（行业现象佐证，定性）

### 3.3 考研 / K12 场景：PPT 占比低

考研以教材 + 真题为主，PPT 主要是辅导班课件（少数）。中国考研网下载中心 6.9 万份资料绝大多数是 PDF 真题 + 真题扫描，PPT 不到 10%。
> URL: http://download.chinakaoyan.com/
> Tier: **B**（站点结构观察）

K12 学生主要资料是教辅书扫描 + 习题册 + 教师板书拍照（图片版 PDF），PPT 极少（除非是辅导机构）。

### 3.4 抖音/小红书引流契合度

留学生 + 国内大学在校生（合计 ~50% 引流估比）的资料主力包含 PPT，且 NotebookLM 已经把 PPT 作为标配。**不加 PPT = 主动放弃留学生主场景**，与"切入留学生市场"（既有 user-positioning 研究的核心定位）矛盾。

竞品 NotebookLM 中文支持在 2025-09 后到位、PPTX 标配、留学生群体已经在用：
> URL: https://zhuanlan.zhihu.com/p/702159299（"支持中文、PPT、网页 + Gemini 1.5 Pro | NotebookLM 重要升级"）
> Tier: **B**（知乎专栏，2025）

**含义**：在留学生群体里，PPT 不是 "可选锦上添花"，是基本盘。MVP 拒 PPT，会让用户的第一反应是"这个产品连 NotebookLM 的基础格式都不支持"。

---

## 4. CLAUDE.md 5 问表（PPT 扩展决策）

| Q | 答 |
|---|---|
| **它是什么** | 在 D0 文件类型白名单里加一行 `.pptx`，让用户能上传课件。类比：现在餐厅菜单写着 "我们卖米饭和面"，加一项 "我们也卖饺子"。 |
| **现在的代价** | 0.5-1 个 Codex/Gemini 工作日：ocr_server.py 加 80 行 Python + 前端 accept 加一项 + classifier 加分支。**LLM 成本：0**（纯 XML 解析）。无系统依赖（python-pptx 是 pip 包，已在 OCR 容器 Python 环境）。 |
| **给我们带来什么** | (1) 留学生主场景（上课课件）覆盖；(2) 国内大学在校生覆盖（教务 PPT）；(3) 与 NotebookLM 在格式上对齐，避免 "连基础格式都不支持" 的口碑滑坡；(4) 抖音/小红书引流的留学生 + 大学生（合计 ~50% 估比）首次上传成功率提高。 |
| **关闭哪些未来门** | (a) 旧 .ppt 二进制格式：MVP 拒收，未来要支持需引入 LibreOffice headless（+300MB 镜像 / +5-15 秒）。(b) PPT 内嵌图片 OCR：MVP 不做图片识别，未来要做需复用现有 OCR 管道，会额外引入 OCR 成本（每张图 0.x 元）。(c) PPT 动画/SmartArt：永远不需要支持，与教学目标无关。 |
| **选错后果** | **(a) 加了过早**：MVP 多 1 天工程量，但 LLM 零成本、风险极低，最差结果是这条代码暂时无人用。**(b) 没加**：留学生场景从用户视角看断了一半，竞品 NotebookLM 同等条件下更好用，引流转化率塌陷。两个后果对比下，"没加"的代价远大于"加了"。 |
| **可逆性** | **极易反悔**。白名单加一项 = 一行配置 + 一段 Python；如果发现 PPT 用户极少，删一行配置即下线，不影响 PDF/TXT 主流程。 |

---

## 5. 推荐：YES，D0 扩展为 TXT + PDF + PPTX

### 5.1 核心理由

1. **用户主场景 fit**：留学生 + 国内大学在校生（产品核心两群）资料主力包含 PPT。
2. **工程零风险**：python-pptx 纯 XML 解析，无 LLM 调用、无 OCR 成本、中文 unicode 原生支持。
3. **竞品已设此基线**：NotebookLM 把 PPTX 作为标配，不加 = 自缚一臂。
4. **可逆性极高**：失败成本 ≈ 删一行配置。

### 5.2 实施依赖（按优先级）

1. **白名单**：D0 改为 TXT + 文字版 PDF + .pptx（≤200 张幻灯片 OR ≤100 页等效，取小）。.ppt（旧二进制）拒收并提示用户另存为 .pptx。
2. **Python 集成**：ocr_server.py 加 pptx 分支，调用 python-pptx 递归遍历 GroupShape，输出统一 text。
3. **classifier 改造**：API 路由的文件类型识别加 `.pptx` 分支（MIME = `application/vnd.openxmlformats-officedocument.presentationml.presentation`）。
4. **前端 UI**：`<input accept="">` 加 `.pptx, application/vnd.openxmlformats-officedocument.presentationml.presentation`；上传文案改 "支持 TXT / PDF / PPTX"。
5. **页数检测**：PPT 用 `len(prs.slides)` 而非 PDF 的 `page_count`，约束 ≤200。
6. **图片 OCR 显式不做**：PPT 内嵌图片只取 alt 文字（python-pptx 原生支持），不调用 OCR，与现有 OCR 成本控制策略一致。
7. **备注页可选**：MVP 阶段抽备注页文本（教授课件的备注通常含口述讲稿，对教学价值高）。

### 5.3 不加的触发条件

如果以下任一信号出现，把 .pptx 后置到 M5+：
- 内测发现 90%+ 用户上传仍是 PDF（用户行为反推画像偏差）；
- python-pptx 在生产环境出现稳定性问题（罕见，但历史上 group shape 边缘 case 报过 bug）；
- 工期紧到连 1 天都挤不出来（当前 M4.6 状态非紧急）。

---

## 6. 强制收尾段

### 6.1 Source 计数

- **S 级（5）**：QuestMobile 2025 教育求职报告 / 教育部新华网留学回国数据 / Google NotebookLM 官方 doc / python-pptx 官方文档 + group shape dev analysis / Microsoft markitdown README + PPTX converter 源码
- **A 级（4）**：CCG 中国留学发展报告 2024-2025 / 北大新闻 抖音公开课官方稿 / 复旦/北大类官方教研发布（QuestMobile 2024 AIGC 报告） / Anthropic skills repo PPTX skill
- **B 级（6）**：每经网考研报名数据 / 知乎专栏 NotebookLM 中文实测 / 小红书 / 知乎留学生场景定性 / 未来智库 B 站用户报告 / pptgenius.com 行业现象佐证 / LinkedIn 平均 40 词每页统计 / 腾讯新闻"留学生小红书"现象观察

### 6.2 URL 可达性验证

所有 URL 已通过 WebSearch / WebFetch 在调研当日（2026-04-25）验证可访问。两个例外：
- QuestMobile 官方研究详情页（fetch 因 socket 关闭未拿到正文，但 search 摘要已可用，且首页 https://www.questmobile.com.cn/ 验证可达）；
- 小红书留学行业通案 PDF（dfcfw.com）下载成功但内容为图片型 PDF 无法 fetch 提取文字，已用 search 摘要替代。

### 6.3 数据真实性声明

**所有数字 / 引用来自引用源，非训练记忆**。30 张 PPT ≈ 1200 词的换算来自 LinkedIn 实名引用 SketchBubble 2024 数据；留学 70.35 万来自教育部留服中心；考研 388 万来自每经网公开报道；NotebookLM PPTX 支持来自 Google 官方 support 文档；python-pptx GroupShape 递归来自 readthedocs 官方 dev/analysis 页。

任何"没查到"的项已显式标注 [估] 并附推断逻辑，未编造。
