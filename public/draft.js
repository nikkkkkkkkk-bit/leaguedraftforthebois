const socket = io();

const params = new URLSearchParams(window.location.search);
const draftId = params.get("id");
const side = params.get("side");

const draftTitle = document.getElementById("draftTitle");
const phaseText = document.getElementById("phaseText");
const sideText = document.getElementById("sideText");
const timerBox = document.getElementById("timerBox");
const readyBtn = document.getElementById("readyBtn");
const readySection = document.getElementById("readySection");

const blueTeamName = document.getElementById("blueTeamName");
const redTeamName = document.getElementById("redTeamName");

const blueBans = document.getElementById("blueBans");
const redBans = document.getElementById("redBans");
const bluePicks = document.getElementById("bluePicks");
const redPicks = document.getElementById("redPicks");

const searchInput = document.getElementById("searchInput");
const championGrid = document.getElementById("championGrid");
const gragasBanAudio = new Audio("audio/gragas.mp3");
gragasBanAudio.volume = 0.7;

const blueTimerFill = document.getElementById("blueTimerFill");
const redTimerFill = document.getElementById("redTimerFill");

const roleButtons = document.querySelectorAll(".role-btn");
let activeRole = "all";

const roleMap = {
  top: [
    "Aatrox", "Camille", "Chogath", "Darius", "DrMundo", "Fiora", "Gangplank",
    "Garen", "Gnar", "Gwen", "Illaoi", "Irelia", "Jax", "Jayce", "Kennen",
    "Kled", "KSante", "Malphite", "Mordekaiser", "Nasus", "Olaf", "Ornn",
    "Pantheon", "Poppy", "Quinn", "Renekton", "Riven", "Rumble", "Sett",
    "Shen", "Singed", "Sion", "TahmKench", "Teemo", "Tryndamere", "Urgot",
    "Volibear", "Yone", "Yorick"
  ],

  jungle: [
    "Amumu", "Belveth", "Briar", "Diana", "Ekko", "Elise", "Evelynn", "FiddleSticks",
    "Gragas", "Graves", "Hecarim", "Ivern", "JarvanIV", "Karthus", "Kayn",
    "Khazix", "Kindred", "LeeSin", "Lillia", "Maokai", "MasterYi", "MonkeyKing",
    "Morgana", "Nidalee", "Nocturne", "Nunu", "Poppy", "Rammus", "RekSai",
    "Rengar", "Sejuani", "Shaco", "Shyvana", "Skarner", "Taliyah", "Trundle",
    "Udyr", "Viego", "Vi", "Volibear", "Warwick", "XinZhao", "Zac"
  ],

  mid: [
    "Ahri", "Akali", "Akshan", "Anivia", "Annie", "AurelionSol", "Azir",
    "Brand", "Cassiopeia", "Corki", "Diana", "Ekko", "Fizz", "Galio",
    "Hwei", "Kassadin", "Katarina", "LeBlanc", "Lissandra", "Lux", "Malzahar",
    "Naafiri", "Neeko", "Orianna", "Qiyana", "Ryze", "Swain", "Sylas",
    "Syndra", "Taliyah", "Talon", "TwistedFate", "Veigar", "Vex", "Viktor",
    "Vladimir", "Xerath", "Yasuo", "Yone", "Zed", "Ziggs", "Zoe"
  ],

  adc: [
    "Aphelios", "Ashe", "Caitlyn", "Draven", "Ezreal", "Jhin", "Jinx",
    "Kaisa", "Kalista", "KogMaw", "Lucian", "MissFortune", "Nilah", "Samira",
    "Sivir", "Smolder", "Tristana", "Twitch", "Varus", "Vayne", "Xayah",
    "Zeri", "Ziggs"
  ],

  support: [
    "Alistar", "Bard", "Blitzcrank", "Brand", "Braum", "Janna", "Karma",
    "Leona", "Lulu", "Lux", "Maokai", "Milio", "Morgana", "Nami", "Nautilus",
    "Neeko", "Poppy", "Pyke", "Rakan", "Rell", "Renata", "Senna", "Seraphine",
    "Sona", "Soraka", "Swain", "TahmKench", "Taric", "Thresh", "Velkoz",
    "Xerath", "Yuumi", "Zilean", "Zyra"
  ]
};

