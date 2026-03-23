// app.js — Main application logic for the lab pet-raising app

// ---------------------------------------------------------------------------
// Level system
// ---------------------------------------------------------------------------
// Returns { level, progress, size, isMax }
function getLevel(points) {
  const maxPoints = CONFIG.POINTS_PER_LEVEL * CONFIG.MAX_LEVEL;
  const level     = Math.min(Math.floor(points / CONFIG.POINTS_PER_LEVEL) + 1, CONFIG.MAX_LEVEL);
  const isMax     = points >= maxPoints;
  const progress  = isMax ? 1 : (points % CONFIG.POINTS_PER_LEVEL) / CONFIG.POINTS_PER_LEVEL;
  const size      = 80 + (level - 1) * 10; // 80px at Lv.1 → 170px at Lv.10
  return { level, progress, size, isMax };
}

// ---------------------------------------------------------------------------
// Feeding rate formula: f(n) = 2 * (1 - 0.5^n)
// Returns 0 when n=0, approaches 2 as n grows large
// ---------------------------------------------------------------------------
function feedingRate(n) {
  if (n === 0) return 0;
  return 2 * (1 - Math.pow(0.5, n));
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
function loadState() {
  return {
    growthPoints: parseFloat(localStorage.getItem('petGrowthPoints')) || 0,
    lastPresenceTime: parseInt(localStorage.getItem('lastPresenceTime')) || null,
    memberStates: JSON.parse(localStorage.getItem('memberStates') || 'null'),
  };
}

function saveState(growthPoints, lastPresenceTime, memberStates) {
  localStorage.setItem('petGrowthPoints', String(growthPoints));
  if (lastPresenceTime !== null) {
    localStorage.setItem('lastPresenceTime', String(lastPresenceTime));
  }
  localStorage.setItem('memberStates', JSON.stringify(memberStates));
}

// ---------------------------------------------------------------------------
// Determine pet mood: 'happy' | 'neutral' | 'sad'
// ---------------------------------------------------------------------------
function getPetMood(presentCount, lastPresenceTime) {
  const now = Date.now();
  const thresholdMs = CONFIG.SADNESS_THRESHOLD_HOURS * 3600000;

  if (presentCount > 0) {
    return 'happy';
  }

  // Nobody present — check how long it has been
  if (lastPresenceTime === null || (now - lastPresenceTime) > thresholdMs) {
    return 'sad';
  }

  return 'neutral';
}

// ---------------------------------------------------------------------------
// Render: update all DOM elements to reflect current state
// ---------------------------------------------------------------------------
function render(growthPoints, memberStates, presentCount, lastPresenceTime) {
  const { level, progress, size, isMax } = getLevel(growthPoints);
  const mood = getPetMood(presentCount, lastPresenceTime);
  const rate = feedingRate(presentCount);

  // --- Pet image ---
  const petEl = document.getElementById('pet');
  const src = mood === 'happy' ? 'imgs/noiman-happy.png'
            : mood === 'sad'   ? 'imgs/noiman-sad.png'
            :                    'imgs/noiman-base.png';
  petEl.src = src;
  petEl.className = `pet mood-${mood}`;
  petEl.style.width  = size + 'px';
  petEl.style.height = size + 'px';

  // --- Level label ---
  document.getElementById('stage-name').textContent = `Lv.${level}`;

  // --- Progress bar ---
  const pct = Math.round(progress * 100);
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = isMax
    ? `${Math.floor(growthPoints)} pts — fully grown!`
    : `${Math.floor(growthPoints)} / ${level * CONFIG.POINTS_PER_LEVEL} pts`;

  // --- Feeding rate indicator ---
  const feedEl = document.getElementById('feeding-rate');
  if (presentCount === 0) {
    feedEl.textContent = '😴 nobody home';
    feedEl.className = 'feeding-rate sleeping';
  } else {
    feedEl.textContent = `🩷 +${rate.toFixed(2)} (${presentCount}人在室)`;
    feedEl.className = 'feeding-rate active';
  }

  // --- Member avatars ---
  renderAvatars(memberStates);

  // --- Growth points total (small detail line) ---
  const totalEl = document.getElementById('total-points');
  if (totalEl) {
    totalEl.textContent = `Total: ${Math.floor(growthPoints)} pts`;
  }
}

// ---------------------------------------------------------------------------
// Build or update member avatar elements
// ---------------------------------------------------------------------------
function renderAvatars(memberStates) {
  const container = document.getElementById('member-ring');
  if (!memberStates || memberStates.length === 0) return;

  const total = memberStates.length;

  // Ellipse params matching scene layout
  const cx = 211, cy = 211, rx = 172, ry = 150;
  const startAngleDeg = -90;

  memberStates.forEach((member, i) => {
    const angleDeg = startAngleDeg + (360 / total) * i;
    const angleRad = angleDeg * Math.PI / 180;
    const x = Math.round(cx + rx * Math.cos(angleRad) - 24); // -24 = half of 48px avatar
    const y = Math.round(cy + ry * Math.sin(angleRad) - 24);

    const present = isPresent(member);

    let avatarEl = document.getElementById(`avatar-${member.id}`);
    if (!avatarEl) {
      // Create new avatar element
      avatarEl = document.createElement('div');
      avatarEl.id = `avatar-${member.id}`;
      avatarEl.title = `ID: ${member.id}`;
      avatarEl.style.left = x + 'px';
      avatarEl.style.top  = y + 'px';

      // Try user photo; fall back to initials
      const img = document.createElement('img');
      img.src = `imgs/users/id-${member.id}.jpeg`;
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
      img.onerror = function () {
        if (!this.dataset.triedJpg) {
          this.dataset.triedJpg = '1';
          this.src = `imgs/users/id-${member.id}.jpg`;
        } else if (!this.dataset.triedPng) {
          this.dataset.triedPng = '1';
          this.src = `imgs/users/id-${member.id}.png`;
        } else if (!this.dataset.triedWebp) {
          this.dataset.triedWebp = '1';
          this.src = `imgs/users/id-${member.id}.webp`;
        } else {
          this.remove();
          if (!avatarEl.textContent) avatarEl.textContent = member.name || member.id;
        }
      };
      avatarEl.appendChild(img);
      container.appendChild(avatarEl);
    }

    avatarEl.className = 'avatar ' + (present ? 'present' : 'away');
  });
}


// ---------------------------------------------------------------------------
// Feeding animation: particles fly from present member avatars to the pet
// ---------------------------------------------------------------------------
function spawnFoodParticle(avatarEl, sceneEl, petEl) {
  const sceneRect = sceneEl.getBoundingClientRect();
  const avatarRect = avatarEl.getBoundingClientRect();
  const petRect    = petEl.getBoundingClientRect();

  // Center of avatar and pet, relative to the scene element
  const startX = avatarRect.left + avatarRect.width  / 2 - sceneRect.left;
  const startY = avatarRect.top  + avatarRect.height / 2 - sceneRect.top;
  const endX   = petRect.left    + petRect.width     / 2 - sceneRect.left;
  const endY   = petRect.top     + petRect.height    / 2 - sceneRect.top;

  const particle = document.createElement('div');
  particle.className = 'food-particle';
  particle.textContent = '♥';
  particle.style.left = (startX - 7) + 'px'; // -7 = approx half of glyph width
  particle.style.top  = (startY - 7) + 'px';
  sceneEl.appendChild(particle);

  const anim = particle.animate([
    { transform: 'translate(0, 0) scale(1)',                              opacity: 1 },
    { transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0.3)`, opacity: 0 },
  ], { duration: 2800, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });

  anim.onfinish = () => particle.remove();
}

function triggerFeedingAnimation() {
  const presentAvatars = document.querySelectorAll('.avatar.present');
  if (presentAvatars.length === 0) return;

  const sceneEl = document.querySelector('.scene');
  const petEl   = document.getElementById('pet');

  // Stagger each particle by 100ms so they don't all launch simultaneously
  presentAvatars.forEach((avatarEl, i) => {
    setTimeout(() => spawnFoodParticle(avatarEl, sceneEl, petEl), i * 100);
  });

  // Pet bounce timed to when the first particle arrives (~halfway through flight)
  const bounceDelay = Math.floor(presentAvatars.length / 2) * 100 + 2000;
  setTimeout(() => {
    petEl.classList.add('eating');
    petEl.addEventListener('animationend', () => petEl.classList.remove('eating'), { once: true });
  }, bounceDelay);
}

// ---------------------------------------------------------------------------
// Main poll tick: fetch presence, update growth, save, re-render
// ---------------------------------------------------------------------------
async function tick() {
  let { growthPoints, lastPresenceTime, memberStates } = loadState();

  try {
    const members = await fetchPresence();
    memberStates = members;

    const presentCount = members.filter(isPresent).length;
    const rate = feedingRate(presentCount);

    // Add growth points (capped at max level)
    growthPoints = Math.min(
      growthPoints + rate * CONFIG.GROWTH_PER_TICK,
      CONFIG.POINTS_PER_LEVEL * CONFIG.MAX_LEVEL
    );

    // Update last presence timestamp if anyone is home
    if (presentCount > 0) {
      lastPresenceTime = Date.now();
    }

    saveState(growthPoints, lastPresenceTime, memberStates);
    render(growthPoints, memberStates, presentCount, lastPresenceTime);
    triggerFeedingAnimation();

    // Update last-updated timestamp
    const tsEl = document.getElementById('last-updated');
    if (tsEl) {
      let d = new Date();
      tsEl.textContent = 'Updated: ' + d.getHours() + '時' + d.getMinutes() + '分';
    }

  } catch (err) {
    console.error('Failed to fetch presence data:', err);
    // Still render with cached data so the UI doesn't go blank
    if (memberStates) {
      const presentCount = memberStates.filter(isPresent).length;
      render(growthPoints, memberStates, presentCount, lastPresenceTime);
    }
  }
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------
function init() {
  // Render immediately with stored state while we wait for first API call
  const { growthPoints, lastPresenceTime, memberStates } = loadState();
  if (memberStates) {
    const presentCount = memberStates.filter(isPresent).length;
    render(growthPoints, memberStates, presentCount, lastPresenceTime);
  }

  // First poll immediately, then on interval
  tick();
  setInterval(tick, CONFIG.POLL_INTERVAL_MS);

}

// Start the app once the DOM is ready
document.addEventListener('DOMContentLoaded', init);
