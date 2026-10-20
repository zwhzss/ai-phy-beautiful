<#
    Physics Beauty - one-click release build

    Steps:
      1. check required tools (go / node / wails / makensis)
      2. generate the narration audio pack (narrations-audio.zip)
      3. generate the material assets pack (phy-assets.zip)
      4. build frontend (Angular production build)
      5. sync frontend output into the desktop project
      6. build backend (server executable) + desktop dependencies
      7. build desktop executable (wails build)
      8. verify the installer actually carries the audio pack
      9. build NSIS installer (makensis)

    Usage:
      powershell -NoProfile -ExecutionPolicy Bypass -File build-release.ps1
      powershell -NoProfile -ExecutionPolicy Bypass -File build-release.ps1 -SkipAudioPack

    IMPORTANT: keep this file ASCII-only. Non-ASCII characters in .ps1/.bat
    may break on hosts using a legacy code page.

    Options:
      -SkipFrontend     reuse existing client build output
      -SkipServer       do not build the standalone server executable
      -SkipAudioPack    do not regenerate narrations-audio.zip (reuse the existing one)
      -SkipAudioCheck   do not fail when the audio pack is missing
      -AudioDb          path to the SQLite DB used to build the audio pack
      -AudioDir         path to the narration audio directory
      -NoInstaller      build only the desktop exe, skip the NSIS installer
#>
[CmdletBinding()]
param(
    [switch]$SkipFrontend,
    [switch]$SkipServer,
    [switch]$SkipAudioPack,
    [switch]$SkipAudioCheck,
    [string]$AudioDb = '',
    [string]$AudioDir = '',
    [switch]$NoInstaller
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root         = $PSScriptRoot
$clientDir    = Join-Path $root 'client'
$serverDir    = Join-Path $root 'server'
$desktopDir   = Join-Path $root 'desktop'
$distDir      = Join-Path $clientDir 'dist\phy-beauty-client\browser'
$desktopFront = Join-Path $desktopDir 'frontend\dist'
$audioPack    = Join-Path $desktopDir 'assets\narrations-audio.zip'
$audioReport  = Join-Path $desktopDir 'assets\narrations-audio.report.json'
$installerDir = Join-Path $desktopDir 'build\windows\installer'
$nsiFile      = Join-Path $installerDir 'project.nsi'
$binDir       = Join-Path $desktopDir 'build\bin'
$desktopExe   = Join-Path $binDir 'PhysicsBeauty.exe'
$installerExe = Join-Path $binDir 'phy-beauty-amd64-installer.exe'

$script:stepNo   = 0
$script:stepSum  = 9
$script:started  = Get-Date

function Write-Step([string]$text) {
    $script:stepNo++
    Write-Host ''
    Write-Host ("[{0}/{1}] {2}" -f $script:stepNo, $script:stepSum, $text) -ForegroundColor Cyan
}

function Write-Ok([string]$text)   { Write-Host ("      OK  - {0}" -f $text) -ForegroundColor Green }
function Write-Warn([string]$text) { Write-Host ("      WARN - {0}" -f $text) -ForegroundColor Yellow }
function Write-Info([string]$text) { Write-Host ("      {0}" -f $text) -ForegroundColor Gray }

function Fail([string]$text) {
    Write-Host ''
    Write-Host ("      FAILED - {0}" -f $text) -ForegroundColor Red
    exit 1
}

# Run a native command and fail the build when it returns a non-zero exit code.
#
# Note: do NOT pipe native command output through "2>&1 | Out-Host". Under
# Windows PowerShell 5.1 that turns ordinary stderr progress messages (e.g.
# "ng build" writes its progress to stderr) into terminating NativeCommandError
# records. We let stdout/stderr pass straight through and only inspect the exit
# code, which is what actually matters here.
function Invoke-Native([string]$label, [scriptblock]$body) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $body
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($LASTEXITCODE -ne 0) {
        Fail ("{0} (exit code {1})" -f $label, $LASTEXITCODE)
    }
}

function Format-Size([long]$bytes) {
    if ($bytes -ge 1GB) { return ('{0:N2} GB' -f ($bytes / 1GB)) }
    if ($bytes -ge 1MB) { return ('{0:N2} MB' -f ($bytes / 1MB)) }
    return ('{0:N0} KB' -f ($bytes / 1KB))
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '==================================================' -ForegroundColor Magenta
Write-Host '  Physics Beauty - Release Build' -ForegroundColor Magenta
Write-Host '==================================================' -ForegroundColor Magenta
Write-Host ("  project: {0}" -f $root)
Write-Host ("  started: {0}" -f $script:started.ToString('yyyy-MM-dd HH:mm:ss'))

# ---------------------------------------------------------------------------
# 1. toolchain check
# ---------------------------------------------------------------------------
Write-Step 'Checking toolchain'

function Resolve-Tool([string]$name, [string[]]$extraDirs) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($dir in $extraDirs) {
        if (-not $dir) { continue }
        $candidate = Join-Path $dir "$name.exe"
        if (Test-Path $candidate) { return $candidate }
    }
    return $null
}

