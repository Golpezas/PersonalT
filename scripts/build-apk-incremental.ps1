# Rebuild INCREMENTAL del APK de release.
#
# Diferencia clave con build-apk.ps1 (este NO borra nada):
#   build-apk.ps1            -> prebuild --clean + borra todos los .cxx  => 90 min
#   build-apk-incremental.ps1-> reutiliza el cache CMake de node_modules => 15-25 min
#
# Solo usar este script si android/ ya existe y no se toco app.json de forma
# estructural (plugins, permisos, package). Para cambios de esos, usar build-apk.ps1.
#
# Uso:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-apk-incremental.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-apk-incremental.ps1 -Architectures "arm64-v8a,armeabi-v7a"

param(
  # ABIs a compilar. Default: solo arm64-v8a (todo Android moderno; ~42 MB en vez de ~65 MB).
  [string]$Architectures = 'arm64-v8a'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$sdk  = 'E:\Android\Sdk'
$jdk  = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot'

$env:JAVA_HOME        = $jdk
$env:ANDROID_HOME     = $sdk
$env:ANDROID_SDK_ROOT = $sdk

Set-Location $root

# ------------------------------------------- 1. gradle.properties: ABIs + heap
Write-Host "=== 1/3 Sincronizando ABIs ($Architectures) ===" -ForegroundColor Cyan
$gpPath = Join-Path $root 'android\gradle.properties'
$gp = [System.IO.File]::ReadAllText($gpPath)

# reactNativeArchitectures <- BuildConfig. buildArchs de app.json hace lo mismo en prebuild.
$gp = [regex]::Replace($gp, '(?m)^reactNativeArchitectures=.*$', "reactNativeArchitectures=$Architectures")

# El build anterior se quejo de Metaspace agotado. 3g heap / 1g metaspace: hay
# ~16 GB de RAM en la maquina y ~5 GB libres cuando arranca el daemon.
$gp = [regex]::Replace($gp, '(?m)^org\.gradle\.jvmargs=.*$', 'org.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g')

# ASCII a proposito: gradle.properties no deberia llevar acentos.
[System.IO.File]::WriteAllText($gpPath, $gp, [System.Text.Encoding]::ASCII)
Write-Host ("    reactNativeArchitectures = " + $Architectures)

# El ABI tambien queda en el config del modulo app. Si el modulo lo fija de forma
# explicita (ndk.abiFilters), ahi manda el y no la propiedad global.
$appGradle = Join-Path $root 'android\app\build.gradle'
$ab = [System.IO.File]::ReadAllText($appGradle)
if ($ab -match '(?m)^\s*abiFilters\s') {
  $ab = [regex]::Replace($ab, '(?m)^(\s*abiFilters\s+)[^\r\n]+', "`$1$Architectures")
  [System.IO.File]::WriteAllText($appGradle, $ab, [System.Text.Encoding]::UTF8)
  Write-Host '    app/build.gradle abiFilters actualizado' -ForegroundColor Yellow
} else {
  Write-Host '    app/build.gradle no fija abiFilters (usa reactNativeArchitectures)' -ForegroundColor DarkGray
}

# ------------------------------------------------ 2. el cache C++ debe sobrevivir
Write-Host '=== 2/3 Verificando cache CMake (.cxx) ===' -ForegroundColor Cyan
$cxx = Get-ChildItem -Path (Join-Path $root 'node_modules') -Directory -Recurse -Filter '.cxx' -ErrorAction SilentlyContinue
if (-not $cxx) {
  Write-Host '    AVISO: no hay cache .cxx. El build va a compilar Skia desde cero (~60-90 min).' -ForegroundColor Yellow
  Write-Host '    Para eso mejor usar scripts\build-apk.ps1' -ForegroundColor Yellow
} else {
  $bytes = 0
  foreach ($d in $cxx) {
    $bytes += (Get-ChildItem -LiteralPath $d.FullName -Recurse -File -ErrorAction SilentlyContinue |
      Measure-Object -Property Length -Sum).Sum
  }
  $mb = [math]::Round($bytes / 1MB, 0)
  Write-Host "    $($cxx.Count) directorios .cxx intactos ($mb MB) - no se borran" -ForegroundColor Green
}

# ------------------------------------------------------------------- 3. gradle
Write-Host '=== 3/3 gradlew assembleRelease ===' -ForegroundColor Cyan
Set-Location (Join-Path $root 'android')
& .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Architectures" '-Dorg.gradle.vfs.watch=false' --console=plain

Write-Host ''
Write-Host '=== APK ===' -ForegroundColor Green
$apks = Get-ChildItem -Path (Join-Path $root 'android\app\build\outputs') -Recurse -Filter *.apk -ErrorAction SilentlyContinue
$apks | Select-Object FullName, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 2) } }, LastWriteTime |
  Format-Table -AutoSize

# Verificacion: si se pidio una sola ABI, confirmar que el APK no la trae.
if ($Architectures -notmatch ',') {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  foreach ($a in $apks) {
    $z = [System.IO.Compression.ZipFile]::OpenRead($a.FullName)
    $abis = $z.Entries | Where-Object { $_.FullName -like 'lib/*' } |
      ForEach-Object { ($_.FullName -split '/')[1] } | Sort-Object -Unique
    $z.Dispose()
    $esperadas = $Architectures -split ','
    $sobran = $abis | Where-Object { $esperadas -notcontains $_ }
    if ($sobran) {
      Write-Host "    [FALLA] $($a.Name) contiene ABIs de mas: $($sobran -join ', ')" -ForegroundColor Red
    } else {
      Write-Host "    [OK] $($a.Name) solo contiene: $($abis -join ', ')" -ForegroundColor Green
    }
  }
}

Write-Host 'DONE' -ForegroundColor Green
