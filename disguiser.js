const apiUrl = "https://sussyrakas.onrender.com/api/disguise";
const form = document.querySelector("#disguiser-form");
const submit = document.querySelector("#disguiser-submit");
const buttonText = document.querySelector("#disguiser-button-text");
const statusText = document.querySelector("#disguiser-status");
const sound = document.querySelector("#disguiser-sound");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  playClickSound();
  submit.classList.add("is-rainbow");
  setBusy(true, "uploading...");

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      body: new FormData(form),
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const blob = await response.blob();
    const fileName = getDownloadName(response) || "disguised.jar";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    statusText.textContent = `downloaded ${fileName}`;
  } catch (error) {
    statusText.textContent = error.message || "could not create disguised jar.";
  } finally {
    setBusy(false, "create disguised jar");
  }
});

function setBusy(isBusy, text) {
  submit.disabled = isBusy;
  buttonText.textContent = text;
}

function playClickSound() {
  sound.currentTime = 0;
  sound.play().catch(() => {
    statusText.textContent = "sound could not play in this browser.";
  });
}

async function readError(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await response.json();
    return body.error || "the server could not disguise this jar.";
  }

  return response.text();
}

function getDownloadName(response) {
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1];
}
