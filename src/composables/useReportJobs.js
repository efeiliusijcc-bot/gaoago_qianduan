import { computed, onMounted, ref } from 'vue'
import {
  createReportJob,
  fetchOpenClawHealth,
  fetchReportJob,
  fetchReportJobs,
  fetchReportResult,
} from '../lib/api.js'

const DRAFT_KEY = 'nexus-report-history-overrides'

function readDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeDrafts(value) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(value))
}

export function useReportJobs() {
  const currentView = ref('generator')

  const title = ref('')
  const reportType = ref('risk-assessment-reports')
  const countryOrRegion = ref('')
  const currentPosition = ref('')
  const scenario = ref('foreign_leader_visit')
  const riskReportType = ref('k_report')
  const targetCity = ref('')
  const visitTime = ref('')
  const contextText = ref('')
  const outputDepth = ref('detailed')

  const isGenerating = ref(false)
  const generatedHtml = ref('')
  const phase = ref('idle')
  const processLogs = ref([])
  const loadingStep = ref('等待输入任务')
  const job = ref(null)
  const jobList = ref([])
  const health = ref(null)
  const errorMessage = ref('')
  const selectedReport = ref(null)
  const openedHistoryJobId = ref(null)
  const savedNotice = ref('')

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const isHistoryMode = computed(() => Boolean(openedHistoryJobId.value) && phase.value === 'done')
  const filteredJobs = computed(() => [...jobList.value].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)))
  const succeededCount = computed(() => filteredJobs.value.filter((i) => i.status === 'succeeded').length)
  const runningCount = computed(() => filteredJobs.value.filter((i) => i.status === 'running' || i.status === 'queued').length)

  function pushLog(message) {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    processLogs.value.push(`[${time}] ${message}`)
  }

  function getJobTitle(item) {
    const drafts = readDrafts()
    return drafts[item.jobId]?.title || item.payload?.topic || item.payload?.target_name || item.payload?.target_country || item.jobId
  }

  function applyHistoryDraft(item) {
    const drafts = readDrafts()
    const draft = drafts[item.jobId] || {}
    title.value = draft.title || item.payload?.topic || item.payload?.target_name || item.payload?.target_country || item.jobId
    contextText.value = draft.contextText || item.payload?.known_context || item.payload?.visit_context || ''

    if (item.skill === 'write-hb') {
      reportType.value = 'risk-assessment-reports'
      riskReportType.value = item.payload?.report_type === 'hb_report' ? 'hb_report' : 'k_report'
      scenario.value = item.payload?.scenario || 'foreign_leader_visit'
      return
    }

    if (item.skill === 'risk-assessment-reports') {
      reportType.value = 'risk-assessment-reports'
      scenario.value = item.payload?.scenario || 'foreign_leader_visit'
      riskReportType.value = item.payload?.report_type === 'hb_report' ? 'hb_report' : 'k_report'
      return
    }

    reportType.value = item.skill || reportType.value
  }

  function clearScreenForNextReport() {
    openedHistoryJobId.value = null
    selectedReport.value = null
    generatedHtml.value = ''
    errorMessage.value = ''
    processLogs.value = []
    job.value = null
    phase.value = 'idle'
    loadingStep.value = '等待输入任务'
    savedNotice.value = ''
    title.value = ''
    contextText.value = ''
    countryOrRegion.value = ''
    currentPosition.value = ''
    scenario.value = 'foreign_leader_visit'
    riskReportType.value = 'k_report'
    targetCity.value = ''
    visitTime.value = ''
    outputDepth.value = 'detailed'
    currentView.value = 'generator'
  }

  function saveCurrentReportDraft() {
    if (!openedHistoryJobId.value) return
    const drafts = readDrafts()
    drafts[openedHistoryJobId.value] = {
      title: title.value.trim(),
      contextText: contextText.value.trim(),
      savedAt: new Date().toISOString(),
    }
    writeDrafts(drafts)
    jobList.value = jobList.value.map((item) =>
      item.jobId === openedHistoryJobId.value
        ? { ...item, displayTitle: drafts[openedHistoryJobId.value].title }
        : item,
    )
    savedNotice.value = '已保存当前历史报告信息'
    pushLog(savedNotice.value)
  }

  function buildPayload() {
    const subject = title.value.trim()
    const context = contextText.value.trim() || subject

    if (reportType.value === 'person-intelligence-report') {
      return {
        skill: 'person-intelligence-report',
        payload: {
          target_name: subject,
          country_or_region: countryOrRegion.value.trim() || '待研判',
          current_position: currentPosition.value.trim() || '待研判',
          report_type: 'visiting_dignitary',
          visit_context: context,
          focus_areas: ['基本情况', '政治立场', '风险点', '接待建议'],
          output_depth: outputDepth.value,
          language: 'zh-CN',
        },
      }
    }

    return {
      skill: 'risk-assessment-reports',
      payload: {
        scenario: scenario.value,
        report_type: riskReportType.value,
        target_country: subject,
        target_city: targetCity.value.trim(),
        visit_time: visitTime.value.trim(),
        known_context: context,
        focus_areas: ['公开信息检索', '风险识别', '舆情走势', '处置建议'],
        language: 'zh-CN',
      },
    }
  }

  async function refreshHealth() {
    try {
      health.value = await fetchOpenClawHealth()
      pushLog(`健康检查：${health.value.status}`)
    } catch (error) {
      health.value = {
        ok: false,
        status: 'down',
        checks: {},
        details: [error instanceof Error ? error.message : String(error)],
      }
      pushLog(`健康检查失败：${health.value.details[0]}`)
    }
  }

  async function pollUntilDone(jobId) {
    const stepMessages = [
      'OpenClaw 已接收任务',
      '正在检索公开信息',
      '正在整理证据和来源',
      '正在生成报告正文',
      '正在等待文件落盘',
    ]
    let tick = 0
    let interval = 2000
    const maxInterval = 10000

    while (true) {
      const next = await fetchReportJob(jobId)
      job.value = next
      loadingStep.value = stepMessages[tick % stepMessages.length]
      pushLog(`任务状态：${next.status}${next.stage ? ` / ${next.stage}` : ''}`)
      tick += 1

      if (next.status === 'succeeded') {
        loadingStep.value = '正在读取报告文件内容'
        const result = await fetchReportResult(jobId)
        generatedHtml.value = result.html || ''
        job.value = { ...next, resultPath: result.resultPath || next.resultPath }
        selectedReport.value = { ...job.value, html: generatedHtml.value }
        phase.value = 'done'
        openedHistoryJobId.value = null
        pushLog('已读取后端返回的 HTML 报告')
        await loadJobList(false)
        return
      }

      if (next.status === 'failed' || next.status === 'waiting_approval' || next.status === 'cancelled') {
        throw new Error(next.errorMessage || `任务未成功完成：${next.status}`)
      }

      await sleep(interval)
      interval = Math.min(interval * 2, maxInterval)
    }
  }

  async function handleGenerate() {
    if (isGenerating.value || !title.value.trim()) return

    openedHistoryJobId.value = null
    isGenerating.value = true
    generatedHtml.value = ''
    errorMessage.value = ''
    processLogs.value = []
    selectedReport.value = null
    job.value = null
    phase.value = 'loading'
    loadingStep.value = '正在提交任务到后端'
    savedNotice.value = ''

    try {
      pushLog('提交报告生成任务到后端')
      await refreshHealth()
      const created = await createReportJob(buildPayload())
      job.value = { jobId: created.jobId, status: created.status }
      pushLog(`任务已创建：${created.jobId}`)
      await pollUntilDone(created.jobId)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
      phase.value = 'error'
      loadingStep.value = '任务失败'
      pushLog(`错误：${errorMessage.value}`)
    } finally {
      isGenerating.value = false
    }
  }

  async function loadJobList(switchView = true) {
    try {
      const drafts = readDrafts()
      jobList.value = (await fetchReportJobs()).map((item) => ({
        ...item,
        displayTitle: drafts[item.jobId]?.title || undefined,
      }))
      if (switchView) currentView.value = 'list'
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
      pushLog(`历史任务加载失败：${errorMessage.value}`)
    }
  }

  async function openReportFromList(item) {
    selectedReport.value = null
    generatedHtml.value = ''
    errorMessage.value = ''
    savedNotice.value = ''
    phase.value = 'loading'
    loadingStep.value = '正在读取历史报告文件'
    currentView.value = 'generator'
    openedHistoryJobId.value = item.jobId

    try {
      const result = await fetchReportResult(item.jobId)
      job.value = { ...item, resultPath: result.resultPath || item.resultPath }
      generatedHtml.value = result.html || ''
      selectedReport.value = { ...job.value, html: generatedHtml.value }
      applyHistoryDraft(item)
      phase.value = 'done'
      pushLog(`已打开历史报告：${item.jobId}`)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
      phase.value = 'error'
    }
  }

  function showGenerator() {
    clearScreenForNextReport()
  }

  onMounted(async () => {
    await refreshHealth()
    await loadJobList(false)
  })

  return {
    currentView,
    title,
    reportType,
    countryOrRegion,
    currentPosition,
    scenario,
    riskReportType,
    targetCity,
    visitTime,
    contextText,
    outputDepth,
    isGenerating,
    generatedHtml,
    phase,
    processLogs,
    loadingStep,
    job,
    jobList,
    health,
    errorMessage,
    selectedReport,
    openedHistoryJobId,
    savedNotice,
    isHistoryMode,
    filteredJobs,
    succeededCount,
    runningCount,
    getJobTitle,
    handleGenerate,
    refreshHealth,
    loadJobList,
    openReportFromList,
    showGenerator,
    resetForNewReport: clearScreenForNextReport,
    saveCurrentReportDraft,
  }
}