$goBin = Resolve-Tool 'go' @()
if (-not $goBin) { Fail 'go was not found in PATH' }
Write-Ok ("go      : {0}" -f $goBin)

$nodeBin = Resolve-Tool 'node' @()
if (-not $nodeBin) { Fail 'node was not found in PATH' }
Write-Ok ("node    : {0}" -f $nodeBin)

$npxBin = Resolve-Tool 'npx' @()
if (-not $npxBin) { Fail 'npx was not found in PATH' }
Write-Ok ("npx     : {0}" -f $npxBin)

$goPathBin = Join-Path $env:USERPROFILE 'go\bin'
$wailsBin = Resolve-Tool 'wails' @($goPathBin)
if (-not $wailsBin) {
    Fail 'wails CLI was not found. Install it with: go install github.com/wailsapp/wails/v2/cmd/wails@latest'
}
Write-Ok ("wails   : {0}" -f $wailsBin)

$makensisBin = Resolve-Tool 'makensis' @(
    "${env:ProgramFiles(x86)}\NSIS",
    "$env:ProgramFiles\NSIS"
)
if (-not $makensisBin -and -not $NoInstaller) {
    Fail 'makensis was not found. Install NSIS 3.x or pass -NoInstaller.'
}
if ($makensisBin) { Write-Ok ("makensis: {0}" -f $makensisBin) }

# make the resolved tools visible to child processes
$env:PATH = "$env:PATH;$goPathBin"

# ---------------------------------------------------------------------------
# 2. narration audio pack
#
# The installer ships desktop\assets\narrations-audio.zip and the app unpacks it
# into %APPDATA%\phy-beauty\audio on first launch. That archive MUST be generated
# from the same database/slug mapping the app uses, otherwise the audio lands in
# the wrong directories (slug collisions between experiments and milestones).
# So the pack is (re)generated here and verified before it goes into the installer.
# ---------------------------------------------------------------------------
Write-Step 'Generating narration audio pack'

if (-not $AudioDir) {
    $AudioDir = Join-Path $serverDir 'data\audio'
}
if (-not $AudioDb) {
    $candidates = @()
    if ($env:APPDATA) { $candidates += (Join-Path $env:APPDATA 'phy-beauty\phy-beauty.db') }
    $candidates += (Join-Path $serverDir 'data\phy_beauty.db')
    foreach ($c in $candidates) {
        if (Test-Path $c) { $AudioDb = $c; break }
    }
}

if ($SkipAudioPack) {
    Write-Warn 'skipped (-SkipAudioPack)'
    if (-not (Test-Path $audioPack)) { Fail "audio pack not found: $audioPack" }
} elseif (-not (Test-Path $AudioDb)) {
    $msg = "audio source DB not found. Pass -AudioDb <path to phy-beauty.db>."
    if ($SkipAudioCheck) { Write-Warn $msg; Write-Info 'continuing (-SkipAudioCheck)' }
    else { Fail $msg }
} elseif (-not (Test-Path $AudioDir)) {
    $msg = "narration audio dir not found: $AudioDir"
    if ($SkipAudioCheck) { Write-Warn $msg; Write-Info 'continuing (-SkipAudioCheck)' }
    else { Fail $msg }
} else {
    Write-Info ("db    : {0}" -f $AudioDb)
    Write-Info ("audio : {0}" -f $AudioDir)
    Push-Location $serverDir
    try {
        Invoke-Native 'audio-pack' {
            go run ./cmd/audio-pack -db $AudioDb -audio $AudioDir -out $audioPack -report $audioReport
        }
    } finally {
        Pop-Location
    }
}

