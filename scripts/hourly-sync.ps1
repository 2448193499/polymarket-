# 每小时：拉 Polymarket → 写本地 feed → 上传 OSS
# 计划任务示例：
#   schtasks /Create /TN "PanjueHourlySync" /TR "powershell -File ...\hourly-sync.ps1" /SC HOURLY
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -LiteralPath $root
Write-Host ("[{0}] npm run sync:push" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
npm run sync:push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "done."
