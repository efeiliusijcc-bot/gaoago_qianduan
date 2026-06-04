<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { fetchResearchKeys, fetchVectorSourceStatus, updateResearchKeys } from '../lib/api.js'

const emit = defineEmits(['return-home'])

const currentTime = ref('')
const canvasRef = ref(null)
const settingsButtonRef = ref(null)
const settingsMenuRef = ref(null)
const showSettingsMenu = ref(false)
const settingsMenuStyle = ref({})
const showKeySettings = ref(false)
const keyStatus = ref(null)
const keyForm = ref({
  tavilyApiKey: '',
  exaApiKey: '',
  firecrawlApiKey: '',
  openaiEmbeddingApiKey: '',
})
const keyClears = ref({
  tavilyApiKey: false,
  exaApiKey: false,
  firecrawlApiKey: false,
  openaiEmbeddingApiKey: false,
})
const keyLoading = ref(false)
const keySaving = ref(false)
const keyError = ref('')
const keyNotice = ref('')
const vectorStatus = ref(null)

const keyFields = [
  { key: 'tavilyApiKey', label: 'Tavily', placeholder: 'tvly-...' },
  { key: 'exaApiKey', label: 'Exa', placeholder: 'Exa API Key' },
  { key: 'firecrawlApiKey', label: 'Firecrawl', placeholder: 'fc-...' },
  { key: 'openaiEmbeddingApiKey', label: 'OpenAI Embedding', placeholder: 'sk-...' },
]

const emptyKeyForm = () => ({
  tavilyApiKey: '',
  exaApiKey: '',
  firecrawlApiKey: '',
  openaiEmbeddingApiKey: '',
})

const emptyKeyClears = () => ({
  tavilyApiKey: false,
  exaApiKey: false,
  firecrawlApiKey: false,
  openaiEmbeddingApiKey: false,
})

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

async function loadResearchKeys() {
  keyLoading.value = true
  keyError.value = ''
  try {
    const [keys, vector] = await Promise.allSettled([fetchResearchKeys(), fetchVectorSourceStatus()])
    if (keys.status === 'fulfilled') keyStatus.value = keys.value
    else throw keys.reason
    if (vector.status === 'fulfilled') vectorStatus.value = vector.value
  } catch (error) {
    keyError.value = error instanceof Error ? error.message : String(error)
  } finally {
    keyLoading.value = false
  }
}

function openKeySettings() {
  showSettingsMenu.value = false
  showKeySettings.value = true
  keyNotice.value = ''
  keyError.value = ''
  keyForm.value = emptyKeyForm()
  keyClears.value = emptyKeyClears()
  void loadResearchKeys()
}

function closeKeySettings() {
  if (!keySaving.value) showKeySettings.value = false
}

function updateSettingsMenuPosition() {
  const button = settingsButtonRef.value
  if (!button) return
  const rect = button.getBoundingClientRect()
  settingsMenuStyle.value = {
    top: `${rect.bottom + 8}px`,
    right: `${Math.max(16, window.innerWidth - rect.right)}px`,
  }
}

function toggleSettingsMenu(event) {
  event?.stopPropagation()
  if (!showSettingsMenu.value) updateSettingsMenuPosition()
  showSettingsMenu.value = !showSettingsMenu.value
}

function closeSettingsMenu() {
  showSettingsMenu.value = false
}

function handleDocumentClick(event) {
  const menu = settingsMenuRef.value
  const button = settingsButtonRef.value
  if (menu?.contains(event.target) || button?.contains(event.target)) return
  closeSettingsMenu()
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') closeSettingsMenu()
}

function handleWindowResize() {
  if (showSettingsMenu.value) updateSettingsMenuPosition()
}

function configuredLabel(name) {
  return keyStatus.value?.[name]?.configured ? '已配置' : '未配置'
}

function configuredClass(name) {
  return keyStatus.value?.[name]?.configured ? 'text-emerald-600' : 'text-slate-500'
}

function toggleClear(name) {
  keyClears.value = {
    ...keyClears.value,
    [name]: !keyClears.value[name],
  }
  if (keyClears.value[name]) {
    keyForm.value = { ...keyForm.value, [name]: '' }
  }
}

async function saveResearchKeys() {
  keySaving.value = true
  keyError.value = ''
  keyNotice.value = ''

  const body = {}
  for (const field of keyFields) {
    const value = keyForm.value[field.key]?.trim()
    if (keyClears.value[field.key]) body[field.key] = null
    else if (value) body[field.key] = value
  }

  try {
    keyStatus.value = await updateResearchKeys(body)
    keyNotice.value = '配置已保存，下一次编报立即生效。'
    keyForm.value = emptyKeyForm()
    keyClears.value = emptyKeyClears()
  } catch (error) {
    keyError.value = error instanceof Error ? error.message : String(error)
  } finally {
    keySaving.value = false
  }
}

let timeInterval = null
let animFrameId = null
const barCount = 40
const barHeights = new Float32Array(barCount)
const targetHeights = new Float32Array(barCount)

