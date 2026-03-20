// app.js — Main application logic for the lab pet-raising app

// ---------------------------------------------------------------------------
// Growth stage definitions
// ---------------------------------------------------------------------------
// threshold = points needed to enter this stage
const STAGES = [
  { name: 'Egg',     threshold: 0,    size: 80  },
  { name: 'Sprout',  threshold: 300, size: 100 },
  { name: 'Small',   threshold: 1000, size: 120 },
  { name: 'Growing', threshold: 2500, size: 150 },
  { name: 'Adult',   threshold: 5000, size: 180 },
];

// ---------------------------------------------------------------------------
// Feeding rate formula: f(n) = 2 * (1 - 0.5^n)
// Returns 0 when n=0, approaches 2 as n grows large
// ---------------------------------------------------------------------------
function feedingRate(n) {
  if (n === 0) return 0;
  return 2 * (1 - Math.pow(0.5, n));
}

// ---------------------------------------------------------------------------
// Growth stage lookup based on current points
// ---------------------------------------------------------------------------
function getStage(points) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (points >= STAGES[i].threshold) return { ...STAGES[i], index: i };
  }
  return { ...STAGES[0], index: 0 };
}

// ---------------------------------------------------------------------------
// Progress within the current stage (0–1)
// Progress is calculated between this stage's threshold and the next one's.
// ---------------------------------------------------------------------------
function getStageProgress(points) {
  const stage = getStage(points);
  const next = STAGES[stage.index + 1];
  if (!next) return 1; // already at max stage
  const range = next.threshold - stage.threshold;
  return (points - stage.threshold) / range;
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
  const stage = getStage(growthPoints);
  const progress = getStageProgress(growthPoints);
  const mood = getPetMood(presentCount, lastPresenceTime);
  const rate = feedingRate(presentCount);

  // --- Pet body ---
  const petEl = document.getElementById('pet');
  petEl.className = `pet stage-${stage.name.toLowerCase()} mood-${mood}`;
  petEl.style.width  = stage.size + 'px';
  petEl.style.height = stage.size + 'px';

  // Update face expression
  updatePetFace(mood, stage);

  // --- Stage label ---
  document.getElementById('stage-name').textContent = stage.name;

  // --- Progress bar ---
  const pct = Math.round(progress * 100);
  document.getElementById('progress-fill').style.width = pct + '%';
  const nextStage = STAGES[stage.index + 1];
  document.getElementById('progress-text').textContent = nextStage
    ? `${Math.floor(growthPoints)} / ${nextStage.threshold} pts`
    : `${Math.floor(growthPoints)} pts — fully grown!`;

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
  const members = memberStates;

  members.forEach((member, i) => {
    let avatarEl = document.getElementById(`avatar-${member.id}`);
    if (!avatarEl) return; // elements are pre-built in HTML

    const present = isPresent(member);
    avatarEl.className = 'avatar ' + (present ? 'present' : 'away');
  });
}

// ---------------------------------------------------------------------------
// Update pet face elements based on mood and stage
// ---------------------------------------------------------------------------
function updatePetFace(mood, stage) {
  const face = document.getElementById('pet-face');
  if (!face) return;

  // Clear extra decorations
  const existingExtras = document.querySelectorAll('.pet-extra');
  existingExtras.forEach(el => el.remove());

  // Update mouth
  const mouth = document.getElementById('pet-mouth');
  if (mouth) {
    mouth.className = 'mouth ' + mood;
  }

  // Update eyes
  const eyes = document.querySelectorAll('.eye');
  eyes.forEach(eye => {
    eye.className = 'eye ' + mood;
  });

  // Teardrop for sad state
  if (mood === 'sad') {
    const tear = document.createElement('div');
    tear.className = 'tear pet-extra';
    document.getElementById('pet').appendChild(tear);
  }

  // Heart for happy state (only sprout and above)
  if (mood === 'happy' && stage.index >= 1) {
    const heart = document.createElement('div');
    heart.className = 'heart pet-extra';
    document.getElementById('pet').appendChild(heart);
  }

  // Show/hide sprout feature
  const sprout = document.getElementById('pet-sprout');
  if (sprout) {
    sprout.style.display = stage.index >= 1 ? 'block' : 'none';
  }
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

    // Add growth points (capped at MAX_GROWTH_POINTS)
    growthPoints = Math.min(
      growthPoints + rate * CONFIG.GROWTH_PER_TICK,
      CONFIG.MAX_GROWTH_POINTS
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