let playedGragasBanAudio = false;

let champions = [];
let version = "";
let currentDraft = null;

const draftOrder = [
  { team: "blue", type: "ban" },
  { team: "red", type: "ban" },
  { team: "blue", type: "ban" },
  { team: "red", type: "ban" },
  { team: "blue", type: "ban" },
  { team: "red", type: "ban" },

  { team: "blue", type: "pick" },
  { team: "red", type: "pick" },
  { team: "red", type: "pick" },
  { team: "blue", type: "pick" },
  { team: "blue", type: "pick" },
  { team: "red", type: "pick" },

  { team: "red", type: "ban" },
  { team: "blue", type: "ban" },
  { team: "red", type: "ban" },
  { team: "blue", type: "ban" },

  { team: "red", type: "pick" },
  { team: "blue", type: "pick" },
  { team: "blue", type: "pick" },
  { team: "red", type: "pick" }
];

async function loadChampions() {
  const versionResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions = await versionResponse.json();
  version = versions[0];

  const championResponse = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );

  const data = await championResponse.json();

  champions = Object.values(data.data).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  renderChampions();
}

function joinDraft() {
  if (!draftId || !side) {
    phaseText.textContent = "Invalid draft link.";
    return;
  }

  sideText.textContent = `You are viewing as ${side.toUpperCase()} side`;
  socket.emit("joinDraft", draftId);
}

socket.on("draftState", draft => {
  if (!draft) {
    phaseText.textContent = "Draft not found.";
    return;
  }

  currentDraft = draft;
  updateSideTimerBars();
  checkGragasBanAudio();

  blueTeamName.textContent = draft.blueName;
  redTeamName.textContent = draft.redName;
  draftTitle.textContent = `${draft.blueName} vs ${draft.redName}`;

  const bothReady = draft.ready.blue && draft.ready.red;

  if (!bothReady) {
    readySection.style.display = "flex";
    timerBox.style.display = "none";

    if (draft.ready[side]) {
      readyBtn.textContent = "WAITING FOR OTHER TEAM...";
      readyBtn.disabled = true;
    } else {
      readyBtn.textContent = "READY";
      readyBtn.disabled = false;
    }

    phaseText.textContent = "Waiting for both teams to ready up";
  } else {
    readySection.style.display = "none";
    timerBox.style.display = "flex";
    timerBox.textContent = draft.timeLeft;

    renderSlots();
    renderChampions();
    updatePhaseText();
    highlightActiveTeam();
  }
});

function renderSlots() {
  renderSlotGroup(blueBans, getItems("blue", "ban"), 5);
  renderSlotGroup(redBans, getItems("red", "ban"), 5);
  renderSlotGroup(bluePicks, getItems("blue", "pick"), 5);
  renderSlotGroup(redPicks, getItems("red", "pick"), 5);
}

function renderSlotGroup(container, items, count) {
  container.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";

    if (items[i] === null) {
      slot.innerHTML = `<span class="empty-slot">Skipped</span>`;
    } else if (items[i]) {
      slot.innerHTML = `
        <img 
          src="${getChampionImage(items[i].image.full)}" 
          title="${items[i].name}"
        >
      `;
    } else {
      slot.innerHTML = `<span class="empty-slot">Empty</span>`;
    }

    container.appendChild(slot);
  }
}

function getItems(team, type) {
  return currentDraft.history
    .filter(move => move.team === team && move.type === type)
    .map(move => move.champion);
}

