#!/usr/bin/env bash
# Stage 2 preview of the whole film (frames 1–975) at 50 % / 16 spp, three passes through the kit's guarded renderer:
#   A  AgX, the scene as animated            frames 1–S8 end  (the 3D world, hand-off stand-in included)
#   B  Standard, the scene as animated       frames S5–S8     (flat UI drawings: exact hex)
#   M  flat matte (pass_override PASS=matte) frames S5–S8     (per-pixel mix A → B)
#   end card (END start–frames): solid bone plane added by composite_seq (text comes from Remotion)
# then composite_seq.py, H.264 preview, contact sheets (fps 2, 6 × 4) and motion_check.
# Usage: render_preview.sh [mode]   mode = preview (default) | final      env: BLENDER, DEVICE
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
FILM=$(cd "$HERE/.." && pwd)
KIT="/d/Claude Projects/_blender-kit"
BLENDER=${BLENDER:-/e/blender-5.2.3-windows-x64/blender-5.2.3-windows-x64/blender.exe}
BPY="/e/blender-5.2.3-windows-x64/blender-5.2.3-windows-x64/5.2/python/bin/python.exe"
MODE=${1:-preview}
OUT="$FILM/render/$MODE"
BLEND="$FILM/scene.blend"
PO=$(cd "$HERE" && pwd -W 2>/dev/null || pwd)/pass_override.py
mkdir -p "$OUT"
LOG="$OUT/_preview.log"
exec > >(tee -a "$LOG") 2>&1
echo "=== $(date '+%F %T') preview start · mode $MODE"
t_all=$(date +%s)

pass() {   # name start end env-assignments...
  local name=$1 s=$2 e=$3; shift 3
  local t0=$(date +%s)
  echo "--- pass $name frames $s-$e ($*)"
  env "$@" EXTRA_PY="exec(open(r'$PO', encoding='utf-8').read())" \
    bash "$KIT/render_resume_guarded.sh" "$BLEND" Film "$OUT/$name" "$s" "$e" "$MODE" || { echo "pass $name FAILED"; exit 1; }
  local n=$((e - s + 1)); local dt=$(( $(date +%s) - t0 ))
  echo "pass $name: $n frames in ${dt}s = $(awk "BEGIN{printf \"%.2f\", $dt/$n}") s/frame"
}

# frame numbers from film/scenes.json (written by build_scene.py): last 3D frame, first flat frame, end card, total
FILM_W=$(cd "$FILM" && pwd -W 2>/dev/null || pwd)   # Windows path for the Blender python
read LAST BFROM TAIL TOTAL < <("$BPY" -I -c "import json, sys; s = json.load(open(sys.argv[1])); sc = {x['id']: x for x in s['scenes']}; print(sc['S8']['end'], sc['S5']['start'], sc['END']['start'], s['frames'])" "$FILM_W/scenes.json")
[ -n "$TOTAL" ] || { echo "scenes.json not readable"; exit 1; }
echo "frames: 3D 1-$LAST · flat from $BFROM · end card $TAIL-$TOTAL"
pass A 1 "$LAST" VT=AgX
pass B "$BFROM" "$LAST" VT=Standard
pass M "$BFROM" "$LAST" PASS=matte

echo "--- composite"
"$BLENDER" --background --factory-startup --python-exit-code 1 --python "$HERE/composite_seq.py" -- \
  "$OUT/A" "$OUT/B" "$OUT/M" "$OUT/out" 1 "$TOTAL" --b-from "$BFROM" --tail-from "$TAIL" --tail-hex "#E7E4DE" 2>&1 | grep -E "COMPOSITE|Error|Traceback"

echo "--- encode + QC"
ffmpeg -v error -y -framerate 30 -start_number 1 -i "$OUT/out/%04d.png" -c:v libx264 -preset slow -crf 16 \
  -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart \
  "$OUT/preview.mp4"
ffprobe -v error -show_entries stream=width,height,r_frame_rate,nb_frames,pix_fmt,color_space,color_range -of default=nw=1 "$OUT/preview.mp4"
ffmpeg -v error -y -i "$OUT/preview.mp4" -vf "fps=2,scale=320:-1,tile=6x4" -q:v 3 "$OUT/contact_%02d.jpg"
ls "$OUT"/contact_*.jpg
# the 3D film without the end card (a static bone plane by design) for motion_check
ffmpeg -v error -y -framerate 30 -start_number 1 -i "$OUT/out/%04d.png" -frames:v "$LAST" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p "$OUT/preview_3d.mp4"
"$BPY" -I "$KIT/motion_check.py" "$OUT/preview_3d.mp4" --no-loop --max-static 30 || true
echo "=== $(date '+%F %T') preview done in $(( $(date +%s) - t_all ))s"
