#!/bin/bash
# Render one share of the drone flight on this machine: every 4th frame starting at $1,
# optionally only within frames $2..$3 (inclusive), tagged $4 (default: none).
# Leaves JPEGs (quality 95) in <repo>/frames_$1$4 and writes /tmp/part_$1$4.done when finished.
set -e
K=$1
A=${2:-0}
B=${3:-289}
T=${4:-}
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
LOG=/tmp/part_$K$T.log
if [ ! -x /tmp/bl/bin/python ]; then
  python3.11 -m venv /tmp/bl >> $LOG 2>&1
  /tmp/bl/bin/pip install -q bpy==5.0.1 numpy pillow >> $LOG 2>&1
fi
LIST=$(python3 -c "print(','.join(str(i) for i in range($A, $B + 1) if i % 4 == $K))")
cd "$HERE"
rm -rf /tmp/frames_$K$T
/tmp/bl/bin/python fly.py 1152 16 /tmp/frames_$K$T "$LIST" >> $LOG 2>&1
mkdir -p "$REPO/frames_$K$T"
/tmp/bl/bin/python -c "
import glob, os
from PIL import Image
for p in sorted(glob.glob('/tmp/frames_$K$T/*.png')):
    Image.open(p).convert('RGB').save(os.path.join('$REPO/frames_$K$T', os.path.basename(p)[:-4] + '.jpg'), quality=95, subsampling=0)
"
ls "$REPO/frames_$K$T" | wc -l > /tmp/part_$K$T.done
