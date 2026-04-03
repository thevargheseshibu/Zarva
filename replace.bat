@echo off
setlocal EnableDelayedExpansion

set "SOURCE=C:\Users\theva\OneDrive\Desktop\App\Zarva"
set "DEST=C:\Users\theva\OneDrive\Desktop\App\new\zarva"

echo Syncing existing folders (updating files and pulling in new files)...
echo.

:: STEP 1: Loop through every folder that CURRENTLY exists in DESTINATION
for /D /R "%DEST%" %%D in (*) do (
    set "DEST_DIR=%%D"
    
    :: Strip the DEST prefix to get the relative path
    set "REL_PATH=!DEST_DIR!"
    call set "REL_PATH=%%REL_PATH:%DEST%=%%"

    :: Build the full source path explicitly
    set "SRC_DIR=%SOURCE%!REL_PATH!"

    :: Only sync if this folder exists in SOURCE
    if exist "!SRC_DIR!\" (
        echo Syncing folder: !REL_PATH!
        robocopy "!SRC_DIR!" "!DEST_DIR!" /LEV:1 /IS /R:1 /W:1 /NJH /NJS /NDL >nul
    )
)

:: STEP 2: Update files in the ROOT folder (skip files that don't already exist in DEST)
for %%F in ("%DEST%\*") do (
    if exist "%SOURCE%\%%~nxF" (
        copy /Y "%SOURCE%\%%~nxF" "%%F" >nul
    )
)

echo.
echo Sync Complete!
pause