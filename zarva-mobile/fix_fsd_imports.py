import os
import re

ROOT_DIR = r'c:\Users\theva\OneDrive\Desktop\App\Zarva\zarva-mobile\src\features'

REPLACEMENTS = [
    (re.compile(r"from ['\"]\.\./\.\./design-system['\"]"), "from '@shared/design-system'"),
    (re.compile(r"from ['\"]\.\./\.\./hooks/useT['\"]"), "from '@shared/i18n/useTranslation'"),
    (re.compile(r"from ['\"]\.\./\.\./design-system/components/PressableAnimated['\"]"), "from '@shared/design-system/components/PressableAnimated'"),
    (re.compile(r"from ['\"]\.\./\.\./utils/jobParser['\"]"), "from '@shared/utils/jobParser'"),
]

def fix_imports():
    for root, dirs, files in os.walk(ROOT_DIR):
        for file in files:
            if file.endswith(('.js', '.jsx')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = content
                for pattern, replacement in REPLACEMENTS:
                    new_content = pattern.sub(replacement, new_content)
                
                if new_content != content:
                    print(f"Fixed imports in {path}")
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == '__main__':
    fix_imports()
