const socket = io();

const playerNameInput = document.getElementById("playerName");
const createQueueBtn = document.getElementById("createQueueBtn");
const joinQueueBtn = document.getElementById("joinQueueBtn");
const queueCodeInput = document.getElementById("queueCodeInput");
const errorText = document.getElementById("errorText");

const createBtn = document.getElementById("createBtn");
const blueNameInput = document.getElementById("blueName");
const redNameInput = document.getElementById("redName");
const timerSecondsInput = document.getElementById("timerSeconds");
const linksBox = document.getElementById("links");
const blueLink = document.getElementById("blueLink");
const redLink = document.getElementById("redLink");

let playerId = sessionStorage.getItem("playerId");

if (!playerId) {
  playerId = crypto.randomUUID();
  sessionStorage.setItem("playerId", playerId);
}

function cleanName(value) {
  return value.replace(/[^a-zA-Z0-9]/g, "");
}

function showError(message) {
  errorText.textContent = message;
}

playerNameInput.addEventListener("input", () => {
  playerNameInput.value = cleanName(playerNameInput.value);
});

queueCodeInput.addEventListener("input", () => {
  queueCodeInput.value = queueCodeInput.value
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
});

createQueueBtn.addEventListener("click", () => {
  const playerName = cleanName(playerNameInput.value.trim());

  if (!playerName) {
    showError("Enter a name first.");
    return;
  }

  socket.emit("createQueue", { playerName, playerId });
});

joinQueueBtn.addEventListener("click", () => {
  const playerName = cleanName(playerNameInput.value.trim());
  const code = queueCodeInput.value.trim().toUpperCase();

  if (!playerName) {
    showError("Enter a name first.");
    return;
  }

  if (code.length !== 5) {
    showError("Enter a 5-letter queue code.");
    return;
  }

  socket.emit("joinQueue", { code, playerName, playerId });
});

socket.on("queueCreated", ({ code }) => {
  const playerName = cleanName(playerNameInput.value.trim());
  sessionStorage.setItem("playerName", playerName);
  window.location.href = `queue.html?code=${code}`;
});

socket.on("queueJoined", ({ code }) => {
  const playerName = cleanName(playerNameInput.value.trim());
  sessionStorage.setItem("playerName", playerName);
  window.location.href = `queue.html?code=${code}`;
});

socket.on("queueError", message => {
  showError(message);
});

createBtn.addEventListener("click", async () => {
  const blueName = blueNameInput.value || "Blue Team";
  const redName = redNameInput.value || "Red Team";
  const timerSeconds = timerSecondsInput.value || 55;

  const response = await fetch("/api/create-draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ blueName, redName, timerSeconds })
  });

  const data = await response.json();
  const baseUrl = window.location.origin;

  blueLink.value = `${baseUrl}/draft.html?id=${data.id}&side=blue`;
  redLink.value = `${baseUrl}/draft.html?id=${data.id}&side=red`;

  linksBox.classList.remove("hidden");
});

function copyLink(id) {
  const input = document.getElementById(id);
  input.select();
  navigator.clipboard.writeText(input.value);
}
