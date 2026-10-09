#!/usr/bin/env python3
"""Fail builds if an APK/AAB statically contains a Cloudflare worker origin.

Run on generated archives (not on the source ZIP). The test cannot prevent the
public gateway address from being discovered at runtime through network traffic.
"""
import re
import sys
import zipfile
from pathlib import Path

# Static app assets and DEX may not contain an origin from a workers.dev host.
WORKER_HOST = re.compile(rb'[a-z0-9.-]+\.workers\.dev', re.IGNORECASE)


def check(path: Path) -> None:
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            if name.endswith('/'):
                continue
            # Skip large binary media whose contents are not application config.
            if not (name.endswith(('.dex', '.xml', '.arsc', '.json', '.txt', '.properties')) or
                    name.startswith('assets/')):
                continue
            if WORKER_HOST.search(archive.read(name)):
                raise ValueError(f'Embedded workers.dev hostname detected in {path.name}:{name}')
    print(f'No embedded workers.dev hostname: {path.name}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('Usage: python3 scripts/verify-apk-endpoints.py file.apk [file.aab ...]')
    for argument in sys.argv[1:]:
        check(Path(argument))
