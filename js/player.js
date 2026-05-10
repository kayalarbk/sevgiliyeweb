/**
 * player.js — Ambient music player for the love app.
 *
 * Parçalar js/tracks.js dosyasındaki MUSIC_TRACKS dizisinden yüklenir.
 * Dosyalar müzikler/ klasöründe bulunmalıdır.
 * Public API: player.init()
 */
const player = (function () {

  let currentIdx = 0;
  let isPlaying  = false;

  let audioEl, trackNameEl, btnPlayPause, btnPrev, btnNext;
  let progressEl, currentTimeEl, durationEl;
  let trackSelectEl;

  /* ── Helpers ─────────────────────────────────────── */

  function trackUrl(file) {
    return 'müzikler/' + file;
  }

  function loadTrack(idx, autoPlay) {
    if (!MUSIC_TRACKS.length) return;
    currentIdx = ((idx % MUSIC_TRACKS.length) + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    const track = MUSIC_TRACKS[currentIdx];
    audioEl.src = trackUrl(track.file);
    trackNameEl.textContent = track.name;
    if (trackSelectEl) trackSelectEl.value = String(currentIdx);
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
    if (!MUSIC_TRACKS.length) return;
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

  /* ── Track selector ──────────────────────────────── */

  function buildTrackSelector() {
    if (!trackSelectEl) return;
    trackSelectEl.innerHTML = '';

    if (!MUSIC_TRACKS.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Henüz şarkı yok';
      trackSelectEl.appendChild(opt);
      trackSelectEl.disabled = true;
      return;
    }

    MUSIC_TRACKS.forEach((track, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = track.name;
      trackSelectEl.appendChild(opt);
    });

    trackSelectEl.disabled = false;
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
    trackSelectEl = document.getElementById('trackSelect');

    if (!audioEl) return;

    btnPlayPause.addEventListener('click', togglePlayPause);
    btnPrev.addEventListener('click', prevTrack);
    btnNext.addEventListener('click', nextTrack);
    audioEl.addEventListener('timeupdate',     updateProgress);
    audioEl.addEventListener('loadedmetadata', handleMetadata);
    progressEl.addEventListener('input',       handleSeek);
    audioEl.addEventListener('ended',          nextTrack);

    trackSelectEl.addEventListener('change', () => {
      const idx = parseInt(trackSelectEl.value, 10);
      if (!isNaN(idx)) loadTrack(idx, isPlaying);
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

    buildTrackSelector();
    if (MUSIC_TRACKS.length) loadTrack(0, false);
  }

  return { init };

})();
