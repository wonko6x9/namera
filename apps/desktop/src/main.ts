import { App, type AppController } from "./App";

const root = document.getElementById("app");

if (root) {
  root.innerHTML = App();
  wireApp(root);
}

function wireApp(root: HTMLElement): void {
  const controller = createAppController(root);
  const fileInput = root.querySelector<HTMLInputElement>("[data-role='file-input']");
  const folderInput = root.querySelector<HTMLInputElement>("[data-role='folder-input']");

  fileInput?.addEventListener("change", async (event) => {
    const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
    await controller.ingestFiles(files);
  });

  folderInput?.addEventListener("change", async (event) => {
    const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
    await controller.ingestFiles(files);
  });
}

function createAppController(root: HTMLElement): AppController {
  const rerender = (markup: string) => {
    root.innerHTML = markup;
    wireApp(root);
  };

  return {
    rerender,
  };
}
