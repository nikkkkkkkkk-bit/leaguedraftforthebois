const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());

const drafts = {};
const timers = {};
const queues = {};
const acceptTimers = {};

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

function createQueueCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";

  do {
    code = "";
    for (let i = 0; i < 5; i++) {
      code += letters[Math.floor(Math.random() * letters.length)];
    }
  } while (queues[code]);

  return code;
}

function isValidName(name) {
  return /^[a-zA-Z0-9]+$/.test(name);
}

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

app.post("/api/create-draft", (req, res) => {
  const { blueName, redName, timerSeconds } = req.body;
  const seconds = Number(timerSeconds) || 55;
  const id = Math.random().toString(36).substring(2, 10);

  drafts[id] = {
    id,
    blueName: blueName || "Blue Team",
    redName: redName || "Red Team",
    timerSeconds: seconds,
    timeLeft: seconds,
    history: [],
    selected: [],
    ready: { blue: false, red: false },
    started: false
  };

  res.json({ id });
});

function startTimer(draftId) {
  clearInterval(timers[draftId]);

  const draft = drafts[draftId];
  if (!draft) return;

  draft.started = true;

  if (draft.history.length >= draftOrder.length) {
    draft.timeLeft = 0;
    io.to(draftId).emit("draftState", draft);
    return;
  }

  draft.timeLeft = draft.timerSeconds;
  io.to(draftId).emit("draftState", draft);

  timers[draftId] = setInterval(() => {
    const draft = drafts[draftId];
    if (!draft) return;

    draft.timeLeft--;

    if (draft.timeLeft <= 0) {
      clearInterval(timers[draftId]);

      const step = draftOrder[draft.history.length];

      if (step) {
        draft.history.push({
          team: step.team,
          type: step.type,
          champion: null
        });
      }

      startTimer(draftId);
      return;
    }

    io.to(draftId).emit("draftState", draft);
  }, 1000);
}

function startAcceptPhase(code) {
  const queue = queues[code];
  if (!queue || queue.status !== "waiting") return;

  queue.status = "accepting";
  queue.players.forEach(player => {
    player.accepted = false;
  });

  io.to(code).emit("queueState", queue);

  clearTimeout(acceptTimers[code]);

  acceptTimers[code] = setTimeout(() => {
    const q = queues[code];
    if (!q || q.status !== "accepting") return;

    q.players = q.players.filter(player => player.accepted);
    q.status = "waiting";

    io.to(code).emit("queueState", q);
  }, 15000);
}

function startCaptainDraft(code) {
  const queue = queues[code];
  if (!queue) return;

  queue.status = "captain";

  const realPlayers = queue.players.filter(
    player => !String(player.id).startsWith("BOT_")
  );

  const captainPool = realPlayers.length >= 2
    ? realPlayers
    : queue.players;

  const shuffledCaptains = shuffleArray(captainPool);

  const blueCaptain = shuffledCaptains[0];
  const redCaptain = shuffledCaptains[1];

  queue.blueTeam = [blueCaptain];
  queue.redTeam = [redCaptain];

  queue.players = queue.players.filter(
    player => player.id !== blueCaptain.id && player.id !== redCaptain.id
  );

  queue.pickIndex = 0;

  queue.pickOrder = [
    blueCaptain.id,
    redCaptain.id,
    redCaptain.id,
    blueCaptain.id,
    blueCaptain.id,
    redCaptain.id,
    redCaptain.id,
    blueCaptain.id
  ];

  io.to(code).emit("queueState", queue);
}

