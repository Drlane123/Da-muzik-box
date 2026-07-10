$ErrorActionPreference = 'Stop'
$repo = 'E:\Da-Music-Box-v4-SOURCE-COMPLETE'
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$dest = "E:\Da-Music-Box-CODE-COPY_$stamp"
$log = Join-Path $repo 'pack-result.txt'

New-Item -ItemType Directory -Path $dest -Force | Out-Null

$folders = @('app', 'scripts')
$copied = @()

foreach ($name in $folders) {
    $src = Join-Path $repo $name
    if (-not (Test-Path -LiteralPath $src)) { continue }
    $null = robocopy $src (Join-Path $dest $name) /E /R:2 /W:1 /NFL /NDL /NJH /NJS
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $name (exit $LASTEXITCODE)" }
    $copied += $name
}

$rootFiles = @(
    'package.json', 'bun.lockb', 'bun.lock', 'vite.config.ts', 'tsconfig.json',
    'tsconfig.app.json', 'tsconfig.node.json', 'index.html', '.gitignore'
)
foreach ($f in $rootFiles) {
    $src = Join-Path $repo $f
    if (Test-Path -LiteralPath $src) {
        Copy-Item -LiteralPath $src -Destination (Join-Path $dest $f) -Force
        $copied += $f
    }
}

if (Test-Path -LiteralPath (Join-Path $repo '.cursor\rules')) {
    $null = robocopy (Join-Path $repo '.cursor\rules') (Join-Path $dest '.cursor\rules') /E /R:2 /W:1 /NFL /NDL /NJH /NJS
    $copied += '.cursor/rules'
}

$fileCount = (Get-ChildItem -LiteralPath $dest -Recurse -File -Force | Measure-Object).Count
$sizeBytes = (Get-ChildItem -LiteralPath $dest -Recurse -File -Force | Measure-Object -Property Length -Sum).Sum
$sizeMb = [math]::Round($sizeBytes / 1MB, 2)

$body = @(
    'FOLDER COPY COMPLETE - CODE BACKUP'
    '=================================='
    ''
    "Copy: $dest"
    "Files: $fileCount"
    "Size: $sizeMb MB"
    "Finished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    ''
    'Included folders/files:'
    ($copied | ForEach-Object { "  - $_" })
    ''
    'Rebuild after restore: bun install'
    ''
    'This is a plain folder copy (not a zip). Open the folder directly in Explorer.'
)
$body | Set-Content -LiteralPath $log -Encoding UTF8
$body | Set-Content -LiteralPath (Join-Path $dest 'README-COPY.txt') -Encoding UTF8
$body | ForEach-Object { Write-Host $_ }

return @{ Dest = $dest; FileCount = $fileCount; SizeMb = $sizeMb }
