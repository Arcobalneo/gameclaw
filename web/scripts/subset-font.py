#!/usr/bin/env python3
"""Subset Fusion Pixel 12px (OFL-1.1) to the glyphs GameClaw actually renders.

Usage: python3 web/scripts/subset-font.py [path/to/fusion-pixel-12px-proportional-zh_hans.ttf.woff2]

Collects every character from game sources/data and web sources, plus ASCII,
CJK punctuation and GB2312 level-1 hanzi so runtime strings never fall back.
Requires `fonttools` and `brotli` (pip install fonttools brotli).
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/fpf/fusion-pixel-12px-proportional-zh_hans.ttf.woff2'
OUT = ROOT / 'web' / 'public' / 'fonts' / 'fusion-pixel-12.woff2'

chars = set(chr(c) for c in range(0x20, 0x7F))
chars |= set('·—…“”‘’「」『』【】《》〈〉、。，；：？！（）～·①②③④⑤⑥⑦⑧⑨←→↑↓★☆♥♦●○■□▲△▼▽◆◇✓✗×÷±°％')
for b1 in range(0xB0, 0xD8):
    for b2 in range(0xA1, 0xFF):
        try:
            chars.add(bytes([b1, b2]).decode('gb2312'))
        except UnicodeDecodeError:
            pass
for pattern in ('games/*/src/**/*.ts', 'games/*/data/**/*.json', 'web/src/**/*.ts', 'web/index.html'):
    for path in ROOT.glob(pattern):
        chars |= set(path.read_text(encoding='utf-8'))
chars = {c for c in chars if c.isprintable()}
text = ''.join(sorted(chars))
(ROOT / 'web' / '.tmp').mkdir(exist_ok=True)
listfile = ROOT / 'web' / '.tmp' / 'chars.txt'
listfile.write_text(text, encoding='utf-8')
subprocess.run(
    ['pyftsubset', SRC, f'--text-file={listfile}', '--flavor=woff2', f'--output-file={OUT}',
     '--layout-features=*', '--no-hinting'],
    check=True,
)
print(f'{len(chars)} chars -> {OUT} ({OUT.stat().st_size // 1024} KiB)')
