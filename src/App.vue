<script setup>
import NexusHeader from './components/NexusHeader.vue'
import ControlPanel from './components/ControlPanel.vue'
import DataCanvas from './components/DataCanvas.vue'
import { useReportJobs } from './composables/useReportJobs.js'
import { computed } from 'vue'

const {
  currentView,
  title,
  reportType,
  countryOrRegion,
  currentPosition,
  scenario,
  targetCity,
  visitTime,
  contextText,
  parameterValues,
  activeParameters,
  outputDepth,
  isGenerating,
  generatedHtml,
  phase,
  processLogs,
  loadingStep,
  job,
  health,
  errorMessage,
  filteredJobs,
  listSearch,
  listTypeFilter,
  listPage,
  listPageSize,
  listTotal,
  listTotalPages,
  succeededCount,
  runningCount,
  isHistoryMode,
  hasActiveWorkspace,
  savedNotice,
  executionLogs,
  unreadLogCount,
  isLogDrawerOpen,
  getJobTitle,
  handleGenerate,
  refreshHealth,
  loadJobList,
  updateListSearch,
  updateListTypeFilter,
  updateListPage,
  updateListPageSize,
  monitorJobFromList,
  showGenerator,
  resetForNewReport,
  saveCurrentReportDraft,
  toggleLogDrawer,
} = useReportJobs()

const reportTypeOptions = [
  { value: 'all', label: '全部' },
  { value: 'write-hb-k', label: 'K报' },
  { value: 'write-hb-hb', label: 'HB报' },
  { value: 'person-intelligence-report', label: '人物报' },
  { value: 'risk-assessment-reports', label: '风险报' },
]

const hasGeneratingWorkspace = computed(() => {
  return phase.value === 'loading' || isGenerating.value || job.value?.status === 'running' || job.value?.status === 'queued'
})

function skillLabel(item) {
  if (item.skill === 'write-hb' && item.payload?.report_type) return item.payload.report_type
  if (item.skill === 'person-intelligence-report') return '人物情报'
  if (item.skill === 'risk-assessment-reports') return '风险评估'
  return item.skill || '报告'
}

function jobStatusType(status) {
  if (status === 'succeeded') return 'success'
  if (status === 'failed' || status === 'cancelled' || status === 'waiting_approval') return 'failed'
  return 'running'
}

function jobStatusLabel(status) {
  const type = jobStatusType(status)
  if (type === 'success') return '成功'
  if (type === 'failed') return '失败'
  return '生成中'
}

function jobStatusClass(status) {
  const type = jobStatusType(status)
  if (type === 'success') return 'text-neon-green'
  if (type === 'failed') return 'text-red-300'
  return 'text-cyber-yellow'
}

function jobActionLabel(status) {
  const type = jobStatusType(status)
  if (type === 'success') return '查看报告'
  if (type === 'failed') return '查看错误'
  return '查看状态'
}
</script>

