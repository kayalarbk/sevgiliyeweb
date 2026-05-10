/**
 * player.js — Ambient music player for the love app.
 *
 * Two modes:
 *   • Local — Upload audio files from device (Object URL, no base64)
 *   • Spotify — Paste a Spotify link; rendered as an embed iframe
 *
 * Mode and Spotify URL are persisted in localStorage.
 * Public API: player.init()
 */
const player = (function () {

  const SPOTIFY_KEY      = 'love_spotify_url';
  const PLAYER_MODE_KEY  = 'love_player_mode';

  /* ── State ───────────────────────────────────────── */

  let tracks     = [];
  let currentIdx = 0;
  let isPlaying  = false;
  let playerMode = 'local';

  /* ── DOM references (populated in init) ─────────── */
  let audioEl, trackNameEl, btnPlayPause, btnPrev, btnNext;
  let progressEl, currentTimeEl, durationEl;

  /* ── Spotify URL parsing ─────────────────────────── */

  function parseSpotifyUrl(input) {
    const str = String(input || '').trim();
    /* https://open.spotify.com/track/ID or spotify:track:ID */
    let m = str.match(/open\.spotify\.com\/(track|playlist|album|artist)\/([A-Za-z0-9]+)/);
    if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`;
    m = str.match(/^spotify:(track|playlist|album|artist):([A-Za-z0-9]+)$/);
    if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`;
    return null;
  }

  /* ── Spotify panel states ────────────────────────── */

  function setSpotifyEmbed(embedUrl) {
    document.getElementById('spotifyFrame').src      = embedUrl;
    document.getElementById('spotifyEmbedWrap').style.display = '';
    document.getElementById('spotifyInputRow').style.display  = 'none';
    document.body.classList.add('spotify-embed-active');
  }

  function showSpotifyInput() {
    document.getElementById('spotifyFrame').src      = '';
    document.getElementById('spotifyEmbedWrap').style.display = 'none';
    document.getElementById('spotifyInputRow').style.display  = '';
    document.body.classList.remove('spotify-embed-active');
  }

  function handleSpotifySave() {
    const input    = document.getElementById('spotifyUrlInput');
    const embedUrl = parseSpotifyUrl(input.value);
    if (!embedUrl) {
      alert('Geçerli bir Spotify linki değil. Parça, playlist veya albüm linki girin.');
      return;
    }
    storage.setRaw(SPOTIFY_KEY, embedUrl);
    setSpotifyEmbed(embedUrl);
  }

  function handleSpotifyChange() {
    storage.remove(SPOTIFY_KEY);
    document.getElementById('spotifyUrlInput').value = '';
    showSpotifyInput();
  }

  /* ── Mode switching ──────────────────────────────── */

  function switchMode(mode) {
    playerMode = mode;
    const localPanel   = document.getElementById('playerLocalPanel');
    const spotifyPanel = document.getElementById('playerSpotifyPanel');
    const localBtn     = document.getElementById('playerModeLocal');
    const spotifyBtn   = document.getElementById('playerModeSpotify');

    if (mode === 'spotify') {
      localPanel.style.display   = 'none';
      spotifyPanel.style.display = '';
      localBtn.classList.remove('active');
      spotifyBtn.classList.add('active');
      storage.setRaw(PLAYER_MODE_KEY, 'spotify');

      const savedEmbed = storage.getRaw(SPOTIFY_KEY);
      if (savedEmbed) {
        setSpotifyEmbed(savedEmbed);
      } else {
        showSpotifyInput();
      }
    } else {
      localPanel.style.display   = '';
      spotifyPanel.style.display = 'none';
      localBtn.classList.add('active');
      spotifyBtn.classList.remove('active');
      storage.setRaw(PLAYER_MODE_KEY, 'local');
      document.body.classList.remove('spotify-embed-active');
    }
  }

  /* ── Local player helpers ────────────────────────── */

  function loadTrack(idx, autoPlay) {
    if (!tracks.length) return;
    currentIdx = ((idx % tracks.length) + tracks.length) % tracks.length;
    audioEl.src = tracks[currentIdx].url;
    trackNameEl.textContent = tracks[currentIdx].name;
    if (autoPlay) {
      startPlayback();
    } else {
      setPlayingUI(false);
    }
  }

  function startPlayback() {
    audioEl.play()
      .then(() => setPlayingUI(true))
      .catch(() => setPlayingUI(false));
  }

  function setPlayingUI(playing) {
    isPlaying = playing;
    btnPlayPause.textContent = playing ? '⏸' : '▶';
    btnPlayPause.classList.toggle('playing', playing);
    trackNameEl.classList.toggle('playing', playing);
  }

  function togglePlayPause() {
    if (!tracks.length) return;
    if (isPlaying) {
      audioEl.pause();
      setPlayingUI(false);
    } else {
      startPlayback();
    }
  }

  function prevTrack() { loadTrack(currentIdx - 1, isPlaying); }
  function nextTrack() { loadTrack(currentIdx + 1, isPlaying); }

  /* ── Progress bar ────────────────────────────────── */

  function formatTime(secs) {
    if (!isFinite(secs) || secs < 0) return '0:00';
    return Math.floor(secs / 60) + ':' + String(Math.floor(secs % 60)).padStart(2, '0');
  }

  function updateProgress() {
    if (!audioEl.duration) return;
    progressEl.value = (audioEl.currentTime / audioEl.duration) * 100;
    currentTimeEl.textContent = formatTime(audioEl.currentTime);
  }

  function handleMetadata() {
    durationEl.textContent    = formatTime(audioEl.duration);
    currentTimeEl.textContent = '0:00';
    progressEl.value          = 0;
  }

  function handleSeek() {
    if (!audioEl.duration) return;
    audioEl.currentTime = (progressEl.value / 100) * audioEl.duration;
  }

  /* ── Upload handler ──────────────────────────────── */

  function handleUpload(e) {
    const files   = Array.from(e.target.files);
    const wasEmpty = tracks.length === 0;
    files.forEach(file => {
      tracks.push({
        name: file.name.replace(/\.[^/.]+$/, ''),
        url:  URL.createObjectURL(file),
      });
    });
    if (wasEmpty && tracks.length) loadTrack(0, false);
    e.target.value = '';
  }

  /* ── Init ────────────────────────────────────────── */

  function init() {
    audioEl       = document.getElementById('audioElement');
    trackNameEl   = document.getElementById('trackName');
    btnPlayPause  = document.getElementById('btnPlayPause');
    btnPrev       = document.getElementById('btnPrev');
    btnNext       = document.getElementById('btnNext');
    progressEl    = document.getElementById('playerProgress');
    currentTimeEl = document.getElementById('playerCurrentTime');
    durationEl    = document.getElementById('playerDuration');
    const upload  = document.getElementById('audioUpload');

    if (!audioEl) return;

    /* Local player controls */
    btnPlayPause.addEventListener('click', togglePlayPause);
    btnPrev.addEventListener('click', prevTrack);
    btnNext.addEventListener('click', nextTrack);
    upload.addEventListener('change', handleUpload);
    audioEl.addEventListener('timeupdate',     updateProgress);
    audioEl.addEventListener('loadedmetadata', handleMetadata);
    progressEl.addEventListener('input',       handleSeek);
    audioEl.addEventListener('ended',          nextTrack);

    /* Mode switcher */
    document.getElementById('playerModeLocal').addEventListener('click',   () => switchMode('local'));
    document.getElementById('playerModeSpotify').addEventListener('click', () => switchMode('spotify'));

    /* Spotify controls */
    document.getElementById('spotifySaveBtn').addEventListener('click',   handleSpotifySave);
    document.getElementById('spotifyChangeBtn').addEventListener('click', handleSpotifyChange);
    document.getElementById('spotifyUrlInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') handleSpotifySave();
    });

    /* Player bar toggle */
    const toggleBtn = document.getElementById('btnTogglePlayer');
    const playerBar = document.getElementById('playerBar');
    if (toggleBtn && playerBar) {
      toggleBtn.addEventListener('click', () => {
        const hidden = playerBar.classList.toggle('player-hidden');
        document.body.classList.toggle('player-visible', !hidden);
      });
    }

    /* Restore persisted mode */
    const savedMode = storage.getRaw(PLAYER_MODE_KEY) || 'local';
    switchMode(savedMode);
  }

  return { init };

})();
