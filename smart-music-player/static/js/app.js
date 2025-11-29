function showToast(message) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);

  // Animate show
  setTimeout(() => toast.classList.add("show"), 100);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}


// helper to create elements quickly (not required)
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  });
  children.forEach(c => node.appendChild(c));
  return node;
}

const audio = document.getElementById("audioPlayer");
const seekBar = document.getElementById("seekBar");
const currentTimeText = document.getElementById("currentTime");
const totalTimeText = document.getElementById("totalTime");


/* DOM refs */
const songGrid = document.getElementById("songGrid");
const trendingList = document.getElementById("trendingList");
const audioPlayer = document.getElementById("audioPlayer");
const currentCover = document.getElementById("currentCover");
const currentTitle = document.getElementById("currentTitle");
const currentArtist = document.getElementById("currentArtist");
const playPauseBtn = document.getElementById("playPauseBtn");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");

const viewPlaylistBtn = document.getElementById("viewPlaylistBtn");
const viewLikedBtn = document.getElementById("viewLikedBtn");
const viewQueueBtn = document.getElementById("viewQueueBtn");

let isPlaying = false;
let currentSongTitle = null; // track current title for UI state

/* Load playlist and default view (playlist) */
async function loadPlaylistView() {
  const res = await fetch("/playlist");
  const songs = await res.json();
  renderSongGrid(songs, "playlist");
  await loadTrending();
}

async function loadLikedView() {
  const res = await fetch("/liked");
  const liked = await res.json();
  renderSongGrid(liked, "liked");
}

async function loadQueueView() {
  const res = await fetch("/queue");
  const data = await res.json();
  // For queue view, show titles only and a "play" button for each
  const queueTitles = data.queue;
  const fake = queueTitles.map(t => ({ title: t, artist: "", cover: "/static/images/believer.jpg", file: "" }));
  renderSongGrid(fake, "queue", queueTitles);
}

/* Render function for a list of songs */
function renderSongGrid(songs, mode = "playlist", extra = null) {
  songGrid.innerHTML = "";
  if (!songs.length) {
    songGrid.innerHTML = `<div style="color:var(--muted)">No songs to show.</div>`;
    return;
  }
  songs.forEach(s => {
    const card = el("div", { class: "card" });
    const img = el("img", { src: s.cover || "/static/images/believer.jpg", alt: s.title });
    const h = el("h4", { html: s.title });
    const p = el("p", { html: s.artist || "" });

    const btnRow = el("div", { class: "btn-row" });
    const playBtn = el("button", { class: "small-btn", html: "Play" });
    playBtn.onclick = () => playSong(s.title);

    const queueBtn = el("button", { class: "small-btn secondary", html: "Add to Queue" });
    queueBtn.onclick = () => addToQueue(s.title);

    const likeBtn = el("button", { class: "small-btn", html: "❤ Like" });
    likeBtn.onclick = () => likeSong(s.title);

    // If mode is "queue", extra is array of titles; show remove or play only
    if (mode === "queue") {
      // s.title might be empty if we created fake entries; use extra list
      const t = s.title || extra.shift();
      h.innerHTML = t;
      playBtn.onclick = () => playSong(t);
      btnRow.appendChild(playBtn);
      btnRow.appendChild(likeBtn);
    } else if (mode === "liked") {
      // liked items already have full song info; allow unlike
      const unlikeBtn = el("button", { class: "small-btn secondary", html: "Remove" });
      unlikeBtn.onclick = () => unlikeSong(s.title);
      btnRow.appendChild(playBtn);
      btnRow.appendChild(unlikeBtn);
    } else {
      // playlist default
      btnRow.appendChild(playBtn);
      btnRow.appendChild(queueBtn);
      btnRow.appendChild(likeBtn);
    }

    card.appendChild(img);
    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(btnRow);
    songGrid.appendChild(card);
  });
}

/* Play a song by title */
async function playSong(title) {
  const res = await fetch(`/play/${encodeURIComponent(title)}`, { method: "POST" });
  if (!res.ok) {
    alert((await res.json()).message || "Error playing song");
    return;
  }
  const data = await res.json();
  currentSongTitle = title;
  audioPlayer.src = data.file;
  audioPlayer.play();
  isPlaying = true;
  updatePlayerUI(data);
  await loadTrending(); // update trending display
}

