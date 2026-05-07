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
  if (status === 'succeeded') return 'bg-neon-green shadow-[0_0_8px_rgba(0,255,136,0.38)]'
  if (status === 'failed' || status === 'cancelled') return 'bg-red-300 shadow-[0_0_8px_rgba(252,90,122,0.35)]'
  return 'bg-cyber-yellow shadow-[0_0_8px_rgba(252,238,10,0.32)]'
}
</script>

<template>
  <aside class="w-[312px] shrink-0 border-r border-neon-cyan/10 bg-[rgba(4,12,21,0.72)] backdrop-blur-xl flex flex-col p-4 gap-4">
    <section class="panel p-5">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="font-mono text-sm neon-text tracking-widest">AI引擎状态</h2>
          <div class="mt-1 font-mono text-[10px] text-neon-cyan/35">ENGINE STATUS</div>
        </div>
        <button class="sci-btn text-[10px] px-3 py-1.5" @click="emit('refresh-health')">检测</button>
      </div>

      <div class="flex items-center gap-4 mb-6">
        <div
          class="w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl bg-black/20"
          :class="healthOk ? 'border-neon-green/45 text-neon-green shadow-[0_0_22px_rgba(0,255,136,0.16)]' : !hasHealth ? 'border-cyber-yellow/35 text-cyber-yellow shadow-[0_0_18px_rgba(252,238,10,0.12)]' : 'border-red-300/45 text-red-300 shadow-[0_0_18px_rgba(252,90,122,0.14)]'"
        >
          ✓
        </div>
        <div class="min-w-0">
          <div class="font-mono text-[28px] leading-none font-bold" :class="healthOk ? 'text-neon-green' : !hasHealth ? 'text-cyber-yellow' : 'text-red-300'">{{ engineStatus }}</div>
          <div class="font-mono text-xs text-slate-300/70 mt-2 truncate">{{ engineText }}</div>
        </div>
      </div>

      <div class="space-y-2 border-t border-neon-cyan/10 pt-4">
        <div class="flex items-center justify-between rounded-xl border border-neon-cyan/10 bg-black/18 px-3 py-3">
          <span class="font-mono text-xs text-slate-300/65">服务连接状态</span>
          <span class="font-mono text-xs" :class="serviceStatus === '正常' ? 'text-neon-green' : serviceStatus === '检测中' ? 'text-cyber-yellow' : 'text-red-300'">{{ serviceStatus }}</span>
        </div>
        <div class="flex items-center justify-between rounded-xl border border-neon-cyan/10 bg-black/18 px-3 py-3">
          <span class="font-mono text-xs text-slate-300/65">本地服务引擎</span>
          <span class="font-mono text-xs" :class="localStatus === '正常' ? 'text-neon-green' : localStatus === '检测中' ? 'text-cyber-yellow' : 'text-red-300'">{{ localStatus }}</span>
        </div>
      </div>
    </section>

    <section class="panel flex-1 min-h-0 flex flex-col">
      <div class="panel-header justify-between px-4 py-4">
        <div>
          <span class="font-mono text-sm neon-text tracking-widest">历史记录</span>
          <div class="mt-1 font-mono text-[10px] text-neon-cyan/30">RECENT REPORTS</div>
        </div>
        <button class="sci-btn text-[10px] px-2.5 py-1.5" @click="emit('refresh-list')">↻</button>
      </div>

      <div class="flex-1 overflow-auto p-3">
        <div v-if="recentJobs.length" class="space-y-2">
          <button
            v-for="item in recentJobs"
            :key="item.jobId"
            class="w-full text-left rounded-xl border px-3.5 py-3.5 transition-all hover:bg-neon-cyan/[0.07] hover:border-neon-cyan/25 hover:translate-x-0.5"
            :class="item.jobId === currentJobId ? 'border-neon-cyan/45 bg-neon-cyan/[0.08]' : 'border-neon-cyan/10 bg-black/16'"
            @click="emit('open-job', item)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="statusClass(item.status)"></span>
              <span class="font-mono text-xs text-slate-100/82 truncate">{{ jobTitle(item) }}</span>
              <span class="ml-auto text-neon-cyan/45 shrink-0">›</span>
            </div>
            <div class="font-mono text-[10px] text-neon-cyan/35 mt-2 pl-3.5">
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
