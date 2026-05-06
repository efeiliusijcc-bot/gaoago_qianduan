<script setup>
import { computed } from 'vue'

const props = defineProps({
  health: Object,
  jobs: {
    type: Array,
    default: () => [],
  },
  currentJobId: String,
})

const emit = defineEmits(['open-job', 'refresh-health', 'refresh-list'])

const hasHealth = computed(() => Boolean(props.health))
const healthOk = computed(() => Boolean(props.health?.ok))
const engineStatus = computed(() => {
  if (!hasHealth.value) return '检测中'
  return healthOk.value ? '正常' : props.health?.status === 'degraded' ? '部分异常' : '异常'
})
const engineText = computed(() => {
  if (!hasHealth.value) return '正在连接 AI 引擎'
  return healthOk.value ? '系统运行良好' : props.health?.details?.[0] || '服务连接异常'
})
const serviceStatus = computed(() => {
  if (!hasHealth.value) return '检测中'
  return props.health?.checks?.openclawHttpApi || props.health?.checks?.openclawBinary ? '正常' : '异常'
})
const localStatus = computed(() => {
  if (!hasHealth.value) return '检测中'
  return props.health?.checks?.localProbe ? '正常' : '异常'
})
const recentJobs = computed(() => props.jobs.slice(0, 8))

function jobTitle(item) {
  return item.displayTitle || item.payload?.topic || item.payload?.target_name || item.payload?.target_country || item.jobId
}

function formatTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function statusClass(status) {
  if (status === 'succeeded') return 'bg-neon-green shadow-[0_0_10px_rgba(0,255,136,0.65)]'
  if (status === 'failed' || status === 'cancelled') return 'bg-red-300 shadow-[0_0_10px_rgba(252,90,122,0.65)]'
  return 'bg-cyber-yellow shadow-[0_0_10px_rgba(252,238,10,0.65)]'
}
</script>

<template>
  <aside class="w-[360px] border-r border-border-glow bg-panel-bg flex flex-col p-4 gap-4">
    <section class="panel p-4">
      <div class="flex items-center justify-between mb-5">
        <h2 class="font-mono text-base neon-text tracking-widest">AI引擎状态</h2>
        <button class="sci-btn text-[9px] px-2 py-1" @click="emit('refresh-health')">检测</button>
      </div>

      <div class="flex items-center gap-5 mb-5">
        <div
          class="w-16 h-16 rounded-full border flex items-center justify-center text-3xl"
          :class="healthOk ? 'border-neon-green text-neon-green shadow-[0_0_24px_rgba(0,255,136,0.35)]' : !hasHealth ? 'border-cyber-yellow text-cyber-yellow shadow-[0_0_24px_rgba(252,238,10,0.25)]' : 'border-red-300 text-red-300 shadow-[0_0_24px_rgba(252,90,122,0.25)]'"
        >
          ✓
        </div>
        <div>
          <div class="font-mono text-2xl font-bold" :class="healthOk ? 'text-neon-green' : !hasHealth ? 'text-cyber-yellow' : 'text-red-300'">{{ engineStatus }}</div>
          <div class="font-mono text-xs text-neon-cyan/65 mt-1">{{ engineText }}</div>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between rounded border border-neon-cyan/15 bg-black/25 px-3 py-3">
          <span class="font-mono text-xs text-neon-cyan/70">服务连接状态</span>
          <span class="font-mono text-xs" :class="serviceStatus === '正常' ? 'text-neon-green' : serviceStatus === '检测中' ? 'text-cyber-yellow' : 'text-red-300'">{{ serviceStatus }}</span>
        </div>
        <div class="flex items-center justify-between rounded border border-neon-cyan/15 bg-black/25 px-3 py-3">
          <span class="font-mono text-xs text-neon-cyan/70">本地服务引擎</span>
          <span class="font-mono text-xs" :class="localStatus === '正常' ? 'text-neon-green' : localStatus === '检测中' ? 'text-cyber-yellow' : 'text-red-300'">{{ localStatus }}</span>
        </div>
      </div>
    </section>

    <section class="panel flex-1 min-h-0 flex flex-col">
      <div class="panel-header justify-between">
        <span class="font-mono text-base neon-text tracking-widest">历史记录</span>
        <button class="font-mono text-neon-cyan/65 hover:text-neon-green text-sm" @click="emit('refresh-list')">↻</button>
      </div>

      <div class="flex-1 overflow-auto p-2">
        <div v-if="recentJobs.length" class="space-y-1">
          <button
            v-for="item in recentJobs"
            :key="item.jobId"
            class="w-full text-left rounded border px-3 py-3 transition-colors hover:bg-neon-cyan/10"
            :class="item.jobId === currentJobId ? 'border-neon-cyan/60 bg-neon-cyan/10' : 'border-neon-cyan/10 bg-black/20'"
            @click="emit('open-job', item)"
          >
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full shrink-0" :class="statusClass(item.status)"></span>
              <span class="font-mono text-xs text-neon-cyan/85 truncate">{{ jobTitle(item) }}</span>
              <span class="ml-auto text-neon-cyan/55">›</span>
            </div>
            <div class="font-mono text-[10px] text-neon-cyan/40 mt-1 pl-4">
              {{ formatTime(item.updatedAt || item.createdAt) }}
            </div>
          </button>
        </div>

        <div v-else class="h-full flex items-center justify-center text-center">
          <div>
            <div class="font-mono text-3xl text-neon-cyan/15 mb-2">HISTORY</div>
            <div class="font-mono text-xs text-neon-cyan/45">暂无历史记录</div>
          </div>
        </div>
      </div>
    </section>
  </aside>
</template>
