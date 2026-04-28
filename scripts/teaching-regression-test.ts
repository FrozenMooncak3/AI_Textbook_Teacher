#!/usr/bin/env tsx

import { generateObject } from 'ai'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type {
  KPType,
  TeachingStatus,
  TranscriptMessage,
  TranscriptV1,
} from '../src/lib/teaching-types'

type ClusterKp = {
  code: string
  description: string
}

type ClusterFixture = {
  id: string
  kp_type: KPType
  mainKp: ClusterKp
  allKps: readonly [ClusterKp, ClusterKp, ClusterKp]
}

type FixtureReport = {
  kp_type: KPType
  cluster_summary: string
  turns: TurnReport[]
}

type TurnReport = {
  turn_index: number
  student_input: string
  status: TeachingStatus
  teacher_message: string
  kp_takeaway: string | null
  struggling_streak_after: number
}

type RegressionReport = {
  ts: string
  model: 'deepseek:deepseek-chat'
  summary: {
    total_turns: 50
    successful_turns: number
    status_coverage: Record<TeachingStatus, number>
    all_pass: boolean
  }
  fixtures: FixtureReport[]
  errors: string[]
}

type UsageRecord = {
  inputTokens?: number
  outputTokens?: number
}

const MODEL_ID = 'deepseek:deepseek-chat' as const
const RESULTS_PATH = resolve(process.cwd(), '.ccb', 'teaching-regression-results.json')

function defineTenTurns(
  ...inputs: [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ]
): readonly string[] {
  return inputs
}

