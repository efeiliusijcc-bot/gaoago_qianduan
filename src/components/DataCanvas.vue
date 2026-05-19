<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import DOMPurify from 'dompurify'

const purifyConfig = {
  ALLOWED_TAGS: [
    'h1','h2','h3','h4','h5','h6','p','br','hr','div','span',
    'ul','ol','li','table','thead','tbody','tr','th','td',
    'strong','em','b','i','u','a','blockquote','pre','code',
    'img','figure','figcaption','sub','sup',
  ],
  ALLOWED_ATTR: ['href','src','alt','title','class','id','target','rel'],
}

const props = defineProps({
  phase: String,
  loadingStep: String,
  processLogs: Array,
  generatedHtml: String,
  reportType: String,
  title: String,
  contextText: String,
  parameterValues: {
    type: Object,
    default: () => ({}),
  },
  activeParameters: {
    type: Array,
    default: () => [],
  },
  job: Object,
  jobList: Array,
  health: Object,
  errorMessage: String,
  isHistoryMode: Boolean,
  isGenerating: Boolean,
  isPlanning: Boolean,
  reportPlan: Object,
  planStepIndex: {
    type: Number,
    default: 0,
  },
  planSelections: {
    type: Object,
    default: () => ({}),
  },
  planSearchSelections: {
    type: Array,
    default: () => [],
  },
  planSourceInput: {
    type: String,
    default: '',
  },
  planSupplement: {
    type: String,
    default: '',
  },
  planError: String,
  executionLogs: {
    type: Array,
    default: () => [],
  },
  unreadLogCount: {
    type: Number,
    default: 0,
  },
  isLogDrawerOpen: Boolean,
  hasReturnableWorkspace: Boolean,
})

const emit = defineEmits([
  'list',
  'new-report',
  'show-active-workspace',
  'toggle-log-drawer',
  'update:title',
  'update:reportType',
  'update:contextText',
  'update:parameterValues',
  'update:activeParameters',
  'update:planSourceInput',
  'update:planSupplement',
  'generate',
  'confirm-plan',
  'cancel-plan',
  'toggle-plan-option',
  'toggle-plan-search-query',
  'next-plan-step',
  'prev-plan-step',
])
const reportRef = ref(null)
const drawerLogListRef = ref(null)
const liveLogListRef = ref(null)
const contextTextRef = ref(null)
const technicalLogOpenIds = ref(new Set())
const liveLogShouldStick = ref(true)
const drawerLogShouldStick = ref(true)
let liveLogScrollTimer = null

const canExport = computed(() => props.phase === 'done' && Boolean(props.generatedHtml))
const isLiveLogVisible = computed(() => props.phase === 'loading')
const canOpenLogDrawer = computed(() => !isLiveLogVisible.value)
const showLogDrawer = computed(() => props.isLogDrawerOpen && canOpenLogDrawer.value)
const showNewReportButton = computed(() => props.isHistoryMode || props.phase === 'done' || props.phase === 'error')
const canGenerate = computed(() => Boolean(props.reportType) && Boolean(props.title?.trim()) && !props.isGenerating && !props.isPlanning)
const titleLength = computed(() => props.title?.length || 0)
const currentPlanStep = computed(() => props.reportPlan?.steps?.[props.planStepIndex] || null)
const isLastPlanStep = computed(() => props.planStepIndex >= ((props.reportPlan?.steps?.length || 1) - 1))
const reportTypeLabel = computed(() => {
  if (props.reportType === 'person-intelligence-report') return '人物报'
  if (props.reportType === 'risk-assessment-reports') return '风险报'
  if (props.reportType === 'write-hb-k') return 'K报'
  if (props.reportType === 'write-hb-hb') return 'HB报'
  return props.job?.skill || '报告'
})
const taskStatusType = computed(() => {
  const status = props.job?.status
  if (status === 'succeeded' || props.phase === 'done') return 'success'
  if (status === 'failed' || status === 'cancelled' || status === 'waiting_approval' || props.phase === 'error') return 'failed'
  return 'running'
})
const taskStatusLabel = computed(() => {
  if (taskStatusType.value === 'success') return '成功'
  if (taskStatusType.value === 'failed') return '失败'
  return '生成中'
})
const taskStatusClass = computed(() => {
  if (taskStatusType.value === 'success') return 'text-neon-green'
  if (taskStatusType.value === 'failed') return 'text-red-300'
  return 'text-cyber-yellow'
})
const sanitizedHtml = computed(() => DOMPurify.sanitize(props.generatedHtml || '', purifyConfig))
const reportTypeOptions = [
  {
    value: 'write-hb-k',
    label: 'K报告编写',
    icon: '▤',
    desc: '三段式现场调研报告：基本情况、涉我风险、对策建议',
    params: ['背景信息', '关注方向', '时间范围', '地区 / 对象', '已知上下文'],
    placeholder: '请输入需要编报的标题，例如：2026年东南亚区域安全态势研判',
  },
  {
    value: 'write-hb-hb',
    label: 'HB报告编写',
    icon: '◇',
    desc: '综合汇编类报告：背景脉络、关键动态、风险判断、后续建议',
    params: ['背景信息', '关注方向', '材料范围', '地区 / 对象', '已知上下文'],
    placeholder: '请输入HB报主题，例如：重点行业政策动态汇编',
  },
  {
    value: 'risk-assessment-reports',
    label: '风险报告编写',
    icon: '◎',
    desc: '风险评估报告：场景设定、风险识别、趋势研判、处置建议',
    params: ['风险场景', '研判方向', '时间范围', '地区 / 对象', '已知上下文'],
    placeholder: '请输入风险报标题，例如：企业员工关怀月活动风险评估',
  },
  {
    value: 'person-intelligence-report',
    label: '人文报告编写',
    icon: '▣',
    desc: '人物情报报告：基本情况、政治立场、风险点、接待建议',
    params: ['人物背景', '国家 / 地区', '当前职务', '来访场景', '已知上下文'],
    placeholder: '请输入人物报标题，例如：某国政要人物情报报告',
  },
]
const selectedReportType = computed(() => reportTypeOptions.find((item) => item.value === props.reportType))
const activeSelectedParameters = computed(() => {
  const params = selectedReportType.value?.params || []
  return props.activeParameters.filter((param) => params.includes(param))
})

