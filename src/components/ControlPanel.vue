<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: String,
  reportType: String,
  countryOrRegion: String,
  currentPosition: String,
  scenario: String,
  riskReportType: String,
  targetCity: String,
  visitTime: String,
  contextText: String,
  outputDepth: String,
  isGenerating: Boolean,
  health: Object,
  isHistoryMode: Boolean,
  savedNotice: String,
})

const emit = defineEmits([
  'update:title',
  'update:reportType',
  'update:countryOrRegion',
  'update:currentPosition',
  'update:scenario',
  'update:riskReportType',
  'update:targetCity',
  'update:visitTime',
  'update:contextText',
  'update:outputDepth',
  'generate',
  'save-current',
  'new-report',
  'refresh-health',
])

const reportTypes = [
  {
    value: 'person-intelligence-report',
    label: '人物情报报告',
    desc: '外宾、领导人、重点人物背景研判。',
  },
  {
    value: 'risk-assessment-reports',
    label: '风险评估报告',
    desc: '出访、来访、节假日和调研类风险任务。',
  },
]

const scenarios = [
  { value: 'h_report', label: '调研报告' },
  { value: 'foreign_leader_visit', label: '外方领导人来访' },
  { value: 'leader_outbound', label: '领导人出访' },
  { value: 'domestic_holiday', label: '国内节假日' },
]

const riskReportTypes = [
  { value: 'k_report', label: 'K报' },
  { value: 'hb_report', label: 'HB报' },
]

const outputDepths = [
  { value: 'brief', label: '简版' },
  { value: 'standard', label: '标准' },
  { value: 'detailed', label: '详细' },
]

const canGenerate = computed(() => props.title?.trim() && !props.isGenerating)
const healthStatus = computed(() => props.health?.status || 'unknown')
const healthColor = computed(() => {
  if (props.health?.ok) return '#00ff88'
  if (props.health?.status === 'degraded') return '#fcee0a'
  return '#ff5c7a'
})
</script>

