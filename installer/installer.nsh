!macro customInstall
  ; Keep the large, checksum-pinned models outside the versioned app directory.
  ReadINIStr $0 "$LOCALAPPDATA\Maicer\engine\models\manifest.ini" "models" "speech"
  ReadINIStr $1 "$LOCALAPPDATA\Maicer\engine\models\manifest.ini" "models" "writer"
  ReadINIStr $2 "$INSTDIR\resources\engine\models\manifest.ini" "models" "speech"
  ReadINIStr $3 "$INSTDIR\resources\engine\models\manifest.ini" "models" "writer"
  StrCmp $0 $2 0 copyModels
  StrCmp $1 $3 0 copyModels
  IfFileExists "$LOCALAPPDATA\Maicer\engine\models\speech.bin" 0 copyModels
  IfFileExists "$LOCALAPPDATA\Maicer\engine\models\writer.gguf" modelsReady copyModels
  copyModels:
  CreateDirectory "$LOCALAPPDATA\Maicer\engine\models"
  ClearErrors
  CopyFiles /SILENT "$INSTDIR\resources\engine\models\speech.bin" "$LOCALAPPDATA\Maicer\engine\models\speech.bin"
  IfErrors modelCopyFailed
  CopyFiles /SILENT "$INSTDIR\resources\engine\models\writer.gguf" "$LOCALAPPDATA\Maicer\engine\models\writer.gguf"
  IfErrors modelCopyFailed
  CopyFiles /SILENT "$INSTDIR\resources\engine\models\manifest.ini" "$LOCALAPPDATA\Maicer\engine\models\manifest.ini"
  IfErrors modelCopyFailed
  Goto modelsReady
  modelCopyFailed:
  MessageBox MB_ICONSTOP "Maicer could not preserve its AI models in your local app-data folder. The installation cannot continue."
  Abort
  modelsReady:

  ; Install the Visual C++ runtime only when it's missing (avoids an admin prompt on every install).
  ClearErrors
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  IfErrors vcneeded
  StrCmp $0 1 vcdone vcneeded
  vcneeded:
  IfFileExists "$INSTDIR\resources\vc_redist.x64.exe" 0 vcfailed
  ExecWait '"$INSTDIR\resources\vc_redist.x64.exe" /install /quiet /norestart' $0
  StrCmp $0 0 vcverify vcfailed
  vcverify:
  ClearErrors
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  IfErrors vcfailed
  StrCmp $0 1 vcdone vcfailed
  vcfailed:
  MessageBox MB_ICONSTOP "The Microsoft Visual C++ runtime could not be installed or verified. Maicer setup cannot continue."
  Abort
  vcdone:
!macroend
!macro customUnInstall
  ; Remove the command shim and PATH entry on uninstall and on upgrades; silent upgrades never remove user data.
  IfFileExists "$INSTDIR\resources\remove-launcher.ps1" 0 +2
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\remove-launcher.ps1"'
  Delete "$LOCALAPPDATA\Maicer\helper.ps1"
  MessageBox MB_YESNO|MB_ICONQUESTION /SD IDNO "Also delete your Maicer history, settings, and downloaded AI models?" IDNO keepdata
  RMDir /r "$APPDATA\Maicer"
  RMDir /r "$LOCALAPPDATA\Maicer\engine\models"
  keepdata:
!macroend
