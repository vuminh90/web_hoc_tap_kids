@echo off
echo Dang mo cong 3000 tren Windows Firewall de cac may tinh khac co the truy cap...
netsh advfirewall firewall add rule name="GiaSuAo Port 3000" dir=in action=allow protocol=TCP localport=3000
echo Hoan tat! Ban co the tat cua so nay.
pause
