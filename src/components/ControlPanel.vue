<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: String,
  reportType: String,
  countryOrRegion: String,
  currentPosition: String,
  scenario: String,
  targetCity: String,
  visitTime: String,
  contextText: String,
  outputDepth: String,
  isGenerating: Boolean,
  health: Object,
})

const emit = defineEmits([
  'update:title',
  'update:reportType',
  'update:countryOrRegion',
  'update:currentPosition',
  'update:scenario',
  'update:targetCity',
  'update:visitTime',
  'update:contextText',
  'update:outputDepth',
  'generate',
  'refresh-health',
])

const reportTypes = [
  {
    value: 'person-intelligence-report',
    label: '人物情报报告',
    desc: '外宾、领导人、重点人物背景研判',
  },
  {
    value: 'risk-assessment-reports',
    label: '风险评估报告',
    desc: '访问活动、节假日、城市风险场景研判',
  },
  {
    value: 'write-hb-k',
    label: 'K报编写',
    desc: '三段式现场调研报告：基本情况、涉我风险、对策建议',
  },
  {
    value: 'write-hb-hb',
    label: 'HB报编写',
    desc: '六段式深度调研报告：事件、背景、立场、风险、趋势、建议',
  },
]

const scenarios = [
  { value: 'foreign_leader_visit', label: '外方领导人来访' },
  { value: 'leader_outbound', label: '领导人出访' },
  { value: 'domestic_holiday', label: '国内节假日' },
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
        <span class="font-mono text-[10px] tracking-[0.25em] text-neon-cyan/60">参数控制台</span>
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
      <div class="flex items-center gap-2 mb-3">
        <span class="font-mono text-[10px] tracking-widest text-neon-cyan/60">[ 报告主题 / 对象 ]</span>
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
          @click="emit('update:reportType', type.value)"
          class="report-type-option"
          :class="{ active: reportType === type.value }"
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
      <div class="font-mono text-[10px] tracking-widest text-neon-cyan/60 mb-3">[ 业务参数 ]</div>

      <div v-if="reportType === 'person-intelligence-report'" class="space-y-3">
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

      <div v-else-if="reportType === 'risk-assessment-reports'" class="space-y-3">
        <select class="sci-input" :value="scenario" @change="emit('update:scenario', $event.target.value)">
          <option v-for="item in scenarios" :key="item.value" :value="item.value">{{ item.label }}</option>
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

      <div v-else class="space-y-3">
        <div class="font-mono text-[10px] leading-relaxed text-neon-cyan/55">
          K报/HB报将使用 write-hb skill，按国家、地方、政策、社会、传播五个维度自动拆解调研任务。
        </div>
      </div>

      <textarea
        class="sci-textarea mt-3"
        rows="4"
        :value="contextText"
        @input="emit('update:contextText', $event.target.value)"
        placeholder="补充背景、重点关注方向、已知上下文，可空"
      ></textarea>
    </div>

    <div class="p-4">
      <button @click="emit('generate')" :disabled="!canGenerate" class="sci-btn sci-btn-primary w-full py-3">
        <span v-if="isGenerating" class="flex items-center justify-center gap-2">
          <span class="data-pulse"></span>
          <span>// 后端生成中 //</span>
          <span class="data-pulse"></span>
        </span>
        <span v-else>// 启动报告生成 //</span>
      </button>

      <div class="mt-2 font-mono text-[8px] text-center text-neon-cyan/25 tracking-widest">
        NEXUS REPORT CLIENT
      </div>
    </div>
  </aside>
</template>
