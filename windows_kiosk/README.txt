KIDS KIOSK - WINDOWS SETUP

1. Remove the old Windows Assigned Access kiosk configuration.
2. Sign in as an Administrator.
3. Extract this package to a local folder.
4. Open PowerShell as Administrator in that folder.
5. Use the exact local account name shown by Get-LocalUser. For the current machine, run:

   powershell -ExecutionPolicy Bypass -File .\Install-KidsKiosk.ps1 -StandardUser "Góc Học tập"

6. Sign out, then sign in to the Standard account. KidsKiosk starts automatically.

Logs:
   %LOCALAPPDATA%\KidsLearningKiosk\kiosk.log

Uninstall (Administrator):
   powershell -ExecutionPolicy Bypass -File .\Uninstall-KidsKiosk.ps1
