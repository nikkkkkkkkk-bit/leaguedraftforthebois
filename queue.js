const socket = io();

const params = new URLSearchParams(window.location.search);
const code = params.get("code");

const queueCodeText = document.getElementById("queueCodeText");
const copyQueueCodeBtn = document.getElementById("copyQueueCodeBtn");

const queueCountText = document.getElementById("queueCountText");
const queueProgressFill = document.getElementById("queueProgressFill");
const playersList = document.getElementById("playersList");
const queueMessage = document.getElementById("queueMessage");

const acceptBox = document.getElementById("acceptBox");
const acceptBtn = document.getElementById("acceptBtn");

const captainBox = document.getElementById("captainBox");
const turnText = document.getElementById("turnText");
const playerPool = document.getElementById("playerPool");
const blueTeamList = document.getElementById("blueTeamList");
const redTeamList = document.getElementById("redTeamList");

const playerId = sessionStorage.getItem("playerId");

if (!code) {
  queueMessage.textContent = "Invalid queue link.";
} else {
  queueCodeText.textContent = code.toUpperCase();
  socket.emit("joinQueueRoom", { code, playerId });
}

copyQueueCodeBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(code.toUpperCase());
  copyQueueCodeBtn.textContent = "Copied!";

  setTimeout(() => {
    copyQueueCodeBtn.textContent = "Copy Code";
  }, 1200);
});

acceptBtn.addEventListener("click", () => {
  socket.emit("acceptQueue", { code, playerId });
  acceptBtn.textContent = "Accepted";
  acceptBtn.disabled = true;
});

socket.on("queueState", queue => {
  if (!queue) {
    queueMessage.textContent = "Queue not found.";
    return;
  }

  queueCodeText.textContent = queue.code;

  renderQueuePlayers(queue);
  renderQueueStatus(queue);
  renderAcceptBox(queue);
  renderCaptainDraft(queue);
});

socket.on("queueError", message => {
  queueMessage.textContent = message;
});

function renderQueueStatus(queue) {
  const count = getTotalPlayerCount(queue);

  queueCountText.textContent = `Players: ${count} / 10`;
  queueProgressFill.style.width = `${Math.min(100, (count / 10) * 100)}%`;

  if (queue.status === "waiting") {
    queueMessage.textContent =
      count < 10
        ? `Waiting for ${10 - count} more player${10 - count === 1 ? "" : "s"}...`
        : "Queue full.";
  }

  if (queue.status === "accepting") {
    queueMessage.textContent = "Match found. Waiting for everyone to accept.";
  }

  if (queue.status === "captain") {
    queueMessage.textContent = "Captains are drafting teams.";
  }

  if (queue.status === "done") {
    queueMessage.textContent = "Teams are ready.";
  }
}

function renderQueuePlayers(queue) {
  playersList.innerHTML = "";

  const allPlayers = [
    ...(queue.blueTeam || []),
    ...(queue.redTeam || []),
    ...(queue.players || [])
  ];

  allPlayers.forEach((player, index) => {
    const li = document.createElement("li");

    const acceptedText =
      queue.status === "accepting"
        ? player.accepted
          ? "Accepted"
          : "Waiting"
        : player.id === queue.hostId
          ? "Host"
          : "Player";

    li.innerHTML = `
      <span>${index + 1}. ${player.name}</span>
      <small>${acceptedText}</small>
    `;

    playersList.appendChild(li);
  });
}

function renderAcceptBox(queue) {
  if (queue.status === "accepting") {
    acceptBox.classList.remove("hidden");
  } else {
    acceptBox.classList.add("hidden");
  }
}

function renderCaptainDraft(queue) {
  if (queue.status !== "captain" && queue.status !== "done") {
    captainBox.classList.add("hidden");
    return;
  }

  captainBox.classList.remove("hidden");

  renderTeamList(blueTeamList, queue.blueTeam || []);
  renderTeamList(redTeamList, queue.redTeam || []);

  playerPool.innerHTML = "";

  if (queue.status === "done") {
    turnText.textContent = "Teams ready";
    return;
  }

  const currentCaptainId = queue.pickOrder[queue.pickIndex];
  const isMyTurn = currentCaptainId === playerId;

  const currentCaptain =
    [...(queue.blueTeam || []), ...(queue.redTeam || [])]
      .find(player => player.id === currentCaptainId);

  turnText.textContent = isMyTurn
    ? "YOUR PICK"
    : `${currentCaptain?.name || "Captain"} is picking`;

  queue.players.forEach(player => {
    const button = document.createElement("button");
    button.textContent = player.name;
    button.disabled = !isMyTurn;

    button.addEventListener("click", () => {
      socket.emit("pickPlayer", {
      code,
      targetId: player.id,
      playerId
    });
    });

    playerPool.appendChild(button);
  });
}

function renderTeamList(container, players) {
  container.innerHTML = "";

  players.forEach((player, index) => {
    const li = document.createElement("li");
    li.textContent = index === 0
      ? `${player.name} 👑 Captain`
      : player.name;

    container.appendChild(li);
  });
}

function getTotalPlayerCount(queue) {
  return (
    (queue.players?.length || 0) +
    (queue.blueTeam?.length || 0) +
    (queue.redTeam?.length || 0)
  );
}