const singleLineParameters = new Set(['时间范围', '地区 / 对象', '国家 / 地区', '当前职务', '材料范围'])

function selectReportType(value) {
  emit('update:reportType', props.reportType === value ? '' : value)
}

function isParameterActive(param) {
  return props.activeParameters.includes(param)
}

function parameterInputType(param) {
  return singleLineParameters.has(param) ? 'input' : 'textarea'
}

function parameterPlaceholder(param) {
  const hints = {
    '背景信息': '补充事件背景、已知事实、历史脉络或前置材料。',
    '关注方向': '说明重点研判角度、必须覆盖的问题或核心判断方向。',
    '时间范围': '例如：2026年5月、近三个月、2025年至今。',
    '地区 / 对象': '例如：欧盟、东南亚、某城市、某机构或重点企业。',
    '已知上下文': '粘贴已有材料、口径、线索、数据或需要引用的上下文。',
    '材料范围': '说明需要汇编的材料类型、来源范围或时间跨度。',
    '风险场景': '描述需要评估的场景、触发条件或潜在事件。',
    '研判方向': '说明风险识别、趋势判断、影响评估或处置建议方向。',
    '人物背景': '补充人物履历、派系关系、公开立场或关键经历。',
    '国家 / 地区': '填写人物所属国家、地区或主要活动范围。',
    '当前职务': '填写人物当前职位、组织身份或实际角色。',
    '来访场景': '说明访问背景、议题、接待对象或敏感点。',
  }
  return hints[param] || `填写${param}相关信息。`
}

function toggleParameter(param) {
  const next = isParameterActive(param)
    ? props.activeParameters.filter((item) => item !== param)
    : [...props.activeParameters, param]
  emit('update:activeParameters', next)
  nextTick(() => {
    if (contextTextRef.value && !isParameterActive(param)) contextTextRef.value.focus()
  })
}

function updateParameterValue(param, value) {
  emit('update:parameterValues', {
    ...props.parameterValues,
    [param]: value,
  })
}

function submitReport() {
  if (canGenerate.value) emit('generate')
}

function isPlanOptionSelected(stepId, optionId) {
  return (props.planSelections?.[stepId] || []).includes(optionId)
}

function isPlanSearchQuerySelected(query) {
  return (props.planSearchSelections || []).includes(query)
}

function planStepTypeLabel(type) {
  const labels = {
    search_queries: '检索词',
    source_scope: '信源范围',
    basic_info_module: '基本信息模块',
    analysis_module: '研判模块',
    output_module: '输出模块',
    report_section: '编报章节',
  }
  return labels[type] || '编报模块'
}

function toggleLogDrawer() {
  if (canOpenLogDrawer.value) emit('toggle-log-drawer')
}

function logTypeLabel(type) {
  if (type === 'tool_start') return '工具开始'
  if (type === 'tool_end') return '工具完成'
  if (type === 'tool_error') return '工具错误'
  if (type === 'done') return '任务完成'
  if (type === 'error') return '任务错误'
  return '阶段'
}

function logStatusClass(status) {
  if (status === 'failed' || status === 'error') return 'text-red-300 border-red-400/35 bg-red-950/30'
  if (status === 'completed' || status === 'succeeded') return 'text-neon-green border-neon-green/30 bg-neon-green/5'
  if (status === 'fallback') return 'text-cyber-yellow border-cyber-yellow/30 bg-cyber-yellow/5'
  return 'text-slate-500 border-neon-cyan/25 bg-neon-cyan/5'
}

function buildRawLogText(log) {
  return [log?.label, log?.summary, log?.command, log?.detail]
    .filter(Boolean)
    .join('\n')
}

function extractQuery(rawLog) {
  const text = rawLog || ''
  const quoted = text.match(/--query\s+["']([^"']+)["']/i)
  if (quoted?.[1]) return quoted[1].trim()
  const plain = text.match(/--query\s+([^\n\r]+)/i)
  if (!plain?.[1]) return ''
  return plain[1].replace(/\s+--\S+.*$/, '').trim()
}

