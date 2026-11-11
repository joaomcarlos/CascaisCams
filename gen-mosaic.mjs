import { readFileSync, writeFileSync } from "fs";

const CAMS = new Function(readFileSync(new URL("./cams.js", import.meta.url).pathname, "utf8") + "; return CAMS;")();
const hls = CAMS.filter((c) => c.type === "hls");
const COLS = 5;
const W = 320;
const H = 180;

const inputs = hls
  .map(
    (c) =>
      `-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i '${c.url}'`
  )
  .join(" \\\n  ");

const scales = hls.map((_, i) => `[${i}:v]scale=${W}:${H}[v${i}]`).join(";");
const layout = hls
  .map((_, i) => `${(i % COLS) * W}_${Math.floor(i / COLS) * H}`)
  .join("|");
const xstack = `${hls.map((_, i) => `[v${i}]`).join("")}xstack=inputs=${hls.length}:layout=${layout}[out]`;

const script = `#!/bin/bash
mkdir -p "$(dirname "$0")/live"
exec ffmpeg -hide_banner -loglevel warning -fflags +genpts \\
  ${inputs} \\
  -filter_complex "${scales};${xstack}" \\
  -map "[out]" -c:v libx264 -preset ultrafast -tune zerolatency -g 50 -sc_threshold 0 -pix_fmt yuv420p -an \\
  -f hls -hls_time 2 -hls_list_size 5 -hls_flags delete_segments+independent_segments \\
  -hls_segment_filename "$(dirname "$0")/live/seg_%05d.ts" "$(dirname "$0")/live/mosaic.m3u8"
`;

writeFileSync(new URL("./mosaic.sh", import.meta.url).pathname, script, { mode: 0o755 });
console.log(`wrote mosaic.sh: ${hls.length} inputs, ${COLS}x${Math.ceil(hls.length / COLS)} grid`);
