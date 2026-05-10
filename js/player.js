/**
 * player.js — Ambient music player for the love app.
 *
 * Supports uploading multiple audio files (no server required — uses
 * Object URLs created from File objects), play/pause toggle, previous/next
 * track navigation, and automatic advance to the next track on song end.
 *
 * Public API:  player.init()
 */
const player = (function () {

  /* ── State ───────────────────────────────────────── */

  let tracks     = [];   // [{ name: string, url: string }]
  let currentIdx = 0;
  let isPlaying  = false;

  /* ── DOM references (populated in init) ─────────── */
  let audioEl, trackNameEl, btnPlayPause, btnPrev, btnNext;
  let progressEl, currentTimeEl, durationEl;

  /* ── Internal helpers ────────────────────────────── */

  /**
   * Loads a track at the given (possibly out-of-bounds) index.
   * Wraps around the playlist using modulo arithmetic.
   * @param {number}  idx       - Raw index (will be normalised).
   * @param {boolean} autoPlay  - If true, begins playback after loading.
   */
  function loadTrack(idx, autoPlay) {
    if (!tracks.length) return;

    // Wrap safely in both directions
    currentIdx = ((idx % tracks.length) + tracks.length) % tracks.length;

    audioEl.src = tracks[currentIdx].url;
    trackNameEl.textContent = tracks[currentIdx].name;

    if (autoPlay) {
      startPlayback();
    } else {
      setPlayingUI(false);
    }
  }

  /** Calls audio.play() and updates UI to "playing" state. */
  function startPlayback() {
    audioEl.play()
      .then(() => setPlayingUI(true))
      .catch(() => {
        // Autoplay blocked by browser — update state without throwing
        setPlayingUI(false);
      });
  }

  /** Syncs button icon / CSS classes to the current playing state. */
  function setPlayingUI(playing) {
    isPlaying = playing;
    btnPlayPause.textContent = playing ? '⏸' : '▶';
    btnPlayPause.classList.toggle('playing', playing);
    trackNameEl.classList.toggle('playing', playing);
  }

  /* ── Controls ────────────────────────────────────── */

  /** Toggles between play and pause. */
  function togglePlayPause() {
    if (!tracks.length) return;

    if (isPlaying) {
      audioEl.pause();
      setPlayingUI(false);
    } else {
      startPlayback();
    }
  }

  /** Jumps to the previous track, maintaining current play state. */
  function prevTrack() {
    loadTrack(currentIdx - 1, isPlaying);
  }

  /** Jumps to the next track, maintaining current play state. */
  function nextTrack() {
    loadTrack(currentIdx + 1, isPlaying);
  }

  /* ── Progress bar ────────────────────────────────── */

  /** Converts a duration in seconds to an "m:ss" display string. */
  function formatTime(secs) {
    if (!isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  /** Syncs the progress bar and current-time label to audio.currentTime. */
  function updateProgress() {
    if (!audioEl.duration) return;
    const pct = (audioEl.currentTime / audioEl.duration) * 100;
    progressEl.value = pct;
    currentTimeEl.textContent = formatTime(audioEl.currentTime);
  }

  /** Called when audio metadata loads — sets the max and shows total duration. */
  function handleMetadata() {
    progressEl.max = 100;
    durationEl.textContent = formatTime(audioEl.duration);
    currentTimeEl.textContent = '0:00';
    progressEl.value = 0;
  }

  /** Seeks audio to the position chosen via the range slider. */
  function handleSeek() {
    if (!audioEl.duration) return;
    audioEl.currentTime = (progressEl.value / 100) * audioEl.duration;
  }

  /* ── Upload handler ──────────────────────────────── */

  /**
   * Processes files from the <input type="file" multiple>.
   * Creates Object URLs (efficient, in-memory, no base64 overhead) and
   * strips the file extension from the display name.
   *
   * Note: Object URLs are tied to the page session and are revoked when the
   * tab closes, which is the desired behaviour for in-browser playback.
   */
  function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const wasEmpty = tracks.length === 0;

    files.forEach(file => {
      tracks.push({
        name: file.name.replace(/\.[^/.]+$/, ''),  // strip extension
        url:  URL.createObjectURL(file),
      });
    });

    // Auto-load the first track of the new batch if playlist was empty
    if (wasEmpty) loadTrack(0, false);

    // Reset input so the same file list can be re-selected later
    e.target.value = '';
  }

  /* ── Public init ─────────────────────────────────── */

  /**
   * Binds all event listeners and caches DOM references.
   * Must be called after the DOM is ready.
   */
  function init() {
    audioEl        = document.getElementById('audioElement');
    trackNameEl    = document.getElementById('trackName');
    btnPlayPause   = document.getElementById('btnPlayPause');
    btnPrev        = document.getElementById('btnPrev');
    btnNext        = document.getElementById('btnNext');
    progressEl     = document.getElementById('playerProgress');
    currentTimeEl  = document.getElementById('playerCurrentTime');
    durationEl     = document.getElementById('playerDuration');
    const upload   = document.getElementById('audioUpload');

    if (!audioEl) return;

    btnPlayPause.addEventListener('click', togglePlayPause);
    btnPrev.addEventListener('click', prevTrack);
    btnNext.addEventListener('click', nextTrack);
    upload.addEventListener('change', handleUpload);

    // Toggle player bar visibility
    const toggleBtn = document.getElementById('btnTogglePlayer');
    const playerBar = document.getElementById('playerBar');
    if (toggleBtn && playerBar) {
      toggleBtn.addEventListener('click', () => {
        const hidden = playerBar.classList.toggle('player-hidden');
        document.body.classList.toggle('player-visible', !hidden);
      });
    }

    // Progress bar events
    audioEl.addEventListener('timeupdate',    updateProgress);
    audioEl.addEventListener('loadedmetadata', handleMetadata);
    progressEl.addEventListener('input',      handleSeek);

    // Auto-advance when a track reaches its natural end
    audioEl.addEventListener('ended', nextTrack);
  }

  return { init };

})();
