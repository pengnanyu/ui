@echo off
REM Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
REM Generate release keystore for BMS Android App
REM Run this script once to generate release.keystore

set KEYTOOL=keytool
set STORE_FILE=release.keystore
set STORE_PASSWORD=Fkue@1023
set KEY_ALIAS=dcsf-bms
set KEY_PASSWORD=Fkue@1023
set KEY_SIZE=2048
set VALIDITY=10000

echo Generating release keystore...
%KEYTOOL% -genkeypair -v ^
  -keystore %STORE_FILE% ^
  -storepass %STORE_PASSWORD% ^
  -alias %KEY_ALIAS% ^
  -keypass %KEY_PASSWORD% ^
  -keyalg RSA ^
  -keysize %KEY_SIZE% ^
  -validity %VALIDITY% ^
  -dname "CN=DCSF, OU=Engineering, O=深圳市德诚四方科技有限公司, L=Shenzhen, ST=Guangdong, C=CN"

if %ERRORLEVEL% EQU 0 (
  echo Keystore generated successfully: %STORE_FILE%
  echo Place this file in app/ directory
) else (
  echo Failed to generate keystore. Make sure keytool is in PATH.
  echo You can find keytool in Android Studio's JBR bin directory.
)
pause
