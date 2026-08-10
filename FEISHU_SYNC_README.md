# 飞书多维表格同步脚本使用说明

这个目录已经生成了飞书多维表格到 Supabase PostgreSQL 的同步脚本。

## 文件说明

| 文件 | 用途 |
|---|---|
| `scripts/feishu-list-tables.js` | 读取飞书多维表格里的表名和 `table_id` |
| `scripts/feishu-sync.js` | 同步飞书记录到 Supabase |
| `scripts/lib/feishu.js` | 飞书 API 客户端 |
| `scripts/lib/supabase.js` | Supabase REST upsert 客户端 |
| `feishu-bitable-config.template.json` | 飞书字段到数据库字段的映射 |
| `supabase/schema.sql` | Supabase 建表 SQL |
| `.github/workflows/sync-feishu.yml` | GitHub Actions 定时同步 |
| `.env.example` | 本地环境变量模板 |

## 第一步：在 Supabase 建表

打开 Supabase：

```text
SQL Editor -> New query
```

执行：

```text
supabase/schema.sql
```

## 第二步：配置本地环境变量

复制 `.env.example` 为 `.env`，填入真实配置。

PowerShell 本地测试可以临时这样设置：

```powershell
$env:FEISHU_APP_ID="cli_xxx"
$env:FEISHU_APP_SECRET="xxx"
$env:FEISHU_BITABLE_APP_TOKEN="appxxx"
$env:SUPABASE_URL="https://xxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="xxx"
```

## 第三步：获取飞书 table_id

```powershell
npm run feishu:list-tables
```

输出会类似：

```text
SKU主数据    tblxxxx
成本组件     tblxxxx
```

把这些值填到环境变量：

```powershell
$env:FEISHU_TABLE_PRODUCTS="tblxxxx"
$env:FEISHU_TABLE_COST_COMPONENTS="tblxxxx"
$env:FEISHU_TABLE_PRE_LAUNCH="tblxxxx"
$env:FEISHU_TABLE_SUPPLIERS="tblxxxx"
$env:FEISHU_TABLE_COMPETITORS="tblxxxx"
$env:FEISHU_TABLE_OPERATION_LOGS="tblxxxx"
```

## 第四步：先 dry-run

```powershell
npm run feishu:dry-run
```

确认能读取飞书数据，并看到样例 JSON。

## 第五步：正式同步

```powershell
npm run feishu:sync
```

同步成功后，脚本会：

- 把飞书记录 upsert 到 Supabase。
- 将飞书记录的 `sync_status` 回写为 `synced`。
- 将 `last_synced_at` 更新为当前时间。

同步失败时，脚本会：

- 将 `sync_status` 回写为 `error`。
- 将错误写入 `sync_error`。

## GitHub Actions 自动同步

把 `.env.example` 里的变量配置到 GitHub：

```text
Repository Settings
  -> Secrets and variables
  -> Actions
  -> New repository secret
```

配置完成后，`.github/workflows/sync-feishu.yml` 会每 6 小时同步一次，也可以手动触发。

## 重要安全提醒

- 不要把 `.env` 提交到 GitHub。
- 不要把 `FEISHU_APP_SECRET` 放进前端。
- 不要把 `SUPABASE_SERVICE_ROLE_KEY` 放进前端。
- 前端只使用 Supabase `anon key`，同步脚本和后端才使用 `service_role key`。