io.on("connection", socket => {
  socket.on("createQueue", ({ playerName, playerId }) => {
    const cleanName = String(playerName || "").trim();

    if (!isValidName(cleanName) || !playerId) {
      socket.emit("queueError", "Name can only use letters and numbers.");
      return;
    }

    const code = createQueueCode();

    queues[code] = {
      code,
      hostId: playerId,
      status: "waiting",
      players: [
        {
          id: playerId,
          socketId: socket.id,
          name: cleanName,
          accepted: false
        }
      ],
      blueTeam: [],
      redTeam: [],
      pickOrder: [],
      pickIndex: 0
    };

    socket.join(code);
    socket.emit("queueCreated", { code });
    io.to(code).emit("queueState", queues[code]);
  });

  socket.on("joinQueue", ({ code, playerName, playerId }) => {
    const cleanCode = String(code || "").trim().toUpperCase();
    const cleanName = String(playerName || "").trim();

    if (!isValidName(cleanName) || !playerId) {
      socket.emit("queueError", "Name can only use letters and numbers.");
      return;
    }

    const queue = queues[cleanCode];

    if (!queue) {
      socket.emit("queueError", "Queue not found.");
      return;
    }

    if (queue.status !== "waiting") {
      socket.emit("queueError", "Queue has already started.");
      return;
    }

    if (queue.players.length >= 10) {
      socket.emit("queueError", "Queue is already full.");
      return;
    }

    const idTaken = queue.players.some(player => player.id === playerId);

    if (idTaken) {
      socket.emit("queueError", "This browser tab is already in the queue.");
      return;
    }

    const nameTaken = queue.players.some(
      player => player.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (nameTaken) {
      socket.emit("queueError", "That name is already taken.");
      return;
    }

    queue.players.push({
      id: playerId,
      socketId: socket.id,
      name: cleanName,
      accepted: false
    });

    socket.join(cleanCode);
    socket.emit("queueJoined", { code: cleanCode });

    if (queue.players.length >= 10 && queue.status === "waiting") {
      startAcceptPhase(cleanCode);
    } else {
      io.to(cleanCode).emit("queueState", queue);
    }
  });

  socket.on("joinQueueRoom", ({ code, playerId }) => {
    const cleanCode = String(code || "").trim().toUpperCase();
    const queue = queues[cleanCode];

    if (!queue) {
      socket.emit("queueError", "Queue not found.");
      return;
    }

    const player =
      queue.players.find(p => p.id === playerId) ||
      queue.blueTeam.find(p => p.id === playerId) ||
      queue.redTeam.find(p => p.id === playerId);

    if (player) {
      player.socketId = socket.id;
    }

    socket.join(cleanCode);

    if (queue.players.length >= 10 && queue.status === "waiting") {
      startAcceptPhase(cleanCode);
    } else {
      socket.emit("queueState", queue);
    }
  });

  socket.on("acceptQueue", ({ code, playerId }) => {
    const cleanCode = String(code || "").trim().toUpperCase();
    const queue = queues[cleanCode];

    if (!queue || queue.status !== "accepting") return;

    const player = queue.players.find(p => p.id === playerId);
    if (!player) return;

    player.accepted = true;
    io.to(cleanCode).emit("queueState", queue);

    const allAccepted =
      queue.players.length === 10 &&
      queue.players.every(player => player.accepted || String(player.id).startsWith("BOT_"));

    if (allAccepted) {
      clearTimeout(acceptTimers[cleanCode]);
      startCaptainDraft(cleanCode);
    }
  });

  socket.on("pickPlayer", ({ code, targetId, playerId }) => {
    const cleanCode = String(code || "").trim().toUpperCase();
    const queue = queues[cleanCode];

    if (!queue || queue.status !== "captain") return;

    const currentCaptainId = queue.pickOrder[queue.pickIndex];

    if (playerId !== currentCaptainId) return;

    const pickedPlayer = queue.players.find(player => player.id === targetId);
    if (!pickedPlayer) return;

    queue.players = queue.players.filter(player => player.id !== targetId);

    const isBlueCaptainTurn = queue.blueTeam.some(
      player => player.id === currentCaptainId
    );

    if (isBlueCaptainTurn) {
      queue.blueTeam.push(pickedPlayer);
    } else {
      queue.redTeam.push(pickedPlayer);
    }

    queue.pickIndex++;

    if (queue.pickIndex >= queue.pickOrder.length) {
      queue.status = "done";
    }

    io.to(cleanCode).emit("queueState", queue);
  });

  socket.on("joinDraft", draftId => {
    socket.join(draftId);
    socket.emit("draftState", drafts[draftId]);
  });

  socket.on("setReady", ({ draftId, side }) => {
    const draft = drafts[draftId];

    if (!draft) return;
    if (side !== "blue" && side !== "red") return;

    draft.ready[side] = true;

    io.to(draftId).emit("draftState", draft);

    if (draft.ready.blue && draft.ready.red && !draft.started) {
      startTimer(draftId);
    }
  });

  socket.on("selectChampion", ({ draftId, champion, side }) => {
    const draft = drafts[draftId];

    if (!draft) return;
    if (!draft.started) return;
    if (side !== "blue" && side !== "red") return;
    if (!champion || !champion.id) return;
    if (draft.selected.includes(champion.id)) return;
    if (draft.history.length >= draftOrder.length) return;

    const step = draftOrder[draft.history.length];

    if (!step) return;
    if (step.team !== side) return;

    draft.history.push({
      team: step.team,
      type: step.type,
      champion
    });

    draft.selected.push(champion.id);

    startTimer(draftId);
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Draft app running on port ${PORT}`);
});
