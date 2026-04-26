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
  jobList,
  health,
  errorMessage,
  filteredJobs,
  succeededCount,
  runningCount,
  handleGenerate,
  refreshHealth,
  loadJobList,
  openReportFromList,
  showGenerator,
} = useReportJobs()
</script>

<template>
  <div class="min-h-screen bg-deep-void grid-bg relative">
    <div class="crt-overlay"></div>
    <div class="crt-scanline"></div>

    <NexusHeader />

    <div v-if="currentView === 'generator'" class="flex h-[calc(100vh-60px)]">
      <ControlPanel
        v-model:title="title"
        v-model:reportType="reportType"
        v-model:countryOrRegion="countryOrRegion"
        v-model:currentPosition="currentPosition"
        v-model:scenario="scenario"
        v-model:targetCity="targetCity"
        v-model:visitTime="visitTime"
        v-model:contextText="contextText"
        v-model:outputDepth="outputDepth"
        :isGenerating="isGenerating"
        :health="health"
        @generate="handleGenerate"
        @refresh-health="refreshHealth"
      />

      <DataCanvas
        :phase="phase"
        :loadingStep="loadingStep"
        :processLogs="processLogs"
        :generatedHtml="generatedHtml"
        :reportType="reportType"
        :title="title"
        :job="job"
        :jobList="filteredJobs"
        :health="health"
        :errorMessage="errorMessage"
        @list="loadJobList"
      />
    </div>

    <main v-else class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <div class="neon-text font-mono text-xl font-bold tracking-widest">报告档案库</div>
          <div class="font-mono text-[10px] text-neon-cyan/40 mt-1">真实后端任务列表 / 点击查看已生成报告</div>
        </div>
        <div class="flex gap-2">
          <button class="sci-btn text-[10px] px-3 py-2" @click="showGenerator">返回生成</button>
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
          <div class="font-mono text-3xl" :class="health?.ok ? 'text-neon-green' : 'text-cyber-yellow'">{{ health?.status || 'unknown' }}</div>
        </div>
      </div>

      <div class="panel overflow-hidden">
        <div class="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border-glow bg-neon-cyan/5">
          <div class="col-span-2 font-mono text-[10px] text-neon-cyan/60 tracking-widest">任务编号</div>
          <div class="col-span-2 font-mono text-[10px] text-neon-cyan/60 tracking-widest">类型</div>
          <div class="col-span-2 font-mono text-[10px] text-neon-cyan/60 tracking-widest">状态</div>
          <div class="col-span-3 font-mono text-[10px] text-neon-cyan/60 tracking-widest">生成时间</div>
          <div class="col-span-2 font-mono text-[10px] text-neon-cyan/60 tracking-widest">文件</div>
          <div class="col-span-1 font-mono text-[10px] text-neon-cyan/60 tracking-widest">操作</div>
        </div>

        <div v-if="filteredJobs.length">
          <div
            v-for="item in filteredJobs"
            :key="item.jobId"
            class="grid grid-cols-12 gap-4 px-4 py-4 border-b border-neon-cyan/10 hover:bg-neon-cyan/5 transition-colors"
          >
            <div class="col-span-2 font-mono text-xs text-neon-cyan">{{ item.jobId.slice(0, 8) }}</div>
            <div class="col-span-2 font-mono text-xs text-neon-cyan/75">{{ item.skill }}</div>
            <div class="col-span-2 font-mono text-xs" :class="item.status === 'succeeded' ? 'text-neon-green' : 'text-cyber-yellow'">{{ item.status }}</div>
            <div class="col-span-3 font-mono text-xs text-neon-cyan/55">{{ item.updatedAt || item.createdAt }}</div>
            <div class="col-span-2 font-mono text-xs text-neon-cyan/55 truncate">{{ item.resultPath || '未生成文件' }}</div>
            <div class="col-span-1">
              <button
                class="font-mono text-[10px] text-neon-cyan hover:text-neon-green disabled:opacity-30"
                :disabled="item.status !== 'succeeded'"
                @click="openReportFromList(item)"
              >
                查看
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
