const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
let featured = null;
let liveCount = 0;

function updateStatus() {
  statusEl.textContent = `${liveCount}/${CAMS.length} live`;
}

function flip(mutate) {
  const tiles = [...grid.children];
  const before = new Map(tiles.map((t) => [t, t.getBoundingClientRect()]));
  mutate();
  for (const t of tiles) {
    const f = before.get(t);
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

function setFeatured(tile) {
  flip(() => {
    if (featured && featured !== tile) featured.classList.remove("featured");
    if (featured === tile) {
      tile.classList.remove("featured");
      featured = null;
    } else {
      tile.classList.add("featured");
      featured = tile;
    }
  });
}

function markOffline(tile) {
  if (!tile.classList.contains("offline")) {
    tile.classList.add("offline");
    grid.appendChild(tile);
    updateStatus();
    const state = tile.querySelector(".state");
    if (state) state.textContent = "offline";
  }
}

function attachHls(video, cam, tile) {
  const onReady = () => {
    video.play().catch(() => {});
  };
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = cam.url;
    video.addEventListener("loadedmetadata", onReady, { once: true });
    video.addEventListener("error", () => markOffline(tile), { once: true });
  } else if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({
      capLevelToPlayerSize: true,
      maxBufferLength: 12,
      liveSyncDurationCount: 3,
    });
    hls.loadSource(cam.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, onReady);
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          markOffline(tile);
        }
      }
    });
    tile._hls = hls;
  } else {
    markOffline(tile);
  }
}

function buildTile(cam) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.dataset.id = cam.id;
  tile.tabIndex = 0;

  const state = document.createElement("div");
  state.className = "state";
  state.textContent = "loading";
  tile.appendChild(state);

  let media;
  if (cam.type === "hls") {
    media = document.createElement("video");
    media.muted = true;
    media.playsInline = true;
    media.autoplay = true;
    attachHls(media, cam, tile);
    media.addEventListener("playing", () => {
      state.remove();
      if (!tile.classList.contains("offline")) {
        liveCount++;
        tile.dataset.live = "1";
        updateStatus();
      }
    }, { once: true });
  } else if (cam.type === "iframe") {
    media = document.createElement("iframe");
    media.src = cam.url;
    media.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    media.loading = "lazy";
    media.addEventListener("load", () => {
      state.remove();
      liveCount++;
      updateStatus();
    }, { once: true });
  } else if (cam.type === "mjpeg") {
    media = document.createElement("img");
    media.className = "feed";
    media.src = cam.url;
    media.addEventListener("load", () => {
      state.remove();
      liveCount++;
      updateStatus();
    }, { once: true });
    media.addEventListener("error", () => markOffline(tile), { once: true });
  }
  tile.appendChild(media);

  if (cam.type === "hls") {
    const ICON_OFF =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
    const ICON_ON =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.4 5.6a9 9 0 0 1 0 12.8"/></svg>';
    const btn = document.createElement("button");
    btn.className = "mute-btn";
    btn.title = "Toggle sound";
    btn.innerHTML = ICON_OFF;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      media.muted = !media.muted;
      btn.innerHTML = media.muted ? ICON_OFF : ICON_ON;
    });
    tile.appendChild(btn);
  }

  const label = document.createElement("div");
  label.className = "label";
  const dot = document.createElement("span");
  dot.className = "live-dot";
  const name = document.createElement("span");
  name.textContent = cam.name;
  label.append(dot, name);
  if (cam.page) {
    const a = document.createElement("a");
    a.href = cam.page;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = cam.credit || "source";
    a.addEventListener("click", (e) => e.stopPropagation());
    label.appendChild(a);
  }
  tile.appendChild(label);

  const activate = () => {
    if (!tile.classList.contains("offline")) setFeatured(tile);
  };
  tile.addEventListener("click", activate);
  tile.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });
  return tile;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && featured) setFeatured(featured);
});

for (const cam of CAMS) grid.appendChild(buildTile(cam));
updateStatus();
