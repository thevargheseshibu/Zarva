$root = "c:\Users\theva\OneDrive\Desktop\App\Zarva\zarva-mobile\src\features"
$files = Get-ChildItem -Path $root -Include *.js, *.jsx -Recurse

$prefixes = @("../../../../", "../../../", "../../", "../", "./")
$aliases = @("@shared", "@infra", "@app", "@features", "@navigation", "@auth", "@worker", "@customer", "@jobs", "@payment", "@inspection", "@notifications")

foreach ($f in $files) {
    $txt = [System.IO.File]::ReadAllText($f.FullName)
    $original = $txt
    
    foreach ($p in $prefixes) {
        foreach ($a in $aliases) {
            $wrong = $p + $a
            if ($txt.Contains($wrong)) {
                $txt = $txt.Replace($wrong, $a)
            }
        }
    }
    
    if ($txt -ne $original) {
        Write-Host "Fixed malformed alias in $($f.FullName)"
        [System.IO.File]::WriteAllText($f.FullName, $txt)
    }
}