if (Test-Path $audioPack) {
    $packInfo = Get-Item $audioPack
    $packCount = 0
    if (Test-Path $audioReport) {
        $rep = Get-Content $audioReport -Raw -Encoding UTF8 | ConvertFrom-Json
        $packCount = [int]$rep.file_count
        if ($packCount -le 0) { Fail 'audio pack report says 0 files' }
        # JSON null arrives as a single empty element, so count only real entries.
        $missingInReport = @($rep.missing_files | Where-Object { $_ -ne $null -and "$_" -ne '' })
        if ($missingInReport.Count -gt 0) {
            Fail ("audio pack report lists {0} missing file(s), first: {1}" -f $missingInReport.Count, $missingInReport[0])
        }
        Write-Ok ("audio pack: {0:N0} files, {1} ({2})" -f $packCount, (Format-Size $packInfo.Length), $packInfo.Name)
    } else {
        Write-Warn "audio pack report not found: $audioReport"
        Write-Ok ("audio pack: {0}" -f (Format-Size $packInfo.Length))
    }

    # Verify the artefact itself: manifest covers every entry, target dirs are valid
    # and unique, and sampled contents match their recorded hashes. This is what
    # guarantees a fresh install lands every narration next to its own record.
    Push-Location $serverDir
    try {
        Invoke-Native 'audio-pack -verify' {
            go run ./cmd/audio-pack -verify $audioPack
        }
    } finally {
        Pop-Location
    }
} elseif (-not $SkipAudioCheck) {
    Fail "audio pack not found: $audioPack"
} else {
    Write-Warn "audio pack not found: $audioPack"
}

# ---------------------------------------------------------------------------
# 3. material assets pack (images / datasets shipped with the installer)
#
# Same reasoning as the audio pack: the assets table is seeded from the built-in
# JSON, so the files themselves must land in %APPDATA%\phy-beauty\assets or every
# /phy-assets/* request 404s and the materials page shows empty cards.
# ---------------------------------------------------------------------------
Write-Step 'Generating material assets pack'

$assetsSrc = Join-Path $serverDir 'data\assets'
$assetsPack = Join-Path $desktopDir 'assets\phy-assets.zip'
$assetsReport = Join-Path $desktopDir 'assets\phy-assets.report.json'

