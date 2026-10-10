#!/bin/bash
cd "$(dirname "$0")/.."
LOG=out/final/render.log
run () {
  local t0=$(date +%s)
  local name=${2/_p/_P}
  ./bl/bin/python r/$1 $2 $3 $4 $5 out/final/$name.png > out/final/$2.log 2>&1
  local rc=$?
  if [ "$name" == "$2" ]; then mv out/final/$2.png out/final/${2}_L.png; mv out/final/$2.json out/final/${2}_L.json; fi
  echo "$2 rc=$rc $(( $(date +%s) - t0 ))s" >> $LOG
}
run house.py garden_p 1080 1920 128
run house.py kitchen 2400 1350 160
run house.py kitchen_p 1080 1920 128
run house.py bath 2400 1350 128
run house.py bath_p 1080 1920 112
run commercial.py commercial 2400 1350 128
run commercial.py commercial_p 1080 1920 112
echo ALL_DONE >> $LOG
