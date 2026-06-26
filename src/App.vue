<script setup>
import { ref, computed } from 'vue'
import { fileToImageData, smoothXor, canvasToPngBlobUrl } from './crypto/imageCrypto.js'

const mode = ref('encrypt') // 'encrypt' | 'decrypt'

const file = ref(null)
const originUrl = ref('')
const resultUrl = ref('')
const key = ref('')
const showKey = ref(false)
const busy = ref(false)
const errorMsg = ref('')
const dragOver = ref(false)
const fileName = ref('')
const fileSize = ref(0)
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
  originUrl.value = URL.createObjectURL(f)
  resultUrl.value = ''
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
  resultUrl.value = ''
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
  try {
    const { canvas, ctx, imageData } = await fileToImageData(file.value)
    const result = smoothXor(imageData, key.value, scale)
    ctx.putImageData(result, 0, 0)
    const url = await canvasToPngBlobUrl(canvas)
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
  const ext = mode.value === 'encrypt' ? '-encrypted.png' : '-decrypted.png'
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
        <span class="logo">🜃</span>
        <div>
          <h1>图密 · Image Crypto</h1>
          <p>纯前端图片加密 · 空间相关 XOR · 连续色块无方块边界</p>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="tabs">
        <button :class="['tab', { active: mode === 'encrypt' }]" @click="switchMode('encrypt')">🔒 加密</button>
        <button :class="['tab', { active: mode === 'decrypt' }]" @click="switchMode('decrypt')">🔓 解密</button>
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
            <span class="upload-icon">🖼️</span>
            <span class="upload-text">点击选择或拖拽图片到此处</span>
            <span class="upload-sub">支持 PNG / JPG / WEBP，纯本地处理，不上传服务器</span>
          </label>
        </div>

        <div v-if="fileName" class="file-meta">
          <span class="file-name">📄 {{ fileName }}</span>
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

        <p v-if="errorMsg" class="error">⚠️ {{ errorMsg }}</p>
      </section>

      <section v-if="originUrl || resultUrl" class="results">
        <div v-if="originUrl" class="img-card">
          <div class="img-label">{{ modeText.originLabel }}</div>
          <img :src="originUrl" class="preview" alt="原图" />
        </div>
        <div v-if="resultUrl" class="img-card">
          <div class="img-label">{{ modeText.resultLabel }}</div>
          <img :src="resultUrl" class="preview" alt="结果" />
          <button class="primary-btn small" @click="downloadResult">⬇️ 下载图片</button>
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
  font-size: 30px; width: 52px; height: 52px;
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
}
.tab:hover { color: var(--text); }
.tab.active { background: var(--accent); color: #fff; font-weight: 500; }

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
.upload-icon { font-size: 36px; }
.upload-text { color: var(--text); font-size: 15px; }
.upload-sub { color: var(--text-muted); font-size: 12px; }

.file-meta {
  display: flex; gap: 12px; align-items: center; font-size: 13px;
  color: var(--text-muted); margin: 10px 0 18px;
}
.file-name { color: var(--text); }

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

.block-options { display: flex; gap: 6px; flex-wrap: wrap; }
.block-btn {
  background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-muted); padding: 8px 12px; cursor: pointer; font-size: 13px; transition: all .15s;
}
.block-btn:hover { color: var(--text); border-color: var(--text-muted); }
.block-btn.active { background: var(--accent-blue); color: #fff; border-color: var(--accent-blue); font-weight: 500; }

.primary-btn {
  width: 100%; background: var(--accent); color: #fff; border: none; border-radius: 6px;
  padding: 12px; font-size: 15px; font-weight: 500; cursor: pointer; transition: background .15s;
}
.primary-btn:hover:not(:disabled) { background: var(--accent-hover); }
.primary-btn:disabled { opacity: .6; cursor: not-allowed; }
.primary-btn.small { width: auto; margin-top: 12px; padding: 8px 16px; font-size: 13px; }

.error {
  margin: 14px 0 0; color: var(--danger); font-size: 13px;
  background: rgba(248,81,73,.1); border: 1px solid rgba(248,81,73,.4);
  border-radius: 6px; padding: 10px 12px;
}

.results { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
.img-card {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px; display: flex; flex-direction: column; align-items: center;
}
.img-label { color: var(--text-muted); font-size: 13px; margin-bottom: 10px; align-self: flex-start; }
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
