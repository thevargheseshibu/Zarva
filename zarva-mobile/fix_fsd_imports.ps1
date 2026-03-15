$root = "c:\Users\theva\OneDrive\Desktop\App\Zarva\zarva-mobile\src\features"
$files = Get-ChildItem -Path $root -Include *.js, *.jsx -Recurse

foreach ($f in $files) {
    $txt = [System.IO.File]::ReadAllText($f.FullName)
    $original = $txt
    
    # Simple literal replacements
    $txt = $txt.Replace("../../design-system", "@shared/design-system")
    $txt = $txt.Replace("../../hooks/useT", "@shared/i18n/useTranslation")
    $txt = $txt.Replace("../../utils/jobParser", "@shared/utils/jobParser")
    $txt = $txt.Replace("../../design-system/components/PressableAnimated", "@shared/design-system/components/PressableAnimated")
    $txt = $txt.Replace("../../../shared/hooks/useT", "@shared/i18n/useTranslation")
    
    if ($txt -ne $original) {
        Write-Host "Fixed imports in $($f.FullName)"
        [System.IO.File]::WriteAllText($f.FullName, $txt)
    }
}
