# 中文语音面试官 Demo (React + Vite + TS)

一个简易但完整的中文语音面试官网页 Demo：集成 Web Speech API 语音识别、浏览器 TTS 播报、LLM 追问（DeepSeek Chat，可选）与结构化问答流程（每个主问题附带 2 条追问）。

## 功能特性

- 欢迎语与风格选择（严肃 / 亲切 / 校园风），影响播报语气与追问风格
- 面试流程：3 个主问题 + 每题最多 2 条追问（生成并显示）
- 语音作答：开始录音 / 提交录音；录音中、朗读中与追问生成中的明确提示
- 文本作答（可选）：需显式切换，文本回答会被标记
- 总结页：显示主问题与追问的问答记录，支持查看 JSON
- UI：Material UI 主题、玻璃卡片、渐变背景，移动端优化（按钮全宽、底部粘性操作区）

## 开发与运行

### 1. 安装依赖

```bash
cd web
npm install
```

### 2. 环境变量（可选，用于 DeepSeek 追问）

- 在 `web` 目录下创建 `.env` 或 `.env.local`（文件已被 `.gitignore` 忽略，不会被提交）：

```env
VITE_DEEPSEEK_API_KEY=sk-你的key
```

- 或在浏览器控制台临时设置：

```js
localStorage.setItem("DEEPSEEK_API_KEY", "sk-你的key");
```

### 3. 启动开发服务器

```bash
npm run dev
```

默认地址通常为 http://localhost:5173

### 4. 构建

在 PowerShell 下建议分步执行：

```bash
npx tsc -b
npx vite build
```

## Vercel 部署

> 假设你将 `web` 作为子目录部署（推荐）。

1. 推送代码到 GitHub。
2. 在 Vercel 新建项目，选择该仓库。
3. 在 “Root Directory” 选择 `web`。
4. Build Command：`npm run build`（Vercel 使用 Linux Shell，`&&` 可正常工作）
5. Output Directory：`dist`
6. Install Command：`npm install`
7. 环境变量：在 Vercel Project → Settings → Environment Variables 中添加：
   - `VITE_DEEPSEEK_API_KEY = sk-你的key`
8. 保存并 Deploy。

注意：

- 如果 DeepSeek API 存在跨域限制，建议在你自己的后端做代理再调用。
- 浏览器语音识别与合成推荐用 Chrome 桌面版。

## 目录结构（web）

```
web/
  src/
    hooks/               # 语音识别/合成
    App.tsx              # 页面与流程
    llm.ts               # DeepSeek 追问（可选）
    types.ts             # 类型与预设
    main.tsx             # MUI 主题入口
  index.html
  package.json
  tsconfig*.json
```

## 已知限制

- Web Speech API 在部分浏览器/系统兼容性差
- DeepSeek 直连需 CORS 许可；建议生产代理

## 许可证

MIT