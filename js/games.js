/**
 * games.js — "Oyunlarımız" section
 *
 * Implements:
 *   • A game menu that switches to individual game views
 *   • Drag-and-drop (+ click-to-swap) photo puzzle
 *   • Confetti animation on completion
 *   • Secret note / video reveal modal
 *   • Puzzle settings (note + video URL) persisted in localStorage
 *
 * Public API: gamesModule.init()
 */
const gamesModule = (function () {

  const PUZZLE_SETTINGS_KEY = 'love_puzzle_settings';

  /* ── State ───────────────────────────────────────── */

  let puzzleImageUrl   = '';
  let puzzleGrid       = 3;
  let puzzleSlots      = [];     // puzzleSlots[slotIndex] = pieceId
  let dragSourceSlot   = null;
  let selectedSlotEl   = null;

  /* ── Puzzle settings ─────────────────────────────── */

  function loadSettings() {
    try {
      const raw = localStorage.getItem(PUZZLE_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function saveSettings(s) {
    try { localStorage.setItem(PUZZLE_SETTINGS_KEY, JSON.stringify(s)); } catch (_) {}
  }

  /* ── Game menu / area toggle ─────────────────────── */

  function showMenu() {
    document.getElementById('gamesMenu').style.display = '';
    document.getElementById('gameArea').style.display  = 'none';
  }

  function showGameArea(gameId) {
    document.getElementById('gamesMenu').style.display = 'none';
    const area = document.getElementById('gameArea');
    area.style.display = '';
    area.innerHTML = '';
    if (gameId === 'puzzle') renderPuzzleUI(area);
  }

  /* ── Puzzle UI ───────────────────────────────────── */

  function renderPuzzleUI(container) {
    container.innerHTML = `
      <div class="puzzle-toolbar">
        <button class="puzzle-back-btn" id="puzzleBack" type="button">← Oyunlar</button>
        <span class="puzzle-title" id="puzzleTitle">🧩 Fotoğraf Puzzle</span>
        <span style="width:80px"></span>
      </div>
      <div class="puzzle-setup" id="puzzleSetup">
        <div class="puzzle-url-row">
          <input type="url" id="puzzleImageUrl" class="puzzle-url-input"
                 placeholder="Fotoğraf URL'si girin…" />
          <label class="puzzle-file-label" for="puzzleImageFile">📁 Dosya Seç</label>
          <input type="file" id="puzzleImageFile" accept="image/*" class="hidden-input" />
        </div>
        <div class="puzzle-grid-choice">
          <label class="puzzle-radio-label">
            <input type="radio" name="puzzleGrid" value="3" checked /> 3×3 (9 parça)
          </label>
          <label class="puzzle-radio-label">
            <input type="radio" name="puzzleGrid" value="4" /> 4×4 (16 parça)
          </label>
        </div>
        <button class="btn-save-memory puzzle-start-btn" id="puzzleStart" type="button">
          Puzzle'ı Başlat
        </button>
      </div>
      <div class="puzzle-game" id="puzzleGame" style="display:none">
        <div class="puzzle-grid" id="puzzleGrid"></div>
        <div class="puzzle-actions">
          <button class="puzzle-reset-btn" id="puzzleReset" type="button">🔀 Yeniden Karıştır</button>
        </div>
      </div>
    `;

    document.getElementById('puzzleBack').addEventListener('click', showMenu);
    document.getElementById('puzzleStart').addEventListener('click', handleStart);

    /* Gizli ayarlar erişimi: başlığa hızlıca 5 kez tıkla */
    let titleClicks = 0;
    let titleTimer  = null;
    document.getElementById('puzzleTitle').addEventListener('click', () => {
      titleClicks++;
      clearTimeout(titleTimer);
      if (titleClicks >= 5) { titleClicks = 0; openSettings(); return; }
      titleTimer = setTimeout(() => { titleClicks = 0; }, 2000);
    });
    document.getElementById('puzzleReset').addEventListener('click', () => {
      buildPuzzle(puzzleImageUrl, puzzleGrid);
    });

    document.getElementById('puzzleImageFile').addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        document.getElementById('puzzleImageUrl').value = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function handleStart() {
    const url = document.getElementById('puzzleImageUrl').value.trim();
    if (!url) {
      alert('Lütfen bir fotoğraf URL\'si girin veya dosya seçin.');
      return;
    }
    const checked = document.querySelector('input[name="puzzleGrid"]:checked');
    puzzleGrid = checked ? parseInt(checked.value, 10) : 3;
    puzzleImageUrl = url;
    buildPuzzle(url, puzzleGrid);
  }

  /* ── Puzzle builder ──────────────────────────────── */

  function buildPuzzle(imageUrl, grid) {
    const setup   = document.getElementById('puzzleSetup');
    const game    = document.getElementById('puzzleGame');
    const gridEl  = document.getElementById('puzzleGrid');

    gridEl.innerHTML = '<p class="puzzle-loading">Yükleniyor…</p>';
    game.style.display  = '';
    setup.style.display = 'none';

    selectedSlotEl = null;

    const img = new Image();
    img.onload = function () {
      gridEl.innerHTML = '';
      gridEl.style.aspectRatio =
        `${img.naturalWidth} / ${img.naturalHeight}`;
      gridEl.style.gridTemplateColumns = `repeat(${grid}, 1fr)`;
      gridEl.style.gridTemplateRows    = `repeat(${grid}, 1fr)`;

      const total = grid * grid;
      puzzleSlots = Array.from({ length: total }, (_, i) => i);
      shuffleArr(puzzleSlots);

      const frag = document.createDocumentFragment();
      for (let slot = 0; slot < total; slot++) {
        const pieceId = puzzleSlots[slot];
        const slotEl  = document.createElement('div');
        slotEl.className      = 'puzzle-slot';
        slotEl.dataset.slotId = slot;

        const pieceEl = makePiece(pieceId, grid, imageUrl);
        slotEl.appendChild(pieceEl);
        frag.appendChild(slotEl);
      }
      gridEl.appendChild(frag);

      setupInteraction();
    };

    img.onerror = function () {
      game.style.display  = 'none';
      setup.style.display = '';
      alert(
        'Fotoğraf yüklenemedi. Lütfen geçerli bir URL girin veya farklı bir dosya seçin.'
      );
    };

    img.src = imageUrl;
  }

  /* Creates a puzzle piece div using CSS background */
  function makePiece(pieceId, grid, imageUrl) {
    const col = pieceId % grid;
    const row = Math.floor(pieceId / grid);
    const pctX = grid === 1 ? 0 : (col * 100) / (grid - 1);
    const pctY = grid === 1 ? 0 : (row * 100) / (grid - 1);

    const div = document.createElement('div');
    div.className        = 'puzzle-piece';
    div.dataset.pieceId  = pieceId;
    div.draggable        = true;
    div.style.backgroundImage    = `url("${imageUrl}")`;
    div.style.backgroundSize     = `${grid * 100}% ${grid * 100}%`;
    div.style.backgroundPosition = `${pctX}% ${pctY}%`;
    return div;
  }

  /* ── Shuffle ─────────────────────────────────────── */

  function shuffleArr(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ── Interaction: drag-and-drop + click-to-swap ──── */

  function setupInteraction() {
    const slots  = document.querySelectorAll('#puzzleGrid .puzzle-slot');
    const pieces = document.querySelectorAll('#puzzleGrid .puzzle-piece');

    /* Drag-and-drop */
    pieces.forEach(piece => {
      piece.addEventListener('dragstart', e => {
        dragSourceSlot = piece.parentElement;
        e.dataTransfer.effectAllowed = 'move';
        piece.classList.add('dragging');
      });
      piece.addEventListener('dragend', () => {
        piece.classList.remove('dragging');
        dragSourceSlot = null;
        slots.forEach(s => s.classList.remove('drag-over'));
      });
    });

    slots.forEach(slot => {
      slot.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        slot.classList.add('drag-over');
      });
      slot.addEventListener('dragleave', e => {
        if (!slot.contains(e.relatedTarget)) slot.classList.remove('drag-over');
      });
      slot.addEventListener('drop', e => {
        e.preventDefault();
        slot.classList.remove('drag-over');
        if (dragSourceSlot && dragSourceSlot !== slot) swapSlots(dragSourceSlot, slot);
        dragSourceSlot = null;
      });

      /* Click-to-swap (works on mobile too) */
      slot.addEventListener('click', () => {
        if (selectedSlotEl === null) {
          selectedSlotEl = slot;
          slot.classList.add('selected');
        } else if (selectedSlotEl === slot) {
          slot.classList.remove('selected');
          selectedSlotEl = null;
        } else {
          swapSlots(selectedSlotEl, slot);
          selectedSlotEl.classList.remove('selected');
          selectedSlotEl = null;
        }
      });
    });
  }

  /* Swaps pieces between two slot elements and updates state */
  function swapSlots(slotA, slotB) {
    const pieceA = slotA.querySelector('.puzzle-piece');
    const pieceB = slotB.querySelector('.puzzle-piece');

    if (pieceA && pieceB) {
      slotA.appendChild(pieceB);
      slotB.appendChild(pieceA);
    } else if (pieceA) {
      slotB.appendChild(pieceA);
    } else if (pieceB) {
      slotA.appendChild(pieceB);
    }

    const si = parseInt(slotA.dataset.slotId, 10);
    const sj = parseInt(slotB.dataset.slotId, 10);
    [puzzleSlots[si], puzzleSlots[sj]] = [puzzleSlots[sj], puzzleSlots[si]];

    checkSolved();
  }

  /* ── Solved check ────────────────────────────────── */

  function checkSolved() {
    const slots = document.querySelectorAll('#puzzleGrid .puzzle-slot');
    for (let i = 0; i < slots.length; i++) {
      const piece = slots[i].querySelector('.puzzle-piece');
      if (!piece || parseInt(piece.dataset.pieceId, 10) !== parseInt(slots[i].dataset.slotId, 10)) {
        return;
      }
    }
    slots.forEach(s => s.classList.add('correct'));
    onSolved();
  }

  function onSolved() {
    spawnConfetti();
    setTimeout(() => {
      const s = loadSettings();
      const noteEl  = document.getElementById('puzzleCompleteNote');
      const vWrap   = document.getElementById('puzzleVideoWrap');
      const vFrame  = document.getElementById('puzzleVideoFrame');

      noteEl.textContent = s.note || '🎉 Puzzle\'ı tamamladın! Tebrikler!';

      if (s.videoUrl) {
        vFrame.src           = s.videoUrl;
        vWrap.style.display  = '';
      } else {
        vFrame.src           = '';
        vWrap.style.display  = 'none';
      }

      document.getElementById('puzzleCompleteModal').classList.add('open');
      document.body.style.overflow = 'hidden';
    }, 700);
  }

  /* ── Confetti ────────────────────────────────────── */

  function spawnConfetti() {
    const colors = [
      '#e91e8c', '#ff5722', '#ffeb3b', '#4caf50',
      '#2196f3', '#9c27b0', '#ff4081', '#00bcd4', '#ff9800'
    ];
    for (let i = 0; i < 130; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-particle';
      const size = 6 + Math.random() * 9;
      p.style.cssText = `
        left:${Math.random() * 100}vw;
        background-color:${colors[Math.floor(Math.random() * colors.length)]};
        animation-delay:${Math.random() * 2.5}s;
        animation-duration:${2.5 + Math.random() * 2.5}s;
        width:${size}px;
        height:${size}px;
        border-radius:${Math.random() > 0.45 ? '50%' : '3px'};
        transform:rotate(${Math.random() * 360}deg);
      `;
      document.body.appendChild(p);
      p.addEventListener('animationend', () => p.remove(), { once: true });
    }
  }

  /* ── Settings modal ──────────────────────────────── */

  function openSettings() {
    const s = loadSettings();
    document.getElementById('puzzleSecretNote').value  = s.note     || '';
    document.getElementById('puzzleSecretVideo').value = s.videoUrl || '';
    document.getElementById('puzzleSettingsModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSettings() {
    document.getElementById('puzzleSettingsModal').classList.remove('open');
    document.body.style.overflow = '';
  }

  function closePuzzleComplete() {
    document.getElementById('puzzleCompleteModal').classList.remove('open');
    document.getElementById('puzzleVideoFrame').src = '';
    document.body.style.overflow = '';
  }

  /* ── Init ────────────────────────────────────────── */

  function init() {
    if (!document.getElementById('gamesMenu')) return;

    document.querySelectorAll('.game-card-btn').forEach(btn => {
      btn.addEventListener('click', () => showGameArea(btn.dataset.game));
    });

    /* Settings modal */
    document.getElementById('closePuzzleSettings').addEventListener('click', closeSettings);
    document.getElementById('puzzleSettingsForm').addEventListener('submit', e => {
      e.preventDefault();
      saveSettings({
        note:     document.getElementById('puzzleSecretNote').value,
        videoUrl: document.getElementById('puzzleSecretVideo').value.trim()
      });
      closeSettings();
    });

    /* Complete modal */
    document.getElementById('closePuzzleComplete').addEventListener('click', closePuzzleComplete);

    /* Overlay clicks */
    const sOverlay = document.getElementById('puzzleSettingsModal');
    sOverlay.addEventListener('click', e => { if (e.target === sOverlay) closeSettings(); });
    const cOverlay = document.getElementById('puzzleCompleteModal');
    cOverlay.addEventListener('click', e => { if (e.target === cOverlay) closePuzzleComplete(); });

    /* Escape key */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeSettings();
        closePuzzleComplete();
      }
    });
  }

  return { init };

})();
