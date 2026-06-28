<script setup>
import { ref, computed } from 'vue'
import { fileToImageData, smoothXor, canvasToBlobUrl, pickExportMime } from './crypto/imageCrypto.js'

const mode = ref('encrypt') // 'encrypt' | 'decrypt'

const file = ref(null)
const fileMime = ref('') // 记录原图 MIME，解密时按原格式导出
const originUrl = ref('')
const resultUrl = ref('')
const key = ref('')
const showKey = ref(false)
const busy = ref(false)
const errorMsg = ref('')
const dragOver = ref(false)
const fileName = ref('')
const fileSize = ref(0)
const resultSize = ref(0) // 结果文件大小
const scale = 128 // 色块尺度固定，无需用户选择

const modeText = computed(() =>
  mode.value === 'encrypt'
    ? { title: '加密', action: '加密图片', hint: '上传图片并输入密钥，生成一幅保留明暗结构、颜色被扭曲成连续色块的加密图发给朋友。', resultLabel: '加密结果（连续色块）', originLabel: '原始图片' }
    : { title: '解密', action: '解密图片', hint: '收到加密图后，上传它并输入同一密钥，即可还原原图。', resultLabel: '解密结果（原图）', originLabel: '加密图片' }
)

function pickFile(f) {
  if (!f) return
  if (!f.type.startsWith('image/')) {
    errorMsg.value = '请选择图片文件'
    return
  }
  revokeUrls()
  file.value = f
  fileName.value = f.name
  fileSize.value = f.size
  fileMime.value = f.type // 记录原图格式
  originUrl.value = URL.createObjectURL(f)
  resultUrl.value = ''
  resultSize.value = 0
  errorMsg.value = ''
}

function onDrop(e) {
  dragOver.value = false
  const f = e.dataTransfer.files?.[0]
  if (f) pickFile(f)
}

function onFileInput(e) {
  const f = e.target.files?.[0]
  if (f) pickFile(f)
}

function revokeUrls() {
  if (originUrl.value) URL.revokeObjectURL(originUrl.value)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  originUrl.value = ''
  resultUrl.value = ''
}

function switchMode(m) {
  if (mode.value === m) return
  mode.value = m
  revokeUrls()
  file.value = null
  fileName.value = ''
  fileSize.value = 0
  fileMime.value = ''
  resultUrl.value = ''
  resultSize.value = 0
  errorMsg.value = ''
}