const CLUSTER_FIXTURES: readonly ClusterFixture[] = [
  {
    id: 'fact-cluster',
    kp_type: 'factual',
    mainKp: {
      code: 'FACT-1',
      description:
        '细胞呼吸的核心事实是：葡萄糖等有机物在酶的作用下逐步分解，储存在化学键中的能量不会一次性直接释放，而是主要转移到 ATP 中供细胞活动使用；在线粒体中完成的大部分有氧呼吸，是真核细胞稳定获得能量的主要来源。',
    },
    allKps: [
      {
        code: 'FACT-1',
        description:
          '细胞呼吸的核心事实是：葡萄糖等有机物在酶的作用下逐步分解，储存在化学键中的能量不会一次性直接释放，而是主要转移到 ATP 中供细胞活动使用；在线粒体中完成的大部分有氧呼吸，是真核细胞稳定获得能量的主要来源。',
      },
      {
        code: 'FACT-2',
        description:
          '葡萄糖分解的起始阶段发生在细胞质基质，先生成丙酮酸并释放少量 ATP，这一阶段既为后续反应提供中间产物，也说明呼吸作用并不是从一开始就全部在线粒体中完成。',
      },
      {
        code: 'FACT-3',
        description:
          '当氧气不足时，细胞可暂时转向无氧呼吸或发酵，虽然仍能得到少量 ATP，但效率显著低于有氧呼吸，这也是剧烈运动后容易出现乳酸积累与疲劳感的重要背景。',
      },
    ],
  },
  {
    id: 'concept-cluster',
    kp_type: 'conceptual',
    mainKp: {
      code: 'CONCEPT-1',
      description:
        '机会成本不是已经付出去的金钱，而是在做出一种选择时必须放弃的次优方案价值。理解它的关键在于，稀缺条件下任何决策都意味着取舍，因此看似“免费”的安排，也可能包含被忽视的真实代价。',
    },
    allKps: [
      {
        code: 'CONCEPT-1',
        description:
          '机会成本不是已经付出去的金钱，而是在做出一种选择时必须放弃的次优方案价值。理解它的关键在于，稀缺条件下任何决策都意味着取舍，因此看似“免费”的安排，也可能包含被忽视的真实代价。',
      },
      {
        code: 'CONCEPT-2',
        description:
          '显性成本表现为账面支出，隐性成本体现为自有资源被用于当前方案而失去的其他收益。很多“我没花钱”的判断，只是忽略了隐性成本，并不意味着机会成本为零。',
      },
      {
        code: 'CONCEPT-3',
        description:
          '边际决策要求比较新增一单位行动带来的边际收益和边际成本，而机会成本常常就是边际成本判断的重要组成部分，所以它不仅是一个定义，更是一套分析稀缺资源分配的思考框架。',
      },
    ],
  },
  {
    id: 'procedure-cluster',
    kp_type: 'procedural',
    mainKp: {
      code: 'PROC-1',
      description:
        '配方法求一元二次方程的程序重点，不是机械背步骤，而是把原式整理成“完全平方 = 常数”的结构，再通过开平方求解。每一步都要保证等式两边同时变化，避免只在一边补项而破坏等式平衡。',
    },
    allKps: [
      {
        code: 'PROC-1',
        description:
          '配方法求一元二次方程的程序重点，不是机械背步骤，而是把原式整理成“完全平方 = 常数”的结构，再通过开平方求解。每一步都要保证等式两边同时变化，避免只在一边补项而破坏等式平衡。',
      },
      {
        code: 'PROC-2',
        description:
          '在进行配方前，通常要先把二次项系数化为 1，再把常数项移到等号另一侧，并把一次项系数的一半平方后同时加到等式两边。这个“先整理、后补项”的顺序，决定了后续是否能得到标准完全平方形式。',
      },
      {
        code: 'PROC-3',
        description:
          '完成开平方后得到的两个根还需要回到原方程中检验，尤其当方程经过分式化简、变量替换或两边乘除同一表达式时，更要防止把增根或漏根带入最终答案。',
      },
    ],
  },
  {
    id: 'analysis-cluster',
    kp_type: 'analytical',
    mainKp: {
      code: 'ANALYSIS-1',
      description:
        '在供给增加与需求下降同时发生时，均衡价格通常会下降，但均衡数量的变化方向不能只凭直觉判断，而要比较两条曲线移动的相对幅度。分析题的关键是先分离单个因素，再合并结果，防止把点移动误写成曲线整体移动。',
    },
    allKps: [
      {
        code: 'ANALYSIS-1',
        description:
          '在供给增加与需求下降同时发生时，均衡价格通常会下降，但均衡数量的变化方向不能只凭直觉判断，而要比较两条曲线移动的相对幅度。分析题的关键是先分离单个因素，再合并结果，防止把点移动误写成曲线整体移动。',
      },
      {
        code: 'ANALYSIS-2',
        description:
          '需求下降意味着在原有价格下消费者愿意购买的数量减少，需求曲线整体左移，而不是沿着原有需求曲线向上滑动。只有商品自身价格变化时，才是曲线上的点移动。',
      },
      {
        code: 'ANALYSIS-3',
        description:
          '供给增加意味着在原有价格下生产者愿意提供更多数量，供给曲线整体右移。若题目同时给出技术进步、原材料降价或政府补贴等条件，要先判断它们是否都在推动同一个方向。',
      },
    ],
  },
  {
    id: 'evaluation-cluster',
    kp_type: 'evaluative',
    mainKp: {
      code: 'EVAL-1',
      description:
        '评价科举制度不能只看“是否公开考试”这一点，而要同时考察它在扩大社会流动、削弱门第垄断方面的积极作用，以及在八股化、选才标准单一、可能抑制实践能力方面的历史局限。评价型知识点要求先立标准，再比较不同后果。',
    },
    allKps: [
      {
        code: 'EVAL-1',
        description:
          '评价科举制度不能只看“是否公开考试”这一点，而要同时考察它在扩大社会流动、削弱门第垄断方面的积极作用，以及在八股化、选才标准单一、可能抑制实践能力方面的历史局限。评价型知识点要求先立标准，再比较不同后果。',
      },
      {
        code: 'EVAL-2',
        description:
          '从公平性看，科举相较世卿世禄确实提高了平民进入仕途的机会，但这种机会仍受地区、性别与家庭资源差异限制，所以“更公平”不等于“完全公平”。',
      },
      {
        code: 'EVAL-3',
        description:
          '从治理效果看，统一考试有助于形成共同的政治语言与官僚训练，却也可能把读书人的精力过度引向应试文本。评价制度时，既要看它解决了什么问题，也要看它新制造了什么问题。',
      },
    ],
  },
]

