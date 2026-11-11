const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const COLS = 5;
const CELL_W = 320;
const CELL_H = 180;

let featured = null;
const tiles = [];

const ICON_OFF =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
const ICON_ON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.4 5.6a9 9 0 0 1 0 12.8"/></svg>';
const ICON_PLAY =
  '<svg viewBox="0 0 24 24" width="42" height="42" fill="currentColor" opacity="0.5"><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9.5 7.5v9l8-4.5z"/></svg>';

const mosaic = document.createElement("video");
mosaic.muted = true;
mosaic.playsInline = true;

function mosaicIndex(tile) {
  return tiles.filter((t) => t._cam.type === "hls").indexOf(tile);
}

function drawTile(tile) {
  const idx = mosaicIndex(tile);
  if (idx < 0 || !mosaic.videoWidth) return;
  tile._ctx.drawImage(
    mosaic,
    (idx % COLS) * CELL_W,
    Math.floor(idx / COLS) * CELL_H,
    CELL_W,
    CELL_H,
    0,
    0,
    CELL_W,
    CELL_H
  );
}

function drawAll() {
  for (const t of tiles) {
    if (t._ctx && !t.classList.contains("featured")) drawTile(t);
  }
}

function startDrawLoop() {
  if (mosaic.requestVideoFrameCallback) {
    const tick = () => {
      drawAll();
      mosaic.requestVideoFrameCallback(tick);
    };
    mosaic.requestVideoFrameCallback(tick);
  } else {
    setInterval(drawAll, 66);
  }
}

function updateStatus() {
  const hlsCount = CAMS.filter((c) => c.type === "hls").length;
  const live = mosaic.videoWidth ? hlsCount : 0;
  statusEl.textContent = `${live} live · ${CAMS.length} feeds`;
}

function flip(mutate) {
  const rects = new Map(tiles.map((t) => [t, t.getBoundingClientRect()]));
  mutate();
  for (const t of tiles) {
    const f = rects.get(t);
    const l = t.getBoundingClientRect();
    const dx = f.left - l.left;
    const dy = f.top - l.top;
    const sx = f.width / l.width || 1;
    const sy = f.height / l.height || 1;
    if (dx || dy || sx !== 1 || sy !== 1) {
      t.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
          { transform: "none" },
        ],
        { duration: 320, easing: "cubic-bezier(0.25, 0.8, 0.25, 1)" }
      );
    }
  }
}

function markOffline(tile) {
  if (!tile.classList.contains("offline")) {
    tile.classList.add("offline");
    grid.appendChild(tile);
    const state = tile.querySelector(".state") || document.createElement("div");
    state.className = "state";
    state.textContent = "offline";
    tile.appendChild(state);
  }
}

function mountStream(tile) {
  const cam = tile._cam;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  tile._video = video;
  tile.appendChild(video);

  const btn = document.createElement("button");
  btn.className = "mute-btn";
  btn.title = "Toggle sound";
  btn.innerHTML = ICON_OFF;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    video.muted = !video.muted;
    btn.innerHTML = video.muted ? ICON_OFF : ICON_ON;
  });
  tile._muteEl = btn;
  tile.appendChild(btn);

  const onFatal = () => markOffline(tile);
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = cam.url;
    video.addEventListener("error", onFatal, { once: true });
  } else if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({
      capLevelToPlayerSize: true,
      maxBufferLength: 8,
      backBufferLength: 0,
      liveSyncDurationCount: 2,
    });
    hls.loadSource(cam.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
      else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      else onFatal();
    });
    tile._hls = hls;
  } else {
    markOffline(tile);
    return;
  }
  video.play().catch(() => {});
}

function unmountStream(tile) {
  if (tile._hls) {
    tile._hls.destroy();
    tile._hls = null;
  }
  if (tile._video) {
    tile._video.remove();
    tile._video = null;
  }
  if (tile._muteEl) {
    tile._muteEl.remove();
    tile._muteEl = null;
  }
}

const warmIframes = [];
const MAX_WARM = 3;

function showIdleState(tile) {
  if (!tile.querySelector(".state")) {
    const state = document.createElement("div");
    state.className = "state";
    state.innerHTML = ICON_PLAY;
    tile.insertBefore(state, tile.firstChild);
  }
}

function mountIframe(tile) {
  if (tile._iframeEl) return;
  const cam = tile._cam;
  tile._iframeEl = document.createElement("iframe");
  tile._iframeEl.src = cam.url;
  tile._iframeEl.allow =
    "autoplay; fullscreen; encrypted-media; picture-in-picture";
  tile._iframeEl.addEventListener("load", () => {
    const s = tile.querySelector(".state");
    if (s) s.remove();
  });
  tile.appendChild(tile._iframeEl);
}

