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

    ctx.fillStyle = 'rgba(0, 243, 255, 0.32)'
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
  <header class="topbar flex items-center justify-between px-6">
    <div class="header-brand flex items-center">
      <span class="font-mono tracking-wide" style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: 0.02em; line-height: 1.2;">
        AI深度编报
      </span>
    </div>

    <div class="header-tech-line flex-1 mx-8 h-8 opacity-70">
      <canvas ref="canvasRef" class="w-full h-full"></canvas>
    </div>

    <div class="header-time flex flex-col items-end">
      <span class="font-mono text-[8px] text-slate-400 tracking-widest mb-1">系统时间</span>
      <span class="font-mono text-xs text-slate-700 tracking-wider">{{ currentTime }}</span>
    </div>
  </header>
</template>
