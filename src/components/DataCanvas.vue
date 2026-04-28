<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import DOMPurify from 'dompurify'

const purifyConfig = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'div', 'span',
    'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'strong', 'em', 'b', 'i', 'u', 'a', 'blockquote', 'pre', 'code',
    'img', 'figure', 'figcaption', 'sub', 'sup',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'],
}

const props = defineProps({
  phase: String,
  loadingStep: String,
  processLogs: Array,
  generatedHtml: String,
  reportType: String,
  scenario: String,
  riskReportType: String,
  title: String,
  job: Object,
  jobList: Array,
  health: Object,
  errorMessage: String,
  isHistoryMode: Boolean,
})

const emit = defineEmits(['list', 'new-report'])
const reportRef = ref(null)

const canExport = computed(() => props.phase === 'done' && Boolean(props.generatedHtml))

const reportTypeLabel = computed(() => {
  if (props.reportType === 'person-intelligence-report') return '人物情报报告'
  if (props.reportType === 'risk-assessment-reports') return '风险评估报告'
  return props.job?.skill || '报告'
})

const reportModeLabel = computed(() => {
  const payload = props.job?.payload || {}
  const scenario = payload.scenario || props.scenario
  const riskReportType = payload.report_type || props.riskReportType

  if (props.reportType === 'risk-assessment-reports' && scenario === 'h_report') {
    return riskReportType === 'hb_report' ? 'HB报' : 'K报'
  }

  return reportTypeLabel.value
})

const sanitizedHtml = computed(() => DOMPurify.sanitize(props.generatedHtml || '', purifyConfig))

function scrollToBottom() {
  nextTick(() => {
    if (reportRef.value) {
      reportRef.value.scrollTop = reportRef.value.scrollHeight
    }
  })
}

watch(() => props.generatedHtml, scrollToBottom)
watch(() => props.processLogs, scrollToBottom, { deep: true })

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
  const { Document, Paragraph, TextRun, AlignmentType, Packer } = docx

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
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: props.title || '报告',
                bold: true,
                size: 40,
                font: 'SimHei',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `任务编号：${props.job?.jobId || '-'}    报告类型：${reportModeLabel.value}`,
                size: 20,
                font: 'SimSun',
                color: '666666',
              }),
            ],
            spacing: { after: 240 },
          }),
          ...collectDocxBlocks(props.generatedHtml, docx),
        ],
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
  const safeJobId = (props.job?.jobId || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeLabel = reportModeLabel.value.replace(/</g, '&lt;').replace(/>/g, '&gt;')

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
    .meta { color: #666; font-size: 12px; margin: 12px 0 24px; text-align: center; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="meta">任务编号：${safeJobId}　报告类型：${safeLabel}</div>
  ${safeHtml}
</body>
</html>`)
  printWindow.document.close()
  printWindow.onload = () => printWindow.print()
}
</script>

<template>
  <main class="flex-1 flex flex-col overflow-hidden">
    <div class="h-12 border-b border-border-glow bg-panel-bg flex items-center justify-between px-4">
      <div class="flex items-center gap-3">
        <span class="font-mono text-[10px] tracking-widest text-neon-cyan/60">
          [ {{ isHistoryMode ? '历史报告查看' : '数据输出终端' }} ]
        </span>
        <span v-if="phase !== 'idle'" class="font-mono text-[10px] text-neon-green">
          {{ reportModeLabel }} / {{ phase === 'done' ? '已完成' : phase === 'error' ? '失败' : '处理中' }}
        </span>
        <span v-if="job?.jobId" class="font-mono text-[10px] text-neon-cyan/40">
          JOB {{ job.jobId.slice(0, 8) }}
        </span>
      </div>

      <div class="flex items-center gap-2">
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

    <div ref="reportRef" class="flex-1 overflow-auto p-6">
      <div v-if="phase === 'idle'" class="h-full flex items-center justify-center">
        <div class="text-center">
          <div class="font-mono text-6xl text-neon-cyan/20 mb-4">NEXUS</div>
          <div class="font-mono text-sm text-neon-cyan/40">等待输入任务</div>
          <div class="font-mono text-[10px] text-neon-cyan/20 mt-2">
            生成完成后会直接读取后端文件内容并展示为 HTML。
          </div>
        </div>
      </div>

      <div v-else-if="phase === 'loading'" class="h-full flex items-center justify-center">
        <div class="loading-panel">
          <div class="nexus-loader">
            <div class="loader-ring ring-a"></div>
            <div class="loader-ring ring-b"></div>
            <div class="loader-core"></div>
          </div>
          <div class="font-mono text-lg neon-text mt-8">{{ loadingStep || '正在生成报告' }}</div>
          <div class="font-mono text-[10px] text-neon-cyan/40 mt-2">后台任务运行中，请保持 OpenClaw gateway 在线</div>
          <div class="mt-6 w-[560px] max-h-56 overflow-auto text-left font-mono text-[11px] space-y-1 bg-black/30 border border-neon-cyan/15 rounded p-4">
            <div v-for="(log, i) in processLogs" :key="i" class="text-neon-green/80">{{ log }}</div>
            <span class="typing-cursor"></span>
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
          <h1 class="text-xl font-bold text-neon-cyan text-center mb-4">{{ title || '报告' }}</h1>
          <div class="grid grid-cols-2 gap-4 text-xs font-mono">
            <div class="flex justify-between border-b border-neon-cyan/20 pb-2">
              <span class="text-neon-cyan/50">报告类型</span>
              <span class="text-neon-cyan">{{ reportModeLabel }}</span>
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
