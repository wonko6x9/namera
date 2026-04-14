import { App, createAppController, type AppController } from "./App";

const root = document.getElementById("app");

if (root) {
  root.innerHTML = App();
  wireApp(root);
}

function wireApp(root: HTMLElement): void {
  const controller = createController(root);
  const fileInput = root.querySelector<HTMLInputElement>("[data-role='file-input']");
  const folderInput = root.querySelector<HTMLInputElement>("[data-role='folder-input']");
  const providerButton = root.querySelector<HTMLButtonElement>("[data-role='refresh-providers']");
  const candidateButtons = root.querySelectorAll<HTMLButtonElement>("[data-role='candidate-pick']");
  const saveConfigButton = root.querySelector<HTMLButtonElement>("[data-role='save-config']");
  const movieRootInput = root.querySelector<HTMLInputElement>("[data-role='config-movie-root']");
  const tvRootInput = root.querySelector<HTMLInputElement>("[data-role='config-tv-root']");
  const musicRootInput = root.querySelector<HTMLInputElement>("[data-role='config-music-root']");
  const omdbKeyInput = root.querySelector<HTMLInputElement>("[data-role='config-omdb-key']");

  fileInput?.addEventListener("change", async (event) => {
    const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
    await controller.ingestFiles(files);
  });

  folderInput?.addEventListener("change", async (event) => {
    const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
    await controller.ingestFiles(files);
  });

  providerButton?.addEventListener("click", async () => {
    await controller.refreshProviders();
  });

  candidateButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.dataset.input ?? "";
      const candidateKey = button.dataset.key ?? "";
      controller.chooseCandidate(input, candidateKey);
    });
  });

  saveConfigButton?.addEventListener("click", () => {
    controller.updateConfig({
      destinations: {
        movieRoot: movieRootInput?.value || "Movies",
        tvRoot: tvRootInput?.value || "TV Shows",
        musicRoot: musicRootInput?.value || "Music",
      },
      providers: {
        omdbApiKey: omdbKeyInput?.value || undefined,
      },
    });
  });
}

function createController(root: HTMLElement): AppController {
  const rerender = (markup: string) => {
    root.innerHTML = markup;
    wireApp(root);
  };

  return createAppController(rerender);
}
