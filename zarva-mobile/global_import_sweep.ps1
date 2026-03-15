$root = "c:\Users\theva\OneDrive\Desktop\App\Zarva\zarva-mobile\src"
$files = Get-ChildItem -Path $root -Include *.js, *.jsx -Recurse

# Specific mappings to handle features first, then layers
$mapping = [ordered]@{
    "features/auth"          = "@auth"
    "features/jobs"          = "@jobs"
    "features/inspection"    = "@inspection"
    "features/payment"       = "@payment"
    "features/notifications" = "@notifications"
    "features/worker"        = "@worker"
    "features/customer"      = "@customer"
    "features"               = "@features"
    "shared"                 = "@shared"
    "infra"                  = "@infra"
    "app"                    = "@app"
    "navigation"             = "@navigation"
}

foreach ($f in $files) {
    $txt = [System.IO.File]::ReadAllText($f.FullName)
    $original = $txt
    
    foreach ($key in $mapping.Keys) {
        $alias = $mapping[$key]
        
        # Regex to match relative imports at any depth: ../ or ../../ etc.
        # Captures the trailing separator or quote to preserve it.
        $pattern = "from\s+['\"](\.\./)+$($key)(/|['\"])"
        $replacement = "from '$alias$2"
        $txt = [regex]::Replace($txt, $pattern, $replacement)
    }

    # Cleanup malformed aliases that might have relative prefixes from previous half-fixes
    $txt = [regex]::Replace($txt, "from\s+['\"]\.*\/+(@app|@shared|@features|@infra|@navigation|@auth|@worker|@customer|@jobs|@payment|@inspection|@notifications)", "from '$1")

    # Final sweep for specific broken paths mentioned by user (e.g. @shared/screens)
    # Screens should be in their respective features.
    # If we find @shared/screens, we'll flag it or try to leave it if it's a generic shared component,
    # but the user specifically called it a "broken path".
    
    if ($txt -ne $original) {
        Write-Host "Fixed imports in $($f.FullName)"
        [System.IO.File]::WriteAllText($f.FullName, $txt)
    }
}