function fmtSize(n) {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

async function process() {
  errorMsg.value = ''
  if (!file.value) { errorMsg.value = '请先上传图片'; return }
  if (!key.value) { errorMsg.value = '请输入密钥'; return }
  busy.value = true
  resultUrl.value = ''
  resultSize.value = 0
  try {
    const { canvas, ctx, imageData } = await fileToImageData(file.value)
    const result = smoothXor(imageData, key.value, scale)
    ctx.putImageData(result, 0, 0)

    // 加密：固定 PNG（无损，避免有损压缩导致解密失真）
    // 解密：按原图格式导出（JPEG→JPEG，避免 PNG 膨胀）
    let exportMime, exportQuality
    if (mode.value === 'encrypt') {
      exportMime = 'image/png'
      exportQuality = undefined
    } else {
      const picked = pickExportMime(fileMime.value)
      exportMime = picked.mime
      exportQuality = picked.quality
    }

    const url = await canvasToBlobUrl(canvas, exportMime, exportQuality)

    // 读取结果 blob 大小用于展示
    const resp = await fetch(url)
    const blob = await resp.blob()
    resultSize.value = blob.size

    resultUrl.value = url
  } catch (e) {
    errorMsg.value = e.message || '处理失败'
  } finally {
    busy.value = false
  }
}

function downloadResult() {
  if (!resultUrl.value) return
  const a = document.createElement('a')
  a.href = resultUrl.value
  // 加密：固定 .png；解密：按原格式扩展名
  let ext
  if (mode.value === 'encrypt') {
    ext = '-encrypted.png'
  } else {
    const map = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/webp': '.webp', 'image/png': '.png' }
    const suffix = map[fileMime.value] || '.png'
    ext = '-decrypted' + suffix
  }
  const base = (fileName.value || 'image').replace(/\.[^.]+$/, '')
  a.download = base + ext
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
</script>

<template>
  <div class="wrap">
    <header class="topbar">
      <div class="brand">
        <span class="logo" aria-hidden="true">
          <!-- 影鸦符号：盾牌 + 鸦羽，与 favicon.svg 同源 -->
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2 L4 5 V11 C4 16 7 20 12 22 C17 20 20 16 20 11 V5 Z" />
            <path d="M12 7 L12 14" />
            <path d="M9 11 L12 14 L15 11" />
          </svg>
        </span>
        <div>
          <h1>图密 · Image Crypto</h1>
          <p>纯前端图片加密 · 空间相关 XOR · 连续色块无方块边界</p>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="tabs">
        <button :class="['tab', { active: mode === 'encrypt' }]" @click="switchMode('encrypt')">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11 V7 a4 4 0 0 1 8 0 v4" />
          </svg>
          加密
        </button>
        <button :class="['tab', { active: mode === 'decrypt' }]" @click="switchMode('decrypt')">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11 V7 a4 4 0 0 1 7.5 -2" />
          </svg>
          解密
        </button>
      </div>

      <section class="panel">
        <p class="hint">{{ modeText.hint }}</p>

        <div
          class="dropzone"
          :class="{ over: dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
        >
          <input type="file" accept="image/*" class="file-input" @change="onFileInput" id="fileInput" />
          <label for="fileInput" class="dropzone-inner">
            <span class="upload-icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8.5" cy="10" r="1.5" />
                <path d="M21 16 L16 11 L5 19" />
                <path d="M12 4 L12 9 M9.5 6.5 L12 4 L14.5 6.5" />
              </svg>
            </span>
            <span class="upload-text">点击选择或拖拽图片到此处</span>
            <span class="upload-sub">支持 PNG / JPG / WEBP，纯本地处理，不上传服务器</span>
          </label>
        </div>

        <div v-if="fileName" class="file-meta">
          <span class="file-name">
            <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 3 H7 a2 2 0 0 0 -2 2 v14 a2 2 0 0 0 2 2 h10 a2 2 0 0 0 2 -2 V8 Z" />
              <path d="M14 3 V8 h5" />
              <path d="M9 13 h6 M9 16 h6" />
            </svg>
            {{ fileName }}
          </span>
          <span class="file-size">{{ fmtSize(fileSize) }}</span>
        </div>

        <div class="field">
          <label class="label">密钥（口令）<span class="label-sub">—— 加密解密必须一致，没有密钥无法还原</span></label>
          <div class="key-row">
            <input
              :type="showKey ? 'text' : 'password'"
              v-model="key"
              class="input"
              placeholder="输入密钥"
              autocomplete="off"
            />
            <button class="ghost-btn" @click="showKey = !showKey" type="button">
              {{ showKey ? '隐藏' : '显示' }}
            </button>
          </div>
        </div>

        <button class="primary-btn" :disabled="busy" @click="process">
          <span v-if="busy">处理中…</span>
          <span v-else>{{ modeText.action }}</span>
        </button>

        <p v-if="errorMsg" class="error">
          <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3 L22 20 H2 Z" />
            <path d="M12 10 L12 14" />
            <circle cx="12" cy="17" r="0.5" fill="currentColor" />
          </svg>
          {{ errorMsg }}
        </p>
      </section>

      <section v-if="originUrl || resultUrl" class="results">
        <div v-if="originUrl" class="img-card">
          <div class="img-label">{{ modeText.originLabel }} · {{ fmtSize(fileSize) }}</div>
          <img :src="originUrl" class="preview" alt="原图" />
        </div>
        <div v-if="resultUrl" class="img-card">
          <div class="img-label">
            {{ modeText.resultLabel }} · {{ fmtSize(resultSize) }}
            <span
              v-if="resultSize && fileSize"
              :class="['size-delta', resultSize > fileSize ? 'up' : 'down']"
            >
              {{ resultSize > fileSize ? '↑' : '↓' }}
              {{ fmtSize(Math.abs(resultSize - fileSize)) }}
            </span>
          </div>
          <img :src="resultUrl" class="preview" alt="结果" />
          <button class="primary-btn small" @click="downloadResult">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 4 V16" />
              <path d="M7 11 L12 16 L17 11" />
              <path d="M5 20 H19" />
            </svg>
            下载图片
          </button>
        </div>
      </section>
    </main>

    <footer class="footer">
      <span>所有处理在浏览器本地完成，图片不会离开你的设备。解密时请使用与加密相同的密钥。</span>
    </footer>
  </div>
</template>

<style scoped>
.wrap { max-width: 920px; margin: 0 auto; padding: 32px 20px 48px; }
.topbar { margin-bottom: 28px; }
.brand { display: flex; align-items: center; gap: 14px; }
.logo {
  color: var(--accent-blue);
  width: 52px; height: 52px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
}
.topbar h1 { margin: 0; font-size: 22px; font-weight: 600; color: var(--text); }
.topbar p { margin: 4px 0 0; font-size: 13px; color: var(--text-muted); }

.tabs {
  display: inline-flex; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 4px; gap: 4px; margin-bottom: 20px;
}
.tab {
  border: none; background: transparent; color: var(--text-muted);
  padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all .15s;
  display: inline-flex; align-items: center; gap: 6px;
}
.tab:hover { color: var(--text); }
.tab.active { background: var(--accent); color: #fff; font-weight: 500; }
.tab-icon { width: 16px; height: 16px; display: block; }

.panel {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 24px;
}
.hint { margin: 0 0 18px; color: var(--text-muted); font-size: 14px; line-height: 1.6; }

.dropzone {
  border: 2px dashed var(--border); border-radius: var(--radius);
  transition: border-color .15s, background .15s; cursor: pointer; margin-bottom: 8px;
}
.dropzone.over { border-color: var(--accent-blue); background: rgba(88,166,255,.06); }
.file-input { display: none; }
.dropzone-inner {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 36px 20px; cursor: pointer; text-align: center;
}
.upload-icon { color: var(--text-muted); display: inline-flex; }
.dropzone.over .upload-icon { color: var(--accent-blue); }
.upload-text { color: var(--text); font-size: 15px; }
.upload-sub { color: var(--text-muted); font-size: 12px; }

.file-meta {
  display: flex; gap: 12px; align-items: center; font-size: 13px;
  color: var(--text-muted); margin: 10px 0 18px;
}
.file-name { color: var(--text); display: inline-flex; align-items: center; gap: 6px; }
.meta-icon { width: 16px; height: 16px; display: block; color: var(--text-muted); }

.field-row { display: flex; gap: 20px; margin-bottom: 18px; flex-wrap: wrap; }
.field { flex: 1; min-width: 220px; }
.label { display: block; font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }
.label-sub { font-size: 11px; opacity: .8; }
.key-row { display: flex; gap: 8px; }
.input {
  flex: 1; background: var(--bg-input); border: 1px solid var(--border);
  border-radius: 6px; padding: 10px 12px; color: var(--text); font-size: 14px;
  outline: none; transition: border-color .15s;
}
.input:focus { border-color: var(--accent-blue); }
.ghost-btn {
  background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-muted); padding: 0 14px; cursor: pointer; font-size: 13px;
}
.ghost-btn:hover { color: var(--text); border-color: var(--text-muted); }

.primary-btn {
  width: 100%; background: var(--accent); color: #fff; border: none; border-radius: 6px;
  padding: 12px; font-size: 15px; font-weight: 500; cursor: pointer; transition: background .15s;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.primary-btn:hover:not(:disabled) { background: var(--accent-hover); }
.primary-btn:disabled { opacity: .6; cursor: not-allowed; }
.primary-btn.small { width: auto; margin-top: 12px; padding: 8px 16px; font-size: 13px; }
.btn-icon { width: 15px; height: 15px; display: block; }

.error {
  margin: 14px 0 0; color: var(--danger); font-size: 13px;
  background: rgba(248,81,73,.1); border: 1px solid rgba(248,81,73,.4);
  border-radius: 6px; padding: 10px 12px;
  display: flex; align-items: center; gap: 8px;
}
.error-icon { width: 16px; height: 16px; display: block; flex-shrink: 0; }

.results { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
.img-card {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px; display: flex; flex-direction: column; align-items: center;
}
.img-label { color: var(--text-muted); font-size: 13px; margin-bottom: 10px; align-self: flex-start; display: flex; align-items: center; gap: 8px; }
.size-delta { font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 500; }
.size-delta.up { color: var(--danger); background: rgba(248,81,73,.12); }
.size-delta.down { color: var(--accent); background: rgba(35,134,54,.15); }
.preview {
  max-width: 100%; max-height: 360px; border-radius: 6px;
  background: repeating-conic-gradient(#1c2128 0% 25%, #0d1117 0% 50%) 50% / 16px 16px;
}

.footer { margin-top: 32px; text-align: center; color: var(--text-muted); font-size: 12px; }

@media (max-width: 640px) {
  .results { grid-template-columns: 1fr; }
  .brand { flex-direction: column; align-items: flex-start; }
  .field-row { flex-direction: column; }
}
</style>
