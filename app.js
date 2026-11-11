const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const MAX_LIVE = (() => {
  const n = parseInt(new URLSearchParams(location.search).get("live"), 10);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();

let featured = null;
const active = [];
const tiles = [];

const ICON_OFF =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
const ICON_ON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.4 5.6a9 9 0 0 1 0 12.8"/></svg>';

function updateStatus() {
  statusEl.textContent = `${active.length} streaming · ${CAMS.length} feeds`;
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

function pauseTile(tile) {
  const i = active.indexOf(tile);
  if (i !== -1) active.splice(i, 1);
  if (tile._video) {
    tile._video.pause();
    if (tile._hls) tile._hls.stopLoad();
  }
  updateStatus();
}

function playTile(tile) {
  if (tile.classList.contains("offline") || active.includes(tile)) return;
  while (active.length >= MAX_LIVE) {
    const victim = active.find((t) => t !== featured);
    if (!victim) break;
    pauseTile(victim);
  }
  active.push(tile);
  const state = tile.querySelector(".state");
  if (state) state.remove();
  if (tile._video) {
    if (tile._hls) tile._hls.startLoad();
    tile._video.play().catch(() => {});
  } else if (tile._cam.type === "hls") {
    attachHls(tile);
  }
  updateStatus();
}

function markOffline(tile) {
  if (!tile.classList.contains("offline")) {
    pauseTile(tile);
    tile.classList.add("offline");
    grid.appendChild(tile);
    const state = tile.querySelector(".state") || document.createElement("div");
    state.className = "state";
    state.textContent = "offline";
    tile.appendChild(state);
  }
}

function attachHls(tile) {
  const cam = tile._cam;
  const video = tile._video;
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

function mountIframe(tile) {
  const cam = tile._cam;
  tile._iframeEl = document.createElement("iframe");
  tile._iframeEl.src = cam.url;
  tile._iframeEl.allow =
    "autoplay; fullscreen; encrypted-media; picture-in-picture";
  tile.appendChild(tile._iframeEl);
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
  if (tile._iframeEl) {
    tile._iframeEl.remove();
    tile._iframeEl = null;
  }
  if (tile._closeEl) {
    tile._closeEl.remove();
    tile._closeEl = null;
  }
  if (!tile.querySelector(".state")) {
    const state = document.createElement("div");
    state.className = "state";
    state.textContent = "click for live";
    tile.insertBefore(state, tile.firstChild);
  }
}

function setFeatured(tile) {
  const target = featured === tile ? null : tile;
  flip(() => {
    if (featured) {
      featured.classList.remove("featured");
      if (featured._cam.type === "iframe") unmountIframe(featured);
    }
    featured = target;
    if (featured) {
      featured.classList.add("featured");
      if (featured._cam.type === "iframe") {
        const state = featured.querySelector(".state");
        if (state) state.remove();
        mountIframe(featured);
      } else {
        playTile(featured);
      }
    }
  });
  updateStatus();
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
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "none";
    tile._video = video;
    tile.appendChild(video);
    state.textContent = "loading";

    const btn = document.createElement("button");
    btn.className = "mute-btn";
    btn.title = "Toggle sound";
    btn.innerHTML = ICON_OFF;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      video.muted = !video.muted;
      btn.innerHTML = video.muted ? ICON_OFF : ICON_ON;
    });
    tile.appendChild(btn);
  } else if (cam.type === "iframe" || cam.type === "mjpeg") {
    state.textContent = "click for live";
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
    if (cam.type === "hls") playTile(tile);
  });
  tile.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setFeatured(tile);
    }
  });
  return tile;
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const en of entries) {
      const tile = en.target;
      if (tile._cam.type !== "hls") continue;
      if (en.isIntersecting) playTile(tile);
      else pauseTile(tile);
    }
  },
  { rootMargin: "80px" }
);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && featured) setFeatured(featured);
});

const heldOnHide = [];
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    heldOnHide.push(...active.splice(0));
    for (const t of heldOnHide) {
      if (t._video) t._video.pause();
      if (t._hls) t._hls.stopLoad();
    }
  } else {
    for (const t of heldOnHide.splice(0)) {
      if (!t.classList.contains("offline")) playTile(t);
    }
    updateStatus();
  }
});

for (const cam of CAMS) {
  const tile = buildTile(cam);
  tiles.push(tile);
  grid.appendChild(tile);
  observer.observe(tile);
}

let i = 0;
const starter = setInterval(() => {
  const pending = tiles
    .slice(i)
    .find((t) => t._cam.type === "hls" && !active.includes(t));
  if (!pending) {
    clearInterval(starter);
    return;
  }
  playTile(pending);
  i++;
}, 400);

updateStatus();