function workflowLogView(phase, rawLog, status) {
  const lowerPhase = String(phase || '').toLowerCase()
  const lower = String(rawLog || '').toLowerCase()
  const views = {
    start: ['CONNECTING', '正在连接 AI 编报引擎', '系统正在与后端 Agent 建立任务通道。'],
    running: ['AGENT_START', 'AI 编报助手已启动', '任务已进入 OpenClaw report-agent 执行流程。'],
    'openclaw:start': ['AGENT_START', 'AI 编报助手已启动', 'OpenClaw report-agent 已开始处理本次编报任务。'],
    'openclaw:complete': ['COMPLETED', '编报 Agent 已完成', 'OpenClaw report-agent 已完成执行。'],
    waiting_final_report: ['WAITING_REPORT', '等待最终报告文件', 'Agent 已返回文件指针，系统正在等待最终 Markdown 报告落盘。'],
    context_preparing: ['PREPARING', '准备任务上下文', '系统正在整理本次编报所需的主题、参数和上下文文件。'],
    research_planning: ['PLANNING', '生成调研计划', 'AI 正在把编报主题拆解为可执行的调研计划。'],
    research_dispatch: ['RESEARCH_TASK', '启动调研子任务', '系统正在创建调研分组并分派 research 子任务。'],
    research_waiting: ['WAITING_RESEARCH', '等待调研完成', '主 Agent 正在等待 research 子任务返回调研结果。'],
    research_collecting: ['RESEARCHING', '执行资料调研', '调研子任务正在检索、读取和整理公开资料。'],
    research_complete: ['RESEARCH_DONE', '调研结果已返回', 'research 子任务已完成，主 Agent 正在收集结果。'],
    synthesis_dispatch: ['SYNTHESIS_TASK', '启动撰稿子任务', '系统正在启动 synthesis 子任务生成报告正文。'],
    synthesis_waiting: ['WAITING_SYNTHESIS', '等待撰稿完成', '主 Agent 正在等待 synthesis 子任务完成报告正文。'],
    synthesis_writing: ['WRITING', '整合并撰写报告', 'AI 正在整合调研材料并撰写最终报告。'],
    report_verifying: ['VERIFYING', '校验报告文件', '系统正在确认 Markdown 报告文件已经生成且内容可用。'],
    report_saving: ['SAVING', '保存报告文件', '报告正文已经生成，系统正在保存并登记报告文件。'],
    technical_detail: ['DETAIL', '处理技术细节', '系统正在读取技能、配置或中间文件；可展开查看原始命令。'],
    done: ['COMPLETED', '编报任务已完成', '报告已生成，可以查看或导出。'],
    error: ['ERROR', '任务执行出现异常', '系统执行过程中出现异常，请查看技术详情或重试。'],
  }
  const match = views[lowerPhase]
  if (match) return { stage: match[0], title: match[1], description: match[2], status }
  if (lower.includes('preparing openclaw gateway')) return { stage: 'CONNECTING', title: views.start[1], description: views.start[2], status }
  if (lower.includes('running openclaw report-agent')) return { stage: 'AGENT_START', title: views.running[1], description: views.running[2], status }
  if (lower.includes('waiting_final_report') || lower.includes('waiting for the final report')) return { stage: 'WAITING_REPORT', title: views.waiting_final_report[1], description: views.waiting_final_report[2], status }
  if (lower.includes('sessions_spawn') && lower.includes('research-group')) return { stage: 'RESEARCH_TASK', title: views.research_dispatch[1], description: views.research_dispatch[2], status }
  if (lower.includes('sessions_spawn') && lower.includes('synthesis')) return { stage: 'SYNTHESIS_TASK', title: views.synthesis_dispatch[1], description: views.synthesis_dispatch[2], status }
  if (lower.includes('sessions_yield') && lower.includes('synthesis')) return { stage: 'WAITING_SYNTHESIS', title: views.synthesis_waiting[1], description: views.synthesis_waiting[2], status }
  if (lower.includes('sessions_yield')) return { stage: 'WAITING_RESEARCH', title: views.research_waiting[1], description: views.research_waiting[2], status }
  if (lower.includes('harness_cli.py plan') || lower.includes('plan.json')) return { stage: 'PLANNING', title: views.research_planning[1], description: views.research_planning[2], status }
  if (lower.includes('group_') && lower.includes('.json')) return { stage: 'RESEARCH_TASK', title: views.research_dispatch[1], description: views.research_dispatch[2], status }
  if (lower.includes('context.json')) return { stage: 'PREPARING', title: views.context_preparing[1], description: views.context_preparing[2], status }
  if ((lower.includes('report_file') || lower.includes('final/report.md')) && !lower.includes('error')) return { stage: 'SAVING', title: views.report_saving[1], description: views.report_saving[2], status }
  return null
}

function isLowValueTechnicalLog(rawLog) {
  const lower = String(rawLog || '').toLowerCase()
  return lower.includes('skill.md') ||
    lower.includes('/skills/') ||
    lower.includes('sessions.json') ||
    lower.includes('uuid') ||
    lower.includes('read completed') ||
    lower.includes('command completed')
}

function translateOpenClawLog(log) {
  const rawLog = buildRawLogText(log)
  const lower = rawLog.toLowerCase()
  const status = log?.status === 'failed' || log?.status === 'error'
    ? 'error'
    : log?.status === 'completed' || log?.status === 'succeeded' || log?.type === 'done'
      ? 'done'
      : 'running'

  const base = {
    time: log?.time || '',
    stage: 'RUNNING',
    title: '正在推进编报任务',
    description: '系统正在执行当前编报步骤。',
    raw: rawLog,
    status,
  }

  const hasFailureText = lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('timed out') ||
    lower.includes('timeout exceeded') ||
    lower.includes('超时')

  if (hasFailureText) {
    return {
      ...base,
      stage: 'ERROR',
      title: '任务执行出现异常',
      description: '系统执行过程中出现异常，请查看技术详情或重试。',
      status: 'error',
    }
  }

  if (lower.includes('succeeded')) {
    return {
      ...base,
      stage: 'COMPLETED',
      title: '编报任务已完成',
      description: '报告已生成，可查看或导出。',
      status: 'done',
    }
  }

  const workflowView = workflowLogView(log?.phase || log?.status, rawLog, status)
  if (workflowView) return { ...base, ...workflowView }

  if (isLowValueTechnicalLog(rawLog)) {
    return {
      ...base,
      stage: 'DETAIL',
      title: '处理技术细节',
      description: '系统正在读取技能、配置或中间文件；可展开查看原始命令。',
      status,
    }
  }

  if (lower.includes('preparing openclaw gateway')) {
    return {
      ...base,
      stage: 'CONNECTING',
      title: '正在连接 AI 编报引擎',
      description: '系统正在与后端 Agent 建立任务通道。',
    }
  }

  if (lower.includes('running openclaw report-agent')) {
    return {
      ...base,
      stage: 'AGENT_START',
      title: 'AI 编报助手已启动',
      description: '任务已进入 Agent 执行流程。',
    }
  }

  if (lower.includes('planner') || lower.includes('planning') || lower.includes('decomposition')) {
    return {
      ...base,
      stage: 'PLANNING',
      title: '正在拆解编报任务',
      description: 'AI 正在分析主题，并拆解调研方向。',
    }
  }

  if (lower.includes('research_cli.py brief') || lower.includes('search') || lower.includes('firecrawl') || lower.includes('tavily')) {
    const query = extractQuery(rawLog)
    return {
      ...base,
      stage: 'SEARCHING',
      title: '正在检索相关资料',
      description: query
        ? `检索主题：${query}`
        : '系统正在检索与当前主题相关的公开资料、新闻和政策信息。',
    }
  }

  if (lower.includes('extract') || lower.includes('crawl') || lower.includes('scrape')) {
    return {
      ...base,
      stage: 'EXTRACTING',
      title: '正在提取网页正文',
      description: '系统正在读取重点来源内容，提取可用于编报的事实材料。',
    }
  }

  if (lower.includes('synthesizer') || lower.includes('synthesize') || lower.includes('analysis')) {
    return {
      ...base,
      stage: 'ANALYZING',
      title: '正在整合研判材料',
      description: 'AI 正在对检索材料进行归纳、筛选和交叉分析。',
    }
  }

  if (lower.includes('command completed')) {
    return {
      ...base,
      stage: 'STEP_DONE',
      title: '当前步骤已完成',
      description: '一个执行步骤已完成，系统正在进入下一阶段。',
      status: 'done',
    }
  }

  if (lower.includes('write') || lower.includes('report_file')) {
    return {
      ...base,
      stage: 'SAVING',
      title: '正在生成报告文件',
      description: '报告正文已生成，正在保存为文件。',
    }
  }

  return base
}

