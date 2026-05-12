<script setup>
import { computed } from 'vue'

const props = defineProps({
  health: Object,
  jobs: {
    type: Array,
    default: () => [],
  },
  recentJobs: {
    type: Array,
    default: () => [],
  },
  recentLoadingMore: Boolean,
  recentHasMore: {
    type: Boolean,
    default: true,
  },
  recentLoadError: String,
  currentJobId: String,
})

const emit = defineEmits(['open-job', 'refresh-health', 'refresh-list', 'load-more-recent'])

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
const recentJobs = computed(() => props.recentJobs.length ? props.recentJobs : props.jobs)

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

function handleRecentScroll(event) {
  const target = event.currentTarget
  if (!target || props.recentLoadingMore || props.recentLoadError || !props.recentHasMore) return
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 80) {
    emit('load-more-recent')
  }
}
</script>

<template>
  <aside class="sidebar-shell w-[312px] shrink-0 flex flex-col p-4 gap-4">
    <section class="panel status-card p-5">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="font-mono text-sm neon-text tracking-widest">AI引擎状态</h2>
          <div class="mt-1 font-mono text-[10px] text-neon-cyan/35">ENGINE STATUS</div>
        </div>
        <button class="sci-btn text-[10px] px-3 py-1.5" @click="emit('refresh-health')">检测</button>
      </div>

      <div class="flex items-center gap-4 mb-6">
        <div
          class="status-orb w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl"
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
        <div class="soft-field flex items-center justify-between px-3 py-3">
          <span class="font-mono text-xs text-slate-300/65">服务连接状态</span>
          <span class="font-mono text-xs" :class="serviceStatus === '正常' ? 'text-neon-green' : serviceStatus === '检测中' ? 'text-cyber-yellow' : 'text-red-300'">{{ serviceStatus }}</span>
        </div>
        <div class="soft-field flex items-center justify-between px-3 py-3">
          <span class="font-mono text-xs text-slate-300/65">本地服务引擎</span>
          <span class="font-mono text-xs" :class="localStatus === '正常' ? 'text-neon-green' : localStatus === '检测中' ? 'text-cyber-yellow' : 'text-red-300'">{{ localStatus }}</span>
        </div>
      </div>
    </section>

    <section class="panel recent-card flex-1 min-h-0 flex flex-col">
      <div class="panel-header recent-header justify-between px-4 py-4">
        <div>
          <span class="font-mono text-sm neon-text tracking-widest">最近</span>
          <div class="mt-1 font-mono text-[10px] text-neon-cyan/30">RECENT</div>
        </div>
        <button class="sci-btn text-[10px] px-2.5 py-1.5" @click="emit('refresh-list')">↻</button>
      </div>

      <div class="recent-list flex-1 overflow-auto p-3" @scroll="handleRecentScroll">
        <div v-if="recentJobs.length" class="space-y-2">
          <button
            v-for="item in recentJobs"
            :key="item.jobId"
            class="history-item recent-item w-full text-left rounded-xl px-3.5 py-3.5 transition-all"
            :class="{ active: item.jobId === currentJobId }"
            @click="emit('open-job', item)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="statusClass(item.status)"></span>
              <span class="recent-title font-mono text-xs truncate">{{ jobTitle(item) }}</span>
              <span class="ml-auto text-neon-cyan/45 shrink-0">›</span>
            </div>
            <div class="recent-time font-mono text-[10px] mt-2 pl-3.5">
              {{ formatTime(item.updatedAt || item.createdAt) }}
            </div>
          </button>

          <button
            v-if="recentLoadError"
            type="button"
            class="recent-load-state recent-load-retry w-full"
            @click="emit('load-more-recent')"
          >
            加载失败，点击重试
          </button>
          <div v-else-if="recentLoadingMore" class="recent-load-state">加载中...</div>
          <div v-else-if="!recentHasMore" class="recent-load-state">没有更多了</div>
        </div>

        <div v-else class="h-full flex items-center justify-center text-center">
          <div>
            <div class="font-mono text-3xl text-neon-cyan/15 mb-2">RECENT</div>
            <div class="font-mono text-xs text-neon-cyan/45">{{ recentLoadingMore ? '加载中...' : '暂无最近任务' }}</div>
          </div>
        </div>
      </div>
    </section>
  </aside>
</template>