function renderChampions() {
  if (!currentDraft || champions.length === 0) return;

  const searchTerm = searchInput.value.toLowerCase();
  championGrid.innerHTML = "";

  champions
    .filter(champ => {
      const matchesSearch = champ.name.toLowerCase().includes(searchTerm);

      const matchesRole =
        activeRole === "all" ||
        roleMap[activeRole]?.includes(champ.id);

      return matchesSearch && matchesRole;
    })
  .forEach(champ => {
      const card = document.createElement("div");
      card.className = "champion";

      const alreadySelected = currentDraft.selected.includes(champ.id);
      const currentStep = draftOrder[currentDraft.history.length];

      const bothReady = currentDraft.ready.blue && currentDraft.ready.red;
      const isMyTurn = bothReady && currentStep && currentStep.team === side;

      if (alreadySelected || !isMyTurn) {
        card.classList.add("disabled");
      }

      card.innerHTML = `
        <img src="${getChampionImage(champ.image.full)}" alt="${champ.name}">
        <span>${champ.name}</span>
      `;

      card.addEventListener("click", () => {
        socket.emit("selectChampion", {
          draftId,
          champion: champ,
          side
        });
      });

      championGrid.appendChild(card);
    });
}

function updatePhaseText() {
  if (!currentDraft) return;

  if (currentDraft.history.length >= draftOrder.length) {
    phaseText.textContent = "DRAFT COMPLETE";
    phaseText.className = "phase done";
    return;
  }

  const step = draftOrder[currentDraft.history.length];
  const teamName = step.team === "blue"
    ? currentDraft.blueName
    : currentDraft.redName;

  const isMyTurn = step.team === side;

  // BIG obvious text
  phaseText.textContent = isMyTurn
    ? `YOUR TURN — ${step.type.toUpperCase()}`
    : `${teamName.toUpperCase()} ${step.type.toUpperCase()}`;

  // apply color classes
  phaseText.className = `phase ${step.team} ${isMyTurn ? "your-turn" : ""}`;
}

function getChampionImage(fileName) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${fileName}`;
}

function highlightActiveTeam() {
  const step = draftOrder[currentDraft.history.length];
  if (!step) return;

  const blueTeam = document.querySelector(".team.blue");
  const redTeam = document.querySelector(".team.red");

  blueTeam.classList.remove("active-team");
  redTeam.classList.remove("active-team");

  if (step.team === "blue") {
    blueTeam.classList.add("active-team");
  } else {
    redTeam.classList.add("active-team");
  }
}

function checkGragasBanAudio() {
  if (!currentDraft || playedGragasBanAudio) return;

  const gragasWasBanned = currentDraft.history.some(move =>
    move.type === "ban" &&
    move.champion &&
    move.champion.id === "Gragas"
  );

  if (gragasWasBanned) {
    playedGragasBanAudio = true;

    gragasBanAudio.currentTime = 0;
    gragasBanAudio.play().catch(error => {
      console.log("Audio blocked until user interacts with the page:", error);
    });
  }
}

function updateSideTimerBars() {
  if (!currentDraft) return;

  const step = draftOrder[currentDraft.history.length];

  blueTimerFill.style.height = "0%";
  redTimerFill.style.height = "0%";

  if (!step || !currentDraft.started) return;

  const percentage = Math.max(
    0,
    Math.min(100, (currentDraft.timeLeft / currentDraft.timerSeconds) * 100)
  );

  if (step.team === "blue") {
    blueTimerFill.style.height = `${percentage}%`;
  } else {
    redTimerFill.style.height = `${percentage}%`;
  }
}

roleButtons.forEach(button => {
  button.addEventListener("click", () => {
    activeRole = button.dataset.role;

    searchInput.value = "";

    roleButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");

    renderChampions();
  });
});

searchInput.addEventListener("input", renderChampions);

readyBtn.addEventListener("click", () => {
  socket.emit("setReady", { draftId, side });
});

loadChampions();
joinDraft();