function friendlyLogStatusClass(status) {
  if (status === 'error') return 'log-entry-error'
  if (status === 'done') return 'log-entry-done'
  return 'log-entry-running'
}

function friendlyLogStatusLabel(status) {
  if (status === 'error') return 'error'
  if (status === 'done') return 'done'
  return 'running'
}

function isTechnicalLogOpen(id) {
  return technicalLogOpenIds.value.has(id)
}

function toggleTechnicalLog(id) {
  const next = new Set(technicalLogOpenIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  technicalLogOpenIds.value = next
}

function scrollToBottom() {
  nextTick(() => {
    if (reportRef.value) {
      reportRef.value.scrollTop = reportRef.value.scrollHeight
    }
  })
}

function scrollToTop() {
  nextTick(() => {
    if (reportRef.value) {
      reportRef.value.scrollTop = 0
    }
  })
}

function scrollLogsToBottom() {
  nextTick(() => {
    const target = isLiveLogVisible.value ? liveLogListRef.value : drawerLogListRef.value
    const shouldStick = isLiveLogVisible.value ? liveLogShouldStick.value : drawerLogShouldStick.value
    if (target && shouldStick) {
      target.scrollTop = target.scrollHeight
    }
  })
}

function scrollLiveLogsToBottom() {
  nextTick(() => {
    if (liveLogListRef.value && liveLogShouldStick.value) {
      liveLogListRef.value.scrollTop = liveLogListRef.value.scrollHeight
    }
  })
}

function setLiveLogAutoScroll(enabled) {
  if (liveLogScrollTimer) {
    clearInterval(liveLogScrollTimer)
    liveLogScrollTimer = null
  }
  if (enabled) {
    scrollLiveLogsToBottom()
    liveLogScrollTimer = setInterval(scrollLiveLogsToBottom, 700)
  }
}

function handleLogScroll(kind, event) {
  const target = event.currentTarget
  if (!target) return
  const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 80
  if (kind === 'live') liveLogShouldStick.value = nearBottom
  else drawerLogShouldStick.value = nearBottom
}

function handleGeneratedHtmlChange() {
  if (props.phase === 'done') {
    scrollToTop()
    return
  }
  scrollToBottom()
}

watch(() => props.generatedHtml, handleGeneratedHtmlChange)
watch(() => [props.phase, props.isHistoryMode], () => {
  if (props.phase === 'done') scrollToTop()
})
watch(() => props.processLogs, scrollToBottom, { deep: true })
watch(() => props.processLogs?.length || 0, scrollLogsToBottom)
watch(() => props.executionLogs.length, scrollLogsToBottom)
watch(() => props.isLogDrawerOpen, (open) => {
  if (open) scrollLogsToBottom()
})
watch(isLiveLogVisible, (visible) => {
  setLiveLogAutoScroll(visible)
}, { immediate: true })

onBeforeUnmount(() => setLiveLogAutoScroll(false))

function htmlToPlainText(html) {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return div.textContent || div.innerText || ''
}

function collectDocxBlocks(html, docx) {
  const { Paragraph, TextRun, Table, TableCell, TableRow, WidthType, HeadingLevel, AlignmentType, BorderStyle } = docx
  const root = document.createElement('div')
  root.innerHTML = DOMPurify.sanitize(html || '', purifyConfig)
  const blocks = []

  for (const node of root.children) {
    const tag = node.tagName.toLowerCase()
    const text = node.textContent?.trim() || ''
    if (!text && tag !== 'table') continue

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      blocks.push(
        new Paragraph({
          text,
          heading: tag === 'h1' ? HeadingLevel.HEADING_1 : tag === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
        }),
      )
    } else if (tag === 'ul' || tag === 'ol') {
      for (const li of node.querySelectorAll('li')) {
        blocks.push(
          new Paragraph({
            children: [new TextRun({ text: li.textContent?.trim() || '', size: 24, font: 'SimSun' })],
            bullet: tag === 'ul' ? { level: 0 } : undefined,
            numbering: tag === 'ol' ? { reference: 'default-numbering', level: 0 } : undefined,
            spacing: { after: 80 },
          }),
        )
      }
    } else if (tag === 'table') {
      const rows = [...node.querySelectorAll('tr')].map((tr) => {
        const cells = [...tr.children].map((cell) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: cell.textContent?.trim() || '', size: 20, font: 'SimSun' })],
              }),
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
          }),
        )
        return new TableRow({ children: cells })
      })
      if (rows.length) {
        blocks.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
      }
    } else {
      blocks.push(
        new Paragraph({
          children: [new TextRun({ text, size: 24, font: 'SimSun' })],
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 480 },
          spacing: { after: 160 },
        }),
      )
    }
  }

  return blocks.length
    ? blocks
    : htmlToPlainText(html)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => new Paragraph({ text: line }))
}

async function exportWord() {
  if (!canExport.value) return

  const docx = await import('docx')
  const { saveAs } = await import('file-saver')
  const { Document, AlignmentType, Packer } = docx

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        children: collectDocxBlocks(props.generatedHtml, docx),
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${props.title || props.job?.jobId || 'report'}.docx`)
}

function exportPdf() {
  if (!canExport.value) return

  const safeHtml = DOMPurify.sanitize(props.generatedHtml || '', purifyConfig)
  const safeTitle = DOMPurify.sanitize(props.title || '报告', { ALLOWED_TAGS: [] })
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: "Microsoft YaHei", SimSun, sans-serif; color: #111; padding: 40px; line-height: 1.75; }
    h1 { text-align: center; font-size: 24px; }
    h2 { color: #0f4c81; border-bottom: 1px solid #0f4c81; padding-bottom: 6px; }
    h3 { color: #0f4c81; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; }
    blockquote { border-left: 4px solid #999; padding-left: 12px; color: #555; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  ${safeHtml}
</body>
</html>`)
  printWindow.document.close()
  printWindow.onload = () => printWindow.print()
}
</script>

