param(
    [string]$OutputDirectory = "release"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version
$outputRoot = Join-Path $projectRoot $OutputDirectory
$stagingRoot = Join-Path $outputRoot "staging-$version"
$zipPath = Join-Path $outputRoot "plus-ultra-online-$version.zip"

$runtimeFiles = @(
    "manifest.json",
    "ultra-custom.css",
    "ultra-custom.js",
    "deck-custom.css",
    "deck-custom.js",
    "remote-card-art.js",
    "card-art.js",
    "deck-card-art.js",
    "assets/icons/icon-16.png",
    "assets/icons/icon-32.png",
    "assets/icons/icon-48.png",
    "assets/icons/icon-128.png"
)

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $stagingRoot | Out-Null

foreach ($relativePath in $runtimeFiles) {
    $sourcePath = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Required runtime file is missing: $relativePath"
    }

    $destinationPath = Join-Path $stagingRoot $relativePath
    $destinationDirectory = Split-Path -Parent $destinationPath
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
}

Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath

$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $actualEntries = @($archive.Entries | Where-Object { $_.Name } | ForEach-Object {
        $_.FullName.Replace("\", "/")
    } | Sort-Object)
} finally {
    $archive.Dispose()
}

$expectedEntries = @($runtimeFiles | Sort-Object)
$unexpectedEntries = @($actualEntries | Where-Object { $_ -notin $expectedEntries })
$missingEntries = @($expectedEntries | Where-Object { $_ -notin $actualEntries })

if ($unexpectedEntries.Count -or $missingEntries.Count) {
    throw "Archive contents differ from the runtime allowlist. Unexpected: $($unexpectedEntries -join ', '); Missing: $($missingEntries -join ', ')"
}

Remove-Item -LiteralPath $stagingRoot -Recurse -Force

Write-Output $zipPath
