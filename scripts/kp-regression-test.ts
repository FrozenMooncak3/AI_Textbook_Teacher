#!/usr/bin/env tsx

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

type KpType = 'factual' | 'conceptual' | 'procedural' | 'analytical' | 'evaluative'

interface FixtureModule {
  title: string
  text: string
}

interface Fixture {
  name: string
  modules: FixtureModule[]
}

interface ModuleRun {
  id: number
  title: string
  text: string
}

interface KpRow {
  module_id: number
  type: KpType
  description: string
  importance: number
}

interface ModuleReport {
  title: string
  kp_count: number
  types_present: KpType[]
  sample_kps: Array<{
    type: KpType
    description: string
    importance: number
  }>
}

interface FixtureReport {
  name: string
  modules: ModuleReport[]
  book_id_for_audit: number | null
  json_parse_ok: boolean
  kp_count_min: number
  kp_count_avg: number
  types_covered_in_book: KpType[]
}

interface RegressionReport {
  ts: string
  model: string
  summary: {
    total_modules: number
    json_parse_success: number
    modules_with_kp_ge_3: number
    type_coverage_count: number
    all_pass: boolean
  }
  fixtures: FixtureReport[]
  type_coverage_global: KpType[]
  errors: string[]
}

const MODEL_ID = 'deepseek:deepseek-chat'
const FALLBACK_MODEL_ID = 'qwen:qwen3-max'
const RESULTS_PATH = resolve(process.cwd(), '.ccb', 'kp-regression-results.json')
const TARGET_TYPES: readonly KpType[] = [
  'factual',
  'conceptual',
  'procedural',
  'analytical',
  'evaluative',
]

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
  if (!existsSync(filePath)) {
    return
  }

  const source = readFileSync(filePath, 'utf8')
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const equalsIndex = line.indexOf('=')
    if (equalsIndex <= 0) {
      continue
    }

    const key = line.slice(0, equalsIndex).trim()
    if (!key || process.env[key] !== undefined) {
      continue
    }

    let value = line.slice(equalsIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function requireEnv(name: 'DATABASE_URL' | 'DEEPSEEK_API_KEY'): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      name === 'DATABASE_URL'
        ? 'DATABASE_URL is required. Point it to Neon dev/prod PostgreSQL before running this script.'
        : 'DEEPSEEK_API_KEY is required. Export it before running this script.'
    )
  }
  return value
}

function buildModule(pageStart: number, title: string, sections: string[]): string {
  const pageMarkers = [
    `--- PAGE ${pageStart} ---`,
    `--- PAGE ${pageStart + 1} ---`,
    `--- PAGE ${pageStart + 2} ---`,
  ]

  const body: string[] = [`# ${title}`]
  for (let index = 0; index < sections.length; index += 1) {
    body.push(pageMarkers[Math.min(index, pageMarkers.length - 1)])
    body.push(sections[index])
  }

  return body.join('\n\n')
}

function sortTypes(types: Iterable<KpType>): KpType[] {
  const set = new Set(types)
  return TARGET_TYPES.filter((type) => set.has(type))
}

function pickSampleKps(kps: KpRow[]): Array<{ type: KpType; description: string; importance: number }> {
  const samples: Array<{ type: KpType; description: string; importance: number }> = []
  const seen = new Set<KpType>()

  for (const kp of kps) {
    if (seen.has(kp.type)) {
      continue
    }

    samples.push({
      type: kp.type,
      description: kp.description,
      importance: kp.importance,
    })
    seen.add(kp.type)

    if (samples.length === 3) {
      return samples
    }
  }

  for (const kp of kps) {
    if (samples.length === 3) {
      break
    }

    const alreadyIncluded = samples.some((sample) => sample.description === kp.description)
    if (alreadyIncluded) {
      continue
    }

    samples.push({
      type: kp.type,
      description: kp.description,
      importance: kp.importance,
    })
  }

  return samples
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  return Math.round((total / values.length) * 100) / 100
}

