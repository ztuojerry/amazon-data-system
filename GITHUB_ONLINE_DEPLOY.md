# Amazon 数据看板线上部署

当前仓库已经配置 GitHub Pages 部署：

- 发布目录：`amazon-dashboard`
- 部署流程：`.github/workflows/deploy-dashboard.yml`
- 自定义域名：`amazon.chesey.com`
- 触发方式：推送到 `main`，且改动包含 `amazon-dashboard/**` 或部署 workflow

## 线上可用能力

GitHub Pages 是纯静态托管，所以线上页面可以直接使用：

- `amazon-dashboard/index.html` 产品数据看板
- `amazon-dashboard/asin-keywords.html` ASIN 关键词反查
- `amazon-dashboard/data/asin-keyword-data.js` 预生成的 ASIN 关键词索引

## 线上暂不可直接做的能力

以下能力不能把密钥写进 HTML/JS，否则 Token 会暴露：

- 西柚洞察 MCP 实时查询
- 本地 1GB+ ABA CSV 全量扫描
- 任何需要 `XYDC_MCP_TOKEN`、Amazon SP-API、第三方 API Key 的请求

## 推荐架构

第一版使用 GitHub Pages 静态版上线。每次本地下载新热搜词后：

```powershell
npm.cmd run search:opportunities
npm.cmd run asin-keywords:build
git add amazon-dashboard/asin-keywords.html amazon-dashboard/assets/asin-keywords.js amazon-dashboard/assets/asin-keywords.css amazon-dashboard/data/asin-keyword-data.js
git commit -m "Update Amazon keyword dashboard"
git push origin main
```

实际提交时建议只 `git add` 本次需要上线的文件，不要把原始下载 CSV 一起提交。

第二版如果要在线实时查西柚洞察，建议增加一个后端代理：

- 前端仍放 GitHub Pages
- 后端放 Vercel、Cloudflare Workers、Render 或 Railway
- `XYDC_MCP_TOKEN` 只放后端环境变量
- 前端通过 `window.ASIN_KEYWORD_API_BASE` 指向后端 API

这样既能线上访问，也不会泄露 MCP Token。