for (let i = 0; i < barCount; i++) {
  barHeights[i] = Math.random() * 28 + 8
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
      targetHeights[i] = Math.random() * 30 + 8
    }

    const x = i * (barWidth + gap)
    const y = rect.height - barHeights[i]
    const h = barHeights[i]
    const alpha = 0.25 + (h / 38) * 0.45
    ctx.fillStyle = `rgba(14, 165, 233, ${alpha.toFixed(2)})`
    ctx.fillRect(x, y, barWidth, h)

    if (h > 20) {
      const tipH = Math.min(h * 0.35, 12)
      ctx.fillStyle = 'rgba(0, 200, 220, 0.55)'
      ctx.fillRect(x, y, barWidth, tipH)
    }
  }

  animFrameId = requestAnimationFrame(drawWave)
}

onMounted(() => {
  updateTime()
  timeInterval = window.setInterval(updateTime, 1000)
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', handleWindowResize)
  drawWave()
})

onUnmounted(() => {
  window.clearInterval(timeInterval)
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', handleWindowResize)
  if (animFrameId) cancelAnimationFrame(animFrameId)
})
</script>

<template>
  <header class="topbar flex items-center justify-between px-6">
    <div class="header-brand flex items-center">
      <button
        class="header-home-btn"
        type="button"
        aria-label="返回首页"
        title="返回首页"
        @click="emit('return-home')"
      >
        ‹
      </button>
      <span class="font-mono tracking-wide" style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: 0.02em; line-height: 1.2;">
        AI深度编报
      </span>
    </div>

    <div class="header-tech-line flex-1 mx-8 h-10">
      <canvas ref="canvasRef" class="w-full h-full"></canvas>
    </div>

    <div class="header-right-actions">
      <div class="header-time flex flex-col items-end">
        <span class="font-mono text-[8px] text-slate-400 tracking-widest mb-1">系统时间</span>
        <span class="font-mono text-xs text-slate-700 tracking-wider">{{ currentTime }}</span>
      </div>

      <div class="header-settings relative">
        <button
          ref="settingsButtonRef"
          class="settings-icon-btn"
          type="button"
          aria-label="设置"
          :aria-expanded="showSettingsMenu"
          title="设置"
          @click.stop="toggleSettingsMenu"
        >
          ⚙
        </button>
      </div>
    </div>
  </header>

  <Teleport to="body">
    <button
      v-if="showSettingsMenu"
      ref="settingsMenuRef"
      class="settings-dropdown"
      type="button"
      role="menuitem"
      :style="settingsMenuStyle"
      @click.stop="openKeySettings"
    >
      <span class="settings-menu-icon">⌁</span>
      <span>信源设置</span>
    </button>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="showKeySettings"
      class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-sm"
      @click.self="closeKeySettings"
    >
      <section class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="font-mono text-lg font-bold text-slate-900">信源设置</h2>
            <p class="mt-1 text-xs leading-relaxed text-slate-500">配置 Tavily、Exa、Firecrawl 和向量检索 API Key。密钥只保存在服务器，前端不回显明文。</p>
          </div>
          <button class="sci-btn px-3 py-2 text-[10px]" type="button" @click="closeKeySettings">关闭</button>
        </div>

        <div v-if="keyLoading" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          正在读取配置状态...
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="field in keyFields"
            :key="field.key"
            class="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
          >
            <div class="mb-2 flex items-center justify-between gap-3">
              <div class="font-mono text-sm font-semibold text-slate-900">{{ field.label }}</div>
              <div class="font-mono text-[11px]" :class="configuredClass(field.key)">
                {{ configuredLabel(field.key) }}
              </div>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row">
              <input
                class="sci-input flex-1 text-sm"
                type="password"
                autocomplete="off"
                :disabled="keyClears[field.key]"
                :placeholder="keyClears[field.key] ? '保存后清除该 Key' : `输入新的 ${field.label} Key 后保存覆盖`"
                :value="keyForm[field.key]"
                @input="keyForm = { ...keyForm, [field.key]: $event.target.value }"
              />
              <button
                class="sci-btn shrink-0 px-3 py-2 text-[10px]"
                type="button"
                @click="toggleClear(field.key)"
              >
                {{ keyClears[field.key] ? '取消清除' : '清除' }}
              </button>
            </div>
          </div>
          <div v-if="vectorStatus" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <span>向量库：<strong :class="vectorStatus.available ? 'text-emerald-600' : 'text-amber-600'">{{ vectorStatus.available ? '可用' : '未就绪' }}</strong></span>
              <span>索引 {{ vectorStatus.indexedRows || 0 }} 条</span>
              <span v-if="vectorStatus.embeddingModel">模型 {{ vectorStatus.embeddingModel }}</span>
              <span v-if="vectorStatus.lastIndexedAt">更新 {{ new Date(vectorStatus.lastIndexedAt).toLocaleString('zh-CN', { hour12: false }) }}</span>
            </div>
            <div v-if="vectorStatus.fallbackReason" class="mt-1 text-amber-600">{{ vectorStatus.fallbackReason }}</div>
          </div>
        </div>

        <div v-if="keyError" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ keyError }}
        </div>
        <div v-if="keyNotice" class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {{ keyNotice }}
        </div>

        <div class="mt-5 flex items-center justify-end gap-2">
          <button class="sci-btn px-4 py-2 text-[10px]" type="button" :disabled="keySaving" @click="closeKeySettings">
            取消
          </button>
          <button class="sci-btn sci-btn-primary px-4 py-2 text-[10px]" type="button" :disabled="keySaving || keyLoading" @click="saveResearchKeys">
            {{ keySaving ? '保存中...' : '保存配置' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
