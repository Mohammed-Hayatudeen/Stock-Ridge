#!/usr/bin/env python3
"""One-time deterministic recovery of the concatenated StockRidge source export."""
from pathlib import Path
import re

SOURCE = Path('/tmp/arena-coding-uploads/o.txt')
ROOT = Path(__file__).resolve().parents[1]
lines = SOURCE.read_text(encoding='utf-8-sig').splitlines()

def write(path, start, end):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text('\n'.join(lines[start - 1:end]).rstrip() + '\n', encoding='utf-8')

# Explicit file banners in the web/Worker export.
headers = []
for index, line in enumerate(lines):
    match = re.match(r'^//\s+([A-Za-z0-9_@][A-Za-z0-9_./@ -]+\.[A-Za-z0-9]+)\s+—', line)
    if not match:
        continue
    path = match.group(1)
    if path.startswith(('server/', 'domain/', 'public/js/', 'worker/src/turso.js', 'worker/src/housekeeping.js', 'tools/turso-admin.js', 'tools/stamp-build.js')):
        headers.append((index + 1, path))

for pos, (line_no, path) in enumerate(headers):
    start = line_no - 1
    while start > 1 and lines[start - 2].strip() in ("'use strict';", '"use strict";', '#!/usr/bin/env node'):
        start -= 1
    if pos + 1 < len(headers):
        end = headers[pos + 1][0] - 2
        while end >= start and lines[end - 1].strip() in ("'use strict';", '"use strict";', '#!/usr/bin/env node'):
            end -= 1
    else:
        end = 71673
    # Do not let the desktop duplicate replace the original browser adapter.
    if path == 'public/js/store-native.js' and line_no > 76000:
        continue
    write(path, start, end)

# Files whose banners were not part of the export.
write('worker/src/index.mjs', 1340, 1692)
write('schema/migrations/0001_schema.sql', 34374, 55082)
write('public/sw.js', 55083, 55288)
write('public/offline.html', 55289, 55444)
write('public/index.html', 55445, 55762)
write('public/css/app.css', 62007, 63230)

# Desktop tools and native libraries. Ranges are source-export line identities.
ranges = {
    'tools/stage-ui.js': (76014, 76046),
    'tools/publish-update.js': (76048, 76063),
    'tools/archive.js': (76065, 76148),
    'public/js/store-native.js': (76305, 76542),
    'lib/native-support.js': (76544, 76608),
    'public/js/native-desktop.js': (76610, 77547),
    'lib/updates.js': (77549, 77593),
    'lib/sync-budget.js': (77594, 77624),
    'lib/stock-sql.js': (77625, 78017),
    'lib/stock-hold.js': (78019, 78052),
    'lib/sql-open.js': (78053, 78371),
    'lib/shop-clone.js': (78373, 78723),
    'lib/shared-books.js': (78725, 78735),
    'lib/session-hold.js': (78736, 78801),
    'lib/screen-sync.js': (78802, 78965),
    'lib/offline-error.js': (78966, 78987),
    'lib/offline-door.js': (78989, 79157),
    'lib/offline-auth.js': (79158, 79209),
    'lib/native-shell.js': (79210, 79229),
    'lib/local-sales.js': (79230, 79253),
    'lib/hub.js': (79254, 79383),
    'lib/escpos.js': (79384, 79405),
    'lib/device-store.js': (79406, 80179),
    'electron/updater.js': (80180, 80250),
    'electron/server.js': (80251, 81072),
    'electron/printer.js': (81073, 81129),
    'electron/preload.js': (81130, 81197),
    'electron/paths.js': (81199, 81231),
    'electron/main.js': (81232, 81612),
    'electron/hide-install.js': (81614, 81640),
}
# Correct boundaries where the export omitted a file banner.
overrides = {
    'worker/src/turso.js': (736, 1339),
    'worker/src/housekeeping.js': (1693, 1834),
    'server/services/glService.js': (7719, 8840),
    'server/services/categoryProfile.js': (8841, 8988),
    'server/routes/attendance.js': (25338, 26048),
    'server/routes/agreements.js': (26049, 26203),
    'server/middleware/auth.js': (30545, 30880),
    'server/services/dispatchService.js': (30881, 31091),
    'server/lib/storage.js': (31092, 31314),
    'server/lib/requireScreen.js': (31315, 31332),
    'server/lib/audit.js': (34136, 34373),
    'public/js/print.js': (61070, 62006),
    'domain/access.js': (71389, 71673),
    'domain/time.js': (65808, 66103),
    'domain/sync-watermark.js': (66104, 66140),
    'domain/money.js': (69159, 69316),
    'domain/modules.js': (69317, 69376),
    'domain/migration-squash.js': (69377, 69394),
    'domain/compliance.js': (70929, 71177),
    'domain/branchTypes.js': (71178, 71212),
    'public/js/state.js': (60215, 60896),
    'public/js/save-status.js': (60897, 60962),
    'public/js/role-screens.js': (60963, 61029),
    'public/js/reachability.js': (61030, 61069),
    'tools/stamp-build.js': (2412, 2578),
    'tools/archive.js': (76069, 76115),
    'tools/no-native-compile.js': (76065, 76068),
    'public/js/store-native.js': (76305, 76543),
    'public/js/native-support.js': (76544, 76609),
    'public/js/native-desktop.js': (76610, 77548),
    'lib/stock-sql.js': (77625, 78018),
    'lib/sql-open.js': (78053, 78372),
    'lib/shop-clone.js': (78373, 78724),
    'electron/preload.js': (81130, 81198),
    'electron/main.js': (81232, 81613),
}
for path, (start, end) in {**ranges, **overrides}.items():
    write(path, start, end)
(ROOT / 'lib/native-support.js').unlink(missing_ok=True)

# Native Android wrapper, excluding legacy repository instructions and generated scripts.
write('android/settings.gradle', 81641, 81662)
write('android/gradle.properties', 82027, 82029)
write('android/gradle/wrapper/gradle-wrapper.properties', 82037, 82043)
write('android/app/build.gradle', 82044, 82071)
write('android/app/src/main/AndroidManifest.xml', 82072, 82094)
write('android/app/src/main/res/values/strings.xml', 82095, 82100)
write('android/app/src/main/java/com/stockridge/till/MainActivity.java', 82101, 82493)

print(f'Recovered {len(headers) + len(ranges) + 12} source files into {ROOT}')
