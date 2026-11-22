@echo off
rem Serves the game to other devices on your home Wi-Fi so a tablet can play it.
rem Keep this window open while playing. Close it to stop.
cd /d "%~dp0"
echo.
echo  FRIGHT AISLE - tablet server
echo  ----------------------------
echo  1. Make sure the tablet is on the same Wi-Fi as this computer.
echo  2. On the tablet, open the browser and type one of these addresses:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=*" %%b in ("%%a") do echo        http://%%b:8766/
echo.
echo  3. If Windows asks about the firewall, choose "Allow" for private networks.
echo.
echo  To play on this computer instead, open  http://localhost:8766/
echo  Close this window to stop.
echo.
python -m http.server 8766 --bind 0.0.0.0
