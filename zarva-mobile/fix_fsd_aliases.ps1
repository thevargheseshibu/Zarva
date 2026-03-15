$root = "c:\Users\theva\OneDrive\Desktop\App\Zarva\zarva-mobile\src\features"
$items = Get-ChildItem -Path $root -Include *.js, *.jsx -Recurse

foreach ($item in $items) {
    $text = [System.IO.File]::ReadAllText($item.FullName)
    $lines = $text -split "`r?`n"
    $changed = $false
    $newLines = foreach ($line in $lines) {
        if ($line -match "from ['\"]\.*\/+@") {
            # Replace things like from "../@shared" with from "@shared"
            $newLine = $line -replace "from ['\"]\.*\/+@", "from '@"
            $changed = $true
            $newLine
        } else {
            $line
        }
    }
    
    if ($changed) {
        Write-Host "Fixed alias in $($item.FullName)"
        $outputText = $newLines -join [System.Environment]::NewLine
        [System.IO.File]::WriteAllText($item.FullName, $outputText)
    }
}
