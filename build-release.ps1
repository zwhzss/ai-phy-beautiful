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
      -SkipOfflineWebView2
                        do not ship the offline WebView2 runtime (installer then
                        needs internet during install, like stock Wails does)
      -WebView2Installer
                        path to an already downloaded
                        MicrosoftEdgeWebView2RuntimeInstallerX64.exe (skips download)
      -SignPfx / -SignThumbprint
                        Authenticode signing target. Also readable from the
                        environment (PHY_SIGN_PFX / PHY_SIGN_PFX_PASSWORD /
                        PHY_SIGN_THUMBPRINT). Without one the build still succeeds
                        but the binaries stay unsigned.

    Code signing notes: a thumbprint refers to a certificate already in the
    machine's Personal store and needs no password on the command line, so prefer
    it over -SignPfx. Self-signed certificates do NOT remove the SmartScreen
    warning, they only help when the root certificate is deployed to managed PCs.
#>
[CmdletBinding()]
param(
    [switch]$SkipFrontend,
    [switch]$SkipServer,
    [switch]$SkipAudioPack,
    [switch]$SkipAudioCheck,
    [string]$AudioDb = '',
    [string]$AudioDir = '',
    [switch]$NoInstaller,
    [switch]$SkipOfflineWebView2,
    [string]$WebView2Installer = '',
    [string]$SignPfx = '',
    [string]$SignThumbprint = ''
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

# Offline WebView2 runtime. Stock Wails only bundles the 1.8 MB "online only"
# bootstrapper, so installing on a machine without internet leaves the app with no
# webview. Microsoft's Evergreen stand-alone installer (~204 MB) carries the whole
# runtime, so we bundle that instead and fall back to the stock macro on request.
$wv2TmpDir      = Join-Path $installerDir 'tmp'
$wv2OfflineName = 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
$wv2OfflinePath = Join-Path $wv2TmpDir $wv2OfflineName
$wv2OfflineUrl  = 'https://go.microsoft.com/fwlink/?linkid=2124701'
$wv2MinBytes    = 150MB

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
# offline WebView2 runtime
# ---------------------------------------------------------------------------

$script:wv2MarkerBegin = '# --- PHY: offline WebView2 begin ---'
$script:wv2MarkerEnd   = '# --- PHY: offline WebView2 end ---'

# The block that replaces stock Wails' "!insertmacro wails.webview2runtime".
# Kept as a single-quoted here-string: NSIS variables ($0, $pluginsdir) must not
# be expanded by PowerShell.
$script:wv2NsiBlock = @'
    # --- PHY: offline WebView2 begin ---
    # Install the WebView2 runtime from the Evergreen stand-alone package shipped
    # inside this installer, so an offline machine still gets a working app.
    # The registry check is the same one wails_tools.nsh uses for the online
    # bootstrapper; when the runtime is already there, nothing is extracted.
    SetRegView 64
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    ${If} $0 != ""
        Goto phy_wv2_ok
    ${EndIf}
    DetailPrint "Installing: WebView2 Runtime (offline package)"
    InitPluginsDir
    CreateDirectory "$pluginsdir\webview2offline"
    SetOutPath "$pluginsdir\webview2offline"
    File "tmp\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"
    ExecWait '"$pluginsdir\webview2offline\MicrosoftEdgeWebView2RuntimeInstallerX64.exe" /silent /install'
    RMDir /r "$pluginsdir\webview2offline"
    phy_wv2_ok:
    # --- PHY: offline WebView2 end ---
'@

function Test-OfflineWebView2File([string]$path) {
    if (-not (Test-Path $path)) { return $false }
    if ((Get-Item $path).Length -lt $wv2MinBytes) { return $false }
    # The file comes from a Microsoft CDN. Check the Authenticode signature instead
    # of a pinned hash: Microsoft refreshes this installer regularly and the fwlink
    # always points at the current build, so a fixed hash would break every build.
    $sig = Get-AuthenticodeSignature $path
    if ($sig.Status -ne 'Valid') { return $false }
    if (-not $sig.SignerCertificate) { return $false }
    if ($sig.SignerCertificate.Subject -notmatch 'CN=Microsoft Corporation') { return $false }
    return $true
}

function Ensure-OfflineWebView2 {
    if (-not (Test-Path $wv2TmpDir)) { New-Item -ItemType Directory -Path $wv2TmpDir -Force | Out-Null }

    if ($WebView2Installer) {
        if (-not (Test-Path $WebView2Installer)) { Fail "WebView2 installer not found: $WebView2Installer" }
        if (-not (Test-OfflineWebView2File $WebView2Installer)) {
            Fail ("WebView2 installer failed the signature/size check: {0}" -f $WebView2Installer)
        }
        if ((Resolve-Path $WebView2Installer).ProviderPath -ne $wv2OfflinePath) {
            Copy-Item -LiteralPath $WebView2Installer -Destination $wv2OfflinePath -Force
        }
    }
    elseif (Test-OfflineWebView2File $wv2OfflinePath) {
        Write-Info 'reusing cached offline WebView2 package'
    }
    else {
        Write-Info ('downloading Evergreen WebView2 runtime (~204 MB): {0}' -f $wv2OfflineUrl)
        $partial = "$wv2OfflinePath.part"
        Remove-Item -LiteralPath $partial -ErrorAction SilentlyContinue
        # curl.exe ships with Windows 10+; -L follows the fwlink redirect, --fail makes
        # an HTTP error a non-zero exit instead of a saved error page.
        Invoke-Native 'webview2 download' {
            & curl.exe -sSL --fail --retry 3 --connect-timeout 20 -o $partial $wv2OfflineUrl
        }
        Move-Item -LiteralPath $partial -Destination $wv2OfflinePath -Force
    }

    if (-not (Test-OfflineWebView2File $wv2OfflinePath)) {
        Fail ("offline WebView2 package is missing, truncated, not signed by Microsoft, or smaller than {0} MB: {1}" -f `
            [int]($wv2MinBytes / 1MB), $wv2OfflinePath)
    }
    Write-Ok ("offline WebView2 package: {0} ({1})" -f $wv2OfflineName, (Format-Size (Get-Item $wv2OfflinePath).Length))
}

# Patch (or unpatch) the NSIS project so the runtime installs from the package.
#
# project.nsi lives under desktop\build, which is gitignored: Wails regenerates it
# only when it is missing, so manual edits survive a normal build but a fresh clone
# starts from the stock template. Patching here from the (tracked) build script keeps
# both cases identical and idempotent.
function Set-NsiWebView2Offline([bool]$enabled) {
    $text = [System.IO.File]::ReadAllText($nsiFile, [System.Text.Encoding]::UTF8)
    $stock = '!insertmacro wails.webview2runtime'
    $patched = $text.Contains($script:wv2MarkerBegin)

    if ($enabled) {
        if ($patched) { Write-Ok 'project.nsi already installs WebView2 offline'; return }
        # Match the whole line (including its indentation) so the block lands flush.
        $pattern = '(?m)^[ \t]*' + [regex]::Escape($stock) + '[ \t]*\r?\n'
        if ($text -notmatch $pattern) {
            Fail ("cannot wire the offline WebView2 install: '{0}' not found in {1}" -f $stock, $nsiFile)
        }
        $block = $script:wv2NsiBlock.TrimEnd() + "`r`n"
        $text = [regex]::Replace($text, $pattern, ($block.Replace('$', '$$')))
        [System.IO.File]::WriteAllText($nsiFile, $text, (New-Object System.Text.UTF8Encoding($false)))
        # Never trust the write: re-read and confirm the block really replaced the
        # stock macro. An unnoticed no-op yields a silent 200 MB difference in the
        # installer and nobody notices until a machine without internet fails.
        $after = [System.IO.File]::ReadAllText($nsiFile, [System.Text.Encoding]::UTF8)
        if (-not $after.Contains($script:wv2MarkerBegin)) {
            Fail ("project.nsi patch did not take effect: {0}" -f $nsiFile)
        }
        if ($after.Contains($stock)) {
            Fail 'project.nsi still installs WebView2 from the online bootstrapper after patching'
        }
        Write-Ok 'project.nsi patched: WebView2 installs from the offline package'
    }
    else {
        if (-not $patched) { return }
        # makensis aborts when the File line points at a missing 204 MB package,
        # so reverting has to remove the whole block.
        # (?sm): ^ must match the start of the LINE, not of the file.
        $pattern = '(?sm)^[ \t]*' + [regex]::Escape($script:wv2MarkerBegin) + '.*?' + [regex]::Escape($script:wv2MarkerEnd) + '[ \t]*\r?\n?'
        $text = [regex]::Replace($text, $pattern, ('    ' + $stock).Replace('$', '$$') + "`r`n")
        [System.IO.File]::WriteAllText($nsiFile, $text, (New-Object System.Text.UTF8Encoding($false)))
        $after = [System.IO.File]::ReadAllText($nsiFile, [System.Text.Encoding]::UTF8)
        if ($after.Contains($script:wv2MarkerBegin)) {
            Fail ("project.nsi revert did not take effect: {0}" -f $nsiFile)
        }
        if (-not $after.Contains($stock)) {
            Fail 'project.nsi lost the WebView2 install step while reverting'
        }
        Write-Warn 'project.nsi restored to the online WebView2 bootstrapper (-SkipOfflineWebView2)'
    }
}

# ---------------------------------------------------------------------------
# Authenticode signing (optional)
# ---------------------------------------------------------------------------

$script:signedFiles  = @()
$script:signWarned   = $false

function Resolve-SignTool {
    if ($env:SIGNTOOL -and (Test-Path $env:SIGNTOOL)) { return $env:SIGNTOOL }
    $kitRoots = @(
        "${env:ProgramFiles(x86)}\Windows Kits\10\bin",
        "$env:ProgramFiles\Windows Kits\10\bin"
    )
    $best = $null
    $bestVersion = [version]'0.0'
    foreach ($root in $kitRoots) {
        if (-not (Test-Path $root)) { continue }
        foreach ($cand in Get-ChildItem -Path $root -Filter 'signtool.exe' -Recurse -ErrorAction SilentlyContinue) {
            # x64 signtool only: it has to handle the 600 MB installer
            if ($cand.FullName -notmatch '\\x64\\') { continue }
            # Take the SDK version from the path (bin\10.0.26100.0\x64\signtool.exe);
            # the FileVersion resource is not reliably populated for every SDK drop.
            $parsed = [version]$null
            if ($cand.FullName -match '\\bin\\([^\\]+)\\x64\\signtool\.exe$' -and
                [version]::TryParse($matches[1], [ref]$parsed)) {
                if ($parsed -gt $bestVersion) { $bestVersion = $parsed; $best = $cand.FullName }
            }
        }
    }
    return $best
}

function Invoke-CodeSign([string]$file, [string]$label) {
    $pfx = $SignPfx; if (-not $pfx) { $pfx = $env:PHY_SIGN_PFX }
    $thumb = $SignThumbprint; if (-not $thumb) { $thumb = $env:PHY_SIGN_THUMBPRINT }

    if (-not $pfx -and -not $thumb) {
        if (-not $script:signWarned) {
            $script:signWarned = $true
            Write-Warn 'binaries are UNSIGNED: pass -SignPfx/-SignThumbprint (or PHY_SIGN_PFX / PHY_SIGN_THUMBPRINT)'
        }
        return
    }
    if (-not (Test-Path $file)) { Fail ("cannot sign {0}: file not found" -f $label) }

    $signtool = Resolve-SignTool
    if (-not $signtool) {
        Fail 'signtool.exe was not found (Windows 10/11 SDK). Install the SDK or set $env:SIGNTOOL.'
    }
    $timestamp = 'http://timestamp.digicert.com'
    if ($env:PHY_SIGN_TIMESTAMP) { $timestamp = $env:PHY_SIGN_TIMESTAMP }

    # signtool's subcommand is "sign" (no slash); only its options take a slash.
    $argsList = @('sign', '/fd', 'SHA256', '/tr', $timestamp, '/td', 'SHA256')
    if ($pfx) {
        if (-not (Test-Path $pfx)) { Fail ("certificate not found: {0}" -f $pfx) }
        $argsList += @('/f', $pfx)
        # Prefer PHY_SIGN_PFX_PASSWORD over -p on the command line: command lines of
        # other processes can be read by any local user.
        if ($env:PHY_SIGN_PFX_PASSWORD) { $argsList += @('/p', $env:PHY_SIGN_PFX_PASSWORD) }
    }
    else {
        $argsList += @('/sha1', $thumb)
    }
    $argsList += $file

    Invoke-Native ("sign " + $label) { & $signtool @argsList }
    # /pa checks the full Authenticode trust chain. A self-signed certificate always
    # fails it, and that is a real problem for end users (SmartScreen still blocks),
    # so stop here instead of shipping a package that looks signed but is not trusted.
    $null = & $signtool verify /pa /all $file
    if ($LASTEXITCODE -ne 0) {
        # Build the message first: "-f" binds tighter than "+", so formatting an
        # inline concatenation only ever touches the last string.
        $why = ('signature of {0} is not trusted (signtool verify exit {1}). Use a CA-issued code ' +
                'signing certificate; self-signed certificates do not satisfy the Authenticode chain.') -f `
                $label, $LASTEXITCODE
        Fail $why
    }
    $script:signedFiles += $label
    Write-Ok ("signed: {0}" -f $label)
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

# Sign before NSIS packs the exe: the copy embedded in the installer has to carry
# its signature already, and the installer itself is signed after step 8.
Invoke-CodeSign $desktopExe 'desktop exe'

# ---------------------------------------------------------------------------
# 8. NSIS installer
# ---------------------------------------------------------------------------
if ($NoInstaller) {
    Write-Host ''
    Write-Host '      installer skipped (-NoInstaller)' -ForegroundColor Yellow
} else {
    Write-Step 'Building NSIS installer'

    if (-not (Test-Path $nsiFile)) { Fail "NSIS script not found: $nsiFile" }

    # Bundle the offline WebView2 runtime and make sure project.nsi installs from it.
    if ($SkipOfflineWebView2) {
        Set-NsiWebView2Offline $false
    }
    else {
        Ensure-OfflineWebView2
        Set-NsiWebView2Offline $true
    }

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

    # Same guard for the offline WebView2 runtime: without its File line the
    # installer is 200 MB lighter and breaks on any machine lacking the runtime.
    if (-not $SkipOfflineWebView2) {
        $payloadMb += (Get-Item $wv2OfflinePath).Length / 1MB
        if ($nsiText -notmatch [regex]::Escape($wv2OfflineName)) {
            Fail ("project.nsi does not install {0}: the offline WebView2 block is missing" -f $wv2OfflineName)
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

    Invoke-CodeSign $installerExe 'installer'
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
if ($NoInstaller) {
    Write-Host '  webview2 : not bundled (no installer built)'
}
elseif ($SkipOfflineWebView2) {
    Write-Host '  webview2 : online bootstrapper only (-SkipOfflineWebView2)'
}
else {
    Write-Host ("  webview2 : offline runtime bundled ({0})" -f $wv2OfflineName)
}
if ($script:signedFiles.Count -gt 0) {
    Write-Host ("  signed   : {0}" -f ($script:signedFiles -join ', '))
}
else {
    Write-Host '  signed   : no (unsigned binaries)'
}
Write-Host ''
exit 0