audio.addEventListener("timeupdate", () => {
    if (!isNaN(audio.duration)) {
        const progress = (audio.currentTime / audio.duration) * 100;
        seekBar.value = progress;

        currentTimeText.textContent = formatTime(audio.currentTime);
        totalTimeText.textContent = formatTime(audio.duration);
    }
});


/* Update player UI */
function updatePlayerUI(data) {
  currentCover.src = data.cover || "/static/images/believer.jpg";
  currentTitle.textContent = data.title || currentSongTitle || "Playing";
  currentArtist.textContent = data.artist || "";
  playPauseBtn.textContent = "⏸";
}

/* Play / Pause button */
playPauseBtn.addEventListener("click", () => {
  if (!audioPlayer.src) return;
  if (audioPlayer.paused) {
    audioPlayer.play();
    playPauseBtn.textContent = "⏸";
  } else {
    audioPlayer.pause();
    playPauseBtn.textContent = "▶";
  }
});

/* Next / Prev handlers */
nextBtn.addEventListener("click", async () => {
  const res = await fetch("/next");
  const data = await res.json();
  if (!res.ok) {
    showToast(data.message);

    return;
  }
  currentSongTitle = data.file ? data.file : data.title;
  audioPlayer.src = data.file;
  audioPlayer.play();
  updatePlayerUI(data);
  await loadQueueView();
  await loadTrending();
});

prevBtn.addEventListener("click", async () => {
  const res = await fetch("/prev");
  const data = await res.json();
  if (!res.ok) {
    showToast(data.message);

    return;
  }
  audioPlayer.src = data.file;
  audioPlayer.play();
  updatePlayerUI(data);
  await loadTrending();
});

/* Add to queue */
async function addToQueue(title) {
  const res = await fetch(`/queue/${encodeURIComponent(title)}`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    alert(data.message);
    return;
  }
  showToast(data.message);
  await loadQueueView();
}

/* Like a song (stack push) */
async function likeSong(title) {
  const res = await fetch(`/like/${encodeURIComponent(title)}`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    alert(data.message);
    return;
  }
  showToast(data.message);
}

/* Unlike (remove from liked stack) */
async function unlikeSong(title) {
  const res = await fetch(`/unlike/${encodeURIComponent(title)}`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.message);
    return;
  }
  showToast(data.message);
  // Refresh liked view if visible
  if (document.getElementById("viewLikedBtn").classList.contains("active")) {
    loadLikedView();
  }
}

/* Trending loader */
async function loadTrending() {
  const res = await fetch("/trending");
  const list = await res.json();
  trendingList.innerHTML = "";
  list.forEach(s => {
    const d = document.createElement("div");
    d.className = "trend-item";
    d.innerHTML = `<img src="${s.cover}" style="width:38px;height:38px;border-radius:6px;margin-right:8px"> 
                   <div><div style="font-size:13px">${s.title}</div><div style="font-size:12px;color:var(--muted)">${s.artist}</div></div>`;
    trendingList.appendChild(d);
  });
}

/* Search */
async function searchSongs() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  if (!q) {
    loadPlaylistView();
    return;
  }
  const res = await fetch("/playlist");
  const songs = await res.json();
  const filtered = songs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  renderSongGrid(filtered, "playlist");
}

/* Sidebar buttons */
viewPlaylistBtn.addEventListener("click", () => { activateBtn(viewPlaylistBtn); loadPlaylistView(); });
viewLikedBtn.addEventListener("click", () => { activateBtn(viewLikedBtn); loadLikedView(); });
viewQueueBtn.addEventListener("click", () => { activateBtn(viewQueueBtn); loadQueueView(); });

function activateBtn(btn) {
  [viewPlaylistBtn, viewLikedBtn, viewQueueBtn].forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

seekBar.addEventListener("input", () => {
    if (!isNaN(audio.duration)) {
        const seekTo = (seekBar.value / 100) * audio.duration;
        audio.currentTime = seekTo;
    }
});

function formatTime(seconds) {
    seconds = Math.floor(seconds);
    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    if (secs < 10) secs = "0" + secs;
    return mins + ":" + secs;
}


/* initial load */
activateBtn(viewPlaylistBtn);
loadPlaylistView();
