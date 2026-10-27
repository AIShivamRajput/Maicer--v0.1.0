!macro customInstall
  ; Install the Visual C++ runtime only when it's missing (avoids an admin prompt on every install).
  ClearErrors
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  IfErrors vcneeded
  StrCmp $0 1 vcdone vcneeded
  vcneeded:
  IfFileExists "$INSTDIR\resources\vc_redist.x64.exe" 0 vcdone
  ExecWait '"$INSTDIR\resources\vc_redist.x64.exe" /install /quiet /norestart'
  vcdone:
!macroend
!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Also delete your Maicer history and settings?" IDNO keepdata
  RMDir /r "$APPDATA\Maicer"
  keepdata:
!macroend
