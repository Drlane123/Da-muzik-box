# Shared paths for agent checkpoint scripts (E: project only).
$script:AgentCheckpointRoot = Split-Path $PSScriptRoot -Parent
$script:AgentCheckpointDataDir = Join-Path $script:AgentCheckpointRoot ".cursor\workspace-data"
$script:AgentCheckpointJson = Join-Path $script:AgentCheckpointDataDir "agent-checkpoints.json"

function Get-AgentCheckpointStore {
  if (-not (Test-Path -LiteralPath $script:AgentCheckpointDataDir)) {
    New-Item -ItemType Directory -Path $script:AgentCheckpointDataDir -Force | Out-Null
  }
  if (-not (Test-Path -LiteralPath $script:AgentCheckpointJson)) {
    '{ "version": 1, "checkpoints": [] }' | Set-Content -LiteralPath $script:AgentCheckpointJson -Encoding UTF8
  }
  return (Get-Content -LiteralPath $script:AgentCheckpointJson -Raw | ConvertFrom-Json)
}

function Save-AgentCheckpointStore([object]$store) {
  $json = $store | ConvertTo-Json -Depth 8
  Set-Content -LiteralPath $script:AgentCheckpointJson -Value $json -Encoding UTF8
}
