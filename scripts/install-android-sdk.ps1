# Instala el Android SDK (command-line tools + platform 36 + build-tools + NDK + CMake)
# Necesario para compilar el APK en local. Idempotente: si algo ya existe, lo saltea.
$ErrorActionPreference = 'Stop'

$SDK      = 'E:\Android\Sdk'
$JAVAHOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot'
$TMP      = 'E:\Android\_tmp'
# OJO: en PowerShell los nombres de variable no distinguen mayúsculas.
# Usar `$zipUrl`/`$zipFile` en vez de `$ZIP`/`$zip` — si no, una pisa a la otra.
$zipUrl   = 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip'

$env:JAVA_HOME = $JAVAHOME
$env:ANDROID_HOME = $SDK
$env:ANDROID_SDK_ROOT = $SDK

New-Item -ItemType Directory -Force -Path $SDK | Out-Null
New-Item -ItemType Directory -Force -Path $TMP | Out-Null

$sdkmanager = Join-Path $SDK 'cmdline-tools\latest\bin\sdkmanager.bat'

if (-not (Test-Path $sdkmanager)) {
  Write-Host "[1/4] Descargando command-line tools (136 MB)..."
  $zipFile = Join-Path $TMP 'cmdline-tools.zip'
  if (Test-Path $zipFile) { Remove-Item -Force $zipFile }
  # curl.exe viene con Windows 10+ y es mucho más fiable que Invoke-WebRequest
  & curl.exe -L --fail --retry 3 --retry-delay 5 -o $zipFile $zipUrl
  if (-not (Test-Path $zipFile)) { throw "No se pudo descargar $zipUrl" }
  Write-Host "      descargado $((Get-Item $zipFile).Length) bytes"
  Write-Host "[2/4] Extrayendo..."
  $extract = Join-Path $TMP 'extracted'
  if (Test-Path $extract) { Remove-Item -Recurse -Force $extract }
  Expand-Archive -Path $zipFile -DestinationPath $extract -Force
  $target = Join-Path $SDK 'cmdline-tools\latest'
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  Copy-Item -Path (Join-Path $extract 'cmdline-tools\*') -Destination $target -Recurse -Force
  Write-Host "      sdkmanager en $sdkmanager"
} else {
  Write-Host "[1/4] command-line tools ya instalados"
}

if (-not (Test-Path $sdkmanager)) { throw "No se encontro sdkmanager en $sdkmanager" }

Write-Host "[3/4] Aceptando licencias..."
$yes = 1..40 | ForEach-Object { 'y' }
$yes | & $sdkmanager --sdk_root=$SDK --licenses 2>&1 | Out-Null

Write-Host "[4/4] Instalando paquetes del SDK (esto tarda bastante: NDK ~2.5 GB)..."
& $sdkmanager --sdk_root=$SDK `
  'platform-tools' `
  'platforms;android-36' `
  'build-tools;36.0.0' `
  'ndk;27.1.12297006' `
  'cmake;3.22.1' 2>&1 | ForEach-Object { $_ }

Write-Host "`n=== SDK instalado ==="
Get-ChildItem $SDK -Directory | ForEach-Object { $_.Name }
Write-Host "`n=== NDK ==="
if (Test-Path (Join-Path $SDK 'ndk')) { Get-ChildItem (Join-Path $SDK 'ndk') | ForEach-Object { $_.Name } }
Write-Host "`n=== adb ==="
& (Join-Path $SDK 'platform-tools\adb.exe') version
Write-Host "DONE"