<template>
  <main class="data-canvas flex-1 flex flex-col overflow-hidden relative">
    <div class="workspace-subbar h-14 flex items-center justify-between px-5">
      <div class="workspace-meta flex items-center gap-3">
        <span class="font-mono text-[10px] tracking-widest text-[#374151]">
          [ {{ isHistoryMode ? '历史报告查看' : '数据输出终端' }} ]
        </span>
        <span v-if="phase !== 'idle'" class="font-mono text-[10px] text-neon-green">
          {{ reportTypeLabel }} / {{ phase === 'done' ? '已完成' : phase === 'error' ? '失败' : '处理中' }}
        </span>
        <span v-if="job?.jobId" class="font-mono text-[10px] text-slate-500">
          JOB {{ job.jobId.slice(0, 8) }}
        </span>
      </div>

      <div class="workspace-actions flex items-center gap-2">
        <button
          v-if="hasReturnableWorkspace"
          @click="emit('show-active-workspace')"
          class="sci-btn text-[10px] px-3 py-2 border-neon-green text-neon-green"
        >
          返回生成编报
        </button>
        <button
          @click="toggleLogDrawer"
          :disabled="!canOpenLogDrawer"
          class="sci-btn text-[10px] px-3 py-2 relative"
          :title="isLiveLogVisible ? '运行中日志已在中间实时展示' : '打开执行日志'"
        >
          执行日志
          <span
            v-if="unreadLogCount"
            class="absolute -right-2 -top-2 min-w-5 h-5 px-1 rounded-full bg-cyber-yellow text-black text-[10px] leading-5 text-center"
          >
            {{ unreadLogCount > 99 ? '99+' : unreadLogCount }}
          </span>
        </button>
        <button v-if="showNewReportButton" @click="emit('new-report')" class="sci-btn text-[10px] px-3 py-2">
          清屏并开启下一个编报
        </button>
        <button @click="exportWord" :disabled="!canExport" class="sci-btn text-[10px] px-3 py-2">导出 Word</button>
        <button
          @click="exportPdf"
          :disabled="!canExport"
          class="sci-btn text-[10px] px-3 py-2"
        >
          导出 PDF
        </button>
        <button @click="emit('list')" class="sci-btn text-[10px] px-3 py-2">报告列表</button>
      </div>
    </div>

      <aside
        v-if="showLogDrawer"
        class="log-drawer-panel absolute right-0 top-14 bottom-0 z-20 w-[420px] max-w-[calc(100%-1rem)] border-l backdrop-blur overflow-hidden flex flex-col"
      >
        <div class="h-12 border-b border-border-glow flex items-center justify-between px-4">
          <div>
            <div class="font-mono text-xs neon-text tracking-widest">执行日志</div>
            <div class="font-mono text-[10px] text-[#374151]">OpenClaw 工具调用摘要</div>
          </div>
          <button @click="emit('toggle-log-drawer')" class="sci-btn text-[10px] px-2 py-1">关闭</button>
        </div>

        <div ref="drawerLogListRef" class="flex-1 overflow-auto p-4 space-y-3" @scroll="handleLogScroll('drawer', $event)">
          <div v-if="!executionLogs.length" class="h-full flex items-center justify-center text-center">
            <div>
              <div class="font-mono text-3xl mb-3" style="color: #94a3b8">LOGS</div>
              <div class="font-mono text-xs" style="color: #94a3b8">暂无执行日志</div>
            </div>
          </div>

          <div
            v-for="log in executionLogs"
            :key="log.id"
            class="friendly-log-card"
            :class="friendlyLogStatusClass(translateOpenClawLog(log).status)"
          >
            <div class="friendly-log-main">
              <div class="friendly-log-dot"></div>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="friendly-log-stage">{{ translateOpenClawLog(log).stage }}</div>
                    <div class="friendly-log-title">{{ translateOpenClawLog(log).title }}</div>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <span class="friendly-log-time">{{ translateOpenClawLog(log).time }}</span>
                    <span class="friendly-log-status">{{ friendlyLogStatusLabel(translateOpenClawLog(log).status) }}</span>
                  </div>
                </div>
                <div class="friendly-log-description">{{ translateOpenClawLog(log).description }}</div>
                <button
                  v-if="translateOpenClawLog(log).raw"
                  type="button"
                  class="friendly-log-toggle"
                  @click="toggleTechnicalLog(log.id)"
                >
                  {{ isTechnicalLogOpen(log.id) ? '收起技术详情' : '查看技术详情' }}
                </button>
                <pre v-if="isTechnicalLogOpen(log.id)" class="friendly-log-raw">{{ translateOpenClawLog(log).raw }}</pre>
              </div>
            </div>
          </div>
        </div>
      </aside>

    <div
      v-if="reportPlan || isPlanning || planError"
      class="plan-modal-backdrop absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm px-6"
    >
      <section class="plan-modal-panel w-full max-w-4xl rounded-[24px] border overflow-hidden flex flex-col">
        <div class="flex-shrink-0 px-6 py-5 border-b border-neon-cyan/12 flex items-start justify-between gap-4">
          <div>
            <div class="font-mono text-[11px] tracking-[0.28em] text-[#374151] mb-2">PLAN MODE</div>
            <h2 class="font-mono text-xl neon-text">编报规划确认</h2>
            <p class="mt-2 text-sm text-slate-300/60">
              先按主题生成检索方向和子任务，勾选需要纳入正式编报的内容后再提交。
            </p>
          </div>
          <button class="sci-btn text-[10px] px-3 py-2" type="button" @click="emit('cancel-plan')">关闭</button>
        </div>

        <div v-if="isPlanning" class="plan-modal-scroll px-6 py-14 text-center">
          <div class="nexus-loader scale-75 mx-auto">
            <div class="loader-ring ring-a"></div>
            <div class="loader-ring ring-b"></div>
            <div class="loader-core"></div>
          </div>
          <div class="font-mono text-[#0f172a] mt-6">正在规划检索方向...</div>
          <div class="font-mono text-[11px] text-[#374151] mt-2">预计 10-30 秒，请稍候</div>
        </div>

        <div v-else-if="planError" class="plan-modal-scroll px-6 py-8">
          <div class="rounded-2xl border border-red-400/35 bg-red-950/25 px-4 py-4 text-red-200 text-sm">
            {{ planError }}
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <button class="sci-btn text-[10px] px-3 py-2" type="button" @click="emit('cancel-plan')">返回修改</button>
            <button class="sci-btn text-[10px] px-3 py-2 border-neon-green text-neon-green" type="button" @click="emit('confirm-plan')">
              跳过规划直接提交
            </button>
          </div>
        </div>

        <div v-else class="plan-modal-body">
          <div class="flex-shrink-0 px-6 pt-5">
            <div class="rounded-2xl border border-neon-cyan/12 bg-black/16 px-4 py-3 mb-5">
              <div class="font-mono text-sm text-[#0f172a] mb-2">{{ reportPlan.title }}</div>
              <div class="text-sm text-slate-300/70 leading-relaxed">{{ reportPlan.summary }}</div>
            </div>

            <div class="flex items-center gap-2 mb-5">
              <button
                v-for="(step, index) in reportPlan.steps"
                :key="step.id"
                class="h-2 flex-1 rounded-full transition-all"
                :class="index <= planStepIndex ? 'bg-neon-cyan/75 shadow-[0_0_10px_rgba(0,243,255,0.16)]' : 'bg-neon-cyan/10'"
                type="button"
                @click="index < planStepIndex ? emit('prev-plan-step') : null"
              ></button>
            </div>
          </div>

          <div v-if="currentPlanStep" class="plan-modal-scroll px-6 pb-5">
            <div class="mb-4">
              <div class="font-mono text-[11px] tracking-[0.24em] text-slate-700 mb-2">
                STEP {{ planStepIndex + 1 }} / {{ reportPlan.steps.length }} · {{ planStepTypeLabel(currentPlanStep.type) }}
              </div>
              <h3 class="font-mono text-lg text-[#0f172a]">{{ currentPlanStep.sectionTitle || currentPlanStep.title }}</h3>
              <p class="text-sm text-[#374151] mt-1">{{ currentPlanStep.description }}</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                v-for="option in currentPlanStep.options"
                :key="option.id"
                class="text-left rounded-2xl border p-4 transition-all hover:-translate-y-0.5"
                :class="isPlanOptionSelected(currentPlanStep.id, option.id)
                  ? 'border-neon-cyan/55 bg-neon-cyan/[0.08] shadow-[0_0_24px_rgba(0,243,255,0.10)]'
                  : 'border-neon-cyan/12 bg-black/18 hover:border-neon-cyan/30 hover:bg-neon-cyan/[0.04]'"
                type="button"
                @click="emit('toggle-plan-option', currentPlanStep.id, option.id)"
              >
                <div class="flex items-center justify-between gap-3 mb-2">
                  <span class="font-mono text-sm" :class="isPlanOptionSelected(currentPlanStep.id, option.id) ? '' : 'text-slate-200/80'" :style="isPlanOptionSelected(currentPlanStep.id, option.id) ? 'color: #0ea5e9' : ''">
                    {{ option.label }}
                  </span>
                  <span
                    class="h-5 w-5 rounded-full border flex items-center justify-center font-mono text-[10px]"
                    :class="isPlanOptionSelected(currentPlanStep.id, option.id) ? 'border-neon-cyan bg-neon-cyan text-deep-void' : 'border-neon-cyan/20'"
                    :style="!isPlanOptionSelected(currentPlanStep.id, option.id) ? 'color: #0ea5e9' : ''"
                  >
                    ✓
                  </span>
                </div>
                <div class="text-xs leading-relaxed text-[#374151]">{{ option.detail }}</div>
              </button>
            </div>

            <div v-if="isLastPlanStep" class="mt-5 rounded-2xl border border-neon-cyan/12 bg-black/14 p-3">
              <label class="block font-mono text-[10px] tracking-widest text-[#374151] mb-2">补充方向</label>
              <textarea
                class="sci-textarea text-sm bg-black/15"
                rows="3"
                :value="planSupplement"
                placeholder="可补充必须纳入编报的方向、限制条件或特别关注点..."
                @input="emit('update:planSupplement', $event.target.value)"
              ></textarea>
            </div>

            <div v-if="isLastPlanStep" class="mt-5 rounded-2xl border border-neon-cyan/12 bg-black/14 p-3">
              <label class="block font-mono text-[10px] tracking-widest text-[#374151] mb-2">指定信源 / URL / 机构</label>
              <textarea
                class="sci-textarea text-sm bg-black/15"
                rows="3"
                :value="planSourceInput"
                placeholder="可逐行填写必须检索的网页、机构、媒体、数据库或信源说明；未填写则按系统规划自动检索。"
                @input="emit('update:planSourceInput', $event.target.value)"
              ></textarea>
            </div>
          </div>

          <div class="plan-modal-actions flex items-center justify-between gap-3">
            <button
              class="sci-btn text-[10px] px-3 py-2"
              type="button"
              :disabled="planStepIndex <= 0"
              @click="emit('prev-plan-step')"
            >
              上一步
            </button>
            <div class="flex items-center gap-2">
              <button class="sci-btn text-[10px] px-3 py-2" type="button" @click="emit('cancel-plan')">返回修改</button>
              <button
                v-if="!isLastPlanStep"
                class="sci-btn text-[10px] px-3 py-2 border-neon-cyan"
                style="color: #0369a1"
                type="button"
                @click="emit('next-plan-step')"
              >
                下一步
              </button>
              <button
                v-else
                class="sci-btn text-[10px] px-4 py-2 border-neon-green text-neon-green shadow-[0_0_18px_rgba(0,255,159,0.12)]"
                type="button"
                @click="emit('confirm-plan')"
              >
                按所选方向提交编报
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div ref="reportRef" class="main-scroll flex-1 overflow-auto px-8 py-7">
      <div v-if="phase === 'idle'" class="min-h-full flex items-start justify-center py-10">
        <section class="main-content w-full text-center">
          <h1 class="font-mono text-[34px] leading-tight tracking-wide mb-4 text-[#0f172a]" style="font-size: 32px; font-weight: 800">开始新的报告任务</h1>
          <p class="font-mono text-sm text-[#374151] mb-12" style="font-size: 14px; font-weight: 500">
            请先选择编报类型，再输入标题，并补充关键参数信息，以便 AI 为您生成更精准的编报内容。
          </p>

          <div class="report-type-grid mb-9">
            <button
              v-for="type in reportTypeOptions"
              :key="type.value"
              class="report-type-card relative px-5 py-6 transition-all duration-200"
              :class="{ active: reportType === type.value }"
              type="button"
              @click="selectReportType(type.value)"
            >
              <span
                v-if="reportType === type.value"
                class="absolute right-3 top-3 h-6 w-6 rounded-full border border-neon-cyan/40 bg-neon-cyan/90 text-deep-void font-mono text-xs flex items-center justify-center shadow-[0_0_14px_rgba(0,243,255,0.18)]"
              >
                ✓
              </span>
              <div class="h-full flex flex-col items-center justify-center">
                <div class="font-mono text-[34px] mb-4" :class="reportType === type.value ? '' : 'text-slate-400/80'" :style="reportType === type.value ? 'color: #0ea5e9' : ''">{{ type.icon }}</div>
                <div class="font-mono text-base font-semibold" :class="reportType === type.value ? '' : 'text-[#111827]'" :style="reportType === type.value ? 'color: #0ea5e9' : ''">{{ type.label }}</div>
              </div>
            </button>
          </div>

          <div class="input-panel mx-auto text-left p-5 md:p-6">
            <div class="input-title-shell p-5 md:p-6">
              <div class="flex items-center justify-between gap-4 mb-4">
                <label class="block font-mono text-[11px] tracking-widest text-[#111827]" style="font-size: 14px; font-weight: 700">报告标题</label>
                <span class="font-mono text-[10px] text-slate-500">{{ titleLength }}/200</span>
              </div>
              <textarea
                class="title-input w-full resize-y bg-transparent border-none outline-none font-mono text-[17px] leading-8 placeholder:text-slate-500/70"
                :value="title"
                maxlength="200"
                @input="emit('update:title', $event.target.value)"
                :placeholder="selectedReportType?.placeholder || '请输入需要编报的标题，例如：2026年东南亚区域安全态势研判'"
              ></textarea>
            </div>

            <div v-if="selectedReportType" class="mt-5">
              <div class="flex items-center justify-between mb-3 px-1">
                <div class="font-mono text-[11px] tracking-widest text-[#111827]" style="font-size: 14px; font-weight: 700">需要补充的参数</div>
                <span class="font-mono text-[10px] text-neon-green/80">已选择</span>
              </div>

              <div class="flex flex-wrap gap-2.5 mb-4">
                <button
                  v-for="param in selectedReportType.params"
                  :key="param"
                  class="param-chip px-3.5 py-2 font-mono text-[11px] transition-all"
                  :class="{ active: isParameterActive(param) }"
                  type="button"
                  @click="toggleParameter(param)"
                >
                  <span class="mr-1">{{ isParameterActive(param) ? '✓' : '+' }}</span>{{ param }}
                </button>
              </div>

              <div
                v-if="activeSelectedParameters.length"
                class="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4 rounded-2xl border border-neon-cyan/10 p-3"
              >
                <label
                  v-for="param in activeSelectedParameters"
                  :key="param"
                  class="soft-field p-3"
                >
                  <span class="block font-mono text-[10px] tracking-widest text-[#111827] mb-2" style="font-size: 14px; font-weight: 700">{{ param }}</span>
                  <input
                    v-if="parameterInputType(param) === 'input'"
                    class="sci-input text-sm"
                    :value="parameterValues[param] || ''"
                    :placeholder="parameterPlaceholder(param)"
                    @input="updateParameterValue(param, $event.target.value)"
                  />
                  <textarea
                    v-else
                    class="sci-textarea text-sm"
                    rows="3"
                    :value="parameterValues[param] || ''"
                    :placeholder="parameterPlaceholder(param)"
                    @input="updateParameterValue(param, $event.target.value)"
                  ></textarea>
                </label>
              </div>

              <div class="soft-field p-3">
                <label class="block font-mono text-[10px] tracking-widest text-[#111827] mb-2" style="font-size: 14px; font-weight: 700">综合补充说明</label>
                <textarea
                  ref="contextTextRef"
                  :value="contextText"
                  @input="emit('update:contextText', $event.target.value)"
                  placeholder="可继续补充自由文本、特殊要求、口径限制或已有材料..."
                  rows="4"
                  class="sci-textarea text-sm"
                ></textarea>
              </div>
            </div>

            <div v-else class="soft-field mt-5 px-4 py-5 text-center font-mono text-xs text-slate-500">
              选择一个编报类型后，可填写对应的背景、方向、时间、地区对象和上下文参数。
            </div>

            <div class="mt-5 flex items-center justify-between gap-4">
              <div class="font-mono text-[10px] text-slate-500">AI 生成内容仅供参考，请结合专业判断使用</div>
              <button
                class="generate-btn shrink-0 font-mono text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                type="button"
                :disabled="!canGenerate"
                :title="isPlanning ? '正在生成编报规划' : !reportType ? '请先选择编报类型' : !title?.trim() ? '请输入报告标题' : '生成编报规划'"
                @click="submitReport"
              >
                ↗
              </button>
            </div>
          </div>
        </section>
      </div>

      <div v-else-if="phase === 'loading'" class="h-full flex items-center justify-center">
        <div class="loading-panel w-[760px] max-w-[calc(100%-2rem)]">
          <div class="nexus-loader">
            <div class="loader-ring ring-a"></div>
            <div class="loader-ring ring-b"></div>
            <div class="loader-core"></div>
          </div>
          <div class="font-mono text-lg neon-text mt-8">{{ loadingStep || '正在生成报告' }}</div>
          <div class="font-mono text-[10px] text-[#374151] mt-2">预计 3-5 分钟生成，请耐心等待；后台任务运行中，请保持 OpenClaw gateway 在线</div>

            <div class="live-log-panel mt-6 text-left border border-neon-cyan/25 bg-black/35 rounded overflow-hidden shadow-[0_0_28px_rgba(0,243,255,0.12)]">
              <div class="h-10 px-4 border-b border-neon-cyan/15 flex items-center justify-between">
                <div>
                  <div class="font-mono text-xs neon-text tracking-widest">执行日志</div>
                  <div class="font-mono text-[10px] text-[#374151]">运行中实时同步 OpenClaw 工具调用</div>
                </div>
                <div class="flex items-center gap-2 font-mono text-[10px] text-neon-green">
                  <span class="data-pulse" style="background: #00ff88;"></span>
                  LIVE
                </div>
              </div>

              <div ref="liveLogListRef" class="max-h-72 overflow-auto p-4 space-y-3" @scroll="handleLogScroll('live', $event)">
                <div v-if="executionLogs.length">
                  <div
                    v-for="log in executionLogs"
                    :key="log.id"
                    class="friendly-log-card mb-3"
                    :class="friendlyLogStatusClass(translateOpenClawLog(log).status)"
                  >
                    <div class="friendly-log-main">
                      <div class="friendly-log-dot"></div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-start justify-between gap-3">
                          <div>
                            <div class="friendly-log-stage">{{ translateOpenClawLog(log).stage }}</div>
                            <div class="friendly-log-title">{{ translateOpenClawLog(log).title }}</div>
                          </div>
                          <div class="flex shrink-0 items-center gap-2">
                            <span class="friendly-log-time">{{ translateOpenClawLog(log).time }}</span>
                            <span class="friendly-log-status">{{ friendlyLogStatusLabel(translateOpenClawLog(log).status) }}</span>
                          </div>
                        </div>
                        <div class="friendly-log-description">{{ translateOpenClawLog(log).description }}</div>
                        <button
                          v-if="translateOpenClawLog(log).raw"
                          type="button"
                          class="friendly-log-toggle"
                          @click="toggleTechnicalLog(log.id)"
                        >
                          {{ isTechnicalLogOpen(log.id) ? '收起技术详情' : '查看技术详情' }}
                        </button>
                        <pre v-if="isTechnicalLogOpen(log.id)" class="friendly-log-raw">{{ translateOpenClawLog(log).raw }}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="space-y-3">
                  <div
                    v-for="(log, i) in processLogs"
                    :key="i"
                    class="friendly-log-card"
                    :class="friendlyLogStatusClass(translateOpenClawLog({ id: `process-${i}`, summary: log, status: 'running' }).status)"
                  >
                    <div class="friendly-log-main">
                      <div class="friendly-log-dot"></div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-start justify-between gap-3">
                          <div>
                            <div class="friendly-log-stage">{{ translateOpenClawLog({ id: `process-${i}`, summary: log, status: 'running' }).stage }}</div>
                            <div class="friendly-log-title">{{ translateOpenClawLog({ id: `process-${i}`, summary: log, status: 'running' }).title }}</div>
                          </div>
                          <span class="friendly-log-status">{{ friendlyLogStatusLabel(translateOpenClawLog({ id: `process-${i}`, summary: log, status: 'running' }).status) }}</span>
                        </div>
                        <div class="friendly-log-description">{{ translateOpenClawLog({ id: `process-${i}`, summary: log, status: 'running' }).description }}</div>
                        <button
                          type="button"
                          class="friendly-log-toggle"
                          @click="toggleTechnicalLog(`process-${i}`)"
                        >
                          {{ isTechnicalLogOpen(`process-${i}`) ? '收起技术详情' : '查看技术详情' }}
                        </button>
                        <pre v-if="isTechnicalLogOpen(`process-${i}`)" class="friendly-log-raw">{{ log }}</pre>
                      </div>
                    </div>
                  </div>
                  <div v-if="!processLogs.length" class="text-slate-500">等待 OpenClaw 返回执行日志...</div>
                  <span class="typing-cursor"></span>
                </div>
              </div>
            </div>
        </div>
      </div>

      <div v-else-if="phase === 'error'" class="max-w-4xl mx-auto">
        <div class="border border-red-400/40 bg-red-950/30 text-red-200 rounded p-4 font-mono text-sm">
          {{ errorMessage || '任务失败' }}
        </div>
        <div class="mt-4 font-mono text-xs space-y-1">
          <div v-for="(log, i) in processLogs" :key="i" class="text-slate-500">{{ log }}</div>
        </div>
      </div>

      <div v-else class="max-w-5xl mx-auto">
        <div class="border border-neon-cyan/30 rounded p-6 mb-6 bg-black/30">
          <div class="grid grid-cols-2 gap-4 text-xs font-mono">
            <div class="flex justify-between border-b border-neon-cyan/20 pb-2">
              <span class="text-[#374151]">报告类型</span>
              <span class="text-[#0f172a]">{{ reportTypeLabel }}</span>
            </div>
            <div class="flex justify-between border-b border-neon-cyan/20 pb-2">
              <span class="text-[#374151]">任务状态</span>
              <span :class="taskStatusClass">{{ taskStatusLabel }}</span>
            </div>
          </div>
        </div>

        <article
          v-if="generatedHtml"
          class="report-html prose prose-invert max-w-none text-sm leading-relaxed bg-black/20 border border-neon-cyan/10 rounded p-6"
          v-html="sanitizedHtml"
        ></article>
        <div v-else class="report-html bg-black/20 border border-neon-cyan/10 rounded p-6 text-slate-500">
          报告文件内容为空或尚未读取到正文，请刷新列表后重新打开该报告。
        </div>
      </div>
    </div>
  </main>
</template>
