!ifndef BUILD_UNINSTALLER
  Function AddToStartup
    CreateShortCut "$SMSTARTUP\ESX.Rocket.Chat.lnk" "$INSTDIR\ESXPlayer.exe" ""
  FunctionEnd

  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Executar na inicialização"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION AddToStartup
!endif

!ifdef BUILD_UNINSTALLER
  Function un.AddAppData
    RMDir /r "$APPDATA\ESXPlayer"
  FunctionEnd

  ; Using the read me setting to add option to remove app data
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Remover dados do usuário"
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION un.AddAppData
!endif

!macro customInstall
  ; Remove dangling reference of version 2.13.1
  ${If} $installMode == "all"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\66bed7db-e601-54e6-b2e8-7be611d82557"
  ${Else}
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\66bed7db-e601-54e6-b2e8-7be611d82557"
  ${EndIf}
  !insertMacro disableAutoUpdates
  Delete "$SMSTARTUP\ESXPlayer.lnk"
!macroend

!macro customUnInstall
  ${IfNot} ${Silent}
    Delete "$SMSTARTUP\ESXPlayer.lnk"
  ${EndIf}
!macroend

