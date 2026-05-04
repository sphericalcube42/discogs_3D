let ytPlayer;
let ytPlaylist = [];
let ytIndex = 0;
let isYTReady = false;
let isPlaying = false;

export function initYTPlayer(videoId) {
  if (ytPlayer && isYTReady) {
    ytPlayer.loadVideoById(videoId);
    return;
  }

  ytPlayer = new YT.Player('yt-player', {
    height: '0',
    width: '0',
    videoId: videoId,
    events: {
      onReady: () => {
        isYTReady = true;
      },

      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING) {
          isPlaying = true;
          updatePlayButton(true);
        }

        if (e.data === YT.PlayerState.PAUSED ||
            e.data === YT.PlayerState.ENDED) {
          isPlaying = false;
          updatePlayButton(false);
        }

        if (e.data === YT.PlayerState.ENDED) {
          nextTrack();
        }
      }
    }
  });
}

export function playTrack() {
  ytPlayer?.playVideo();
}

export function pauseTrack() {
  ytPlayer?.pauseVideo();
}

function updatePlayButton(state) {
  const btn = document.getElementById("yt-toggle");
  if (!btn) return;

  btn.textContent = state ? "⏸" : "▶";
}

//progress logic

let progressInterval = null;
let isSeeking = false;

function formatTime(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function startProgressUpdates() {
  if (progressInterval) clearInterval(progressInterval);

  progressInterval = setInterval(() => {
    if (!ytPlayer || isSeeking) return;

    const current = ytPlayer.getCurrentTime();
    const duration = ytPlayer.getDuration();

    if (!duration) return;

    const percent = (current / duration) * 100;

    const seek = document.getElementById("yt-seek");
    const currentEl = document.getElementById("yt-current");
    const durationEl = document.getElementById("yt-duration");

    if (seek) seek.value = percent;
    if (currentEl) currentEl.textContent = formatTime(current);
    if (durationEl) durationEl.textContent = formatTime(duration);

  }, 500);
}

export function setupSeekBar() {
  const seek = document.getElementById("yt-seek");

  if (!seek) return;

  seek.addEventListener("input", () => {
    isSeeking = true;
  });

  seek.addEventListener("change", () => {
    const duration = ytPlayer.getDuration();
    const newTime = (seek.value / 100) * duration;

    ytPlayer.seekTo(newTime, true);
    isSeeking = false;
  });
}

export function setPlaylist(list) {
  ytPlaylist = list;
  ytIndex = 0;

  if (isYTReady && ytPlayer) {
    ytPlayer.cueVideoById(ytPlaylist[0].id); // loads but does NOT play
  }
}

export function renderPlaylist() {
  const container = document.getElementById("yt-playlist");
  if (!container) return;

  container.innerHTML = ytPlaylist.map((track, i) => `
    <div class="yt-track ${i === ytIndex ? "active" : ""}" data-index="${i}">
      ${track.title || "Track " + (i + 1)}
    </div>
  `).join("");

  container.querySelectorAll(".yt-track").forEach(el => {
    el.onclick = () => {
      ytIndex = parseInt(el.dataset.index);
      safeLoad(ytPlaylist[ytIndex].id);
      updateTitle(ytPlaylist[ytIndex]?.title || "Unknown");
    };
  });
}

function updateTitle(text) {
  const el = document.getElementById("yt-title");

  el.textContent = text;

  document.querySelectorAll(".yt-track").forEach((el, i) => { el.classList.toggle("active", i === ytIndex); });

  requestAnimationFrame(() => {
    const wrapper = el.parentElement;

    const isOverflowing = el.scrollWidth > wrapper.clientWidth;

    if (isOverflowing) {
      el.classList.add("scroll");
    } else {
      el.classList.remove("scroll");
    }
  });
}

function safeLoad(id){
  if (!isYTReady || !ytPlayer) return;

  ytPlayer.loadVideoById(id);
}

export function nextTrack() {
  ytIndex = (ytIndex + 1) % ytPlaylist.length;
  safeLoad(ytPlaylist[ytIndex].id);
  updateTitle(ytPlaylist[ytIndex]?.title || "Unknown");
}

export function prevTrack() {
  ytIndex = (ytIndex - 1 + ytPlaylist.length) % ytPlaylist.length;
  safeLoad(ytPlaylist[ytIndex].id);
  updateTitle(ytPlaylist[ytIndex]?.title || "Unknown");
}

export function setupToggle() {
  const btn = document.getElementById("yt-toggle");

  btn.onclick = () => {
    const state = ytPlayer.getPlayerState();

    if (isPlaying) {
      ytPlayer.pauseVideo();
      isPlaying = false;
      btn.textContent = "▶";
    } else {
      ytPlayer.playVideo();
      isPlaying = true;
      btn.textContent = "⏸";
    }
  };
}

export function extractVideoId(url) {
  const match = url.match(/v=([^&]+)/);
  return match ? match[1] : null;
}