const STUDENT_INPUTS_BY_TYPE: Record<KPType, readonly string[]> = {
  factual: defineTenTurns(
    '我先试着说：细胞呼吸就是把有机物里的能量一点点转出来，最后给细胞用，对吗？',
    '是不是有氧呼吸的大部分步骤都跟线粒体有关？',
    '我有点糊涂，葡萄糖和 ATP 到底谁才是细胞直接用的能量？',
    '为什么说氧气不是“提供能量”的，而只是参与后面的反应？',
    '能举个跟人运动后气喘有关的具体例子吗？',
    '这和光合作用有什么联系，感觉一个在存能量一个在放能量？',
    '如果暂时没有氧气，细胞是不是就完全得不到能量了？',
    '我再试着回答：ATP 更像细胞马上能花掉的“能量零钱”，这样理解对吗？',
    '现在我基本明白了，关键是有机物先储能，再通过呼吸逐步释放，对吗？',
    '明白了，这个知识点我可以继续下一个了。'
  ),
  conceptual: defineTenTurns(
    '我先理解一下：机会成本不是花出去的钱，而是放弃掉的另一个更好选择，对吗？',
    '如果我周末去兼职，就等于放弃了休息或者学习，这里面被放弃的部分就是机会成本吗？',
    '我还是有点糊涂，显性成本和机会成本是不是一回事？',
    '为什么很多教材会说“免费上学”也有机会成本，这听起来有点反直觉。',
    '能不能举个不是花钱、但机会成本依然很高的例子？',
    '这和边际决策有什么联系，是不是每多做一点都要重新看放弃了什么？',
    '如果两个备选方案都不理想，那机会成本是取其中次优的那个，还是随便挑一个？',
    '我试着答一下：机会成本看的是最值得但没选的那个方案，不是把所有放弃的都加起来，对吗？',
    '现在我感觉清楚一些了，核心是在稀缺下比较“没选的最好方案”，对吗？',
    '明白了，这个概念我觉得可以往下走了。'
  ),
  procedural: defineTenTurns(
    '我先说说看：配方法是不是先把方程整理一下，再凑成一个完全平方？',
    '如果二次项系数不是 1，是不是一定要先把它除掉？',
    '我没听懂的是，为什么补上的那个数一定是一次项系数一半的平方？',
    '为什么补项的时候必须两边同时加，不能只在左边把它凑出来？',
    '能不能拿一个具体方程一步一步示范一下，但不要直接把答案全给我？',
    '这和公式法有什么联系，是不是公式法本质上也来自配方法？',
    '如果我整理成完全平方以后开根号，那两个根是从哪一步出来的？',
    '我试着答一下：因为 \u00b1 号表示平方根有两个方向，所以要写两个解，对吗？',
    '现在我大概抓住顺序了：先化系数、再移项、再补成平方、最后开方检验，对吗？',
    '明白了，这套步骤我可以继续练下一个了。'
  ),
  analytical: defineTenTurns(
    '我先试着判断：供给增加和需求下降一起出现时，价格大概率会往下，对吗？',
    '那数量为什么不能直接说也下降，我总觉得两个因素会互相打架。',
    '我有点乱了，需求下降到底是曲线左移，还是沿着原曲线往下走？',
    '为什么题目里明明都在说“数量变了”，但有时是点移动，有时却是整条曲线移动？',
    '能给我举个“技术进步 + 消费者偏好下降”同时发生的例子吗？',
    '这和单独分析供给或需求的题目有什么联系，是不是先拆开再合并？',
    '如果需求只小幅下降，但供给大幅增加，数量最后是不是更可能上升？',
    '我再试着回答：价格方向比较确定，但数量要看两边谁移得更多，是这样吗？',
    '现在我觉得主线清楚了，先分清哪条曲线动，再比较幅度，对吗？',
    '明白了，这个分析框架我可以继续下一个了。'
  ),
  evaluative: defineTenTurns(
    '我先理解一下：评价科举制度，不能只说“好”或者“不好”，而是要看标准，对吗？',
    '如果从社会流动看，它确实比门第世袭更开放，这算它的重要优点吗？',
    '我还是有点糊涂，为什么说它更公平，但又不能说它已经很公平？',
    '为什么同一个制度既能扩大选官范围，又可能让读书人越来越会应试？',
    '能不能举个从治理效果角度评价科举的具体例子？',
    '这和“公平性标准”和“效率标准”有什么联系，是不是评价角度不同结论也会变？',
    '如果一个制度解决了旧问题，却制造了新问题，写评价题时该怎么摆放轻重？',
    '我试着答一下：先说明评价标准，再分别谈积极作用和历史局限，会更完整，对吗？',
    '现在我感觉明白了，评价题不是背结论，而是比较不同后果，对吗？',
    '明白了，这个知识点我可以进入下一个了。'
  ),
}

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
        ? 'DATABASE_URL is required. Point it to the PostgreSQL instance that already has prompt_templates seeded.'
        : 'DEEPSEEK_API_KEY is required. Export it before running this script.'
    )
  }
  return value
}

