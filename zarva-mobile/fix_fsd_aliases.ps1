$root = "c:\Users\theva\OneDrive\Desktop\App\Zarva\zarva-mobile\src\features"
$files = Get-ChildItem -Path $root -Include *.js, *.jsx -Recurse

foreach ($f in $files) {
    $txt = [System.IO.File]::ReadAllText($f.FullName)
    $original = $txt
    
    # Fix instances where an alias was prefixed with relative paths like ../@shared
    # This often happens during blind regex replacements
    $txt = [regex]::Replace($txt, "from ['\"]\.*\/+(@app|@shared|@features|@infra|@navigation|@auth|@worker|@customer|@jobs|@payment|@inspection|@notifications)", "from '$1")
    
    if ($txt -ne $original) {
        Write-Host "Fixed malformed alias in $($f.FullName)"
        [System.IO.File]::WriteAllText($f.FullName, $txt)
    }
}