if (Test-Path $assetsSrc) {
    Push-Location $serverDir
    try {
        Invoke-Native 'assets-pack' {
            go run ./cmd/assets-pack -src $assetsSrc -out $assetsPack -report $assetsReport
        }
    } finally {
        Pop-Location
    }
    if (-not (Test-Path $assetsPack)) { Fail "material assets pack not created: $assetsPack" }
    Write-Ok ("assets pack: {0} ({1})" -f (Format-Size (Get-Item $assetsPack).Length), (Split-Path $assetsPack -Leaf))
} else {
    Write-Warn "material assets dir not found: $assetsSrc"
    Write-Info 'the installer will ship without images/datasets'
    Remove-Item $assetsPack -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# 4. frontend
# ---------------------------------------------------------------------------
Write-Step 'Building frontend (Angular production)'
if ($SkipFrontend) {
    Write-Warn 'skipped (-SkipFrontend)'
    if (-not (Test-Path $distDir)) { Fail "frontend output not found: $distDir" }
} else {
    Push-Location $clientDir
    try {
        if (-not (Test-Path (Join-Path $clientDir 'node_modules'))) {
            Write-Info 'node_modules missing, running npm install ...'
            Invoke-Native 'npm install' { npm install }
        }
        Invoke-Native 'ng build' { npx ng build }
    } finally {
        Pop-Location
    }
    Write-Ok ("frontend bundle: {0}" -f $distDir)
}

# ---------------------------------------------------------------------------
# 5. sync frontend into the desktop project
# ---------------------------------------------------------------------------
Write-Step 'Syncing frontend output into desktop/frontend/dist'
if (Test-Path $desktopFront) {
    Remove-Item (Join-Path $desktopFront '*') -Recurse -Force -ErrorAction SilentlyContinue
} else {
    New-Item -ItemType Directory -Force -Path $desktopFront | Out-Null
}
Copy-Item (Join-Path $distDir '*') $desktopFront -Recurse -Force
$copied = (Get-ChildItem $desktopFront -Recurse -File | Measure-Object).Count
if ($copied -eq 0) { Fail 'no files were copied into desktop/frontend/dist' }
Write-Ok ("{0} files copied" -f $copied)

# ---------------------------------------------------------------------------
# 6. backend
# ---------------------------------------------------------------------------
Write-Step 'Building backend'
Push-Location $serverDir
try {
    Invoke-Native 'go build ./...' { go build ./... }

    if (-not $SkipServer) {
        $serverBin = Join-Path $serverDir 'build'
        New-Item -ItemType Directory -Force -Path $serverBin | Out-Null
        Invoke-Native 'go build server exe' {
            go build -o (Join-Path $serverBin 'phy-beauty-server.exe') ./cmd/server
        }
        Write-Ok ("server exe: {0}" -f (Join-Path $serverBin 'phy-beauty-server.exe'))
    } else {
        Write-Warn 'standalone server executable skipped (-SkipServer)'
    }
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
# 7. desktop executable (wails)
# ---------------------------------------------------------------------------
Write-Step 'Building desktop executable (wails build)'
Push-Location $desktopDir
try {
    # -s : skip wails' own frontend build (we already produced and synced it)
    Invoke-Native 'wails build' { & $wailsBin build -s -clean -platform windows/amd64 }
} finally {
    Pop-Location
}
if (-not (Test-Path $desktopExe)) { Fail "desktop executable not found: $desktopExe" }
Write-Ok ("desktop exe: {0} ({1})" -f $desktopExe, (Format-Size (Get-Item $desktopExe).Length))

# ---------------------------------------------------------------------------
# 8. NSIS installer
# ---------------------------------------------------------------------------
if ($NoInstaller) {
    Write-Host ''
    Write-Host '      installer skipped (-NoInstaller)' -ForegroundColor Yellow
} else {
    Write-Step 'Building NSIS installer'

    if (-not (Test-Path $nsiFile)) { Fail "NSIS script not found: $nsiFile" }

    # The script contains non-ASCII UI strings and must be UTF-8 with BOM,
    # otherwise makensis fails with "Bad text encoding".
    $nsiBytes = [System.IO.File]::ReadAllBytes($nsiFile)
    $hasBom = ($nsiBytes.Length -ge 3 -and $nsiBytes[0] -eq 0xEF -and $nsiBytes[1] -eq 0xBB -and $nsiBytes[2] -eq 0xBF)
    if (-not $hasBom) {
        $text = [System.IO.File]::ReadAllText($nsiFile, (New-Object System.Text.UTF8Encoding($false)))
        [System.IO.File]::WriteAllText($nsiFile, $text, (New-Object System.Text.UTF8Encoding($true)))
        Write-Info 'added UTF-8 BOM to project.nsi'
    }

    Push-Location $installerDir
    try {
        Invoke-Native 'makensis' {
            & $makensisBin ("-DARG_WAILS_AMD64_BINARY={0}" -f $desktopExe) 'project.nsi'
        }
    } finally {
        Pop-Location
    }
    if (-not (Test-Path $installerExe)) { Fail "installer not found: $installerExe" }
    Write-Ok ("installer: {0} ({1})" -f $installerExe, (Format-Size (Get-Item $installerExe).Length))

    # Every archive that goes into the installer is listed in project.nsi; if the
    # NSIS script loses one of those lines the installer silently ships without it
    # (that is exactly how a fresh machine ends up with no audio / no images).
    $nsiText = [System.IO.File]::ReadAllText($nsiFile, [System.Text.Encoding]::UTF8)
    $payloadMb = 0.0
    foreach ($pack in @($audioPack, $assetsPack)) {
        if (-not (Test-Path $pack)) { continue }
        $packMb = (Get-Item $pack).Length / 1MB
        $packLeaf = Split-Path $pack -Leaf
        $payloadMb += $packMb
        if ($nsiText -notmatch [regex]::Escape($packLeaf)) {
            Fail ("project.nsi does not install {0}: add a File line for it" -f $packLeaf)
        }
    }

    # Loose sanity check: NSIS compresses the payload (zlib), so the installer can
    # legitimately be smaller than the archives. But it cannot be smaller than
    # ~85% of them while still carrying them, and dropping the archives would make
    # it an order of magnitude smaller.
    if ($payloadMb -gt 0) {
        $instMb = (Get-Item $installerExe).Length / 1MB
        $minMb = $payloadMb * 0.85
        if ($instMb -lt $minMb) {
            Fail ("installer ({0:N1} MB) is far below the packed payload ({1:N1} MB): archives did not get embedded" -f $instMb, $payloadMb)
        }
        Write-Ok ("installer carries all packs ({0:N1} MB installer vs {1:N1} MB packed)" -f $instMb, $payloadMb)
    }
}

# ---------------------------------------------------------------------------
# summary
# ---------------------------------------------------------------------------
$elapsed = (Get-Date) - $script:started
Write-Host ''
Write-Host '==================================================' -ForegroundColor Magenta
Write-Host '  BUILD SUCCEEDED' -ForegroundColor Green
Write-Host '==================================================' -ForegroundColor Magenta
Write-Host ("  elapsed  : {0:mm\:ss}" -f $elapsed)
Write-Host ("  desktop  : {0}" -f $desktopExe)
if (Test-Path $audioPack) { Write-Host ("  audio    : {0} ({1})" -f $audioPack, (Format-Size (Get-Item $audioPack).Length)) }
if (Test-Path $assetsPack) { Write-Host ("  assets   : {0} ({1})" -f $assetsPack, (Format-Size (Get-Item $assetsPack).Length)) }
if (Test-Path $installerExe) { Write-Host ("  installer: {0}" -f $installerExe) }
Write-Host ''
exit 0
