# Construye el APK de release en local.
#
# Requisitos ya instalados en esta maquina:
#   - JDK 17 (Temurin)  -> C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot
#   - Android SDK       -> E:\Android\Sdk (platform 36, build-tools 36, NDK 27.1, cmake 3.22.1)
#
# Uso:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-apk.ps1
#
# IMPORTANTE: mientras corra este script NO hay que ejecutar nada mas dentro de
# la carpeta del proyecto (npx tsc, eslint, expo export...). CMake de las
# librerias nativas usa `file(GLOB ... CONFIGURE_DEPENDS)` sobre node_modules:
# si otro proceso escribe ahi, el `build.ninja` se regenera en loop y el build
# muere con "manifest 'build.ninja' still dirty after 100 tries".
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$sdk  = 'E:\Android\Sdk'
$jdk  = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot'

$env:JAVA_HOME       = $jdk
$env:ANDROID_HOME    = $sdk
$env:ANDROID_SDK_ROOT = $sdk

Set-Location $root

# ---------------------------------------------------------------- 1. prebuild
Write-Host '=== 1/4 Regenerando proyecto nativo (prebuild) ==='
npx expo prebuild --platform android --clean

# local.properties le dice a Gradle donde esta el SDK
Write-Host '=== 2/4 Escribiendo android/local.properties ==='
$escaped = $sdk -replace '\\', '\\' -replace ':', '\:'
Set-Content -Path (Join-Path $root 'android\local.properties') -Value "sdk.dir=$escaped" -Encoding ascii

# --------------------------------------------- 3. limpiar estado .cxx sucio
Write-Host '=== 3/4 Limpiando caches C++ (.cxx) de las librerias nativas ==='
Get-ChildItem -Path (Join-Path $root 'node_modules') -Directory -Recurse -Filter '.cxx' -ErrorAction SilentlyContinue |
  ForEach-Object {
    Write-Host ("    " + $_.FullName.Substring($root.Length + 1))
    Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
  }

# ------------------------------------------------------------- 4. gradle
Write-Host '=== 4/4 gradlew assembleRelease (la 1a vez compila Skia: 30-60 min) ==='
Set-Location (Join-Path $root 'android')

& .\gradlew.bat assembleRelease "-PreactNativeArchitectures=arm64-v8a,armeabi-v7a" "-Dorg.gradle.vfs.watch=false" --console=plain --stacktrace

Write-Host ''
Write-Host '=== APK ==='
Get-ChildItem -Path (Join-Path $root 'android\app\build\outputs') -Recurse -Filter *.apk -ErrorAction SilentlyContinue |
  Select-Object FullName, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 2) } } |
  Format-Table -AutoSize
Write-Host 'DONE'