function buildFixtures(): Fixture[] {
  return [
    {
      name: '经济学（Mankiw 中文教材风格）',
      modules: [
        {
          title: '第1章 供给与需求基础',
          text: buildModule(1, '第1章 供给与需求基础', [
            '本章讨论市场经济中最基础的分析工具。需求是消费者在不同价格水平下愿意并且能够购买的数量，供给是生产者在不同价格水平下愿意并且能够出售的数量。需求曲线通常向右下方倾斜，因为在其他条件不变时，价格上升会降低消费者的购买意愿；供给曲线通常向右上方倾斜，因为价格上升会提高生产者的利润空间。这里要区分“曲线上的点移动”和“曲线整体移动”：前者由商品自身价格变化引起，后者由收入、偏好、替代品价格、技术、生产要素成本等外生因素引起。教材常把苹果、牛奶、地铁票等作为例子，目的不是背例子，而是训练学生识别决定变量和结果变量。',
            '市场均衡是供给量等于需求量的状态。均衡价格不是政府规定的“合理价格”，而是买卖双方在竞争中形成的价格信号。当价格高于均衡价格时，市场出现供给过剩，库存积压会促使卖方降价；当价格低于均衡价格时，市场出现短缺，排队、抢购或配给现象会倒逼价格上升。很多初学者把“均衡”误解为静止不动，其实均衡是一个受外部条件约束的相对位置，只要收入、技术或预期发生变化，供给曲线和需求曲线就会重新定位，从而形成新的均衡。学习本章的关键不是画图本身，而是形成“先判断哪条曲线移动，再判断均衡如何变”的程序化思路。',
            '例：某城市夏季高温持续，冷饮需求明显增加。若制冰技术没有变化，则需求曲线右移而供给曲线不动，结果是均衡价格上升、均衡数量增加。若同时电价上涨导致生产成本增加，则供给曲线左移，两种力量会共同推高价格，但数量变化取决于哪种移动更强。这个例子说明，经济学判断往往不是靠单一句子，而是靠条件分解。教材还会强调规范判断和实证判断的差异，例如“高温导致冷饮价格上涨”属于实证判断，“政府应当限制冷饮涨价”属于规范判断。掌握这种区分，有助于在后续章节里理解税收、补贴和价格管制。'
          ]),
        },
        {
          title: '第2章 弹性与税收转嫁',
          text: buildModule(4, '第2章 弹性与税收转嫁', [
            '需求价格弹性衡量价格变动对需求量的影响程度，常用公式是：需求价格弹性 = 需求量变动百分比 / 价格变动百分比。为了避免基期选择造成偏差，教材经常使用中点法，即以区间中点计算百分比变化。若弹性绝对值大于 1，说明需求富有弹性；若小于 1，说明需求缺乏弹性。收入弹性与交叉价格弹性则分别反映收入变化和相关商品价格变化对需求的影响。计算题的难点不在代入公式，而在先判断题目给的是“价格上涨 10% 导致销量下降 20%”还是“销量从 100 件减少到 80 件、价格从 10 元升到 12 元”，因为两种表述对应的计算路径不同。',
            '税收转嫁分析依赖于供需弹性的比较。若需求缺乏弹性而供给较有弹性，则消费者承担更多税负；若供给缺乏弹性而需求较有弹性，则生产者承担更多税负。其原因不是政府“指定谁交税”，而是谁更难调整行为。教材通常用香烟税、房产税、燃油税等说明这一点。学生在解题时可以先画出征税后供给曲线向上平移的图，再比较买方支付价格与卖方实际获得价格之间的楔子。程序化步骤通常包括：第一步识别税是从量税还是从价税；第二步判断税作用于哪一方；第三步画出平移后的曲线；第四步根据弹性判断税负分担；第五步再讨论无谓损失大小。',
            '税收还会造成无谓损失，因为税使一部分原本互利的交易不再发生。无谓损失的面积与交易量减少有关，而交易量对税更敏感的市场，往往需求或供给更富有弹性。教材常让学生比较药品和奢侈品：药品需求较缺乏弹性，税收未必显著减少交易量；奢侈品需求更富弹性，税收更容易压缩成交量。收入弹性则可用于区分正常品与劣等品，交叉价格弹性可用于判断替代品与互补品。若一种商品价格上升使另一种商品需求上升，两者通常是替代关系；若需求下降，则多为互补关系。把这些概念合起来，学生才能理解为什么政府在设计税制时，不仅要看税率，还要看市场反应。'
          ]),
        },
        {
          title: '第3章 市场失灵与政府角色',
          text: buildModule(7, '第3章 市场失灵与政府角色', [
            '完全竞争市场在许多情形下能够实现资源配置效率，但并非所有场景都如此。市场失灵的典型来源包括外部性、公共物品和信息不对称。外部性是某个行为对旁观者产生的收益或成本却没有在市场价格中体现出来。例如工厂排污会增加周边居民健康风险，这部分社会成本若未被内部化，企业的私人边际成本就低于社会边际成本，从而导致过度生产。相反，疫苗接种、基础科研等具有正外部性，私人收益低于社会收益，市场供给可能不足。理解外部性的关键是区分私人激励和社会最优之间的偏差。',
            '公共物品具有非排他性和非竞争性，例如国防、灯塔、部分城市防洪系统。由于难以把未付费者排除在外，私人企业缺乏充分激励提供此类商品，这就形成“搭便车”问题。信息不对称则表现为交易双方掌握的信息不同，例如二手车市场中卖方更了解车辆质量，保险市场中投保人更了解自身风险状况。逆向选择和道德风险是两种经典后果：前者发生在交易前，劣质品挤出优质品；后者发生在交易后，行为人因已受保障而增加风险行为。教材讨论这些问题时，重点并不只是记住名词，而是能够根据案例判断是哪一种机制在起作用。',
            '政府干预并不自动意味着更优。对负外部性，常见工具有庇古税、排放标准和可交易许可证；对正外部性，可用补贴、公共提供或产权安排。信息不对称问题可通过质量认证、强制披露、信誉机制和法律责任缓解。但每一种工具都有实施成本，政府也可能因信息不足、监管俘获或执行激励不当而失败。因此分析市场失灵不能停在“市场不好，所以政府介入”，而要继续问：介入的目标是什么，政策工具如何改变激励，副作用是什么。只有在比较制度安排后，才能较为严谨地判断哪种方案更可取。'
          ]),
        },
        {
          title: '第4章 宏观经济入门与政策权衡',
          text: buildModule(10, '第4章 宏观经济入门与政策权衡', [
            '国内生产总值是一定时期内一国境内最终产品和服务的市场价值总和。它既可以从支出法理解为 C + I + G + NX，也可以从收入法理解为工资、利润、利息与租金等收入的总和。教材提醒学生：GDP 是重要指标，但它不是幸福指数。家庭劳动、地下经济、生态破坏、闲暇损失和收入分配不平等等内容往往无法完整进入 GDP。理解这一点有助于避免把“增长”与“福利”简单等同。名义 GDP 和实际 GDP 的区别在于是否剔除价格变动影响，而 GDP 平减指数则用于概括总体价格水平变动。',
            '通货膨胀是总体价格水平持续上升。适度通胀未必有害，但高通胀会削弱货币购买力、扭曲相对价格信号，并增加菜单成本和鞋底成本。失业率、通胀率和经济增长率之间的关系构成宏观政策的核心背景。短期内，扩张性财政政策和货币政策可以刺激总需求，缓解衰退与失业；但若经济已接近潜在产出，继续刺激可能主要转化为物价上涨。教材在这里训练的是权衡思维：政策并非只追求单一目标，而是在增长、通胀、就业、债务可持续性之间寻找可接受组合。',
            '评价政策时，学生需要区分时滞、预期和制度约束。财政政策可能受预算程序影响，货币政策则依赖中央银行的独立性和可信度。以通货膨胀治理为例，若公众预期政府会持续放松，工资和价格制定就会提前反映这种预期，政策效果可能被削弱。GDP 作为产出指标很重要，但当社会关注环境、健康和公平时，仅看 GDP 会遗漏关键维度。因此宏观经济学入门并不是提供一个机械答案，而是要求学生在不同目标之间做规范评价：某项政策是否只是提高了统计上的产出，还是同时改善了经济稳定与社会福利。'
          ]),
        },
      ],
    },
    {
      name: '计算机基础（操作系统教材风格）',
      modules: [
        {
          title: '第1章 进程与线程',
          text: buildModule(13, '第1章 进程与线程', [
            '操作系统把正在执行的程序抽象为进程。进程不仅包含代码和数据，还包含程序计数器、寄存器集合、打开文件表、地址空间和若干管理信息。进程控制块 PCB 是操作系统记录这些信息的核心数据结构，它使系统能够在中断、系统调用和调度切换之间保存和恢复执行现场。线程则是进程内部的执行流，一个进程可以包含多个线程，共享同一地址空间和大部分资源，但每个线程拥有独立的程序计数器、寄存器和栈。教材常用“资源分配的单位是进程，CPU 调度的基本单位是线程或轻量级执行流”来概括二者的差异。',
            '进程状态通常包括新建、就绪、运行、阻塞和终止。就绪意味着进程已经具备运行条件，只等待 CPU；阻塞意味着进程正在等待 I/O、锁、信号或其他事件，单纯增加 CPU 时间也不能使其前进。状态转换不是死记硬背的箭头图，而是理解系统行为的语言。例如一个进程执行 read 系统调用后可能从运行态转到阻塞态，I/O 完成中断到来后再回到就绪态。线程也有类似状态，但线程切换与进程切换的开销不同，因为同一进程内线程切换不必完全更换地址空间。初学者需要分清并发与并行：并发是多个任务在逻辑上交替推进，并行则强调多个处理器核心在物理上同时执行。',
            '多线程的优势在于提高响应性、资源共享和程序结构化。例如 Web 服务器可以用主线程接收连接、工作线程处理请求，GUI 程序可以让界面线程保持交互而将耗时任务放到后台线程。但是共享地址空间也带来竞态条件、可见性和同步问题。教材讨论线程时常配合生产者—消费者、读者—写者等经典场景，目的是让学生理解“共享带来效率，也带来约束”。判断一个设计该用多进程还是多线程，通常要从故障隔离、数据共享成本、调度粒度和开发复杂度几个维度综合分析。'
          ]),
        },
        {
          title: '第2章 处理机调度算法',
          text: buildModule(16, '第2章 处理机调度算法', [
            '调度算法的任务是在多个就绪进程之间分配 CPU，使系统在吞吐量、响应时间、周转时间和公平性之间达到平衡。先来先服务 FCFS 按到达顺序调度，概念简单、实现代价低，但容易出现“护航效应”：一个很长的 CPU 密集任务占住处理机，会让后续许多短作业等待。最短作业优先 SJF 倾向先执行预期运行时间短的任务，理论上能降低平均周转时间，但它依赖对作业长度的估计，且可能让长作业长期得不到服务。优先级调度通过给任务分配优先级实现差异化服务，但若缺乏老化机制，低优先级任务会饥饿。',
            '时间片轮转算法 Round Robin 适合分时系统。操作系统为每个就绪进程分配一个固定时间片，时间片用完后若进程尚未完成，则被剥夺 CPU 并放回就绪队列尾部。时间片太大，系统接近 FCFS，交互响应差；时间片太小，切换开销增大。教材通常给出计算示例：若有任务 A、B、C 到达时间分别为 0、1、2，运行时间分别为 6、4、2，时间片为 2，则学生需手工画出甘特图，计算等待时间、响应时间和周转时间。程序化步骤包括：先排序到达事件，再维护就绪队列，遇到时间片耗尽或任务结束时更新当前时间并处理新到任务。',
            '评价调度算法时，要结合任务负载特征。批处理系统重视吞吐量和平均周转时间，交互系统重视响应时间，实时系统重视截止期满足情况。没有一种算法能在所有目标上同时最优，所以操作系统往往使用多级反馈队列，将短作业优先、动态调级和时间片轮转组合起来。学生需要把这些算法理解为不同价值取向的制度安排：FCFS 强调顺序公平，SJF 强调效率，优先级调度强调任务差异，轮转调度强调交互公平。真正的工程判断，来自对指标、工作负载与实现成本三者的共同把握。'
          ]),
        },
        {
          title: '第3章 内存管理与虚拟内存',
          text: buildModule(19, '第3章 内存管理与虚拟内存', [
            '内存管理的目标是在有限主存上支持更多程序并发执行，同时保证地址隔离和访问效率。连续分配方式直观，但容易产生外部碎片；分段把程序按逻辑单位划分为代码段、数据段、栈段，更符合程序员视角，却仍可能受到碎片影响。分页将逻辑地址空间划分为固定大小的页，把物理内存划分为同样大小的页框，通过页表建立映射。分页的好处是消除了外部碎片并简化分配，但会引入页表存储与地址转换开销。TLB 作为快表缓存常用页表项，用来减少重复查表带来的性能损失。',
            '虚拟内存允许程序使用看似连续且大于物理内存的地址空间。其核心思想是按需调页：只有真正访问到某一页时，系统才把该页从辅存装入主存。若访问的页不在内存中，就会触发缺页中断。操作系统保存现场、定位所需页面、选择牺牲页、必要时回写脏页，再更新页表和 TLB，最后恢复执行。页面置换算法如 FIFO、LRU、Clock 各有代价与近似策略。教材常让学生比较 Belady 异常、局部性原理和工作集模型，以说明内存管理不是单纯的表项计算，而是对访问行为规律的利用。',
            '分析分页与分段的差异时，应抓住“管理粒度”和“程序语义”两个轴。分页强调物理实现效率，分段强调逻辑结构表达，现代系统通常采用段页式兼顾二者。虚拟内存并非无成本扩容：若工作集远超物理内存，系统会频繁缺页，出现抖动，CPU 时间反而被中断和换页消耗。工程上需要结合程序访问局部性、页大小、TLB 命中率和 I/O 带宽综合设计。学生在这一章的训练重点，是把地址转换、缺页处理和性能后果串成一条完整因果链。'
          ]),
        },
        {
          title: '第4章 并发控制与同步机制',
          text: buildModule(22, '第4章 并发控制与同步机制', [
            '并发程序中最典型的风险是竞态条件：多个执行流对共享变量的读写顺序不同，会导致结果不可预测。临界区是访问共享资源的代码片段，互斥锁通过一次只允许一个线程进入临界区来维护一致性。信号量则把控制范围扩展为计数资源，P 操作和 V 操作用于申请与释放，既可实现互斥，也可协调先后次序。管程进一步把共享数据与同步操作封装为抽象模块，由条件变量表达等待某个状态成立。教材反复强调，正确的并发控制不是“加锁越多越安全”，而是要让锁的粒度、持有时间和资源顺序有清晰设计。',
            '死锁通常满足互斥、占有且等待、不可剥夺和循环等待四个必要条件。避免死锁可以破坏其中任一条件，例如统一加锁顺序、一次性申请全部资源或使用超时回退策略。互斥锁适合保护短小临界区，信号量适合表示有限资源池，管程更利于构造高层同步抽象。若只看语法，学生可能觉得三者只是 API 差异；但从语义上看，它们对应的是不同的建模方法：锁强调排他进入，信号量强调可用数量，管程强调受控接口和条件等待。理解这一点，才能在生产者—消费者、读者—写者和哲学家进餐问题之间迁移思路。',
            '评价同步机制时，需要同时看安全性、活性和可维护性。一个程序即使没有数据竞争，也可能因为错误唤醒、优先级反转或长时间持锁而性能很差。现代系统还会引入无锁结构、原子指令和内存模型，使同步问题更复杂。教材在这一章最希望学生建立的能力，是看到一个并发场景后能先问：共享资源是什么，冲突在哪里，必须满足的顺序约束是什么，选用何种机制最能兼顾正确性与代价。只有把这种分析框架掌握住，才不会停留在“会写 lock() 和 unlock()”的表层。'
          ]),
        },
      ],
    },
    {
      name: '哲学与政治理论（伦理学/政治哲学教材风格）',
      modules: [
        {
          title: '第1章 伦理学基础概念',
          text: buildModule(25, '第1章 伦理学基础概念', [
            '伦理学研究人应当如何行动、何种品格值得追求，以及制度安排何以具有正当性。与描述人们事实上如何行为的社会科学不同，伦理学关注的是规范判断。道德通常指日常生活中的行为要求与评价标准，伦理则更强调系统化、反思性的理论整理。规范、责任、权利、义务、善、正当等术语构成伦理学入门的基本词汇。教材在开篇会提醒学生，不要把“多数人赞成”直接等同于“道德上正确”，因为规范判断还需要理由、原则和可普遍化的论证。',
            '事实判断与价值判断的区分，是伦理学方法论中的第一道门槛。说“某地失业率上升”属于事实判断，说“政府应优先保障失业者基本生活”属于价值判断。规范推理往往需要从事实前提过渡到价值结论，而这一过渡必须借助原则。例如“人具有同等尊严”“避免可预防伤害优先”“承诺应被履行”等。若缺少规范前提，再多事实也无法自动推出应然结论。教材强调这一点，是为了帮助学生识别公共讨论中常见的偷换：把经验数据当成道德结论，把情绪反应当成普遍原则。',
            '伦理学并非只处理私人德性，也涉及制度与公共生活。个体在面对谎言、承诺、救助义务等问题时，需要判断行为理由；社会在面对分配、惩罚、医疗资源配置等问题时，也需要伦理框架。入门阶段最重要的任务不是立刻得出最终答案，而是掌握提问方式：这个问题涉及哪些行动者，他们的利益和权利如何界定，冲突原则是什么，评价标准是结果、规则还是品格。只有当学生具备了这种基本分析框架，后续学习功利主义、义务论与德性伦理学时，才不会把各种理论当成互不相关的名词列表。'
          ]),
        },
        {
          title: '第2章 三大伦理学派的论证路径',
          text: buildModule(28, '第2章 三大伦理学派的论证路径', [
            '功利主义以结果为中心，主张应当选择能够带来最大总体幸福或最大净效用的行动。其优势在于关注政策后果和受影响人群的整体福利，但也面临如何衡量效用、如何处理少数人权利的问题。义务论，尤其康德传统，强调行动是否符合可普遍化的道德法则，以及是否把人作为目的而非纯粹手段。它的强项在于为权利、尊严与不可侵犯性提供坚实根据，但在极端冲突场景中可能显得过于刚性。德性伦理学则把焦点放在行动者品格上，追问一个审慎、公正、勇敢的人在此情境中会如何选择。',
            '学生在比较三大学派时，不能只背结论，而要把它们的论证步骤说清楚。功利主义的程序通常是：识别受影响群体，估计每种方案的利益与损害，比较总体净效用，再选择总和更优的方案。义务论的程序通常是：抽取行动准则，检验其是否能够普遍化，并审查该行动是否尊重人格与自主性。德性伦理学的程序是：分析情境特征，判断相关德性是什么，再由实践智慧寻找合宜行动。教材常把同一案例交给三种理论分别分析，例如是否可以为挽救多人而牺牲一人，以此训练学生发现每种理论看重的道德维度并不相同。',
            '比较三大学派的意义不在于迅速宣布谁“绝对正确”，而在于理解伦理争论为何长期存在。结果、规则和品格都捕捉了道德生活中的真实面向。功利主义提醒我们不能忽视行动后果，义务论提醒我们某些边界不可轻易突破，德性伦理学提醒我们制度与行为最终仍要落实到人的性格与判断力。面对现实决策时，成熟的分析通常会在三者之间来回校准：既评估结果，也审查程序与权利，还关注行动者是否形成稳定而可靠的公共品格。'
          ]),
        },
        {
          title: '第3章 正义理论的分析比较',
          text: buildModule(31, '第3章 正义理论的分析比较', [
            '罗尔斯提出“原初状态”和“无知之幕”的思想实验，试图说明公正原则应在不知道自己社会位置、天赋、阶层与价值偏好的条件下被选择。其核心结论通常概括为两个原则：基本自由平等原则，以及在机会公平条件下允许不平等，但这种不平等必须使最不利者受益的差别原则。罗尔斯的贡献在于把制度正当性与可接受的选择程序联系起来，使正义不只是结果分配的描述，而是公共规则如何对所有人可辩护的问题。',
            '与之形成对照的是诺齐克的资格理论。诺齐克强调个人权利的先在性，认为只要取得正义和转让正义得以满足，分配结果即便高度不平等，也不因此不正义。他批评任何持续维持某种“模式化分配”的制度，因为这往往需要不断干预个人自愿交换。教材在比较两者时，会要求学生看到分歧并不只是“平等多一点还是少一点”，而是制度正当性的起点不同：罗尔斯更关心可共同接受的基本结构，诺齐克更强调个人权利边界与国家干预限度。',
            '分析比较的重点是把两种理论置于同一问题框架下：社会合作收益应如何分配，国家可以合法地做到什么程度，弱势者处境为何值得或不值得被制度优先考虑。罗尔斯提供了处理不平等的制度性标准，诺齐克则警惕以正义之名侵蚀个人自由。学生在写论述题时，应先准确陈述各自前提，再比较其对税收、福利、教育机会和财产权的不同推论，而不是简单把一方标签化为“左”或“右”。只有前提、机制与结论层层对应，理论比较才算真正成立。'
          ]),
        },
        {
          title: '第4章 自由与平等的政治权衡',
          text: buildModule(34, '第4章 自由与平等的政治权衡', [
            '现代政治哲学长期围绕自由与平等的关系展开。自由并非单一概念，既可以指不受他人干预的消极自由，也可以指个体具备真实行动能力的积极自由。平等也并非只有结果平等，还包括法律地位平等、机会平等、政治参与平等与基本能力平等。教材之所以区分这些层次，是为了避免讨论陷入口号。很多看似“自由与平等冲突”的争论，实际上是某一种自由与某一种平等之间的张力，而不是所有意义上的自由都与所有意义上的平等对立。',
            '在具体治理问题上，政治共同体常常面临制度权衡。例如扩大基础教育和公共医疗投入，可能通过税收限制一部分人的可支配收入，却提升了更多人实现自身计划的能力；强调绝对市场自由，可能提高交易自主性，却放大初始资源差异对人生机会的影响。教材会鼓励学生用规范分析而非情绪反应来处理这类问题：首先明确讨论的是财产权自由、言论自由还是迁徙自由；其次判断平等诉求是程序平等、机会平等还是结果平等；最后再评价某项政策在两者之间如何重新分配制度优势与风险。',
            '权衡并不意味着折中主义。某些基本自由，如言论、信仰和人身安全，往往具有优先地位，不宜为了短期效率轻易牺牲；而某些严重不平等若系统性地压缩机会，也会反过来损害自由的现实可达性。成熟的政治评价需要把制度放在具体社会背景中审视：历史不平等是否会代际传递，公共资源是否足以支持最低能力阈值，国家干预是否可能滑向家长主义。学生在本章应练成的能力，是面对制度选择时，能够以概念清晰、论证成链的方式说明何种自由应优先、何种平等值得追求，以及两者如何在现代国家治理中得到较为稳健的协调。'
          ]),
        },
      ],
    },
  ]
}

