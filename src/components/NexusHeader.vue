<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const currentTime = ref('')
const canvasRef = ref(null)

function updateTime() {
  currentTime.value = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

let timeInterval = null
let animFrameId = null
const barCount = 40
const barHeights = new Float32Array(barCount)
const targetHeights = new Float32Array(barCount)

for (let i = 0; i < barCount; i++) {
  barHeights[i] = Math.random() * 20 + 5
  targetHeights[i] = barHeights[i]
}

function drawWave() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
  }

  ctx.clearRect(0, 0, rect.width, rect.height)

  const barWidth = 3
  const gap = (rect.width - barCount * barWidth) / (barCount - 1)

  for (let i = 0; i < barCount; i++) {
    barHeights[i] += (targetHeights[i] - barHeights[i]) * 0.15

    if (Math.random() < 0.08) {
      targetHeights[i] = Math.random() * 25 + 5
    }

    const x = i * (barWidth + gap)
    const y = rect.height - barHeights[i]

    ctx.fillStyle = 'rgba(0, 243, 255, 0.6)'
    ctx.fillRect(x, y, barWidth, barHeights[i])
  }

  animFrameId = requestAnimationFrame(drawWave)
}

onMounted(() => {
  updateTime()
  timeInterval = window.setInterval(updateTime, 1000)
  drawWave()
})

onUnmounted(() => {
  window.clearInterval(timeInterval)
  if (animFrameId) cancelAnimationFrame(animFrameId)
})
</script>

<template>
  <header class="h-[60px] border-b border-border-glow bg-panel-bg backdrop-blur-lg flex items-center justify-between px-6">
    <div class="flex items-center gap-4">
      <div class="flex flex-col">
        <span class="neon-text neon-flicker font-mono font-bold tracking-widest text-sm">
          A.I. N.E.X.U.S
        </span>
        <span class="font-mono text-[9px] text-neon-cyan/50 tracking-[0.3em]">
          // 新闻材料编报系统 · v4.2.1
        </span>
      </div>

      <div class="flex items-center gap-1.5 ml-2">
        <span class="data-pulse" style="background: #00ff88;"></span>
        <span class="font-mono text-[9px] text-neon-green tracking-widest">已就绪</span>
      </div>
    </div>

    <div class="flex-1 mx-8 h-8 opacity-60">
      <canvas ref="canvasRef" class="w-full h-full"></canvas>
    </div>

    <div class="flex flex-col items-end">
      <span class="font-mono text-[8px] text-neon-cyan/40 tracking-widest mb-1">系统时间</span>
      <span class="font-mono text-xs text-neon-cyan tracking-wider">{{ currentTime }}</span>
    </div>
  </header>
</template>
