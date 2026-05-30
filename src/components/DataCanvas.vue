<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { createChatCompletion, fetchReportSources, getChatStreamUrl } from '../lib/api.js'

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
  detailLoading: Boolean,
  detailLoadError: String,
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
  databaseSourceEnabled: {
    type: Boolean,
    default: true,
  },
  planError: String,
  executionLogs: {
    type: Array,
    default: () => [],
  },
  databaseSources: {
    type: Object,
    default: null,
  },
  databaseSourcesLoading: {
    type: Boolean,
    default: false,
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
  'retry-history-report',
  'show-active-workspace',
  'toggle-log-drawer',
  'update:title',
  'update:reportType',
  'update:contextText',
  'update:parameterValues',
  'update:activeParameters',
  'update:planSourceInput',
  'update:planSupplement',
  'update:databaseSourceEnabled',
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
const qaInputRef = ref(null)
const qaThreadRef = ref(null)
const technicalLogOpenIds = ref(new Set())
const dbSourcesExpanded = ref(false)
const expandedSourceId = ref('')
const sourceListRef = ref(null)
const activeSourceType = ref('report_refs')
const sourceSearchQuery = ref('')
const sourceKindFilter = ref('全部')
const sourceTimeFilter = ref('all')
const sourceSortMode = ref('relevance')
const sourceListLoading = ref(false)
const sourceListError = ref('')
const sourceListItems = ref([])
const sourceListPage = ref(1)
const sourceListPageSize = ref(10)
const sourceListTotal = ref(null)
const sourceListHasMore = ref(false)
const sourceCurrentPage = ref(1)
const expandedSourceListId = ref('')
const sourceListNotice = ref('')
const activeResultTab = ref('report')
const homeMode = ref('report')
const qaQuestion = ref('')
const qaCurrentQuestion = ref('')
const qaQuestionTime = ref('')
const qaAnswer = ref('')
const qaStatus = ref('idle')
const qaError = ref('')
const qaTechnicalEvents = ref([])
const qaReferencePayloads = ref([])
const qaImportNotice = ref('')
const qaValidationError = ref('')
const qaCopyNotice = ref('')
const qaRecommendedBatch = ref(0)
const qaThreadShouldStick = ref(true)
const qaThreadHasNewContent = ref(false)
const titleValidationError = ref('')
const liveLogShouldStick = ref(true)
const drawerLogShouldStick = ref(true)
const liveLogHasNewItems = ref(false)
const drawerLogHasNewItems = ref(false)
let qaEventSource = null
let sourceListRequestId = 0

const canExport = computed(() => props.phase === 'done' && Boolean(props.generatedHtml))
const isLiveLogVisible = computed(() => props.phase === 'loading')
const canOpenLogDrawer = computed(() => !isLiveLogVisible.value)
const isHistoryDetailLoading = computed(() => props.detailLoading || props.phase === 'history-loading')
const isHistoryDetailError = computed(() => props.phase === 'history-error' || Boolean(props.detailLoadError))
const showLogDrawer = computed(() => props.isLogDrawerOpen && canOpenLogDrawer.value && !isHistoryDetailLoading.value && !isHistoryDetailError.value)
const showNewReportButton = computed(() => props.isHistoryMode || props.phase === 'done' || props.phase === 'error')
const canSubmitPlanning = computed(() => Boolean(props.reportType) && !props.isGenerating && !props.isPlanning)
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
const resultTabs = [
  { key: 'report', label: '报告正文' },
  { key: 'sources', label: '信源概览' },
  { key: 'citations', label: '引用依据' },
  { key: 'progress', label: '任务进度' },
]
const featureCards = [
  {
    key: 'report',
    title: 'K报编写',
    icon: '▤',
    desc: '围绕特定主题，生成结构化、全面、深度的 K 报。',
    tags: ['深度调研', '多维分析', '专业编报'],
    action: '开始编写 K报',
  },
  {
    key: 'qa',
    title: '知识问答',
    icon: '⌕',
    desc: '基于知识库，快速获取专业回答。',
    tags: ['数据库检索', '信息整合', '流式回答'],
    action: '开始提问',
  },
]

const reportTypeOptions = [
  {
    value: 'write-hb-k',
    label: 'K报编写',
    icon: '▤',
    desc: '围绕特定主题，生成结构化、全面、深度的 K 报。',
    params: ['关注方向', '时间范围', '地区 / 对象', '标签'],
    placeholder: '请输入需要编写的报告标题，例如：2026年东南亚区域安全态势研判',
  },
]
const selectedReportType = computed(() => reportTypeOptions.find((item) => item.value === props.reportType) || reportTypeOptions[0])
const activeSelectedParameters = computed(() => {
  const params = selectedReportType.value?.params || []
  return props.activeParameters.filter((param) => params.includes(param))
})
const enabledReportTypes = new Set(['write-hb-k'])

const singleLineParameters = new Set(['时间范围', '地区 / 对象', '国家 / 地区', '当前职务', '材料范围', '标签'])

const focusDirectionOptions = [
  '政策法规',
  '产业链安全',
  '国际关系',
  '市场与行业',
  '舆情与传播',
  '科技与标准',
  '供应链风险',
  '对策建议',
]

const recommendedQuestions = [
  '近期中美贸易摩擦主要体现在哪些方面？',
  '美国对华关税政策最新变化是什么？',
  '欧盟贸易限制措施对我国产业链有何影响？',
  '当前全球供应链风险有哪些？',
  '中美科技竞争的最新态势如何？',
  '我国重点产业链面临哪些外部限制风险？',
  '近期国际能源市场变化会带来哪些影响？',
  '人工智能产业监管趋势有哪些值得关注？',
  '周边安全形势对经贸合作有什么影响？',
  '跨境数据流动政策有哪些最新变化？',
]

const isQaRunning = computed(() => ['searching', 'integrating', 'streaming'].includes(qaStatus.value))
const visibleRecommendedQuestions = computed(() => {
  const batchSize = 5
  const start = (qaRecommendedBatch.value * batchSize) % recommendedQuestions.length
  return [...recommendedQuestions, ...recommendedQuestions].slice(start, start + batchSize)
})
const canSendQa = computed(() => Boolean(qaQuestion.value.trim()) && !isQaRunning.value)
const qaStepItems = computed(() => [
  { key: 'searching', label: '检索中', done: ['integrating', 'streaming', 'done'].includes(qaStatus.value), active: qaStatus.value === 'searching' },
  { key: 'integrating', label: '整合中', done: ['streaming', 'done'].includes(qaStatus.value), active: qaStatus.value === 'integrating' },
  { key: 'streaming', label: '输出中', done: qaStatus.value === 'done', active: qaStatus.value === 'streaming' },
])
const qaStatusTitle = computed(() => {
  if (qaStatus.value === 'failed') return '回答生成失败'
  if (qaStatus.value === 'done') return '回答已完成'
  if (isQaRunning.value) return '生成中'
  return '等待提问'
})
const qaStatusDescription = computed(() => {
  if (qaStatus.value === 'failed') return qaError.value || '回答生成失败，请稍后重试。'
  if (qaStatus.value === 'done') return '回答已完成。'
  if (isQaRunning.value) return '正在检索数据库并整合相关信息。'
  return '请输入问题后，系统将检索数据库并生成回答。'
})
const qaReferenceItems = computed(() => {
  const seen = new Set()
  return qaReferencePayloads.value
    .map((item, index) => normalizeSourceListItem(item, index, 'structured_sources'))
    .filter((item) => {
      const key = item.url || `${item.title}-${item.sourceName}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 8)
})

const qaTechnicalLabels = {
  stage: '流程状态',
  status: '状态更新',
  tool_start: '检索事件',
  tool_delta: '检索事件',
  tool_end: '检索事件',
  error: '错误信息',
  message: '系统消息',
}

const qaSensitiveTermReplacements = [
  [/OpenClaw/gi, '底层系统'],
  [/\bAgent\b/gi, '处理服务'],
  [/\bGateway\b/gi, '连接服务'],
  [/\bMCP\b/gi, '检索服务'],
  [/\bSQL\b/gi, '查询语句'],
  [/\bSSE\b/gi, '连接通道'],
  [/tool_call/gi, '工具调用'],
  [/\bcommand\b/gi, '命令'],
  [/REPORT_FILE/gi, '报告文件'],
]

function selectReportType(value) {
  if (!enabledReportTypes.has(value)) return
  emit('update:reportType', value)
}

function isReportTypeDisabled(value) {
  return !enabledReportTypes.has(value)
}

function isParameterActive(param) {
  return props.activeParameters.includes(param)
}

function parameterInputType(param) {
  return singleLineParameters.has(param) ? 'input' : 'textarea'
}

function parameterPlaceholder(param) {
  const hints = {
    '关注方向': '请选择需要重点覆盖的研判方向。',
    '时间范围': '例如：2026年5月、近三个月、2025年至今。',
    '地区 / 对象': '例如：欧盟、东南亚、某城市、某机构或重点企业。',
    '标签': '例如：贸易、制裁、产业链、科技、地区安全。',
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
  if (titleValidationError.value) titleValidationError.value = ''
  emit('update:parameterValues', {
    ...props.parameterValues,
    [param]: value,
  })
}

function updateTitle(value) {
  if (titleValidationError.value) titleValidationError.value = ''
  emit('update:title', value)
}

function submitReport() {
  if (props.isGenerating || props.isPlanning) return
  if (!props.title?.trim()) {
    titleValidationError.value = '请先输入需要编报的主题。'
    return
  }
  titleValidationError.value = ''
  if (canSubmitPlanning.value) emit('generate')
}

function ensureReportDefaults() {
  if (props.reportType !== 'write-hb-k') emit('update:reportType', 'write-hb-k')
  const defaults = ['关注方向', '时间范围', '地区 / 对象', '标签']
  const current = new Set(props.activeParameters || [])
  let changed = false
  for (const item of defaults) {
    if (!current.has(item)) {
      current.add(item)
      changed = true
    }
  }
  if (changed) emit('update:activeParameters', Array.from(current))
}

function selectedFocusDirections() {
  return String(props.parameterValues?.['关注方向'] || '')
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function isFocusDirectionSelected(direction) {
  return selectedFocusDirections().includes(direction)
}

function toggleFocusDirection(direction) {
  const current = new Set(selectedFocusDirections())
  if (current.has(direction)) current.delete(direction)
  else current.add(direction)
  updateParameterValue('关注方向', Array.from(current).join('、'))
}

function selectHomeMode(mode) {
  homeMode.value = mode
  qaImportNotice.value = ''
  qaValidationError.value = ''
  if (mode === 'report') ensureReportDefaults()
}

function fillRecommendedQuestion(question) {
  qaQuestion.value = question
  qaValidationError.value = ''
  nextTick(() => {
    resizeQaInput()
    qaInputRef.value?.focus()
  })
}

function rotateRecommendedQuestions() {
  qaRecommendedBatch.value = (qaRecommendedBatch.value + 1) % Math.ceil(recommendedQuestions.length / 5)
}

function resizeQaInput() {
  const target = qaInputRef.value
  if (!target) return
  target.style.height = 'auto'
  target.style.height = `${Math.min(target.scrollHeight, 136)}px`
}

function handleQaInput() {
  qaValidationError.value = ''
  resizeQaInput()
}

function handleQaInputKeydown(event) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  if (canSendQa.value) startQa()
}

function isQaThreadNearBottom() {
  const target = qaThreadRef.value
  if (!target) return true
  return target.scrollHeight - target.scrollTop - target.clientHeight < 80
}

function scrollQaThreadToBottom() {
  nextTick(() => {
    const target = qaThreadRef.value
    if (!target) return
    requestAnimationFrame(() => {
      target.scrollTop = target.scrollHeight
      qaThreadShouldStick.value = true
      qaThreadHasNewContent.value = false
    })
  })
}

function maybeScrollQaThreadToBottom() {
  nextTick(() => {
    const target = qaThreadRef.value
    if (!target) return
    if (qaThreadShouldStick.value || isQaThreadNearBottom()) {
      requestAnimationFrame(() => {
        target.scrollTop = target.scrollHeight
        qaThreadShouldStick.value = true
        qaThreadHasNewContent.value = false
      })
    } else {
      qaThreadHasNewContent.value = true
    }
  })
}

function handleQaThreadScroll(event) {
  const target = event.currentTarget
  if (!target) return
  const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 80
  qaThreadShouldStick.value = nearBottom
  if (nearBottom) qaThreadHasNewContent.value = false
}

function closeQaStream() {
  if (qaEventSource) {
    qaEventSource.close()
    qaEventSource = null
  }
}

function sanitizeQaText(value, maxLength = 240) {
  let text = String(value || '').replace(/\s+/g, ' ').trim()
  for (const [pattern, replacement] of qaSensitiveTermReplacements) {
    text = text.replace(pattern, replacement)
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function sanitizeQaAnswerDelta(value) {
  let text = String(value || '')
  for (const [pattern, replacement] of qaSensitiveTermReplacements) {
    text = text.replace(pattern, replacement)
  }
  return text
}

function qaTechnicalLabel(type) {
  return qaTechnicalLabels[type] || '系统事件'
}

function pushQaTechnical(event) {
  const summary = event?.message || event?.name || event?.content || '系统事件'
  qaTechnicalEvents.value.push({
    id: `${Date.now()}-${qaTechnicalEvents.value.length}`,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    type: qaTechnicalLabel(event?.type),
    summary: sanitizeQaText(summary),
  })
  if (qaTechnicalEvents.value.length > 80) qaTechnicalEvents.value = qaTechnicalEvents.value.slice(-80)
}

function collectQaReferences(event) {
  const candidates = [
    event?.sources,
    event?.source,
    event?.evidence,
    event?.references,
    event?.reference,
    event?.data?.sources,
    event?.data?.evidence,
    event?.data?.references,
  ]
  const nextItems = []
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) nextItems.push(...candidate)
    else if (candidate && typeof candidate === 'object') nextItems.push(candidate)
  }
  if (!nextItems.length) return
  qaReferencePayloads.value = [...qaReferencePayloads.value, ...nextItems].slice(-40)
}

function handleQaEvent(event) {
  if (!event || typeof event !== 'object') return
  collectQaReferences(event)
  if (event.type === 'text_delta') {
    qaStatus.value = 'streaming'
    qaAnswer.value += sanitizeQaAnswerDelta(event.content || '')
    return
  }
  if (event.type === 'token') return
  if (event.type === 'tool_start' || event.type === 'tool_delta' || event.type === 'tool_end' || event.type === 'stage' || event.type === 'status') {
    if (qaStatus.value === 'searching') qaStatus.value = 'integrating'
    pushQaTechnical(event)
    return
  }
  if (event.type === 'done') {
    qaStatus.value = 'done'
    closeQaStream()
    return
  }
  if (event.type === 'error') {
    qaStatus.value = 'failed'
    qaError.value = '回答生成失败，请稍后重试。'
    pushQaTechnical(event)
    closeQaStream()
  }
}

async function startQa(questionOverride = '') {
  const overrideText = typeof questionOverride === 'string' ? questionOverride : ''
  const question = String(overrideText || qaQuestion.value).trim()
  if (isQaRunning.value) return
  if (!question) {
    qaValidationError.value = '请先输入需要咨询的问题。'
    nextTick(() => qaInputRef.value?.focus())
    return
  }
  closeQaStream()
  qaAnswer.value = ''
  qaError.value = ''
  qaImportNotice.value = ''
  qaValidationError.value = ''
  qaCopyNotice.value = ''
  qaTechnicalEvents.value = []
  qaReferencePayloads.value = []
  qaCurrentQuestion.value = question
  qaQuestionTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  qaQuestion.value = ''
  nextTick(resizeQaInput)
  qaThreadShouldStick.value = true
  qaThreadHasNewContent.value = false
  qaStatus.value = 'searching'
  scrollQaThreadToBottom()

  try {
    const response = await createChatCompletion({
      stream: true,
      messages: [
        {
          role: 'system',
          content: '你是知识问答助手。请优先围绕知识库和数据库信源进行检索、归纳和交叉核验，用中文直接回答用户问题。不要在回答中提及底层系统、工具调用、网关、SSE、命令或技术日志。',
        },
        { role: 'user', content: question },
      ],
    })
    const url = getChatStreamUrl(response?.eventsUrl)
    if (!url) throw new Error('未获得回答通道')
    qaEventSource = new EventSource(url)
    qaEventSource.onmessage = (message) => {
      try {
        handleQaEvent(JSON.parse(message.data))
      } catch {
        pushQaTechnical({ type: 'message', message: '收到一条无法解析的系统事件' })
      }
    }
    qaEventSource.onerror = () => {
      if (qaStatus.value === 'done' || (qaStatus.value === 'streaming' && qaAnswer.value.trim())) {
        qaStatus.value = 'done'
        closeQaStream()
        return
      }
      if (qaStatus.value !== 'done') {
        qaStatus.value = 'failed'
        qaError.value = '连接中断，可重新提问。'
        pushQaTechnical({ type: 'error', message: qaError.value })
      }
      closeQaStream()
    }
  } catch (error) {
    qaStatus.value = 'failed'
    qaError.value = '回答生成失败，请稍后重试。'
    pushQaTechnical({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    closeQaStream()
  }
}

async function copyQaAnswer() {
  if (!qaAnswer.value) return
  await navigator.clipboard?.writeText(qaAnswer.value)
  qaCopyNotice.value = '答案已复制'
  window.setTimeout(() => {
    qaCopyNotice.value = ''
  }, 1800)
}

function continueQa() {
  qaValidationError.value = ''
  nextTick(() => {
    resizeQaInput()
    qaInputRef.value?.focus()
  })
}

function buildQaReportTitle(question) {
  const cleaned = String(question || '')
    .replace(/[？?。！!：:；;，,、\s]+$/g, '')
    .replace(/^(请问|请分析|分析一下|介绍一下|说明一下)/, '')
    .trim()
  if (!cleaned) return ''
  if (/(研判|报告|分析|态势|情况)$/.test(cleaned)) return cleaned.slice(0, 200)
  return `${cleaned}情况研判`.slice(0, 200)
}

function importQaAsReportContext() {
  if (!qaAnswer.value.trim()) return
  selectHomeMode('report')
  const titleCandidate = buildQaReportTitle(qaCurrentQuestion.value)
  if (!props.title?.trim() && titleCandidate) emit('update:title', titleCandidate)
  const nextContext = [props.contextText, qaAnswer.value.trim()]
    .filter(Boolean)
    .join('\n\n')
  emit('update:contextText', nextContext)
  qaImportNotice.value = '已作为编报背景导入'
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
    start: ['CONNECTING', '正在连接 AI 编报引擎', '系统正在建立任务通道。'],
    running: ['TASK_START', 'AI 编报助手已启动', '任务已进入自动编报执行流程。'],
    'openclaw:start': ['TASK_START', 'AI 编报助手已启动', '系统已开始处理本次编报任务。'],
    'openclaw:complete': ['COMPLETED', '编报任务已完成', '系统已完成执行。'],
    waiting_final_report: ['WAITING_REPORT', '等待最终报告文件', '系统已返回文件指针，正在等待最终报告落盘。'],
    context_preparing: ['PREPARING', '准备任务上下文', '系统正在整理本次编报所需的主题、参数和上下文文件。'],
    research_planning: ['PLANNING', '生成调研计划', 'AI 正在把编报主题拆解为可执行的调研计划。'],
    research_dispatch: ['RESEARCH_TASK', '启动调研任务', '系统正在创建调研分组并分派资料采集任务。'],
    research_waiting: ['WAITING_RESEARCH', '等待调研完成', '系统正在等待调研结果返回。'],
    research_collecting: ['RESEARCHING', '执行资料调研', '调研子任务正在检索、读取和整理公开资料。'],
    research_complete: ['RESEARCH_DONE', '调研结果已返回', '调研已完成，系统正在收集结果。'],
    synthesis_dispatch: ['SYNTHESIS_TASK', '启动撰稿任务', '系统正在生成报告正文。'],
    synthesis_waiting: ['WAITING_SYNTHESIS', '等待撰稿完成', '系统正在等待报告正文完成。'],
    synthesis_writing: ['WRITING', '整合并撰写报告', 'AI 正在整合调研材料并撰写最终报告。'],
    report_verifying: ['VERIFYING', '校验报告文件', '系统正在确认 Markdown 报告文件已经生成且内容可用。'],
    report_saving: ['SAVING', '保存报告文件', '报告正文已经生成，系统正在保存并登记报告文件。'],
    technical_detail: ['DETAIL', '处理技术细节', '系统正在读取配置或中间文件；可展开查看原始记录。'],
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
      description: '系统正在读取配置或中间文件；可展开查看原始记录。',
      status,
    }
  }

  if (lower.includes('preparing openclaw gateway')) {
    return {
      ...base,
      stage: 'CONNECTING',
      title: '正在连接 AI 编报引擎',
      description: '系统正在建立任务通道。',
    }
  }

  if (lower.includes('running openclaw report-agent')) {
    return {
      ...base,
      stage: 'TASK_START',
      title: 'AI 编报助手已启动',
      description: '任务已进入自动编报执行流程。',
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

const dbSourcesState = computed(() => {
  const data = props.databaseSources
  if (props.databaseSourcesLoading && !data) return 'loading'
  if (!data || data.status === 'unavailable') return 'unavailable'
  if (data.status === 'hit') return 'hit'
  if (data.status === 'empty' || data.status === 'fallback') return 'fallback'
  return 'unavailable'
})

const taskProgressView = computed(() => {
  const status = props.job?.status
  const step = String(props.loadingStep || '').toLowerCase()
  if (status === 'queued') {
    return {
      title: '任务已提交',
      subtitle: '系统已接收编报任务，正在等待调度执行。',
      tone: 'queued',
    }
  }
  if (status === 'failed' || props.phase === 'error') {
    return {
      title: '任务执行失败',
      subtitle: '任务执行过程中出现错误，请展开技术详情查看原因。',
      tone: 'failed',
    }
  }
  if (status === 'succeeded' || props.phase === 'done') {
    return {
      title: '报告已生成',
      subtitle: '信源采集和报告生成已完成，可以查看或下载结果。',
      tone: 'succeeded',
    }
  }
  if (step.includes('extract') || step.includes('正文') || step.includes('抽取')) {
    return {
      title: '正在提取重点网页正文',
      subtitle: '系统正在读取高价值来源正文，补充摘要之外的事实材料。',
      tone: 'extracting',
    }
  }
  if (step.includes('report') || step.includes('撰稿') || step.includes('生成') || step.includes('synthesis')) {
    return {
      title: '正在生成最终报告',
      subtitle: '信源材料已进入撰稿阶段，系统正在组织报告正文。',
      tone: 'waiting_report',
    }
  }
  return {
    title: '正在检索公开资料',
    subtitle: '系统正在围绕当前主题采集公开信源，并筛选可用于编报的材料。',
    tone: 'searching',
  }
})

const taskSummaryText = computed(() => {
  const jobId = props.job?.jobId ? `JOB ${props.job.jobId.slice(0, 8)}` : 'JOB --'
  return `${reportTypeLabel.value} · ${props.title || props.job?.payload?.topic || '当前主题'} · ${jobId}`
})

function sourceStatusLabel(status) {
  const labels = {
    discovered: '已发现',
    selected: '已筛选',
    extracting: '正在抽取',
    extracted: '已抽取',
    snippet_only: '仅摘要',
    failed: '抽取失败',
    used: '已用于报告',
  }
  return labels[status] || '已发现'
}

function inferSourceStatus(src) {
  const text = `${src?.title || ''} ${src?.summary || ''}`.toLowerCase()
  if (text.includes('fail') || text.includes('失败') || text.includes('error')) return 'failed'
  if (props.phase === 'done' || props.job?.status === 'succeeded') return 'used'
  if (src?.summary) return 'snippet_only'
  return 'discovered'
}

const normalizedSources = computed(() => {
  const data = props.databaseSources
  const sources = Array.isArray(data?.sources) ? data.sources : []
  return sources.map((src, index) => {
    const status = inferSourceStatus(src)
    const retrievalMode = data?.retrievalMode || ''
    const highValue = index < 8 || retrievalMode === 'vector' || retrievalMode === 'hybrid'
    return {
      id: `${src.url || src.title || 'source'}-${index}`,
      title: src.title || src.url || '未命名信源',
      sourceType: retrievalMode === 'vector' ? '向量召回' : retrievalMode === 'hybrid' ? '混合召回' : '数据库信源',
      sourceName: src.websiteName || '来源未知',
      publishTime: formatDbSourceTime(src.publishTime) || '时间未知',
      summary: src.summary || '该来源暂未提供摘要，系统已记录标题和来源信息。',
      url: src.url || '',
      status,
      relevance: highValue ? '高相关' : '候选',
      method: retrievalMode === 'vector' ? 'PG 向量语义召回' : retrievalMode === 'hybrid' ? '向量与关键词混合召回' : '数据库关键词召回',
      note: status === 'snippet_only'
        ? '该来源仅保留搜索摘要，后续生成时将降低证据权重。'
        : status === 'failed'
          ? '正文提取失败，已记录该来源并保留可用摘要。'
          : '',
    }
  })
})

const visibleSourceCards = computed(() => {
  return dbSourcesExpanded.value ? normalizedSources.value : normalizedSources.value.slice(0, 5)
})

function extractCitationNumbers() {
  const text = extractReportPlainText()
  if (!text) return []
  const seen = new Set()
  const numbers = []
  const regex = /(?:\[|〔|【)(\d{1,3})(?:\]|〕|】)/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const number = Number(match[1])
    if (!number || seen.has(number)) continue
    seen.add(number)
    numbers.push(number)
  }
  return numbers.sort((a, b) => a - b)
}

const reportCitationNumbers = computed(() => extractCitationNumbers())

function cleanReferenceText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[，,。.；;\s]+|[，,。.；;\s]+$/g, '')
    .trim()
}

function parseReferenceEntry(number, value) {
  const raw = cleanReferenceText(value)
  if (!number || !raw) return null
  const withoutLeadingNumber = cleanReferenceText(
    raw.replace(new RegExp(`^(?:\\\\[|〔|【)${number}(?:\\\\]|〕|】)\\s*`), ''),
  )
  if (!withoutLeadingNumber) return null
  const withoutUrl = cleanReferenceText(withoutLeadingNumber.replace(/https?:\/\/\S+/g, ''))
  const parts = withoutUrl.split(/[，,]/).map((part) => cleanReferenceText(part)).filter(Boolean)
  const sourceName = parts[0] || '--'
  const title = cleanReferenceText((parts[1] || withoutUrl).replace(/^["“”]+|["“”]+$/g, '')) || '--'
  return {
    sourceName,
    title,
    summary: withoutUrl || withoutLeadingNumber,
  }
}

const reportReferenceIndex = computed(() => {
  const refs = new Map()
  const html = props.generatedHtml || ''
  if (html) {
    const div = document.createElement('div')
    div.innerHTML = html
    const blocks = Array.from(div.querySelectorAll('p, li, div'))
      .map((node) => cleanReferenceText(node.textContent || ''))
      .filter(Boolean)
    for (const block of blocks) {
      const match = block.match(/^(?:\[|〔|【)(\d{1,3})(?:\]|〕|】)\s*(.+)$/)
      if (!match) continue
      const number = Number(match[1])
      if (!number || refs.has(number)) continue
      const parsed = parseReferenceEntry(number, block)
      if (parsed) refs.set(number, parsed)
    }
  }

  const text = extractReportPlainText()
  const marker = text.indexOf('参考资料索引')
  if (marker < 0) return refs
  const refText = text.slice(marker)
  const regex = /(?:\[|〔|【)(\d{1,3})(?:\]|〕|】)\s*([\s\S]*?)(?=(?:\[|〔|【)\d{1,3}(?:\]|〕|】)|$)/g
  let match
  while ((match = regex.exec(refText)) !== null) {
    const number = Number(match[1])
    if (!number || refs.has(number)) continue
    const parsed = parseReferenceEntry(number, `${match[0]}`)
    if (parsed) refs.set(number, parsed)
  }
  return refs
})

const sourceStats = computed(() => {
  const data = props.databaseSources
  const candidateHits = data?.totalHits || data?.queryPlan?.totalHits || data?.vectorPlan?.vectorHits || null
  const highValue = data?.vectorPlan?.vectorHits || data?.queryPlan?.strictHits || null
  const visibleSources = normalizedSources.value.length || null
  const extracted = data?.queryPlan?.contentRowsRead || null
  return { candidateHits, highValue, visibleSources, extracted }
})

const sourceOverviewStats = computed(() => {
  const candidateHits = props.databaseSources?.totalHits || props.databaseSources?.vectorPlan?.vectorHits || props.databaseSources?.queryPlan?.totalHits || null
  const structuredSources = normalizedSources.value.length || null
  const reportCitations = reportCitationNumbers.value.length || null
  const failed = normalizedSources.value.filter((item) => item.status === 'failed').length
  const extracted = props.databaseSources?.queryPlan?.contentRowsRead ||
    normalizedSources.value.filter((item) => item.status === 'extracted').length ||
    null
  const snippetOnly = typeof structuredSources === 'number'
    ? Math.max(structuredSources - (extracted || 0) - failed, 0)
    : normalizedSources.value.filter((item) => item.status === 'snippet_only' || item.status === 'used').length
  return {
    reportCitations,
    structuredSources,
    candidateHits,
    extracted,
    snippetOnly: snippetOnly || null,
    failed: failed || null,
  }
})

const sourceTypeOptions = [
  { key: 'all', label: '全部' },
  { key: 'report_refs', label: '报告引用' },
  { key: 'structured_sources', label: '结构化信源' },
  { key: 'candidate_hits', label: '候选命中' },
  { key: 'extract_failed', label: '抽取失败' },
]

const sourceKindOptions = ['全部', '官方文件', '媒体报道', '研究报告', '数据库记录', '其他']
const sourceTimeOptions = [
  { key: 'all', label: '全部时间' },
  { key: '7d', label: '近 7 天', days: 7 },
  { key: '30d', label: '近 30 天', days: 30 },
  { key: '6m', label: '近 6 个月', days: 183 },
  { key: '1y', label: '近 1 年', days: 365 },
]
const sourceSortOptions = [
  { key: 'relevance', label: '按相关性排序' },
  { key: 'time', label: '按发布时间排序' },
  { key: 'authority', label: '按来源权威性排序' },
]

const sourceCardConfigs = computed(() => [
  {
    key: 'report_refs',
    title: '报告引用',
    value: sourceOverviewStats.value.reportCitations ?? '--',
    desc: '来自正文参考编号',
    icon: '◎',
    tone: 'blue',
  },
  {
    key: 'structured_sources',
    title: '结构化信源',
    value: sourceOverviewStats.value.structuredSources ?? '--',
    desc: '来自数据库 / 向量召回',
    icon: '▤',
    tone: 'cyan',
  },
  {
    key: 'candidate_hits',
    title: '候选命中',
    value: sourceOverviewStats.value.candidateHits ?? '--',
    desc: '检索阶段命中的候选池',
    icon: '≋',
    tone: 'orange',
  },
  {
    key: 'extract_failed',
    title: '抽取失败',
    value: sourceOverviewStats.value.failed ?? '--',
    desc: '正文抽取失败或不可用',
    icon: '!',
    tone: 'red',
  },
])

const activeSourceConfig = computed(() => {
  if (activeSourceType.value === 'all') {
    return {
      key: 'all',
      title: '全部信源',
      desc: '以下为当前报告可展示的全部信源记录。',
      emptyTitle: '暂无对应信源',
      emptyDesc: '当前报告暂无可展示的信源记录。',
    }
  }
  const base = sourceCardConfigs.value.find((item) => item.key === activeSourceType.value) || sourceCardConfigs.value[0]
  const descriptions = {
    report_refs: ['报告引用信源', '以下信源来自报告正文中的参考编号和引用依据。', '暂无对应信源', '当前报告没有该类型的信源记录，您可以切换其他类型查看。'],
    structured_sources: ['结构化信源', '以下信源来自数据库或向量召回结果，已完成结构化整理。', '暂无对应信源', '当前报告没有该类型的信源记录，您可以切换其他类型查看。'],
    candidate_hits: ['候选命中信源', '以下内容为检索阶段命中的候选信源，尚未全部进入正文引用。', '暂无对应信源', '当前报告没有该类型的信源记录，您可以切换其他类型查看。'],
    extract_failed: ['抽取失败记录', '以下来源在正文抽取阶段失败，可能仅保留标题、摘要或 URL。', '暂无抽取失败记录', '本次任务未发现正文抽取失败的信源。'],
  }
  const [title, desc, emptyTitle, emptyDesc] = descriptions[base.key] || descriptions.report_refs
  return { ...base, title, desc, emptyTitle, emptyDesc }
})

const sourceListCountText = computed(() => {
  if (typeof sourceListTotal.value === 'number') return `共 ${sourceListTotal.value} 条`
  return sourceListItems.value.length ? `已加载 ${sourceListItems.value.length} 条` : ''
})

const resultInfoItems = computed(() => {
  const generatedAt = props.job?.completedAt || props.job?.updatedAt || props.job?.createdAt || ''
  const generatedText = generatedAt ? new Date(generatedAt).toLocaleString('zh-CN', { hour12: false }) : '--'
  return [
    ['报告标题', props.title || props.job?.payload?.topic || '--'],
    ['报告类型', reportTypeLabel.value || '--'],
    ['任务编号', props.job?.jobId ? props.job.jobId.slice(0, 8) : '--'],
    ['生成时间', generatedText],
    ['状态', props.phase === 'done' || props.job?.status === 'succeeded' ? '已完成' : taskStatusLabel.value || '--'],
  ]
})

const technicalLogs = computed(() => {
  if (props.executionLogs?.length) return props.executionLogs
  return (props.processLogs || []).map((log, index) => ({
    id: `process-${index}`,
    summary: log,
    status: 'running',
  }))
})

const readableProgressSteps = computed(() => {
  const logs = technicalLogs.value.map((log) => translateOpenClawLog(log))
  const logText = logs.map((log) => `${log.stage} ${log.title} ${log.description}`).join('\n').toLowerCase()
  const isDone = props.job?.status === 'succeeded' || props.phase === 'done'
  const has = (...needles) => needles.some((needle) => logText.includes(String(needle).toLowerCase()))
  const steps = [
    { key: 'submitted', label: '任务已提交', done: Boolean(props.job?.jobId) },
    { key: 'searched', label: '正在检索公开资料', done: isDone || has('SEARCHING', 'RESEARCH_DONE', '信源', '检索') },
    { key: 'extracted', label: '正在提取重点网页正文', done: isDone || has('EXTRACTING', '正文抽取', '正文') },
    { key: 'evidence', label: '正在整理证据材料', done: isDone || has('ANALYZING', '证据', '材料') },
    { key: 'drafting', label: '正在生成报告初稿', done: isDone || has('WRITING', '撰写', '初稿', '报告') },
    { key: 'verified', label: '正在进行质量校验', done: isDone || has('VERIFYING', '校验') },
    { key: 'done', label: '报告已生成', done: isDone },
  ]
  return steps.map((step, index) => ({
    ...step,
    current: !step.done && steps.slice(0, index).every((item) => item.done),
  }))
})

function extractReportPlainText() {
  return htmlToPlainText(props.generatedHtml || '')
}

function chapterForCitation(text, matchIndex) {
  const before = text.slice(0, matchIndex)
  const headingMatches = [...before.matchAll(/(?:^|\n)\s*(一、[^。\n]+|二、[^。\n]+|三、[^。\n]+|四、[^。\n]+|五、[^。\n]+)/g)]
  const last = headingMatches[headingMatches.length - 1]
  return last?.[1]?.trim() || '--'
}

const citationItems = computed(() => {
  const text = extractReportPlainText()
  if (!text) return []
  return reportCitationNumbers.value.map((number) => {
    const match = text.match(new RegExp(`(?:\\\\[|〔|【)${number}(?:\\\\]|〕|】)`))
    const source = normalizedSources.value[number - 1] || null
    const reference = reportReferenceIndex.value.get(number) || null
    return {
      number,
      chapter: chapterForCitation(text, match?.index || 0),
      title: reference?.title || source?.title || '--',
      sourceName: reference?.sourceName || source?.sourceName || '--',
      method: source?.method || (reference ? '报告参考资料索引' : '--'),
      credibility: source ? (source.relevance === '高相关' ? '高' : '中') : '--',
      summary: reference?.summary || source?.summary || '当前引用未匹配到结构化来源，可查看任务进度中的技术详情或原始来源。',
    }
  })
})

function formatDbSourceTime(value) {
  if (!value) return ''
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toLocaleDateString('zh-CN')
  } catch {
    return String(value)
  }
}

function firstText(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return fallback
}

function scrubSourceDisplayText(value) {
  return String(value || '')
    .replace(/OpenClaw|Agent|MCP|tool_call|command|rawPayload/gi, '技术信息')
    .replace(/\bSQL\b/gi, '查询信息')
    .trim()
}

function inferSourceGroup(source, fallbackGroup = activeSourceType.value) {
  const explicit = source?.sourceGroup || source?.source_group || source?.group || source?.category
  const text = `${explicit || ''} ${source?.type || ''} ${source?.source_type || ''} ${source?.tag || ''} ${source?.designated_tag || ''} ${source?.status || ''} ${source?.extract_status || ''}`.toLowerCase()
  if (/report_refs|report_ref|citation|reference|引用|参考/.test(text)) return 'report_refs'
  if (/candidate_hits|candidate|hit|候选|命中/.test(text)) return 'candidate_hits'
  if (/extract_failed|failed|failure|error|失败|不可用/.test(text)) return 'extract_failed'
  if (/structured_sources|structured|database|vector|结构化|数据库|向量/.test(text)) return 'structured_sources'
  return fallbackGroup === 'all' ? 'structured_sources' : fallbackGroup
}

function normalizeSourceListItem(source, index, fallbackGroup = activeSourceType.value) {
  const title = scrubSourceDisplayText(firstText(source, ['title', 'ch_title', 'headline', 'sourceTitle', 'name'], '未命名信源'))
  const summary = scrubSourceDisplayText(firstText(source, ['summary', 'abstract', 'description'], '当前信源暂无摘要。'))
  const detail = scrubSourceDisplayText(firstText(source, ['excerpt', 'content_excerpt', 'chunk_text', 'content_chunk', 'body', 'content', 'fullText', 'text', 'detail'], ''))
  const url = firstText(source, ['url', 'source_url', 'data_source_url', 'sourceUrl'], '')
  const sourceName = scrubSourceDisplayText(firstText(source, ['publisher', 'website_name', 'source_name', 'site_name', 'sourceName', 'source', 'websiteName'], '来源未知'))
  const publishRaw = firstText(source, ['published_at', 'publish_time', 'pub_time', 'source_time', 'publishTime', 'publishedAt', 'time'], '')
  const sourceType = normalizeSourceKind(firstText(source, ['source_type', 'type', 'tag', 'designated_tag', 'sourceType'], '其他'))
  const status = scrubSourceDisplayText(firstText(source, ['status', 'extract_status', 'source_status'], ''))
  const method = scrubSourceDisplayText(firstText(source, ['method', 'retrievalMode', 'collection_method'], ''))
  const failedReason = scrubSourceDisplayText(firstText(source, ['failedReason', 'failure_reason', 'error', 'message', 'note'], ''))
  const score = source?.relevance_score ?? source?.relevanceScore ?? source?.score ?? source?.similarity ?? source?.rank_score ?? source?.relevance ?? null
  const sourceGroup = inferSourceGroup(source, fallbackGroup)
  const id = firstText(source, ['id', 'sourceId', 'source_id', 'mysql_id'], `${sourceGroup}-${url || title}-${index}`)
  return {
    id: String(id),
    sourceGroup,
    title,
    summary,
    detail,
    url,
    sourceName,
    publishRaw,
    publishTime: formatDbSourceTime(publishRaw) || '时间未知',
    sourceType,
    status,
    method,
    failedReason,
    authorityScore: inferAuthorityScore(sourceName, sourceType),
    numericScore: normalizeNumericScore(score),
    relevance: formatSourceListScore(score),
  }
}

function normalizeSourceKind(value) {
  const text = String(value || '').trim()
  if (!text) return '其他'
  if (/官方|政府|公告|声明|文件|policy|gov/i.test(text)) return '官方文件'
  if (/媒体|新闻|报道|news|media/i.test(text)) return '媒体报道'
  if (/研究|报告|智库|analysis|report|think/i.test(text)) return '研究报告'
  if (/数据库|向量|记录|database|vector|db/i.test(text)) return '数据库记录'
  return text.length > 8 ? '其他' : text
}

function normalizeNumericScore(value) {
  if (value === undefined || value === null || value === '') return 0
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return number <= 1 ? number * 100 : number
}

function inferAuthorityScore(sourceName, sourceType) {
  const text = `${sourceName || ''} ${sourceType || ''}`
  if (/官方|政府|部|署|局|委员会|office|department|commission|gov/i.test(text)) return 100
  if (/研究|智库|院|所|institute|research|think/i.test(text)) return 82
  if (/新闻|报|社|media|news|reuters|bloomberg/i.test(text)) return 68
  return 50
}

function formatSourceListScore(value) {
  if (value === undefined || value === null || value === '') return ''
  const number = Number(value)
  if (Number.isFinite(number)) {
    if (number <= 1) return `${Math.round(number * 100)}%`
    return number.toFixed(number % 1 === 0 ? 0 : 2)
  }
  return String(value)
}

function normalizeSourceListResponse(response, fallbackGroup = activeSourceType.value) {
  const list = Array.isArray(response)
    ? response
    : Array.isArray(response?.items)
      ? response.items
      : Array.isArray(response?.sources)
        ? response.sources
        : Array.isArray(response?.results)
          ? response.results
          : Array.isArray(response?.data)
            ? response.data
            : []
  const total = response && !Array.isArray(response)
    ? response.total ?? response.count ?? response.totalCount ?? null
    : null
  const hasMore = response && !Array.isArray(response)
    ? Boolean(response.hasMore ?? response.has_more ?? false)
    : false
  return {
    items: list.map((item, index) => normalizeSourceListItem(item, index, fallbackGroup)),
    total: typeof total === 'number' ? total : Number.isFinite(Number(total)) ? Number(total) : null,
    hasMore,
  }
}

function sourceRequestType(type = activeSourceType.value) {
  if (type === 'all') return ''
  return type || 'report_refs'
}

function firstArray(source, keys) {
  for (const key of keys) {
    const value = source?.[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function localSourcePool(type = activeSourceType.value) {
  const citationSources = citationItems.value.map((item, index) => normalizeSourceListItem({
    id: `citation-${item.number}`,
    sourceGroup: 'report_refs',
    title: item.title,
    source_name: item.sourceName,
    summary: item.summary,
    source_type: '报告引用',
    relevance_score: item.credibility === '高' ? 95 : 78,
    method: item.method,
  }, index))

  const structuredSources = normalizedSources.value.map((item, index) => normalizeSourceListItem({
    id: item.id,
    sourceGroup: item.status === 'failed' ? 'extract_failed' : 'structured_sources',
    title: item.title,
    source_name: item.sourceName,
    publish_time: item.publishTime,
    summary: item.summary,
    excerpt: item.note,
    url: item.url,
    source_type: item.sourceType,
    relevance_score: item.relevance === '高相关' ? 92 : 72,
    status: item.status,
    method: item.method,
    failedReason: item.status === 'failed' ? item.note : '',
  }, index))

  const rawCandidateSources = firstArray(props.databaseSources, [
    'candidateSources',
    'candidate_sources',
    'candidateHits',
    'candidate_hits',
    'candidates',
    'hits',
    'retrievalHits',
    'retrieval_hits',
  ])
  const candidateSources = rawCandidateSources.map((item, index) => normalizeSourceListItem({
    ...item,
    id: firstText(item, ['id', 'sourceId', 'source_id', 'mysql_id'], `candidate-${index}`),
    sourceGroup: 'candidate_hits',
  }, index))

  const logFailures = technicalLogs.value
    .filter((log) => /fail|error|失败|错误/i.test(`${log.status || ''} ${log.summary || ''} ${log.message || ''}`))
    .map((log, index) => normalizeSourceListItem({
      id: `log-failed-${log.id || index}`,
      sourceGroup: 'extract_failed',
      title: log.label || log.stage || '抽取失败记录',
      summary: log.summary || log.message || '该来源在处理阶段未能完成正文抽取。',
      source_type: '其他',
      status: 'failed',
      failedReason: log.summary || log.message || '',
      method: log.phase || '',
    }, index))

  const grouped = {
    report_refs: citationSources,
    structured_sources: structuredSources.filter((item) => item.sourceGroup !== 'extract_failed'),
    candidate_hits: candidateSources,
    extract_failed: [
      ...structuredSources.filter((item) => item.sourceGroup === 'extract_failed'),
      ...logFailures,
    ],
  }

  if (type === 'all') return Object.values(grouped).flat()
  return grouped[type] || []
}

function mergeLocalFallback(items, type = activeSourceType.value) {
  if (items.length) return items
  return localSourcePool(type)
}

function sourceMatchesTime(source) {
  const option = sourceTimeOptions.find((item) => item.key === sourceTimeFilter.value)
  if (!option?.days || !source.publishRaw) return true
  const time = new Date(source.publishRaw).getTime()
  if (!Number.isFinite(time)) return true
  return Date.now() - time <= option.days * 24 * 60 * 60 * 1000
}

const filteredSourceRows = computed(() => {
  const query = sourceSearchQuery.value.trim().toLowerCase()
  const rows = sourceListItems.value.filter((source) => {
    const searchable = `${source.title} ${source.sourceName} ${source.summary} ${source.detail} ${source.sourceType}`.toLowerCase()
    if (query && !searchable.includes(query)) return false
    if (sourceKindFilter.value !== '全部' && source.sourceType !== sourceKindFilter.value) return false
    if (!sourceMatchesTime(source)) return false
    return true
  })

  return [...rows].sort((a, b) => {
    if (sourceSortMode.value === 'time') {
      return new Date(b.publishRaw || 0).getTime() - new Date(a.publishRaw || 0).getTime()
    }
    if (sourceSortMode.value === 'authority') return b.authorityScore - a.authorityScore
    return b.numericScore - a.numericScore
  })
})

const sourceTotalPages = computed(() => Math.max(1, Math.ceil(filteredSourceRows.value.length / sourceListPageSize.value)))
const paginatedSourceRows = computed(() => {
  const start = (sourceCurrentPage.value - 1) * sourceListPageSize.value
  return filteredSourceRows.value.slice(start, start + sourceListPageSize.value)
})
const currentSourceEmptyTitle = computed(() => activeSourceConfig.value.emptyTitle || '暂无对应信源')
const currentSourceEmptyDesc = computed(() => activeSourceConfig.value.emptyDesc || '当前报告没有该类型的信源记录，您可以切换其他类型查看。')

function resetSourceListState() {
  sourceListRequestId += 1
  sourceListItems.value = []
  sourceListPage.value = 1
  sourceListTotal.value = null
  sourceListHasMore.value = false
  sourceCurrentPage.value = 1
  sourceListError.value = ''
  sourceListNotice.value = ''
  expandedSourceListId.value = ''
}

function scrollSourceListToTop() {
  nextTick(() => {
    if (sourceListRef.value) sourceListRef.value.scrollTop = 0
  })
}

async function loadSourceListPage(page = 1) {
  const jobId = props.job?.jobId
  if (!jobId || !activeSourceType.value || (sourceListLoading.value && page > 1)) return
  const requestId = sourceListRequestId + 1
  sourceListRequestId = requestId
  const requestType = activeSourceType.value
  sourceListLoading.value = true
  sourceListError.value = ''
  sourceListNotice.value = ''
  try {
    let response
    let usedUntypedFallback = false
    try {
      response = await fetchReportSources(jobId, sourceRequestType(requestType), {
        page,
        pageSize: sourceListPageSize.value,
      })
    } catch {
      usedUntypedFallback = true
      response = await fetchReportSources(jobId, '', {
        page,
        pageSize: sourceListPageSize.value,
      })
    }
    if (requestId !== sourceListRequestId || requestType !== activeSourceType.value || jobId !== props.job?.jobId) return
    const fallbackGroup = usedUntypedFallback || requestType === 'candidate_hits'
      ? 'all'
      : requestType
    const normalized = normalizeSourceListResponse(response, fallbackGroup)
    const typedItems = requestType === 'all'
      ? normalized.items
      : normalized.items.filter((item) => item.sourceGroup === requestType)
    const nextItems = mergeLocalFallback(typedItems, requestType)
    sourceListItems.value = page === 1
      ? nextItems
      : [...sourceListItems.value, ...nextItems]
    sourceListPage.value = page
    sourceCurrentPage.value = 1
    sourceListTotal.value = normalized.total ?? sourceListItems.value.length
    sourceListHasMore.value = normalized.hasMore ||
      (typeof normalized.total === 'number' && sourceListItems.value.length < normalized.total)
  } catch {
    if (requestId !== sourceListRequestId || requestType !== activeSourceType.value || jobId !== props.job?.jobId) return
    const fallback = localSourcePool(requestType)
    if (fallback.length) {
      sourceListItems.value = page === 1 ? fallback : [...sourceListItems.value, ...fallback]
      sourceListPage.value = page
      sourceCurrentPage.value = 1
      sourceListTotal.value = sourceListItems.value.length
      sourceListHasMore.value = false
    } else {
      sourceListError.value = '信源加载失败，请稍后重试。'
      sourceListHasMore.value = false
    }
  } finally {
    if (requestId === sourceListRequestId) sourceListLoading.value = false
  }
}

async function loadMoreSourceRows() {
  await loadSourceListPage(sourceListPage.value + 1)
}

function reloadSourceRows() {
  resetSourceListState()
  scrollSourceListToTop()
  loadSourceListPage(1)
}

function setSourcePage(page) {
  sourceCurrentPage.value = Math.min(Math.max(page, 1), sourceTotalPages.value)
  scrollSourceListToTop()
}

function visibleSourcePages() {
  const total = sourceTotalPages.value
  const current = sourceCurrentPage.value
  const pages = new Set([1, total, current, current - 1, current + 1])
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b)
}

function handleSourceFiltersChanged() {
  sourceCurrentPage.value = 1
  expandedSourceListId.value = ''
  scrollSourceListToTop()
}

function selectSourceType(type) {
  if (!props.job?.jobId) return
  activeSourceType.value = type
  resetSourceListState()
  scrollSourceListToTop()
  loadSourceListPage(1)
}

function toggleSourceListItem(sourceId) {
  expandedSourceListId.value = expandedSourceListId.value === sourceId ? '' : sourceId
}

function sourceToBackgroundText(source) {
  return [
    `信源标题：${source.title}`,
    `来源：${source.sourceName}`,
    `发布时间：${source.publishTime}`,
    source.url ? `URL：${source.url}` : '',
    `摘要：${source.summary}`,
    source.detail ? `详情：${source.detail}` : '',
  ].filter(Boolean).join('\n')
}

async function copySourceListItem(source) {
  const text = sourceToBackgroundText(source)
  await navigator.clipboard?.writeText(text)
  sourceListNotice.value = '信源内容已复制'
  window.setTimeout(() => {
    sourceListNotice.value = ''
  }, 1800)
}

function importSourceListItemAsReportContext(source) {
  const context = sourceToBackgroundText(source)
  emit('new-report')
  nextTick(() => {
    homeMode.value = 'report'
    emit('update:title', source.title.slice(0, 200))
    emit('update:contextText', context)
    qaImportNotice.value = '已作为编报背景导入'
  })
}

function scrollToTop() {
  nextTick(() => {
    if (reportRef.value) {
      reportRef.value.scrollTop = 0
    }
  })
}

function getLogTarget(kind) {
  return kind === 'drawer' ? drawerLogListRef.value : liveLogListRef.value
}

function getLogStickRef(kind) {
  return kind === 'drawer' ? drawerLogShouldStick : liveLogShouldStick
}

function getLogNewItemsRef(kind) {
  return kind === 'drawer' ? drawerLogHasNewItems : liveLogHasNewItems
}

function isLogNearBottom(target) {
  if (!target) return false
  return target.scrollHeight - target.scrollTop - target.clientHeight < 80
}

function scrollLogToBottom(kind) {
  nextTick(() => {
    const target = getLogTarget(kind)
    if (!target) return
    requestAnimationFrame(() => {
      target.scrollTop = target.scrollHeight
      getLogStickRef(kind).value = true
      getLogNewItemsRef(kind).value = false
    })
  })
}

function maybeScrollLogToBottom(kind) {
  nextTick(() => {
    const target = getLogTarget(kind)
    if (!target) return
    const shouldStick = getLogStickRef(kind)
    const hasNewItems = getLogNewItemsRef(kind)
    if (shouldStick.value || isLogNearBottom(target)) {
      requestAnimationFrame(() => {
        target.scrollTop = target.scrollHeight
        shouldStick.value = true
        hasNewItems.value = false
      })
    } else {
      hasNewItems.value = true
    }
  })
}

function handleLogScroll(kind, event) {
  const target = event.currentTarget
  if (!target) return
  const nearBottom = isLogNearBottom(target)
  getLogStickRef(kind).value = nearBottom
  if (nearBottom) getLogNewItemsRef(kind).value = false
}

function handleGeneratedHtmlChange() {
  if (props.phase === 'done') {
    scrollToTop()
    return
  }
}

watch(() => props.generatedHtml, handleGeneratedHtmlChange)
watch(() => [props.phase, props.isHistoryMode], () => {
  if (props.phase === 'done') scrollToTop()
})
watch(() => [props.phase, props.job?.jobId], () => {
  if (props.phase === 'done') activeResultTab.value = 'report'
  activeSourceType.value = 'report_refs'
  resetSourceListState()
})
watch(() => activeResultTab.value, (tab) => {
  if (tab === 'sources' && props.job?.jobId && !sourceListItems.value.length && !sourceListLoading.value) {
    selectSourceType(activeSourceType.value || 'report_refs')
  }
})
watch([sourceSearchQuery, sourceKindFilter, sourceTimeFilter, sourceSortMode], handleSourceFiltersChanged)
watch(() => props.processLogs?.length || 0, () => {
  if (isLiveLogVisible.value) maybeScrollLogToBottom('live')
})
watch(() => props.executionLogs.length, () => {
  if (isLiveLogVisible.value) maybeScrollLogToBottom('live')
  if (showLogDrawer.value) maybeScrollLogToBottom('drawer')
})
watch(() => props.isLogDrawerOpen, (open) => {
  if (open) maybeScrollLogToBottom('drawer')
})
watch(isLiveLogVisible, (visible) => {
  if (visible) maybeScrollLogToBottom('live')
}, { immediate: true })
watch(() => qaAnswer.value, () => {
  if (homeMode.value === 'qa') maybeScrollQaThreadToBottom()
})
watch(() => qaStatus.value, () => {
  if (homeMode.value === 'qa') maybeScrollQaThreadToBottom()
})

onMounted(() => ensureReportDefaults())

watch(() => props.phase, (phase) => {
  if (phase === 'idle') {
    homeMode.value = 'report'
    titleValidationError.value = ''
    ensureReportDefaults()
  }
})

onBeforeUnmount(() => {
  closeQaStream()
})

function htmlToPlainText(html) {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return div.textContent || div.innerText || ''
}

function collectInlineRuns(node, TextRun, options = {}) {
  const { size = 24, font = 'SimSun' } = options
  const segments = []

  function pushText(text, marks) {
    const normalized = String(text || '').replace(/\s+/g, ' ')
    if (normalized) segments.push({ text: normalized, ...marks })
  }

  function walk(current, marks = {}) {
    if (current.nodeType === Node.TEXT_NODE) {
      pushText(current.textContent, marks)
      return
    }

    if (current.nodeType !== Node.ELEMENT_NODE) return

    const tag = current.tagName.toLowerCase()
    if (tag === 'br') {
      segments.push({ break: 1 })
      return
    }

    const nextMarks = {
      ...marks,
      bold: marks.bold || tag === 'strong' || tag === 'b',
      italics: marks.italics || tag === 'em' || tag === 'i',
      underline: marks.underline || tag === 'u',
    }
    for (const child of current.childNodes) walk(child, nextMarks)
  }

  for (const child of node.childNodes) walk(child)

  const firstText = segments.find((segment) => segment.text)
  if (firstText) firstText.text = firstText.text.trimStart()
  const lastText = [...segments].reverse().find((segment) => segment.text)
  if (lastText) lastText.text = lastText.text.trimEnd()

  return segments
    .filter((segment) => segment.break || segment.text)
    .map((segment) => new TextRun({
      ...(segment.break ? { break: segment.break } : { text: segment.text }),
      size,
      font,
      bold: segment.bold || undefined,
      italics: segment.italics || undefined,
      underline: segment.underline ? {} : undefined,
    }))
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
            children: collectInlineRuns(li, TextRun),
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
                children: collectInlineRuns(cell, TextRun, { size: 20 }),
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
          children: collectInlineRuns(node, TextRun),
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
          {{ reportTypeLabel }} / {{ isHistoryDetailLoading ? '加载中' : isHistoryDetailError ? '加载失败' : phase === 'done' ? '已完成' : phase === 'error' ? '失败' : '处理中' }}
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
        <template v-if="phase !== 'done' && !isHistoryDetailLoading && !isHistoryDetailError">
          <button
            @click="toggleLogDrawer"
            :disabled="!canOpenLogDrawer"
            class="sci-btn text-[10px] px-3 py-2 relative"
            :title="isLiveLogVisible ? '任务进度已在中间展示' : '打开任务进度'"
          >
            任务进度
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
          <button @click="exportWord" :disabled="!canExport" class="sci-btn text-[10px] px-3 py-2" :title="canExport ? '导出 Word' : '报告生成后可导出'">导出 Word</button>
          <button
            @click="exportPdf"
            :disabled="!canExport"
            class="sci-btn text-[10px] px-3 py-2"
            :title="canExport ? '导出 PDF' : '报告生成后可导出'"
          >
            导出 PDF
          </button>
          <button @click="emit('list')" class="sci-btn text-[10px] px-3 py-2">报告列表</button>
        </template>
      </div>
    </div>

      <aside
        v-if="showLogDrawer"
        class="log-drawer-panel absolute right-0 top-14 bottom-0 z-20 w-[420px] max-w-[calc(100%-1rem)] border-l backdrop-blur overflow-hidden flex flex-col"
      >
        <div class="h-12 border-b border-border-glow flex items-center justify-between px-4">
          <div>
            <div class="font-mono text-xs neon-text tracking-widest">任务进度</div>
            <div class="font-mono text-[10px] text-[#374151]">任务执行摘要</div>
          </div>
          <button @click="emit('toggle-log-drawer')" class="sci-btn text-[10px] px-2 py-1">关闭</button>
        </div>

        <div ref="drawerLogListRef" class="log-scroll-container flex-1 overflow-auto p-4 space-y-3" @scroll="handleLogScroll('drawer', $event)">
          <div v-if="!executionLogs.length" class="h-full flex items-center justify-center text-center">
            <div>
              <div class="font-mono text-3xl mb-3" style="color: #94a3b8">LOGS</div>
              <div class="font-mono text-xs" style="color: #94a3b8">暂无任务进度</div>
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
          <button
            v-if="drawerLogHasNewItems"
            class="log-new-items-button"
            type="button"
            @click="scrollLogToBottom('drawer')"
          >
            有新日志，点击查看最新
          </button>
        </div>

      </aside>

    <div
      v-if="reportPlan || isPlanning || planError"
      class="plan-modal-backdrop absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm px-6"
    >
      <section class="plan-modal-panel w-full max-w-4xl rounded-[24px] border overflow-hidden flex flex-col">
        <div class="flex-shrink-0 px-6 py-5 border-b border-neon-cyan/12 flex items-start justify-between gap-4">
          <div>
            <div class="font-mono text-[11px] tracking-[0.28em] text-[#374151] mb-2">编报规划</div>
            <h2 class="font-mono text-xl neon-text">编报规划确认</h2>
            <p class="mt-2 text-sm text-slate-300/60">
              先按主题生成检索方向和子任务，勾选需要纳入正式编报的内容后再提交。
            </p>
          </div>
          <button class="sci-btn text-[10px] px-3 py-2" type="button" @click="emit('cancel-plan')">取消</button>
        </div>

        <div v-if="isPlanning" class="plan-modal-scroll px-6 py-14 text-center">
          <div class="nexus-loader scale-75 mx-auto">
            <div class="loader-ring ring-a"></div>
            <div class="loader-ring ring-b"></div>
            <div class="loader-core"></div>
          </div>
          <div class="font-mono text-[#0f172a] mt-6">正在生成编报规划</div>
          <div class="font-mono text-[11px] text-[#374151] mt-2">系统正在识别主题、拆解任务并生成采集方向。</div>
        </div>

        <div v-else-if="planError" class="plan-modal-scroll px-6 py-8">
          <div class="rounded-2xl border border-red-400/35 bg-red-950/25 px-4 py-4 text-red-200 text-sm">
            {{ planError }}
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <button class="sci-btn text-[10px] px-3 py-2" type="button" @click="emit('cancel-plan')">返回修改</button>
            <button class="sci-btn text-[10px] px-3 py-2 border-neon-cyan" style="color: #0369a1" type="button" @click="emit('generate')">
              重新生成规划
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
              <div class="font-mono text-[11px] tracking-[0.24em] text-slate-700 mb-2">{{ currentPlanStep.sectionTitle || currentPlanStep.title }}</div>
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
              <label class="flex items-start gap-3 cursor-pointer">
                <input
                  class="mt-1 h-4 w-4 accent-cyan-500"
                  type="checkbox"
                  :checked="databaseSourceEnabled"
                  @change="emit('update:databaseSourceEnabled', $event.target.checked)"
                />
                <span>
                  <span class="block font-mono text-[10px] tracking-widest text-[#374151] mb-1">数据库信源</span>
                  <span class="block text-xs leading-relaxed text-[#374151]">
                    使用近30天历史爬取网页摘要扩展信源；关闭后仅使用公开检索与手动指定信源。
                  </span>
                </span>
              </label>
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
              <button class="sci-btn text-[10px] px-3 py-2" type="button" @click="emit('cancel-plan')">取消</button>
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
                确认并开始编写
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div ref="reportRef" class="main-scroll flex-1 overflow-auto px-8 py-7">
      <div v-if="phase === 'idle'" class="min-h-full flex items-start justify-center py-10">
        <section class="main-content home-dual-mode w-full">
          <div class="text-center">
            <h1 class="font-mono text-[34px] leading-tight tracking-wide mb-4 text-[#0f172a]" style="font-size: 32px; font-weight: 800">AI深度编报工作台</h1>
            <p class="font-mono text-sm text-[#374151] mb-10" style="font-size: 14px; font-weight: 500">
              选择 K报编写生成正式编报，或进入知识问答快速检索和整合信源信息。
            </p>
          </div>

          <div class="home-mode-grid mb-8">
            <button
              v-for="card in featureCards"
              :key="card.key"
              class="home-mode-card"
              :class="{ active: homeMode === card.key }"
              type="button"
              @click="selectHomeMode(card.key)"
            >
              <span v-if="homeMode === card.key" class="home-mode-check">✓</span>
              <div class="home-mode-icon">{{ card.icon }}</div>
              <div class="home-mode-title">{{ card.title }}</div>
              <p>{{ card.desc }}</p>
              <div class="home-mode-tags">
                <span v-for="tag in card.tags" :key="tag">{{ tag }}</span>
              </div>
              <div class="home-mode-action">{{ card.action }}</div>
            </button>
          </div>

          <div v-if="homeMode === 'report'" class="input-panel mx-auto text-left p-5 md:p-6">
            <div v-if="qaImportNotice" class="qa-import-notice mb-4">{{ qaImportNotice }}</div>
            <div class="input-title-shell p-5 md:p-6">
              <div class="flex items-center justify-between gap-4 mb-4">
                <label class="block font-mono text-[11px] tracking-widest text-[#111827]" style="font-size: 14px; font-weight: 700">报告标题</label>
                <span class="font-mono text-[10px] text-slate-500">{{ titleLength }}/200</span>
              </div>
              <textarea
                class="title-input w-full resize-y bg-transparent border-none outline-none font-mono text-[17px] leading-8 placeholder:text-slate-500/70"
                :value="title"
                maxlength="200"
                @input="updateTitle($event.target.value)"
                :placeholder="selectedReportType?.placeholder"
              ></textarea>
              <div v-if="titleValidationError" class="form-validation-message">{{ titleValidationError }}</div>
            </div>

            <div class="mt-5">
              <div class="flex items-center justify-between mb-3 px-1">
                <div class="font-mono text-[11px] tracking-widest text-[#111827]" style="font-size: 14px; font-weight: 700">K报编写参数</div>
                <span class="font-mono text-[10px] text-neon-green/80">规划前可调整</span>
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
                  <div v-if="param === '关注方向'" class="focus-direction-grid">
                    <button
                      v-for="direction in focusDirectionOptions"
                      :key="direction"
                      class="focus-direction-chip"
                      :class="{ active: isFocusDirectionSelected(direction) }"
                      type="button"
                      @click="toggleFocusDirection(direction)"
                    >
                      {{ direction }}
                    </button>
                  </div>
                  <input
                    v-else-if="parameterInputType(param) === 'input'"
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
                <label class="block font-mono text-[10px] tracking-widest text-[#111827] mb-2" style="font-size: 14px; font-weight: 700">补充背景</label>
                <textarea
                  ref="contextTextRef"
                  :value="contextText"
                  @input="emit('update:contextText', $event.target.value)"
                  placeholder="请输入与报告相关的背景信息、关键事件或已有结论，AI 将据此生成更贴合需求的内容。"
                  rows="4"
                  class="sci-textarea text-sm"
                ></textarea>
              </div>
            </div>

            <div class="mt-5 flex items-center justify-between gap-4 report-form-actions">
              <div class="font-mono text-[10px] text-slate-500">先生成编报规划，确认后才会创建正式编报任务</div>
              <button
                class="generate-btn shrink-0 font-mono text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                type="button"
                :disabled="!canSubmitPlanning"
                :title="isPlanning ? '正在生成编报规划' : !title?.trim() ? '请输入报告标题' : '生成编报规划'"
                @click="submitReport"
              >
                生成编报规划
              </button>
            </div>
          </div>

          <div v-else class="qa-workspace">
            <section class="qa-hero">
              <div class="qa-hero-icon">⌕</div>
              <div>
                <h2>知识问答</h2>
                <p>基于知识库检索与信息整合，快速获取专业、可追溯的回答。</p>
              </div>
            </section>

            <section class="qa-recommendations">
              <div class="qa-recommend-heading">
                <span>推荐问题</span>
                <button type="button" @click="rotateRecommendedQuestions">换一批</button>
              </div>
              <div class="qa-recommend-list">
                <button
                  v-for="question in visibleRecommendedQuestions"
                  :key="question"
                  type="button"
                  @click="fillRecommendedQuestion(question)"
                >
                  {{ question }}
                </button>
              </div>
            </section>

            <section ref="qaThreadRef" class="qa-thread" @scroll="handleQaThreadScroll">
              <div v-if="qaStatus === 'idle' && !qaCurrentQuestion" class="qa-empty-card">
                <div class="qa-empty-icon">?</div>
                <h3>您可以尝试提问</h3>
                <p>系统将检索知识库中的信源资料，并整合生成回答。</p>
              </div>

              <div v-if="qaCurrentQuestion" class="qa-message-row user">
                <article class="qa-user-bubble">
                  <p>{{ qaCurrentQuestion }}</p>
                  <time>{{ qaQuestionTime }}</time>
                </article>
              </div>

              <article v-if="qaCurrentQuestion || qaStatus !== 'idle'" class="qa-ai-card">
                <header class="qa-ai-header">
                  <div>
                    <span>AI 回答</span>
                    <p>{{ qaStatusDescription }}</p>
                  </div>
                  <small class="qa-state-badge" :class="`qa-state-${qaStatus}`">{{ qaStatusTitle }}</small>
                </header>

                <div v-if="qaStatus !== 'idle' && qaStatus !== 'failed'" class="qa-status-steps">
                  <span
                    v-for="step in qaStepItems"
                    :key="step.key"
                    :class="{ active: step.active, done: step.done }"
                  >
                    {{ step.done ? '✓ ' : '' }}{{ step.label }}
                  </span>
                </div>

                <div v-if="qaStatus === 'failed'" class="qa-failure-card">
                  <strong>回答生成失败</strong>
                  <p>系统暂时无法完成检索与整合，请稍后重试。</p>
                  <button type="button" @click="startQa(qaCurrentQuestion)">重新提问</button>
                </div>
                <div v-else class="qa-answer-box" :class="{ empty: !qaAnswer }">
                  <template v-if="qaAnswer">{{ qaAnswer }}</template>
                  <template v-else>正在准备回答...</template>
                </div>

                <div v-if="qaStatus === 'done'" class="qa-answer-actions">
                  <button type="button" @click="copyQaAnswer">复制答案</button>
                  <button class="primary" type="button" @click="importQaAsReportContext">作为编报背景</button>
                  <button type="button" @click="continueQa">继续追问</button>
                </div>
                <div v-if="qaCopyNotice" class="qa-copy-notice">{{ qaCopyNotice }}</div>

                <section v-if="qaStatus === 'done'" class="qa-reference-section">
                  <div class="qa-reference-heading">参考来源</div>
                  <div v-if="qaReferenceItems.length" class="qa-reference-list">
                    <article v-for="(source, index) in qaReferenceItems" :key="source.id" class="qa-reference-card">
                      <div class="qa-reference-number">[{{ index + 1 }}]</div>
                      <div class="qa-reference-body">
                        <strong>{{ source.title }}</strong>
                        <p>{{ source.sourceName }} · {{ source.publishTime }} · {{ source.sourceType }}</p>
                        <details>
                          <summary>展开摘要</summary>
                          <p>{{ source.summary }}</p>
                          <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">打开来源</a>
                        </details>
                      </div>
                    </article>
                  </div>
                  <p v-else class="qa-reference-empty">暂无结构化来源信息。</p>
                </section>

                <details v-if="qaTechnicalEvents.length" class="source-technical-details qa-technical-details">
                  <summary>查看处理详情</summary>
                  <div class="source-technical-log">
                    <div v-for="event in qaTechnicalEvents" :key="event.id" class="friendly-log-card">
                      <div class="friendly-log-title">
                        <span>{{ event.time }}</span>
                        <strong>{{ event.type }}</strong>
                      </div>
                      <p>{{ event.summary }}</p>
                    </div>
                  </div>
                </details>
              </article>

              <button
                v-if="qaThreadHasNewContent"
                class="qa-new-content-button"
                type="button"
                @click="scrollQaThreadToBottom"
              >
                有新内容，点击查看
              </button>
            </section>

            <section class="qa-composer-wrap">
              <div class="qa-composer">
                <button class="qa-scope-button" type="button">默认知识库</button>
                <textarea
                  ref="qaInputRef"
                  v-model="qaQuestion"
                  class="qa-question-input"
                  rows="1"
                  placeholder="请输入您的问题，系统将检索数据库并整合相关信息……"
                  @input="handleQaInput"
                  @keydown="handleQaInputKeydown"
                ></textarea>
                <button
                  class="qa-submit-btn"
                  type="button"
                  :disabled="!canSendQa"
                  @click="startQa"
                >
                  {{ isQaRunning ? '生成中' : '发送' }}
                </button>
              </div>
              <div class="qa-composer-footer">
                <span v-if="qaValidationError" class="qa-validation-message">{{ qaValidationError }}</span>
                <span v-else>Enter 发送，Shift + Enter 换行。</span>
              </div>
            </section>
          </div>
        </section>
      </div>

      <div v-else-if="isHistoryDetailLoading" class="history-detail-state">
        <section class="history-loading-card">
          <div class="history-loading-icon">▤</div>
          <h1>正在加载历史报告</h1>
          <p>系统正在读取报告正文、信源概览和引用依据。</p>
          <div class="history-skeleton-info">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="history-skeleton-body">
            <i class="wide"></i>
            <i></i>
            <i></i>
            <i class="short"></i>
            <i></i>
          </div>
        </section>
      </div>

      <div v-else-if="isHistoryDetailError" class="history-detail-state">
        <section class="history-loading-card history-error-card">
          <div class="history-loading-icon history-error-icon">!</div>
          <h1>历史报告加载失败</h1>
          <p>请稍后重试，或返回报告列表。</p>
          <div v-if="detailLoadError || errorMessage" class="history-error-message">
            {{ detailLoadError || errorMessage }}
          </div>
          <div class="history-error-actions">
            <button class="result-action-btn result-action-primary" type="button" @click="emit('retry-history-report')">重新加载</button>
            <button class="result-action-btn" type="button" @click="emit('list')">返回报告列表</button>
          </div>
        </section>
      </div>

      <div v-else-if="phase === 'loading'" class="source-workspace">
        <section class="source-collection-panel">
          <div class="source-status-area">
            <div class="source-status-orbit" :class="`source-status-${taskProgressView.tone}`">
              <span></span>
            </div>
            <h1>正在执行编报任务</h1>
            <p>系统正在按计划执行任务，请稍候。您可以离开页面，任务将继续在后台运行。</p>
            <div class="source-task-pill">{{ taskSummaryText }}</div>
          </div>

          <div class="progress-timeline execution-progress-timeline">
            <div
              v-for="step in readableProgressSteps"
              :key="step.key"
              class="progress-step"
              :class="{ done: step.done, current: step.current }"
            >
              <span class="progress-dot"></span>
              <span>{{ step.label }}</span>
            </div>
          </div>

          <div class="source-stats-grid">
            <div class="source-stat-card">
              <div class="source-stat-icon">◎</div>
              <div>
                <div class="source-stat-title">候选命中</div>
                <div class="source-stat-value">{{ sourceStats.candidateHits ?? '--' }}</div>
              </div>
            </div>
            <div class="source-stat-card">
              <div class="source-stat-icon">◇</div>
              <div>
                <div class="source-stat-title">高相关候选</div>
                <div class="source-stat-value">{{ sourceStats.highValue ?? '--' }}</div>
              </div>
            </div>
            <div class="source-stat-card">
              <div class="source-stat-icon">▤</div>
              <div>
                <div class="source-stat-title">已展示信源</div>
                <div class="source-stat-value">{{ sourceStats.visibleSources ?? '--' }}</div>
              </div>
            </div>
            <div class="source-stat-card">
              <div class="source-stat-icon source-stat-warning">⌛</div>
              <div>
                <div class="source-stat-title">正文抽取</div>
                <div class="source-stat-value">{{ sourceStats.extracted ?? '--' }}</div>
              </div>
            </div>
          </div>

          <div class="source-results-title">
            <span></span>
            <h2>信源采集结果</h2>
          </div>

          <div v-if="databaseSourcesLoading && !normalizedSources.length" class="source-empty-state">
            正在检查可展示信源...
          </div>
          <div v-else-if="!normalizedSources.length" class="source-empty-state">
            <div>{{ dbSourcesState === 'fallback' ? '数据库无直接命中，已回退公开检索。' : '暂未采集到可展示信源，系统仍在检索中。' }}</div>
            <div v-if="databaseSources?.fallbackReason" class="source-empty-reason">原因：{{ databaseSources.fallbackReason }}</div>
          </div>

          <div v-else class="source-card-list">
            <article
              v-for="source in visibleSourceCards"
              :key="source.id"
              class="source-result-card"
              :class="{ active: expandedSourceId === source.id }"
              @click="expandedSourceId = expandedSourceId === source.id ? '' : source.id"
            >
              <div class="source-result-icon">{{ source.sourceType.slice(0, 1) }}</div>
              <div class="source-result-body">
                <div class="source-result-main">
                  <div>
                    <h3>{{ source.title }}</h3>
                    <div class="source-result-meta">
                      <span>{{ source.sourceType }}</span>
                      <span>{{ source.sourceName }}</span>
                      <span>{{ source.publishTime }}</span>
                    </div>
                  </div>
                  <div class="source-result-tags">
                    <span class="source-status-tag" :class="`source-status-tag-${source.status}`">{{ sourceStatusLabel(source.status) }}</span>
                    <span class="source-relevance-tag">{{ source.relevance }}</span>
                  </div>
                </div>
                <p :class="expandedSourceId === source.id ? 'source-summary-full' : 'source-summary-clamp'">{{ source.summary }}</p>
                <div v-if="expandedSourceId === source.id" class="source-detail-box">
                  <div>采集方式：{{ source.method }}</div>
                  <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer" @click.stop>打开原始来源</a>
                  <p v-if="source.note">{{ source.note }}</p>
                </div>
              </div>
              <button class="source-result-arrow" type="button" aria-label="展开信源详情">
                {{ expandedSourceId === source.id ? '⌃' : '›' }}
              </button>
            </article>

            <button
              v-if="normalizedSources.length > 5"
              class="source-expand-button"
              type="button"
              @click="dbSourcesExpanded = !dbSourcesExpanded"
            >
              {{ dbSourcesExpanded ? '收起' : `展开全部信源（共 ${normalizedSources.length} 条）` }}
            </button>
          </div>

          <details class="source-technical-details">
            <summary>查看技术详情</summary>
            <div ref="liveLogListRef" class="source-technical-log" @scroll="handleLogScroll('live', $event)">
              <div v-if="technicalLogs.length" class="space-y-3">
                <div
                  v-for="log in technicalLogs"
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
                        <span class="friendly-log-status">{{ friendlyLogStatusLabel(translateOpenClawLog(log).status) }}</span>
                      </div>
                      <div class="friendly-log-description">{{ translateOpenClawLog(log).description }}</div>
                      <pre v-if="translateOpenClawLog(log).raw" class="friendly-log-raw">{{ translateOpenClawLog(log).raw }}</pre>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="source-empty-state">等待任务执行日志...</div>
              <button
                v-if="liveLogHasNewItems"
                class="log-new-items-button"
                type="button"
                @click="scrollLogToBottom('live')"
              >
                有新日志，点击查看最新
              </button>
            </div>
          </details>
        </section>
      </div>

      <div v-else-if="phase === 'error'" class="max-w-4xl mx-auto">
        <div class="border border-red-400/40 bg-red-950/30 text-red-200 rounded p-4 font-mono text-sm">
          {{ errorMessage || '任务失败' }}
        </div>
        <div class="mt-4 font-mono text-xs space-y-1">
          <div v-for="(log, i) in processLogs" :key="i" class="text-slate-500">{{ log }}</div>
        </div>
      </div>

      <div v-else class="result-shell">
        <div class="result-toolbar">
          <nav class="result-tabs" aria-label="报告结果切换">
            <button
              v-for="tab in resultTabs"
              :key="tab.key"
              class="result-tab"
              :class="{ active: activeResultTab === tab.key }"
              type="button"
              @click="activeResultTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </nav>

          <div class="result-actions">
            <button @click="exportWord" :disabled="!canExport" class="result-action-btn" type="button">
              <span>▣</span> 导出 Word
            </button>
            <button @click="exportPdf" :disabled="!canExport" class="result-action-btn" type="button">
              <span>◧</span> 导出 PDF
            </button>
            <button @click="emit('list')" class="result-action-btn" type="button">
              <span>☷</span> 报告列表
            </button>
            <button @click="emit('new-report')" class="result-action-btn result-action-primary" type="button">
              <span>＋</span> 新开一篇
            </button>
          </div>
        </div>

        <div class="result-info-bar">
          <div v-for="item in resultInfoItems" :key="item[0]" class="result-info-item">
            <span>{{ item[0] }}</span>
            <strong>{{ item[1] }}</strong>
          </div>
        </div>

        <section v-if="activeResultTab === 'report'" class="result-tab-panel">
          <article
            v-if="generatedHtml"
            class="report-html prose prose-invert max-w-none text-sm leading-relaxed bg-black/20 border border-neon-cyan/10 rounded p-6"
            v-html="sanitizedHtml"
          ></article>
          <div v-else class="report-html bg-black/20 border border-neon-cyan/10 rounded p-6 text-slate-500">
            报告文件内容为空或尚未读取到正文，请刷新列表后重新打开该报告。
          </div>
        </section>

        <section v-else-if="activeResultTab === 'sources'" class="result-tab-panel">
          <div class="source-search-page">
            <div class="source-task-strip">
              <div v-for="item in resultInfoItems" :key="item[0]" class="source-task-strip-item">
                <span>{{ item[0] }}</span>
                <strong>{{ item[1] }}</strong>
              </div>
            </div>

            <div class="source-stat-row">
              <button
                v-for="card in sourceCardConfigs"
                :key="card.key"
                class="source-stat-card source-stat-clickable source-metric-card"
                :class="[{ active: activeSourceType === card.key }, `source-metric-${card.tone}`]"
                type="button"
                @click="selectSourceType(card.key)"
              >
                <span class="source-stat-icon">{{ card.icon }}</span>
                <span class="source-metric-body">
                  <span class="source-stat-title">{{ card.title }}</span>
                  <strong class="source-stat-value">{{ card.value }}</strong>
                  <span class="source-metric-desc">{{ card.desc }}</span>
                </span>
              </button>
            </div>

            <div class="source-count-note">
              口径说明：报告引用来自正文参考编号；结构化信源来自数据库/向量透明展示；候选命中是检索阶段命中的候选池，三者不混算。
            </div>

            <div class="source-sub-filter" aria-label="信源类型筛选">
              <button
                v-for="item in sourceTypeOptions"
                :key="item.key"
                type="button"
                :class="{ active: activeSourceType === item.key }"
                @click="selectSourceType(item.key)"
              >
                {{ item.label }}
              </button>
            </div>

            <div class="source-table-panel">
              <header class="source-table-heading">
                <div>
                  <h2>{{ activeSourceConfig.title }}</h2>
                  <p>{{ activeSourceConfig.desc }}</p>
                </div>
                <button class="source-fixed-refresh" type="button" :disabled="sourceListLoading" @click="reloadSourceRows">
                  {{ sourceListLoading ? '加载中...' : '刷新' }}
                </button>
              </header>

              <div class="source-toolbar">
                <label class="source-search-box">
                  <span>⌕</span>
                  <input
                    v-model="sourceSearchQuery"
                    type="search"
                    placeholder="搜索标题 / 来源 / 关键词"
                  />
                </label>
                <select v-model="sourceKindFilter" aria-label="来源类型筛选">
                  <option v-for="item in sourceKindOptions" :key="item" :value="item">{{ item }}</option>
                </select>
                <select v-model="sourceTimeFilter" aria-label="时间范围筛选">
                  <option v-for="item in sourceTimeOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
                </select>
                <select v-model="sourceSortMode" aria-label="排序">
                  <option v-for="item in sourceSortOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
                </select>
              </div>

              <div ref="sourceListRef" class="source-table-scroll">
                <div v-if="sourceListLoading && !sourceListItems.length" class="source-table-skeleton">
                  <i v-for="item in 5" :key="item"></i>
                </div>
                <div v-else-if="sourceListError" class="source-panel-error">
                  <strong>信源加载失败</strong>
                  <p>{{ sourceListError }}</p>
                  <button type="button" @click="reloadSourceRows">重新加载</button>
                </div>
                <div v-else-if="!filteredSourceRows.length" class="source-empty-state">
                  <strong>{{ currentSourceEmptyTitle }}</strong>
                  <p>{{ currentSourceEmptyDesc }}</p>
                </div>
                <table v-else class="source-data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>信源标题</th>
                      <th>来源类型</th>
                      <th>发布机构</th>
                      <th>发布时间</th>
                      <th>相关性</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="(source, index) in paginatedSourceRows" :key="source.id">
                      <tr :class="{ expanded: expandedSourceListId === source.id }">
                        <td class="source-index-cell">
                          <button type="button" @click="toggleSourceListItem(source.id)">
                            {{ expandedSourceListId === source.id ? '⌄' : '›' }}
                          </button>
                          <span>{{ String((sourceCurrentPage - 1) * sourceListPageSize + index + 1).padStart(2, '0') }}</span>
                        </td>
                        <td class="source-title-cell">
                          <strong>{{ source.title }}</strong>
                          <p>{{ source.summary }}</p>
                        </td>
                        <td><span class="source-type-pill">{{ source.sourceType || '--' }}</span></td>
                        <td>{{ source.sourceName || '--' }}</td>
                        <td>{{ source.publishTime || '--' }}</td>
                        <td><span class="source-score">{{ source.relevance || '--' }}</span></td>
                        <td>
                          <div class="source-row-actions">
                            <button type="button" @click="toggleSourceListItem(source.id)">查看详情</button>
                            <button type="button" @click="copySourceListItem(source)">复制引用</button>
                          </div>
                        </td>
                      </tr>
                      <tr v-if="expandedSourceListId === source.id" class="source-detail-row">
                        <td colspan="7">
                          <div class="source-detail-grid">
                            <div>
                              <span>完整摘要</span>
                              <p>{{ source.summary || '暂无摘要。' }}</p>
                            </div>
                            <div>
                              <span>正文片段</span>
                              <p>{{ source.detail || '暂无正文片段。' }}</p>
                            </div>
                            <div>
                              <span>来源 URL</span>
                              <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.url }}</a>
                              <p v-else>暂无 URL。</p>
                            </div>
                            <div>
                              <span>采集方式 / 失败原因</span>
                              <p>{{ source.failedReason || source.method || source.status || '暂无补充信息。' }}</p>
                            </div>
                          </div>
                          <div class="source-detail-actions">
                            <button type="button" @click="copySourceListItem(source)">复制引用</button>
                            <button type="button" @click="importSourceListItemAsReportContext(source)">作为编报背景</button>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>

              <footer class="source-pagination">
                <span>共 {{ filteredSourceRows.length }} 条</span>
                <button type="button" :disabled="sourceCurrentPage <= 1" @click="setSourcePage(sourceCurrentPage - 1)">上一页</button>
                <button
                  v-for="page in visibleSourcePages()"
                  :key="page"
                  type="button"
                  :class="{ active: sourceCurrentPage === page }"
                  @click="setSourcePage(page)"
                >
                  {{ page }}
                </button>
                <button type="button" :disabled="sourceCurrentPage >= sourceTotalPages" @click="setSourcePage(sourceCurrentPage + 1)">下一页</button>
                <button
                  v-if="sourceListHasMore"
                  type="button"
                  :disabled="sourceListLoading"
                  @click="loadMoreSourceRows"
                >
                  {{ sourceListLoading ? '加载中...' : '加载更多' }}
                </button>
                <span>每页 {{ sourceListPageSize }} 条</span>
              </footer>

              <footer v-if="sourceListNotice" class="source-fixed-notice">{{ sourceListNotice }}</footer>
            </div>
          </div>
        </section>

        <section v-else-if="activeResultTab === 'citations'" class="result-tab-panel">
          <div v-if="!citationItems.length" class="source-empty-state">
            当前报告未返回结构化引用依据。
          </div>
          <div v-else class="citation-list">
            <article v-for="item in citationItems" :key="item.number" class="citation-card">
              <div class="citation-number">[{{ item.number }}]</div>
              <div class="citation-body">
                <div class="citation-title">{{ item.title }}</div>
                <div class="citation-meta">
                  <span>对应章节：{{ item.chapter }}</span>
                  <span>来源机构：{{ item.sourceName }}</span>
                  <span>采集方式：{{ item.method }}</span>
                  <span>可信度：{{ item.credibility }}</span>
                </div>
                <p>{{ item.summary }}</p>
              </div>
            </article>
          </div>
        </section>

        <section v-else class="result-tab-panel">
          <div class="progress-timeline">
            <div
              v-for="step in readableProgressSteps"
              :key="step.key"
              class="progress-step"
              :class="{ done: step.done, current: step.current }"
            >
              <span></span>
              <div>{{ step.label }}</div>
            </div>
          </div>

          <details class="source-technical-details result-technical-details">
            <summary>查看技术详情</summary>
            <div ref="liveLogListRef" class="source-technical-log" @scroll="handleLogScroll('live', $event)">
              <div v-if="technicalLogs.length" class="space-y-3">
                <div
                  v-for="log in technicalLogs"
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
                        <span class="friendly-log-status">{{ friendlyLogStatusLabel(translateOpenClawLog(log).status) }}</span>
                      </div>
                      <div class="friendly-log-description">{{ translateOpenClawLog(log).description }}</div>
                      <pre v-if="translateOpenClawLog(log).raw" class="friendly-log-raw">{{ translateOpenClawLog(log).raw }}</pre>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="source-empty-state">当前任务暂无可展示进度日志。</div>
              <button
                v-if="liveLogHasNewItems"
                class="log-new-items-button"
                type="button"
                @click="scrollLogToBottom('live')"
              >
                有新日志，点击查看最新
              </button>
            </div>
          </details>
        </section>
      </div>
    </div>

  </main>
</template>
