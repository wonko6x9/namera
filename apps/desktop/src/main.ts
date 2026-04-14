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
}

function createController(root: HTMLElement): AppController {
  const rerender = (markup: string) => {
    root.innerHTML = markup;
    wireApp(root);
  };

  return createAppController(rerender);
}
