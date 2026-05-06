<script setup>
import NexusHeader from './components/NexusHeader.vue'
import ControlPanel from './components/ControlPanel.vue'
import DataCanvas from './components/DataCanvas.vue'
import { useReportJobs } from './composables/useReportJobs.js'

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
  monitorJobFromList,
  showGenerator,
  resetForNewReport,
  saveCurrentReportDraft,
  toggleLogDrawer,
} = useReportJobs()

function skillLabel(item) {
  if (item.skill === 'write-hb' && item.payload?.report_type) return item.payload.report_type
  if (item.skill === 'person-intelligence-report') return '人物情报'
  if (item.skill === 'risk-assessment-reports') return '风险评估'
  return item.skill || '报告'
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
        v-model:contextText="contextText"
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
          <button class="sci-btn text-[10px] px-3 py-2" :disabled="!hasActiveWorkspace" @click="showGenerator">返回当前编报</button>
          <button class="sci-btn text-[10px] px-3 py-2" @click="resetForNewReport">新建编报</button>
          <button class="sci-btn text-[10px] px-3 py-2" @click="loadJobList(false)">刷新列表</button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="panel p-4">
          <div class="font-mono text-[10px] text-neon-cyan/50 tracking-widest mb-2">任务总数</div>
          <div class="font-mono text-3xl neon-text">{{ filteredJobs.length }}</div>
        </div>
        <div class="panel p-4">
          <div class="font-mono text-[10px] text-neon-cyan/50 tracking-widest mb-2">已完成</div>
          <div class="font-mono text-3xl text-neon-green">{{ succeededCount }}</div>
        </div>
        <div class="panel p-4">
          <div class="font-mono text-[10px] text-neon-cyan/50 tracking-widest mb-2">运行中</div>
          <div class="font-mono text-3xl text-cyber-yellow">{{ runningCount }}</div>
        </div>
        <div class="panel p-4">
          <div class="font-mono text-[10px] text-neon-cyan/50 tracking-widest mb-2">后端状态</div>
          <div class="font-mono text-3xl" :class="health?.ok ? 'text-neon-green' : 'text-cyber-yellow'">
            {{ health?.status || 'unknown' }}
          </div>
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
            <div
              class="col-span-2 font-mono text-xs"
              :class="item.status === 'succeeded' ? 'text-neon-green' : item.status === 'failed' ? 'text-red-300' : 'text-cyber-yellow'"
            >
              {{ item.status }}<span v-if="item.stage && item.stage !== item.status" class="text-neon-cyan/35"> / {{ item.stage }}</span>
            </div>
            <div class="col-span-2 font-mono text-xs text-neon-cyan/55">{{ item.updatedAt || item.createdAt }}</div>
            <div class="col-span-1 font-mono text-xs text-neon-cyan/55 truncate">{{ item.resultPath ? '已生成' : '未生成' }}</div>
            <div class="col-span-1">
              <button
                class="font-mono text-[10px] text-neon-cyan hover:text-neon-green disabled:opacity-30"
                @click="monitorJobFromList(item)"
              >
                {{ item.status === 'succeeded' ? '查看报告' : item.status === 'running' || item.status === 'queued' ? '查看状态' : '查看错误' }}
              </button>
            </div>
          </div>
        </div>

        <div v-else class="py-16 text-center">
          <div class="font-mono text-4xl text-neon-cyan/15 mb-4">NO DATA</div>
          <div class="font-mono text-sm text-neon-cyan/35">暂无报告任务</div>
        </div>
      </div>
    </main>
  </div>
</template>
