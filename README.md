# 图密 · Image Crypto

纯前端图片加密解密工具。给图片加密后发给朋友，朋友用同一网页 + 同一密钥即可还原。

## 原理

不走「加密 base64 字符串」的路线（那会破坏图片文件头，产物不再是合法图片）。
而是对 **Canvas 像素数据（ImageData）** 做加密：

1. 上传图片 → Canvas 读取像素（RGBA 字节数组）
2. 用密钥派生伪随机字节流（FNV 哈希种子 → xorshift32 PRNG）
3. 对每个像素的 R/G/B 通道做 XOR，Alpha 通道保留
4. 写回 Canvas → 导出为 PNG

产物**始终是合法图片**（视觉上是噪点花屏），能显示、能下载、能再上传。
密钥正确即可还原。XOR 对称，加密解密用同一函数。

所有处理在浏览器本地完成，图片不会离开设备。

## 技术栈

- Vue 3（`<script setup>`）
- Vite
- 零运行时依赖（加密逻辑纯手写）

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 目录结构

```
src/
├── main.js              # 入口
├── App.vue              # 主页面（加密/解密 Tab、上传、预览、下载）
├── style.css            # 全局样式（GitHub 暗色主题）
└── crypto/
    └── imageCrypto.js   # 核心：像素 XOR 加解密
```
