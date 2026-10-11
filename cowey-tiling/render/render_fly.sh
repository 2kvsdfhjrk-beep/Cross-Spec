#!/bin/bash
# Drone flight frames, coarse to fine: every 8th frame of both flights first, then 4th, 2nd, then the rest.
cd "$(dirname "$0")/.."
LOG=out/fly/render.log
mkdir -p out/fly
for lv in 8 4 2 1; do
  for spec in "house 150" "street 70"; do
    set -- $spec
    list=$(python3 -c "print(','.join(str(i) for i in range(0,$2,$lv)))")
    t0=$(date +%s)
    BOUNCES=6,3,3,6 ./bl/bin/python r/fly.py $1 1152 16 out/fly/$1 $list >> out/fly/$1.log 2>&1
    echo "$1 stride $lv rc=$? $(( $(date +%s) - t0 ))s $(ls out/fly/$1/*.png 2>/dev/null | wc -l) frames" >> $LOG
  done
done
echo ALL_DONE >> $LOG
