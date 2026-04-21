(function main() {
  const pageDataElement = document.getElementById("page-data");
  const canvas = document.getElementById("game-canvas");

  if (!pageDataElement || !canvas) {
    return;
  }

  const pageData = JSON.parse(pageDataElement.textContent);
  const context = canvas.getContext("2d");

  const overlay = document.getElementById("game-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayCopy = document.getElementById("overlay-copy");
  const overlayScore = document.getElementById("overlay-score");
  const overlayBest = document.getElementById("overlay-best");
  const currentScoreElement = document.getElementById("current-score");
  const bestScoreElement = document.getElementById("best-score");
  const saveStatusElement = document.getElementById("save-status");
  const playAgainButton = document.getElementById("play-again-button");
  const leaderboardElement = document.getElementById("game-leaderboard");

  const state = {
    bestScore: typeof pageData.bestScore === "number" ? pageData.bestScore : null,
    ended: false,
    frame: 0,
    pipes: [],
    playToken: pageData.playToken || null,
    running: false,
    score: 0,
    waiting: true
  };

  const bird = {
    radius: 18,
    velocityY: 0,
    x: 120,
    y: canvas.height / 2
  };

  const constants = {
    flapStrength: -7.2,
    gapHeight: 170,
    gravity: 0.42,
    groundHeight: 88,
    pipeInterval: 94,
    pipeSpeed: 2.8,
    pipeWidth: 76
  };

  function formatBestScore(value) {
    return value === null || value === undefined ? "No score yet" : String(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setOverlay(title, copy) {
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    overlayScore.textContent = String(state.score);
    overlayBest.textContent = formatBestScore(state.bestScore);
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function setSaveStatus(message) {
    saveStatusElement.textContent = message;
  }

  function updateDisplayedScores() {
    currentScoreElement.textContent = String(state.score);
    bestScoreElement.textContent = formatBestScore(state.bestScore);
    overlayScore.textContent = String(state.score);
    overlayBest.textContent = formatBestScore(state.bestScore);
  }

  function renderLeaderboard(scores) {
    if (!scores || !scores.length) {
      leaderboardElement.innerHTML = '<div class="empty-state">No scores yet. Be the first to post one.</div>';
      return;
    }

    leaderboardElement.innerHTML = `
      <div class="leaderboard-list">
        ${scores
          .map((entry, index) => {
            const initials = entry.name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join("");
            const picture = entry.picture_url
              ? `<img class="avatar avatar-small" src="${escapeHtml(entry.picture_url)}" alt="${escapeHtml(entry.name)}" />`
              : `<div class="avatar avatar-small avatar-fallback">${escapeHtml(initials || "?")}</div>`;

            return `
              <div class="leaderboard-item">
                <div class="leaderboard-rank">#${index + 1}</div>
                <div class="leaderboard-player">
                  ${picture}
                  <div>
                    <strong>${escapeHtml(entry.name)}</strong>
                    <span>${escapeHtml(new Date(entry.created_at).toLocaleString())}</span>
                  </div>
                </div>
                <div class="leaderboard-score">${escapeHtml(entry.score)}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  async function requestPlayToken() {
    if (!pageData.canSaveScore) {
      state.playToken = null;
      return;
    }

    try {
      const response = await fetch(pageData.sessionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not start a new score-tracking session.");
      }

      state.playToken = payload.playToken;
      setSaveStatus("Ready to save");
    } catch (error) {
      state.playToken = null;
      setSaveStatus(error.message);
    }
  }

  function resetBird() {
    bird.velocityY = 0;
    bird.x = 120;
    bird.y = canvas.height / 2 - 40;
  }

  function resetGame() {
    state.ended = false;
    state.frame = 0;
    state.pipes = [];
    state.running = false;
    state.score = 0;
    state.waiting = true;

    resetBird();
    updateDisplayedScores();
    setOverlay("Press play to start", "Keep the bird airborne and fly through the gaps.");
    requestPlayToken();
  }

  function startRun() {
    if (state.ended) {
      resetGame();
      return;
    }

    state.running = true;
    state.waiting = false;
    hideOverlay();
  }

  function flap() {
    if (!state.running) {
      startRun();
    }

    bird.velocityY = constants.flapStrength;
  }

  function spawnPipe() {
    const margin = 120;
    const gapY = margin + Math.random() * (canvas.height - constants.groundHeight - margin * 2);

    state.pipes.push({
      gapY,
      passed: false,
      x: canvas.width + 40
    });
  }

  function intersectsPipe(pipe) {
    const birdTop = bird.y - bird.radius;
    const birdBottom = bird.y + bird.radius;
    const birdLeft = bird.x - bird.radius;
    const birdRight = bird.x + bird.radius;
    const topPipeBottom = pipe.gapY - constants.gapHeight / 2;
    const bottomPipeTop = pipe.gapY + constants.gapHeight / 2;
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + constants.pipeWidth;

    const hitsTopPipe =
      birdRight > pipeLeft &&
      birdLeft < pipeRight &&
      birdTop < topPipeBottom;
    const hitsBottomPipe =
      birdRight > pipeLeft &&
      birdLeft < pipeRight &&
      birdBottom > bottomPipeTop;

    return hitsTopPipe || hitsBottomPipe;
  }

  function endRun() {
    if (state.ended) {
      return;
    }

    state.running = false;
    state.ended = true;

    if (state.score > 0 && pageData.canSaveScore) {
      submitScore();
    } else if (!pageData.canSaveScore) {
      setSaveStatus("Sign in with Google to save your score.");
    } else {
      setSaveStatus("Score must be at least 1 point to save.");
      requestPlayToken();
    }

    setOverlay("Game over", "Play again to chase a better run.");
  }

  async function submitScore() {
    if (!state.playToken) {
      setSaveStatus("Could not save this run. Start a new game to get a fresh session.");
      return;
    }

    setSaveStatus("Saving score...");

    try {
      const response = await fetch(pageData.scoreSubmissionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          playToken: state.playToken,
          score: state.score
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not save the score.");
      }

      state.bestScore = payload.personalBest;
      state.playToken = null;
      updateDisplayedScores();
      renderLeaderboard(payload.leaderboard);
      setSaveStatus(`Saved. Personal best: ${payload.personalBest}. Total runs: ${payload.totalGames}.`);
      requestPlayToken();
    } catch (error) {
      setSaveStatus(error.message);
    }
  }

  function updateGame() {
    if (!state.running) {
      return;
    }

    state.frame += 1;
    bird.velocityY += constants.gravity;
    bird.y += bird.velocityY;

    if (state.frame % constants.pipeInterval === 0) {
      spawnPipe();
    }

    state.pipes = state.pipes.filter((pipe) => pipe.x + constants.pipeWidth > -20);

    for (const pipe of state.pipes) {
      pipe.x -= constants.pipeSpeed;

      if (!pipe.passed && pipe.x + constants.pipeWidth < bird.x) {
        pipe.passed = true;
        state.score += 1;
        updateDisplayedScores();
      }

      if (intersectsPipe(pipe)) {
        endRun();
      }
    }

    if (bird.y + bird.radius >= canvas.height - constants.groundHeight || bird.y - bird.radius <= 0) {
      endRun();
    }
  }

  function drawBackground() {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#79d8ff");
    gradient.addColorStop(0.65, "#dff7ff");
    gradient.addColorStop(1, "#e8fbff");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "rgba(255, 255, 255, 0.7)";
    for (let index = 0; index < 4; index += 1) {
      const offset = (state.frame * (0.2 + index * 0.04) + index * 110) % (canvas.width + 120);
      const x = canvas.width - offset;
      const y = 90 + index * 70;
      context.beginPath();
      context.arc(x, y, 26, 0, Math.PI * 2);
      context.arc(x + 28, y - 8, 20, 0, Math.PI * 2);
      context.arc(x + 52, y, 24, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawGround() {
    context.fillStyle = "#5db36d";
    context.fillRect(0, canvas.height - constants.groundHeight, canvas.width, constants.groundHeight);
    context.fillStyle = "#4a9859";
    context.fillRect(0, canvas.height - constants.groundHeight, canvas.width, 18);
  }

  function drawPipe(pipe) {
    const topHeight = pipe.gapY - constants.gapHeight / 2;
    const bottomY = pipe.gapY + constants.gapHeight / 2;

    context.fillStyle = "#11a36c";
    context.fillRect(pipe.x, 0, constants.pipeWidth, topHeight);
    context.fillRect(pipe.x, bottomY, constants.pipeWidth, canvas.height - bottomY - constants.groundHeight);

    context.fillStyle = "#0d8557";
    context.fillRect(pipe.x - 4, topHeight - 18, constants.pipeWidth + 8, 18);
    context.fillRect(pipe.x - 4, bottomY, constants.pipeWidth + 8, 18);
  }

  function drawBird() {
    context.save();
    context.translate(bird.x, bird.y);
    context.rotate(Math.max(-0.4, Math.min(0.7, bird.velocityY * 0.05)));

    context.fillStyle = "#f59e0b";
    context.beginPath();
    context.arc(0, 0, bird.radius, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#fcd34d";
    context.beginPath();
    context.ellipse(-4, 3, 10, 8, -0.3, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#111827";
    context.beginPath();
    context.arc(6, -4, 2.6, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#f97316";
    context.beginPath();
    context.moveTo(16, 1);
    context.lineTo(30, -4);
    context.lineTo(16, -9);
    context.closePath();
    context.fill();

    context.restore();
  }

  function drawScore() {
    context.fillStyle = "rgba(15, 23, 42, 0.14)";
    context.fillRect(18, 18, 116, 46);
    context.fillStyle = "#102033";
    context.font = "700 26px 'Trebuchet MS', sans-serif";
    context.fillText(`Score ${state.score}`, 28, 49);
  }

  function draw() {
    drawBackground();
    state.pipes.forEach(drawPipe);
    drawGround();
    drawBird();
    drawScore();
  }

  function loop() {
    updateGame();
    draw();
    requestAnimationFrame(loop);
  }

  function handlePrimaryAction(event) {
    if (event.type === "keydown" && event.code !== "Space" && event.code !== "ArrowUp") {
      return;
    }

    if (event.type === "keydown") {
      event.preventDefault();
    }

    if (state.ended) {
      resetGame();
      startRun();
      flap();
      return;
    }

    flap();
  }

  document.addEventListener("keydown", handlePrimaryAction);
  canvas.addEventListener("pointerdown", handlePrimaryAction);
  playAgainButton.addEventListener("click", () => {
    if (state.ended || state.waiting) {
      resetGame();
      startRun();
      flap();
      return;
    }

    flap();
  });

  renderLeaderboard(Array.isArray(pageData.leaderboard) ? pageData.leaderboard : []);
  resetGame();
  draw();
  requestAnimationFrame(loop);
})();
