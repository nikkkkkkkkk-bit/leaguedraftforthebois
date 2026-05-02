const createBtn = document.getElementById("createBtn");
const blueNameInput = document.getElementById("blueName");
const redNameInput = document.getElementById("redName");
const timerSecondsInput = document.getElementById("timerSeconds");

const linksBox = document.getElementById("links");
const blueLink = document.getElementById("blueLink");
const redLink = document.getElementById("redLink");

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
