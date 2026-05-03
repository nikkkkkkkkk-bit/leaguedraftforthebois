const createBtn = document.getElementById("createBtn");
const generateTeamsBtn = document.getElementById("generateTeamsBtn");
const pickCaptainsBtn = document.getElementById("pickCaptainsBtn");

const blueNameInput = document.getElementById("blueName");
const redNameInput = document.getElementById("redName");
const timerSecondsInput = document.getElementById("timerSeconds");

const playersInput = document.getElementById("playersInput");
const playersFile = document.getElementById("playersFile");

const balanceByRank = document.getElementById("balanceByRank");
const captainsByRank = document.getElementById("captainsByRank");

const generatedTeamsBox = document.getElementById("generatedTeams");
const generatedBlueTeam = document.getElementById("generatedBlueTeam");
const generatedRedTeam = document.getElementById("generatedRedTeam");

const captainsOnlyBox = document.getElementById("captainsOnlyBox");
const captainsOnlyText = document.getElementById("captainsOnlyText");

const linksBox = document.getElementById("links");
const blueLink = document.getElementById("blueLink");
const redLink = document.getElementById("redLink");

const rankValues = {
  iron: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
  platinum: 5,
  emerald: 6,
  diamond: 7,
  master: 8,
  grandmaster: 9,
  challenger: 10
};

playersFile.addEventListener("change", async () => {
  const file = playersFile.files[0];
  if (!file) return;

  const text = await file.text();
  playersInput.value = text;
});

pickCaptainsBtn.addEventListener("click", () => {
  const players = parsePlayers(playersInput.value);

  if (players.length < 2) {
    alert("Add at least 2 players.");
    return;
  }

  const captains = captainsByRank.checked
    ? pickRankBasedCaptains(players)
    : pickRandomCaptains(players);

  captainsOnlyText.textContent =
    `${captains[0].name} (${captains[0].rank}) vs ${captains[1].name} (${captains[1].rank})`;

  blueNameInput.value = `${captains[0].name}'s Team`;
  redNameInput.value = `${captains[1].name}'s Team`;

  captainsOnlyBox.classList.remove("hidden");
});

generateTeamsBtn.addEventListener("click", () => {
  const players = parsePlayers(playersInput.value);

  if (players.length < 2) {
    alert("Add at least 2 players.");
    return;
  }

  const teams = balanceByRank.checked
    ? generateRankBalancedTeams(players)
    : generateFullyRandomTeams(players);

  renderGeneratedTeams(teams);
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

function parsePlayers(text) {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(",");

      return {
        name: parts[0]?.trim(),
        rank: parts[1]?.trim() || "Unranked",
        score: getRankScore(parts[1] || "")
      };
    })
    .filter(p => p.name);
}

function getRankScore(rank) {
  const clean = rank.toLowerCase();

  for (const key in rankValues) {
    if (clean.includes(key)) return rankValues[key];
  }

  return 0;
}

function pickRandomCaptains(players) {
  return shuffleArray(players).slice(0, 2);
}

function pickRankBasedCaptains(players) {
  const sorted = shuffleArray(players).sort((a, b) => b.score - a.score);
  const pool = sorted.slice(0, Math.max(2, Math.ceil(sorted.length / 2)));
  return shuffleArray(pool).slice(0, 2);
}

function generateFullyRandomTeams(players) {
  const shuffled = shuffleArray(players);

  return {
    blue: shuffled.filter((_, i) => i % 2 === 0),
    red: shuffled.filter((_, i) => i % 2 !== 0)
  };
}

function generateRankBalancedTeams(players) {
  const sorted = shuffleArray(players).sort((a, b) => b.score - a.score);

  const blue = [];
  const red = [];

  let blueScore = 0;
  let redScore = 0;

  sorted.forEach(player => {
    if (blue.length < 5 && (blueScore <= redScore || red.length >= 5)) {
      blue.push(player);
      blueScore += player.score;
    } else {
      red.push(player);
      redScore += player.score;
    }
  });

  return { blue, red };
}

function renderGeneratedTeams(teams) {
  generatedBlueTeam.innerHTML = "";
  generatedRedTeam.innerHTML = "";

  teams.blue.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name} — ${p.rank}`;
    generatedBlueTeam.appendChild(li);
  });

  teams.red.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name} — ${p.rank}`;
    generatedRedTeam.appendChild(li);
  });

  generatedTeamsBox.classList.remove("hidden");
}

function shuffleArray(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function copyLink(id) {
  const input = document.getElementById(id);
  input.select();
  navigator.clipboard.writeText(input.value);
}