<template>
  <aside class="w-[360px] border-r border-border-glow bg-panel-bg flex flex-col">
    <div class="panel-header justify-between">
      <div class="flex items-center gap-2">
        <span class="data-pulse"></span>
        <span class="font-mono text-[10px] tracking-[0.25em] text-neon-cyan/60">
          {{ isHistoryMode ? '历史报告' : '参数控制台' }}
        </span>
      </div>
      <button class="sci-btn text-[9px] px-2 py-1" @click="emit('refresh-health')">检测</button>
    </div>

    <div class="p-4 border-b border-border-glow">
      <div class="font-mono text-[9px] tracking-widest text-neon-cyan/45 mb-2">后端状态</div>
      <div class="font-mono text-[10px]" :style="{ color: healthColor }">
        [{{ healthStatus }}] {{ health?.details?.[0] || 'OpenClaw health endpoint' }}
      </div>
      <div v-if="health?.checks" class="grid grid-cols-2 gap-1 mt-2 font-mono text-[9px] text-neon-cyan/45">
        <span>OpenClaw: {{ health.checks.openclawHttpApi || health.checks.openclawBinary ? '正常' : '异常' }}</span>
        <span>本地探测: {{ health.checks.localProbe ? '正常' : '异常' }}</span>
      </div>
    </div>

    <div class="p-4 border-b border-border-glow">
      <div class="flex items-center justify-between gap-2 mb-3">
        <span class="font-mono text-[10px] tracking-widest text-neon-cyan/60">[ 报告主题 / 对象 ]</span>
        <span v-if="isHistoryMode" class="font-mono text-[9px] text-cyber-yellow">可修改后保存</span>
      </div>
      <textarea
        :value="title"
        @input="emit('update:title', $event.target.value)"
        placeholder="例如：2026年五一假期杭州热门景区人流风险研判"
        rows="3"
        class="sci-textarea"
      ></textarea>
    </div>

    <div class="p-4 border-b border-border-glow">
      <div class="flex items-center gap-2 mb-3">
        <span class="font-mono text-[10px] tracking-widest text-neon-cyan/60">[ 报告类型 ]</span>
      </div>
      <div class="space-y-2">
        <div
          v-for="type in reportTypes"
          :key="type.value"
          @click="!isHistoryMode && emit('update:reportType', type.value)"
          class="report-type-option"
          :class="{ active: reportType === type.value, 'opacity-60 cursor-default': isHistoryMode && reportType !== type.value }"
        >
          <div class="flex items-center justify-between">
            <span class="text-neon-cyan font-semibold">{{ type.label }}</span>
            <span v-if="reportType === type.value" class="text-neon-green text-[10px]">已选择</span>
          </div>
          <div class="text-[10px] text-neon-cyan/50 mt-1">{{ type.desc }}</div>
        </div>
      </div>
    </div>

    <div class="p-4 border-b border-border-glow flex-1 overflow-auto">
      <div class="font-mono text-[10px] tracking-widest text-neon-cyan/60 mb-3">
        [ {{ isHistoryMode ? '历史备注' : '业务参数' }} ]
      </div>

      <div v-if="!isHistoryMode && reportType === 'person-intelligence-report'" class="space-y-3">
        <input
          class="sci-input"
          :value="countryOrRegion"
          @input="emit('update:countryOrRegion', $event.target.value)"
          placeholder="国家或地区，例如：法国"
        />
        <input
          class="sci-input"
          :value="currentPosition"
          @input="emit('update:currentPosition', $event.target.value)"
          placeholder="当前职务，例如：法国总统"
        />
        <select class="sci-input" :value="outputDepth" @change="emit('update:outputDepth', $event.target.value)">
          <option v-for="item in outputDepths" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </div>

      <div v-else-if="!isHistoryMode && reportType === 'risk-assessment-reports'" class="space-y-3">
        <select class="sci-input" :value="scenario" @change="emit('update:scenario', $event.target.value)">
          <option v-for="item in scenarios" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
        <select
          v-if="scenario === 'h_report'"
          class="sci-input"
          :value="riskReportType"
          @change="emit('update:riskReportType', $event.target.value)"
        >
          <option v-for="item in riskReportTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
        <input
          class="sci-input"
          :value="targetCity"
          @input="emit('update:targetCity', $event.target.value)"
          placeholder="目标城市，可空"
        />
        <input
          class="sci-input"
          :value="visitTime"
          @input="emit('update:visitTime', $event.target.value)"
          placeholder="时间窗口，例如：2026年5月"
        />
      </div>

      <div v-else class="font-mono text-[10px] leading-relaxed text-neon-cyan/55">
        当前正在查看历史报告。修改主题后点击保存，只会更新本页面的历史展示标题，不会重新生成报告正文。
      </div>

      <textarea
        class="sci-textarea mt-3"
        rows="4"
        :value="contextText"
        @input="emit('update:contextText', $event.target.value)"
        placeholder="补充背景、重点关注方向、已知上下文，可空"
      ></textarea>
    </div>

    <div class="p-4 space-y-2">
      <template v-if="isHistoryMode">
        <button @click="emit('save-current')" class="sci-btn sci-btn-primary w-full py-3">
          // 保存当前报告信息 //
        </button>
        <button @click="emit('new-report')" class="sci-btn w-full py-3">
          // 清屏，开启下一个编报 //
        </button>
        <div v-if="savedNotice" class="font-mono text-[9px] text-center text-neon-green/75">
          {{ savedNotice }}
        </div>
      </template>

      <button v-else @click="emit('generate')" :disabled="!canGenerate" class="sci-btn sci-btn-primary w-full py-3">
        <span v-if="isGenerating" class="flex items-center justify-center gap-2">
          <span class="data-pulse"></span>
          <span>// 后端生成中 //</span>
          <span class="data-pulse"></span>
        </span>
        <span v-else>// 启动编报生成 //</span>
      </button>

      <div class="font-mono text-[8px] text-center text-neon-cyan/25 tracking-widest">
        NEXUS REPORT CLIENT
      </div>
    </div>
  </aside>
</template>