<template>
  <div class="min-h-screen bg-deep-void grid-bg relative">
    <div class="crt-overlay"></div>
    <div class="crt-scanline"></div>

    <NexusHeader />

    <div v-if="currentView === 'generator'" class="flex h-[calc(100vh-60px)]">
      <ControlPanel
        :health="health"
        :jobs="filteredJobs"
        :currentJobId="job?.jobId"
        @open-job="monitorJobFromList"
        @refresh-health="refreshHealth"
        @refresh-list="loadJobList(false)"
      />

      <DataCanvas
        v-model:title="title"
        v-model:reportType="reportType"
        v-model:contextText="contextText"
        v-model:parameterValues="parameterValues"
        v-model:activeParameters="activeParameters"
        :phase="phase"
        :loadingStep="loadingStep"
        :processLogs="processLogs"
        :generatedHtml="generatedHtml"
        :reportType="reportType"
        :job="job"
        :jobList="filteredJobs"
        :health="health"
        :errorMessage="errorMessage"
        :isHistoryMode="isHistoryMode"
        :isGenerating="isGenerating"
        :executionLogs="executionLogs"
        :unreadLogCount="unreadLogCount"
        :isLogDrawerOpen="isLogDrawerOpen"
        @generate="handleGenerate"
        @list="loadJobList"
        @new-report="resetForNewReport"
        @toggle-log-drawer="toggleLogDrawer"
      />
    </div>

    <main v-else class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <div class="neon-text font-mono text-xl font-bold tracking-widest">报告档案库</div>
          <div class="font-mono text-[10px] text-neon-cyan/40 mt-1">真实后端任务列表 / 点击查看已生成报告</div>
        </div>
        <div class="flex gap-2">
          <button
            v-if="hasActiveWorkspace"
            class="sci-btn text-[10px] px-3 py-2"
            :class="hasGeneratingWorkspace ? 'border-neon-green text-neon-green shadow-[0_0_18px_rgba(0,255,159,0.18)]' : ''"
            @click="showGenerator"
          >
            {{ hasGeneratingWorkspace ? '返回生成编报' : '返回当前编报' }}
          </button>
          <button class="sci-btn text-[10px] px-3 py-2" @click="resetForNewReport">新建编报</button>
          <button class="sci-btn text-[10px] px-3 py-2" @click="loadJobList(false)">刷新列表</button>
        </div>
      </div>

      <div class="panel p-4 mb-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="relative flex-1">
            <input
              :value="listSearch"
              class="w-full bg-deep-void/80 border border-neon-cyan/25 rounded-sm px-4 py-3 pr-10 font-mono text-sm text-neon-cyan placeholder:text-neon-cyan/25 focus:border-neon-cyan focus:outline-none focus:shadow-[0_0_18px_rgba(0,245,255,0.16)]"
              placeholder="搜索标题 / 任务编号 / 上下文关键词"
              @input="updateListSearch($event.target.value)"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-neon-cyan/35">SEARCH</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in reportTypeOptions"
              :key="option.value"
              class="sci-btn text-[10px] px-3 py-2"
              :class="listTypeFilter === option.value ? 'border-neon-green bg-neon-green/10 text-neon-green' : ''"
              @click="updateListTypeFilter(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="panel p-4">
          <div class="font-mono text-[10px] text-neon-cyan/50 tracking-widest mb-2">任务总数</div>
          <div class="font-mono text-3xl neon-text">{{ listTotal }}</div>
        </div>
        <div class="panel p-4">
          <div class="font-mono text-[10px] text-neon-cyan/50 tracking-widest mb-2">已完成</div>
          <div class="font-mono text-3xl text-neon-green">{{ succeededCount }}</div>
        </div>
        <div class="panel p-4">
          <div class="font-mono text-[10px] text-neon-cyan/50 tracking-widest mb-2">运行中</div>
          <div class="font-mono text-3xl text-cyber-yellow">{{ runningCount }}</div>
        </div>
      </div>

      <div class="panel overflow-hidden">
        <div class="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border-glow bg-neon-cyan/5">
          <div class="col-span-2 font-mono text-[10px] text-neon-cyan/60 tracking-widest">任务编号</div>
          <div class="col-span-3 font-mono text-[10px] text-neon-cyan/60 tracking-widest">主题</div>
          <div class="col-span-1 font-mono text-[10px] text-neon-cyan/60 tracking-widest">类型</div>
          <div class="col-span-2 font-mono text-[10px] text-neon-cyan/60 tracking-widest">状态</div>
          <div class="col-span-2 font-mono text-[10px] text-neon-cyan/60 tracking-widest">更新时间</div>
          <div class="col-span-1 font-mono text-[10px] text-neon-cyan/60 tracking-widest">文件</div>
          <div class="col-span-1 font-mono text-[10px] text-neon-cyan/60 tracking-widest">操作</div>
        </div>

        <div v-if="filteredJobs.length">
          <div
            v-for="item in filteredJobs"
            :key="item.jobId"
            class="grid grid-cols-12 gap-4 px-4 py-4 border-b border-neon-cyan/10 hover:bg-neon-cyan/5 transition-colors"
          >
            <div class="col-span-2 font-mono text-xs text-neon-cyan">{{ item.jobId.slice(0, 8) }}</div>
            <div class="col-span-3 font-mono text-xs text-neon-cyan/75 truncate">{{ getJobTitle(item) }}</div>
            <div class="col-span-1 font-mono text-xs text-neon-cyan/75">{{ skillLabel(item) }}</div>
            <div class="col-span-2 font-mono text-xs" :class="jobStatusClass(item.status)">
              {{ jobStatusLabel(item.status) }}
            </div>
            <div class="col-span-2 font-mono text-xs text-neon-cyan/55">{{ item.updatedAt || item.createdAt }}</div>
            <div class="col-span-1 font-mono text-xs text-neon-cyan/55 truncate">{{ item.resultPath ? '已生成' : '未生成' }}</div>
            <div class="col-span-1">
              <button
                class="font-mono text-[10px] text-neon-cyan hover:text-neon-green disabled:opacity-30"
                @click="monitorJobFromList(item)"
              >
                {{ jobActionLabel(item.status) }}
              </button>
            </div>
          </div>
        </div>

        <div v-else class="py-16 text-center">
          <div class="font-mono text-4xl text-neon-cyan/15 mb-4">{{ listSearch || listTypeFilter !== 'all' ? 'NO MATCH' : 'NO DATA' }}</div>
          <div class="font-mono text-sm text-neon-cyan/35">
            {{ listSearch || listTypeFilter !== 'all' ? '未找到匹配编报' : '暂无报告任务' }}
          </div>
        </div>
      </div>

      <div class="panel mt-4 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="font-mono text-[10px] text-neon-cyan/50">
          第 {{ listPage }} / {{ listTotalPages }} 页 · 共 {{ listTotal }} 条
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select
            class="bg-deep-void border border-neon-cyan/25 px-3 py-2 font-mono text-[10px] text-neon-cyan focus:outline-none focus:border-neon-cyan"
            :value="listPageSize"
            @change="updateListPageSize($event.target.value)"
          >
            <option value="10">10 条/页</option>
            <option value="20">20 条/页</option>
            <option value="50">50 条/页</option>
            <option value="100">100 条/页</option>
          </select>
          <button class="sci-btn text-[10px] px-3 py-2" :disabled="listPage <= 1" @click="updateListPage(listPage - 1)">上一页</button>
          <button class="sci-btn text-[10px] px-3 py-2" :disabled="listPage >= listTotalPages" @click="updateListPage(listPage + 1)">下一页</button>
        </div>
      </div>
    </main>
  </div>
</template>
