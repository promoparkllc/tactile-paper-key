#!/usr/bin/env bash
# Render single frames of the Film scene on the GPU (OptiX), headless, outside MCP.
# Usage: render_frame.sh <out_dir> <frame> [frame ...]
# Env:   BLENDER, DEVICE (OPTIX|CUDA), SAMPLES, PCT (resolution %), BLEND, VT (view transform), PASS (3d|flat, see
#        pass_override.py), EXTRA_PY (extra python file run after loading), PREFIX (file name prefix, default f)
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
BLENDER=${BLENDER:-/e/blender-5.2.3-windows-x64/blender-5.2.3-windows-x64/blender.exe}
DEVICE=${DEVICE:-OPTIX}
BLEND=${BLEND:-$HERE/../scene.blend}
PREFIX=${PREFIX:-f}
OUT=$1; shift
mkdir -p "$OUT"
OUT_ABS=$(cd "$OUT" && pwd -W 2>/dev/null || pwd)
PRE="import bpy
assert bpy.app.version >= (5, 2, 0)
p = bpy.context.preferences.addons['cycles'].preferences
p.compute_device_type = '$DEVICE'
p.get_devices()
assert [d for d in p.devices if d.type == '$DEVICE'], 'no $DEVICE device'
for d in p.devices:
    d.use = d.type == '$DEVICE'
sc = bpy.data.scenes['Film']
sc.cycles.samples = int('${SAMPLES:-64}')
sc.render.resolution_percentage = int('${PCT:-100}')"
EXTRA=()
if [ -n "${PASS:-}" ] || [ -n "${VT:-}" ]; then EXTRA+=(--python "$HERE/pass_override.py"); fi
[ -n "${EXTRA_PY:-}" ] && EXTRA+=(--python "$EXTRA_PY")
for F in "$@"; do
  t0=$(date +%s.%N)
  "$BLENDER" --background --factory-startup "$BLEND" --python-exit-code 1 --python-expr "$PRE" "${EXTRA[@]}" \
    -S Film -o "$OUT_ABS/$PREFIX####" -F PNG -f "$F" > "$OUT/_render_${PREFIX}$F.log" 2>&1 || { echo "frame $F FAILED, see $OUT/_render_${PREFIX}$F.log"; exit 1; }
  printf 'frame %s ok  %.1f s\n' "$F" "$(awk "BEGIN{print $(date +%s.%N)-$t0}")"
done
