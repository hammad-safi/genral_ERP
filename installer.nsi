; NSIS Installer Script for Offline ERP
Name "Shop ERP Installer"
OutFile "release\Shop-ERP-Setup.exe"
InstallDir "$PROGRAMFILES\ShopERP"
RequestExecutionLevel admin

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  
  ; Copy application files
  File /r "release\win-unpacked\*.*"
  
  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\ShopERP"
  CreateShortCut "$SMPROGRAMS\ShopERP\Shop ERP.lnk" "$INSTDIR\Shop ERP.exe"
  CreateShortCut "$SMPROGRAMS\ShopERP\Uninstall.lnk" "$INSTDIR\uninstall.exe"
  CreateShortCut "$DESKTOP\Shop ERP.lnk" "$INSTDIR\Shop ERP.exe"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; Write registry for add/remove programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShopERP" \
                   "DisplayName" "Shop ERP"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShopERP" \
                   "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShopERP" \
                   "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShopERP" \
                   "Publisher" "ERP Developer"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShopERP" \
                   "DisplayVersion" "1.0.0"
SectionEnd

Section "Uninstall"
  RMDir /r "$INSTDIR"
  RMDir /r "$SMPROGRAMS\ShopERP"
  Delete "$DESKTOP\Shop ERP.lnk"
  
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShopERP"
SectionEnd
