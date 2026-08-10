$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$nodeCandidates = @(
  'D:\Program Files (x86)\nodejs\node.exe',
  'C:\Program Files\nodejs\node.exe'
)

$node = $nodeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $node) {
  $node = 'node'
}

& $node 'scripts\serve-dashboard.js'
