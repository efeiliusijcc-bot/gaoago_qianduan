<script setup>
import { computed, nextTick, ref, watch } from 'vue'
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
  executionLogs: {
    type: Array,
    default: () => [],
  },
  unreadLogCount: {
    type: Number,
    default: 0,
  },
  isLogDrawerOpen: Boolean,
})

const emit = defineEmits([
  'list',
  'new-report',
  'toggle-log-drawer',
  'update:title',
  'update:reportType',
  'update:contextText',
  'update:parameterValues',
  'update:activeParameters',
  'generate',
])
const reportRef = ref(null)
const logListRef = ref(null)
const contextTextRef = ref(null)

const canExport = computed(() => props.phase === 'done' && Boolean(props.generatedHtml))
const isLiveLogVisible = computed(() => props.phase === 'loading')
const canOpenLogDrawer = computed(() => !isLiveLogVisible.value)
const showLogDrawer = computed(() => props.isLogDrawerOpen && canOpenLogDrawer.value)
const canGenerate = computed(() => Boolean(props.reportType) && Boolean(props.title?.trim()) && !props.isGenerating)
const reportTypeLabel = computed(() => {
  if (props.reportType === 'person-intelligence-report') return '人物报'
  if (props.reportType === 'risk-assessment-reports') return '风险报'
  if (props.reportType === 'write-hb-k') return 'K报'
  if (props.reportType === 'write-hb-hb') return 'HB报'
  return props.job?.skill || '报告'
})
const sanitizedHtml = computed(() => DOMPurify.sanitize(props.generatedHtml || '', purifyConfig))
const reportTypeOptions = [
  {
    value: 'write-hb-k',
    label: 'K报编写',
    icon: '▤',
    desc: '三段式现场调研报告：基本情况、涉我风险、对策建议',
    params: ['背景信息', '关注方向', '时间范围', '地区 / 对象', '已知上下文'],
    placeholder: '请输入需要编报的标题，例如：2026年东南亚区域安全态势研判',
  },
  {
    value: 'write-hb-hb',
    label: 'HB报编写',
    icon: '◇',
    desc: '综合汇编类报告：背景脉络、关键动态、风险判断、后续建议',
    params: ['背景信息', '关注方向', '材料范围', '地区 / 对象', '已知上下文'],
    placeholder: '请输入HB报主题，例如：重点行业政策动态汇编',
  },
  {
    value: 'risk-assessment-reports',
    label: '风险报',
    icon: '◎',
    desc: '风险评估报告：场景设定、风险识别、趋势研判、处置建议',
    params: ['风险场景', '研判方向', '时间范围', '地区 / 对象', '已知上下文'],
    placeholder: '请输入风险报标题，例如：企业员工关怀月活动风险评估',
  },
  {
    value: 'person-intelligence-report',
    label: '人物报',
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
  return 'text-neon-cyan border-neon-cyan/25 bg-neon-cyan/5'
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
    if (logListRef.value) {
      logListRef.value.scrollTop = logListRef.value.scrollHeight
    }
  })
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
watch(() => props.executionLogs.length, scrollLogsToBottom)
watch(() => props.isLogDrawerOpen, (open) => {
  if (open) scrollLogsToBottom()
})

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
  <main class="flex-1 flex flex-col overflow-hidden relative">
    <div class="h-12 border-b border-border-glow bg-panel-bg flex items-center justify-between px-4">
      <div class="flex items-center gap-3">
        <span class="font-mono text-[10px] tracking-widest text-neon-cyan/60">
          [ {{ isHistoryMode ? '历史报告查看' : '数据输出终端' }} ]
        </span>
        <span v-if="phase !== 'idle'" class="font-mono text-[10px] text-neon-green">
          {{ reportTypeLabel }} / {{ phase === 'done' ? '已完成' : phase === 'error' ? '失败' : '处理中' }}
        </span>
        <span v-if="job?.jobId" class="font-mono text-[10px] text-neon-cyan/40">
          JOB {{ job.jobId.slice(0, 8) }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="toggleLogDrawer"
          :disabled="!canOpenLogDrawer"
          class="sci-btn text-[10px] px-3 py-1.5 relative"
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
        <button v-if="isHistoryMode" @click="emit('new-report')" class="sci-btn text-[10px] px-3 py-1.5">
          清屏并开启下一个编报
        </button>
        <button @click="exportWord" :disabled="!canExport" class="sci-btn text-[10px] px-3 py-1.5">导出 Word</button>
        <button
          @click="exportPdf"
          :disabled="!canExport"
          class="sci-btn text-[10px] px-3 py-1.5"
          style="border-color: rgba(252,238,10,0.5); color: #fcee0a;"
        >
          导出 PDF
        </button>
        <button @click="emit('list')" class="sci-btn text-[10px] px-3 py-1.5">报告列表</button>
      </div>
    </div>

      <aside
        v-if="showLogDrawer"
        class="log-drawer-panel absolute right-0 top-12 bottom-0 z-20 w-[420px] max-w-[calc(100%-1rem)] border-l border-neon-cyan/25 bg-deep-void/95 backdrop-blur overflow-hidden flex flex-col shadow-[0_0_40px_rgba(0,229,255,0.12)]"
      >
        <div class="h-12 border-b border-border-glow flex items-center justify-between px-4">
          <div>
            <div class="font-mono text-xs neon-text tracking-widest">执行日志</div>
            <div class="font-mono text-[10px] text-neon-cyan/40">OpenClaw 工具调用摘要</div>
          </div>
          <button @click="emit('toggle-log-drawer')" class="sci-btn text-[10px] px-2 py-1">关闭</button>
        </div>

        <div ref="logListRef" class="flex-1 overflow-auto p-4 space-y-3">
          <div v-if="!executionLogs.length" class="h-full flex items-center justify-center text-center">
            <div>
              <div class="font-mono text-3xl text-neon-cyan/15 mb-3">LOGS</div>
              <div class="font-mono text-xs text-neon-cyan/45">暂无执行日志</div>
            </div>
          </div>

          <div
            v-for="log in executionLogs"
            :key="log.id"
            class="border rounded p-3 bg-black/25"
            :class="logStatusClass(log.status)"
          >
            <div class="flex items-center justify-between gap-3 mb-2">
              <div class="font-mono text-[10px] tracking-widest text-current/80">{{ logTypeLabel(log.type) }}</div>
              <div class="font-mono text-[10px] text-current/55">{{ log.time }}</div>
            </div>
            <div class="font-mono text-xs text-current font-bold mb-1">{{ log.label }}</div>
            <div class="text-xs leading-relaxed text-slate-200/85">{{ log.summary }}</div>
            <div v-if="log.command" class="mt-2 font-mono text-[10px] text-neon-cyan/40 truncate">
              {{ log.command }}
            </div>
          </div>
        </div>
      </aside>

    <div ref="reportRef" class="flex-1 overflow-auto p-6">
      <div v-if="phase === 'idle'" class="min-h-full flex items-start justify-center py-8">
        <section class="w-full max-w-6xl text-center">
          <h1 class="font-mono text-3xl neon-text tracking-widest mb-3">开始新的编报任务</h1>
          <p class="font-mono text-sm text-neon-cyan/55 mb-8">
            请先选择编报类型，再输入标题，并补充关键参数信息，以便 AI 为您生成更精准的编报内容。
          </p>

          <div class="grid grid-cols-4 gap-7 mb-7">
            <button
              v-for="type in reportTypeOptions"
              :key="type.value"
              class="relative min-h-[132px] rounded-lg border bg-black/25 px-5 py-6 transition-all hover:border-neon-cyan/55 hover:bg-neon-cyan/10"
              :class="reportType === type.value ? 'border-neon-cyan bg-neon-cyan/12 shadow-[0_0_28px_rgba(0,243,255,0.32)]' : 'border-neon-cyan/25'"
              type="button"
              @click="selectReportType(type.value)"
            >
              <span
                v-if="reportType === type.value"
                class="absolute right-0 top-0 h-8 w-8 rounded-bl-lg bg-neon-cyan text-deep-void font-mono text-sm flex items-center justify-center"
              >
                ✓
              </span>
              <div class="font-mono text-4xl mb-4" :class="reportType === type.value ? 'text-neon-cyan' : 'text-slate-300'">{{ type.icon }}</div>
              <div class="font-mono text-lg" :class="reportType === type.value ? 'text-neon-cyan' : 'text-slate-200'">{{ type.label }}</div>
            </button>
          </div>

          <div class="mx-auto text-left rounded-lg border border-neon-cyan/60 bg-[rgba(5,16,26,0.92)] p-6 shadow-[0_0_34px_rgba(0,243,255,0.18)]">
            <label class="block font-mono text-[10px] tracking-widest text-neon-cyan/55 mb-2">报告标题</label>
            <input
              class="sci-input"
              :value="title"
              @input="emit('update:title', $event.target.value)"
              :placeholder="selectedReportType?.placeholder || '请先选择编报类型，再输入需要编报的标题'"
            />

            <div v-if="selectedReportType" class="mt-5">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <div class="font-mono text-[10px] tracking-widest text-neon-cyan/55 mb-1">需要补充的参数</div>
                  <div class="font-mono text-xs text-neon-cyan/65">{{ selectedReportType.desc }}</div>
                </div>
                <span class="font-mono text-[10px] text-neon-green">已选择</span>
              </div>

              <div class="grid grid-cols-5 gap-3 mb-4">
                <button
                  v-for="param in selectedReportType.params"
                  :key="param"
                  class="rounded border px-3 py-3 font-mono text-xs transition-all"
                  :class="isParameterActive(param)
                    ? 'border-neon-green bg-neon-green/10 text-neon-green shadow-[0_0_16px_rgba(0,255,159,0.15)]'
                    : 'border-neon-cyan/35 bg-neon-cyan/5 text-neon-cyan hover:bg-neon-cyan/10'"
                  type="button"
                  @click="toggleParameter(param)"
                >
                  <span class="mr-1">{{ isParameterActive(param) ? '✓' : '+' }}</span>{{ param }}
                </button>
              </div>

              <div
                v-if="activeSelectedParameters.length"
                class="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4"
              >
                <label
                  v-for="param in activeSelectedParameters"
                  :key="param"
                  class="rounded border border-neon-cyan/20 bg-black/20 p-3"
                >
                  <span class="block font-mono text-[10px] tracking-widest text-neon-cyan/60 mb-2">{{ param }}</span>
                  <input
                    v-if="parameterInputType(param) === 'input'"
                    class="sci-input text-sm bg-black/25"
                    :value="parameterValues[param] || ''"
                    :placeholder="parameterPlaceholder(param)"
                    @input="updateParameterValue(param, $event.target.value)"
                  />
                  <textarea
                    v-else
                    class="sci-textarea text-sm bg-black/25"
                    rows="3"
                    :value="parameterValues[param] || ''"
                    :placeholder="parameterPlaceholder(param)"
                    @input="updateParameterValue(param, $event.target.value)"
                  ></textarea>
                </label>
              </div>

              <label class="block font-mono text-[10px] tracking-widest text-neon-cyan/55 mb-2">综合补充说明</label>
              <textarea
                ref="contextTextRef"
                :value="contextText"
                @input="emit('update:contextText', $event.target.value)"
                placeholder="可继续补充自由文本、特殊要求、口径限制或已有材料..."
                rows="5"
                class="sci-textarea text-sm bg-black/25"
              ></textarea>
            </div>

            <div v-else class="mt-5 rounded border border-neon-cyan/15 bg-black/20 px-4 py-5 text-center font-mono text-xs text-neon-cyan/45">
              选择一个编报类型后，可填写对应的背景、方向、时间、地区对象和上下文参数。
            </div>

            <div class="mt-5 flex items-center justify-end">
              <button
                class="w-12 h-12 rounded-full bg-neon-cyan text-deep-void font-mono text-xl shadow-[0_0_24px_rgba(0,243,255,0.45)] disabled:opacity-40 disabled:cursor-not-allowed"
                type="button"
                :disabled="!canGenerate"
                :title="!reportType ? '请先选择编报类型' : !title?.trim() ? '请输入报告标题' : '提交编报任务'"
                @click="submitReport"
              >
                ↗
              </button>
            </div>
          </div>

          <div class="mt-5 font-mono text-[10px] text-neon-cyan/35">AI 生成内容仅供参考，请结合专业判断使用</div>
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
          <div class="font-mono text-[10px] text-neon-cyan/40 mt-2">预计 3-5 分钟生成，请耐心等待；后台任务运行中，请保持 OpenClaw gateway 在线</div>

            <div class="live-log-panel mt-6 text-left border border-neon-cyan/25 bg-black/35 rounded overflow-hidden shadow-[0_0_28px_rgba(0,243,255,0.12)]">
              <div class="h-10 px-4 border-b border-neon-cyan/15 flex items-center justify-between">
                <div>
                  <div class="font-mono text-xs neon-text tracking-widest">执行日志</div>
                  <div class="font-mono text-[10px] text-neon-cyan/40">运行中实时同步 OpenClaw 工具调用</div>
                </div>
                <div class="flex items-center gap-2 font-mono text-[10px] text-neon-green">
                  <span class="data-pulse" style="background: #00ff88;"></span>
                  LIVE
                </div>
              </div>

              <div ref="logListRef" class="max-h-72 overflow-auto p-4 space-y-3">
                <div v-if="executionLogs.length">
                  <div
                    v-for="log in executionLogs"
                    :key="log.id"
                    class="border rounded p-3 bg-black/25 mb-3"
                    :class="logStatusClass(log.status)"
                  >
                    <div class="flex items-center justify-between gap-3 mb-2">
                      <div class="font-mono text-[10px] tracking-widest text-current/80">{{ logTypeLabel(log.type) }}</div>
                      <div class="font-mono text-[10px] text-current/55">{{ log.time }}</div>
                    </div>
                    <div class="font-mono text-xs text-current font-bold mb-1">{{ log.label }}</div>
                    <div class="text-xs leading-relaxed text-slate-200/85">{{ log.summary }}</div>
                    <div v-if="log.command" class="mt-2 font-mono text-[10px] text-neon-cyan/40 truncate">
                      {{ log.command }}
                    </div>
                  </div>
                </div>

                <div v-else class="font-mono text-[11px] space-y-1">
                  <div v-for="(log, i) in processLogs" :key="i" class="text-neon-green/80">{{ log }}</div>
                  <div v-if="!processLogs.length" class="text-neon-cyan/45">等待 OpenClaw 返回执行日志...</div>
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
          <div v-for="(log, i) in processLogs" :key="i" class="text-neon-cyan/60">{{ log }}</div>
        </div>
      </div>

      <div v-else class="max-w-5xl mx-auto">
        <div class="border border-neon-cyan/30 rounded p-6 mb-6 bg-black/30">
          <div class="grid grid-cols-2 gap-4 text-xs font-mono">
            <div class="flex justify-between border-b border-neon-cyan/20 pb-2">
              <span class="text-neon-cyan/50">报告类型</span>
              <span class="text-neon-cyan">{{ reportTypeLabel }}</span>
            </div>
            <div class="flex justify-between border-b border-neon-cyan/20 pb-2">
              <span class="text-neon-cyan/50">任务状态</span>
              <span class="text-neon-cyan">{{ job?.status || phase }}</span>
            </div>
          </div>
        </div>

        <article
          v-if="generatedHtml"
          class="report-html prose prose-invert max-w-none text-sm leading-relaxed bg-black/20 border border-neon-cyan/10 rounded p-6"
          v-html="sanitizedHtml"
        ></article>
        <div v-else class="report-html bg-black/20 border border-neon-cyan/10 rounded p-6 text-neon-cyan/60">
          报告文件内容为空或尚未读取到正文，请刷新列表后重新打开该报告。
        </div>
      </div>
    </div>
  </main>
</template>