function summarizeCluster(description: string): string {
  return description.length <= 80 ? description : description.slice(0, 80)
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function appendStudentMessage(transcript: TranscriptV1, studentInput: string, ts: string): void {
  const studentMessage: TranscriptMessage = {
    kind: 'student_response',
    role: 'user',
    content: studentInput,
    ts,
  }
  transcript.messages.push(studentMessage)
}

function updateUsage(transcript: TranscriptV1, usage: UsageRecord | undefined): void {
  transcript.state.tokensInTotal += usage?.inputTokens ?? 0
  transcript.state.tokensOutTotal += usage?.outputTokens ?? 0
}

function appendTeacherMessage(
  transcript: TranscriptV1,
  status: TeachingStatus,
  teacherMessage: string,
  kpTakeaway: string | null,
  ts: string
): number {
  if (status === 'teaching') {
    const message: TranscriptMessage = {
      kind: 'socratic_question',
      role: 'teacher',
      content: teacherMessage,
      kpId: 0,
      ts,
      model: MODEL_ID,
    }
    transcript.messages.push(message)
    return transcript.state.strugglingStreak
  }

  if (status === 'struggling') {
    transcript.state.strugglingStreak += 1
    const message: TranscriptMessage = {
      kind: 'struggling_hint',
      role: 'teacher',
      content: teacherMessage,
      kpId: 0,
      ts,
      model: MODEL_ID,
    }
    transcript.messages.push(message)
    return transcript.state.strugglingStreak
  }

  const takeawayMessage: TranscriptMessage = {
    kind: 'kp_takeaway',
    role: 'teacher',
    kpId: 0,
    summary: kpTakeaway ?? '',
    ts,
    model: MODEL_ID,
  }
  transcript.messages.push(takeawayMessage)
  transcript.state.strugglingStreak = 0
  if (!transcript.state.coveredKpIds.includes(0)) {
    transcript.state.coveredKpIds.push(0)
  }
  return transcript.state.strugglingStreak
}

async function main(): Promise<number> {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  requireEnv('DATABASE_URL')
  requireEnv('DEEPSEEK_API_KEY')

  process.env.AI_MODEL = MODEL_ID

  const [
    { registry },
    { getTeacherModel },
    { getPrompt },
    { TranscriptOutputSchema, buildTeacherMessages, kpTypeToStage },
    { emptyTranscript },
  ] = await Promise.all([
    import('../src/lib/ai'),
    import('../src/lib/teacher-model'),
    import('../src/lib/prompt-templates'),
    import('../src/lib/teacher-prompts'),
    import('../src/lib/teaching-types'),
  ])

  const modelId = getTeacherModel('free')
  const errors: string[] = []
  const fixtureReports: FixtureReport[] = []
  const statusCoverage: Record<TeachingStatus, number> = {
    teaching: 0,
    ready_to_advance: 0,
    struggling: 0,
  }

  let successfulTurns = 0

  for (const fixture of CLUSTER_FIXTURES) {
    const transcript = emptyTranscript()
    transcript.state.currentKpId = 0
    const turns: TurnReport[] = []
    const studentInputs = STUDENT_INPUTS_BY_TYPE[fixture.kp_type]

    for (let turnIndex = 0; turnIndex < studentInputs.length; turnIndex += 1) {
      const studentInput = studentInputs[turnIndex]

      try {
        const layer2Template = await getPrompt('teacher', kpTypeToStage(fixture.kp_type), {
          kp_content: fixture.mainKp.description,
          cluster_kps: fixture.allKps.map((kp, index) => `${index + 1}. ${kp.description}`).join('\n'),
          struggling_streak: String(transcript.state.strugglingStreak),
        })

        const messages = buildTeacherMessages({
          layer2Template,
          transcript,
          studentInput,
        })

        const result = await generateObject({
          model: registry.languageModel(modelId),
          schema: TranscriptOutputSchema,
          messages,
          maxOutputTokens: 65536,
        })

        const output = result.object
        const usage = result.usage as UsageRecord | undefined
        const now = new Date().toISOString()

        if (!transcript.state.startedAt) {
          transcript.state.startedAt = now
        }
        transcript.state.lastActiveAt = now
        updateUsage(transcript, usage)
        appendStudentMessage(transcript, studentInput, now)

        const strugglingStreakAfter = appendTeacherMessage(
          transcript,
          output.status,
          output.message,
          output.kpTakeaway,
          now
        )

        successfulTurns += 1
        statusCoverage[output.status] += 1
        turns.push({
          turn_index: turnIndex + 1,
          student_input: studentInput,
          status: output.status,
          teacher_message: output.message,
          kp_takeaway: output.kpTakeaway,
          struggling_streak_after: strugglingStreakAfter,
        })
      } catch (error) {
        errors.push(
          `[${fixture.kp_type}] turn ${turnIndex + 1} in ${fixture.id} failed: ${formatError(error)}`
        )
      }
    }

    fixtureReports.push({
      kp_type: fixture.kp_type,
      cluster_summary: summarizeCluster(fixture.mainKp.description),
      turns,
    })
  }

  const allPass =
    successfulTurns === 50 &&
    statusCoverage.teaching > 0 &&
    statusCoverage.ready_to_advance > 0 &&
    statusCoverage.struggling > 0 &&
    errors.length === 0

  const report: RegressionReport = {
    ts: new Date().toISOString(),
    model: MODEL_ID,
    summary: {
      total_turns: 50,
      successful_turns: successfulTurns,
      status_coverage: statusCoverage,
      all_pass: allPass,
    },
    fixtures: fixtureReports,
    errors,
  }

  mkdirSync(dirname(RESULTS_PATH), { recursive: true })
  writeFileSync(RESULTS_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`Teaching regression report written to ${RESULTS_PATH}`)

  return allPass ? 0 : 1
}

void main()
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch((error) => {
    console.error(formatError(error))
    process.exitCode = 1
  })