function dropIframe(tile) {
  if (tile._iframeEl) {
    tile._iframeEl.remove();
    tile._iframeEl = null;
  }
  showIdleState(tile);
}

function warmIframe(tile) {
  if (tile._iframeEl || tile.classList.contains("offline")) return;
  while (warmIframes.length >= MAX_WARM) {
    const old = warmIframes.shift();
    if (old === tile || old === featured) continue;
    dropIframe(old);
  }
  mountIframe(tile);
  warmIframes.push(tile);
}

function addCloseButton(tile) {
  const close = document.createElement("button");
  close.className = "close-btn";
  close.title = "Back to mosaic";
  close.textContent = "×";
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    setFeatured(tile);
  });
  tile._closeEl = close;
  tile.appendChild(close);
}

function unmountIframe(tile) {
  const w = warmIframes.indexOf(tile);
  if (w !== -1) warmIframes.splice(w, 1);
  dropIframe(tile);
  if (tile._closeEl) {
    tile._closeEl.remove();
    tile._closeEl = null;
  }
}

function setFeatured(tile) {
  const target = featured === tile ? null : tile;
  flip(() => {
    if (featured) {
      featured.classList.remove("featured");
      if (featured._cam.type === "iframe") unmountIframe(featured);
      else {
        unmountStream(featured);
        if (featured._closeEl) {
          featured._closeEl.remove();
          featured._closeEl = null;
        }
      }
    }
    featured = target;
    if (featured) {
      featured.classList.add("featured");
      const state = featured.querySelector(".state");
      if (state) state.remove();
      addCloseButton(featured);
      if (featured._cam.type === "iframe") mountIframe(featured);
      else mountStream(featured);
    }
  });
}

function buildTile(cam) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.dataset.id = cam.id;
  tile.tabIndex = 0;
  tile._cam = cam;

  const state = document.createElement("div");
  state.className = "state";
  tile.appendChild(state);

  if (cam.type === "hls") {
    const canvas = document.createElement("canvas");
    canvas.width = CELL_W;
    canvas.height = CELL_H;
    tile._ctx = canvas.getContext("2d");
    tile.appendChild(canvas);
    state.textContent = "connecting";
  } else {
    state.innerHTML = ICON_PLAY;
    state.title = "Click for live player";
  }

  const label = document.createElement("div");
  label.className = "label";
  const dot = document.createElement("span");
  dot.className = "live-dot";
  const name = document.createElement("span");
  name.textContent = cam.name;
  label.append(dot, name);
  if (cam.page || cam.credit) {
    const a = document.createElement("a");
    a.href = cam.page || cam.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = cam.credit || "source";
    a.addEventListener("click", (e) => e.stopPropagation());
    label.appendChild(a);
  }
  tile.appendChild(label);

  tile.addEventListener("click", () => {
    if (!tile.classList.contains("offline")) setFeatured(tile);
  });
  tile.addEventListener("mouseenter", () => {
    if (cam.type === "iframe") warmIframe(tile);
  });
  tile.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setFeatured(tile);
    }
  });
  return tile;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && featured) setFeatured(featured);
});

let wasPlaying = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    wasPlaying = !mosaic.paused;
    mosaic.pause();
    if (mosaic._hls) mosaic._hls.stopLoad();
    if (featured && featured._video) featured._video.pause();
    if (featured && featured._hls) featured._hls.stopLoad();
  } else {
    if (mosaic._hls) mosaic._hls.startLoad();
    if (wasPlaying !== false) mosaic.play().catch(() => {});
    if (featured && featured._hls) featured._hls.startLoad();
    if (featured && featured._video) featured._video.play().catch(() => {});
  }
});

for (const cam of CAMS) {
  const tile = buildTile(cam);
  tiles.push(tile);
  grid.appendChild(tile);
}

if (mosaic.canPlayType("application/vnd.apple.mpegurl")) {
  mosaic.src = "live/mosaic.m3u8";
} else if (window.Hls && Hls.isSupported()) {
  const hls = new Hls({
    maxBufferLength: 8,
    backBufferLength: 0,
    liveSyncDurationCount: 2,
  });
  hls.loadSource("live/mosaic.m3u8");
  hls.attachMedia(mosaic);
  hls.on(Hls.Events.ERROR, (_e, data) => {
    if (!data.fatal) return;
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
  });
  mosaic._hls = hls;
}

mosaic.addEventListener(
  "playing",
  () => {
    startDrawLoop();
    for (const t of tiles) {
      const s = t.querySelector(".state");
      if (s && t._ctx) s.remove();
    }
    updateStatus();
  },
  { once: true }
);
mosaic.play().catch(() => {});
setInterval(updateStatus, 5000);
updateStatus();
