#!/usr/bin/env python3
"""Print a device pairing code without writing an endpoint to the repository or APK.

Usage: python3 scripts/make-pairing-code.py   (paste public entry HTTPS origin when prompted)
The pairing code is configuration, NOT a secret: anyone who has it can decode
its server address and inspect requests. Never embed it in app source.
"""
import base64
import getpass
from urllib.parse import urlsplit


def encode(value: str) -> str:
    origin = value.strip().rstrip('/')
    parts = urlsplit(origin)
    if (parts.scheme != 'https' or not parts.hostname or parts.username or parts.password or
            parts.port is not None or parts.path or parts.query or parts.fragment or '\n' in value):
        raise ValueError('Use a bare HTTPS origin (no path, query, credentials, or port)')
    return 'PB1-' + base64.urlsafe_b64encode(origin.encode('utf-8')).rstrip(b'=').decode('ascii')


if __name__ == '__main__':
    origin = getpass.getpass('Public gateway HTTPS origin (hidden while typing): ')
    print('Device pairing code:', encode(origin))