async function main(): Promise<number> {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  requireEnv('DATABASE_URL')
  requireEnv('DEEPSEEK_API_KEY')

  process.env.AI_MODEL = MODEL_ID
  process.env.AI_MODEL_FALLBACK ??= FALLBACK_MODEL_ID

  const { pool, query, queryOne, run } = await import('../src/lib/db')
  const { chunkText } = await import('../src/lib/text-chunker')
  const { extractModule } = await import('../src/lib/services/kp-extraction-service')

  const fixtures = buildFixtures()
  const errors: string[] = []
  const createdBookIds: number[] = []
  const fixtureReports: FixtureReport[] = []
  const globalTypes = new Set<KpType>()
  let successfulModules = 0
  let modulesWithKpGe3 = 0

  const user = await queryOne<{ id: number }>('SELECT id FROM users ORDER BY id ASC LIMIT 1')
  if (!user) {
    throw new Error('No user found in users table. Create one testable user before running this script.')
  }

  try {
    for (let fixtureIndex = 0; fixtureIndex < fixtures.length; fixtureIndex += 1) {
      const fixture = fixtures[fixtureIndex]
      const suffix = `${Date.now()}-${fixtureIndex + 1}`
      const fullText = fixture.modules.map((module) => module.text).join('\n\n')
      let bookId: number | null = null
      const moduleRuns: ModuleRun[] = []

      try {
        const insertedBook = await queryOne<{ id: number }>(
          `INSERT INTO books (
             user_id,
             title,
             raw_text,
             upload_status,
             parse_status,
             kp_extraction_status
           ) VALUES (
             $1,
             $2,
             $3,
             'confirmed',
             'done',
             'pending'
           )
           RETURNING id`,
          [user.id, `${fixture.name} 回归样本 ${suffix}`, fullText]
        )

        if (!insertedBook) {
          throw new Error('Book insert did not return an id')
        }

        bookId = insertedBook.id
        createdBookIds.push(bookId)

        for (let moduleIndex = 0; moduleIndex < fixture.modules.length; moduleIndex += 1) {
          const fixtureModule = fixture.modules[moduleIndex]
          const chunks = chunkText(fixtureModule.text)

          if (chunks.length === 0) {
            throw new Error(`chunkText returned 0 chunks for module "${fixtureModule.title}"`)
          }

          if (chunks.length !== 1) {
            errors.push(
              `[${fixture.name}] chunkText returned ${chunks.length} chunks for "${fixtureModule.title}". Only the first chunk will be used.`
            )
          }

          const chunk = chunks[0]
          const insertedModule = await queryOne<{ id: number }>(
            `INSERT INTO modules (
               book_id,
               title,
               summary,
               order_index,
               page_start,
               page_end,
               text_status,
               ocr_status,
               kp_extraction_status
             ) VALUES (
               $1,
               $2,
               '',
               $3,
               $4,
               $5,
               'ready',
               'skipped',
               'pending'
             )
             RETURNING id`,
            [bookId, fixtureModule.title, moduleIndex, chunk.pageStart, chunk.pageEnd]
          )

          if (!insertedModule) {
            throw new Error(`Module insert did not return an id for "${fixtureModule.title}"`)
          }

          moduleRuns.push({
            id: insertedModule.id,
            title: fixtureModule.title,
            text: chunk.text,
          })
        }
      } catch (error) {
        errors.push(
          `[${fixture.name}] setup failed: ${error instanceof Error ? error.message : String(error)}`
        )
        fixtureReports.push({
          name: fixture.name,
          modules: fixture.modules.map((module) => ({
            title: module.title,
            kp_count: 0,
            types_present: [],
            sample_kps: [],
          })),
          book_id_for_audit: bookId,
          json_parse_ok: false,
          kp_count_min: 0,
          kp_count_avg: 0,
          types_covered_in_book: [],
        })
        continue
      }

      const extractionOkByModule = new Map<number, boolean>()

      for (const moduleRun of moduleRuns) {
        try {
          await extractModule(bookId!, moduleRun.id, moduleRun.text, moduleRun.title)
          extractionOkByModule.set(moduleRun.id, true)
        } catch (error) {
          extractionOkByModule.set(moduleRun.id, false)
          errors.push(
            `[${fixture.name}] extractModule failed for "${moduleRun.title}": ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }

      const kps = await query<KpRow>(
        `SELECT kp.module_id, kp.type, kp.description, kp.importance
         FROM knowledge_points kp
         JOIN modules m ON m.id = kp.module_id
         WHERE m.book_id = $1
         ORDER BY kp.module_id ASC, kp.importance DESC, kp.id ASC`,
        [bookId]
      )

      const moduleStatusRows = await query<{ id: number; kp_extraction_status: string }>(
        'SELECT id, kp_extraction_status FROM modules WHERE book_id = $1 ORDER BY order_index ASC',
        [bookId]
      )
      const statusByModule = new Map(
        moduleStatusRows.map((row) => [row.id, row.kp_extraction_status])
      )

      const moduleReports: ModuleReport[] = []
      const bookTypes = new Set<KpType>()
      const kpCounts: number[] = []
      let fixtureJsonParseOk = true

      for (const moduleRun of moduleRuns) {
        const moduleKps = kps.filter((kp) => kp.module_id === moduleRun.id)
        const typesPresent = sortTypes(moduleKps.map((kp) => kp.type))
        const status = statusByModule.get(moduleRun.id)
        const extractionOk =
          extractionOkByModule.get(moduleRun.id) === true && status === 'completed'

        if (extractionOk) {
          successfulModules += 1
        } else {
          fixtureJsonParseOk = false
        }

        if (moduleKps.length >= 3) {
          modulesWithKpGe3 += 1
        }

        for (const type of typesPresent) {
          globalTypes.add(type)
          bookTypes.add(type)
        }

        kpCounts.push(moduleKps.length)
        moduleReports.push({
          title: moduleRun.title,
          kp_count: moduleKps.length,
          types_present: typesPresent,
          sample_kps: pickSampleKps(moduleKps),
        })
      }

      fixtureReports.push({
        name: fixture.name,
        modules: moduleReports,
        book_id_for_audit: bookId,
        json_parse_ok: fixtureJsonParseOk,
        kp_count_min: kpCounts.length > 0 ? Math.min(...kpCounts) : 0,
        kp_count_avg: average(kpCounts),
        types_covered_in_book: sortTypes(bookTypes),
      })
    }

    const report: RegressionReport = {
      ts: new Date().toISOString(),
      model: MODEL_ID,
      summary: {
        total_modules: fixtures.reduce((sum, fixture) => sum + fixture.modules.length, 0),
        json_parse_success: successfulModules,
        modules_with_kp_ge_3: modulesWithKpGe3,
        type_coverage_count: globalTypes.size,
        // Red line: >= 3 KP per module + 5 types covered + JSON parse 100% (no errors).
        // Variance runs show that stable 3-KP modules can still cover every core concept.
        // Higher counts mostly reflect split-vs-merge differences, not missing teaching value.
        // KP count alone is not a reliable proxy for concept coverage.
        all_pass:
          successfulModules === 12 &&
          modulesWithKpGe3 === 12 &&
          globalTypes.size === TARGET_TYPES.length &&
          errors.length === 0,
      },
      fixtures: fixtureReports,
      type_coverage_global: sortTypes(globalTypes),
      errors,
    }

    mkdirSync(dirname(RESULTS_PATH), { recursive: true })
    writeFileSync(RESULTS_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`KP regression report written to ${RESULTS_PATH}`)

    if (successfulModules === 0) {
      return 1
    }

    return 0
  } finally {
    for (const bookId of createdBookIds) {
      try {
        await run('DELETE FROM books WHERE id = $1', [bookId])
      } catch (error) {
        errors.push(
          `[cleanup] failed to delete book ${bookId}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    await pool.end()
  }
}

void main()
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
