# CascaisCams

Live mosaic of public webcams around Cascais, Portugal — MEO Beachcam HLS feeds plus Windy webcam embeds.

## How it works

Running 15+ live streams in one page is too much for a browser, so the decode
work happens server-side:

- `gen-mosaic.mjs` reads `cams.js` and generates `mosaic.sh`, an ffmpeg
  pipeline that pulls every HLS feed, decodes/scales/stacks them on the GPU
  (NVDEC/NVENC), and emits a single `live/mosaic.m3u8` stream.
- The frontend plays that one mosaic stream; each tile is a `<canvas>` that
  crops its camera's region per frame.
- Clicking a tile expands it (grid reflow, no overlap) and mounts that
  camera's full-resolution stream directly — so the browser only ever decodes
  1–2 videos.
- Windy feeds are heavyweight iframe apps, so they load on hover/click only
  (max 3 warm at once).

## Run it

```sh
node gen-mosaic.mjs          # regenerates mosaic.sh from cams.js
./mosaic.sh &               # starts the transcoder -> live/mosaic.m3u8
python3 -m http.server 8931 # serve the page
```

Requires ffmpeg built with CUDA support for the GPU path. Without a GPU,
edit `gen-mosaic.mjs` to emit software decode/scale/x264 instead.
