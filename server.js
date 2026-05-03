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
    ready: {
      blue: false,
      red: false
    },
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

io.on("connection", socket => {
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
