import "./styles.css";
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
  const clearIngestButton = root.querySelector<HTMLButtonElement>("[data-role='clear-ingest']");
  const removeIngestButtons = root.querySelectorAll<HTMLButtonElement>("[data-role='remove-ingest-item']");
  const candidateButtons = root.querySelectorAll<HTMLButtonElement>("[data-role='candidate-pick']");
  const rememberButtons = root.querySelectorAll<HTMLButtonElement>("[data-role='candidate-remember']");
  const searchButtons = root.querySelectorAll<HTMLButtonElement>("[data-role='open-search']");
  const artworkSearchButtons = root.querySelectorAll<HTMLButtonElement>("[data-role='open-art-search']");
  const saveConfigButton = root.querySelector<HTMLButtonElement>("[data-role='save-config']");
  const applyNativeButtons = root.querySelectorAll<HTMLButtonElement>("[data-role='apply-native']");
  const applyVisibleBatchButton = root.querySelector<HTMLButtonElement>("[data-role='apply-visible-batch']");
  const retryFailedBatchButton = root.querySelector<HTMLButtonElement>("[data-role='retry-failed-batch']");
  const undoNativeButtons = root.querySelectorAll<HTMLButtonElement>("[data-role='undo-native']");
  const filterAllButton = root.querySelector<HTMLButtonElement>("[data-role='filter-all']");
  const filterNeedsReviewButton = root.querySelector<HTMLButtonElement>("[data-role='filter-needs-review']");
  const filterProviderBackedButton = root.querySelector<HTMLButtonElement>("[data-role='filter-provider-backed']");
  const filterFailedBatchButton = root.querySelector<HTMLButtonElement>("[data-role='filter-failed-batch']");
  const movieRootInput = root.querySelector<HTMLInputElement>("[data-role='config-movie-root']");
  const tvRootInput = root.querySelector<HTMLInputElement>("[data-role='config-tv-root']");
  const musicRootInput = root.querySelector<HTMLInputElement>("[data-role='config-music-root']");
  const omdbKeyInput = root.querySelector<HTMLInputElement>("[data-role='config-omdb-key']");
  const movieSearchProviderInput = root.querySelector<HTMLSelectElement>("[data-role='config-movie-search-provider']");
  const tvSearchProviderInput = root.querySelector<HTMLSelectElement>("[data-role='config-tv-search-provider']");
  const musicSearchProviderInput = root.querySelector<HTMLSelectElement>("[data-role='config-music-search-provider']");
  const sourceRootInput = root.querySelector<HTMLInputElement>("[data-role='config-source-root']");
  const targetRootInput = root.querySelector<HTMLInputElement>("[data-role='config-target-root']");
  const webdavMovieRootInput = root.querySelector<HTMLInputElement>("[data-role='config-webdav-movie-root']");
  const webdavTvRootInput = root.querySelector<HTMLInputElement>("[data-role='config-webdav-tv-root']");
  const webdavMusicRootInput = root.querySelector<HTMLInputElement>("[data-role='config-webdav-music-root']");
  const collisionPolicyInput = root.querySelector<HTMLSelectElement>("[data-role='config-collision-policy']");

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

  clearIngestButton?.addEventListener("click", () => {
    controller.clearIngestedItems();
  });

  removeIngestButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.dataset.input ?? "";
      controller.removeIngestItem(input);
    });
  });

  candidateButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.dataset.input ?? "";
      const candidateKey = button.dataset.key ?? "";
      controller.chooseCandidate(input, candidateKey);
    });
  });

  rememberButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.dataset.input ?? "";
      const candidateKey = button.dataset.key ?? "";
      controller.rememberCandidateChoice(input, candidateKey);
    });
  });

  searchButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const url = button.dataset.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    });
  });

  artworkSearchButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const url = button.dataset.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    });
  });

  saveConfigButton?.addEventListener("click", () => {
    controller.updateConfig({
      destinations: {
        movieRoot: movieRootInput?.value || "Movies",
        tvRoot: tvRootInput?.value || "TV Shows",
        musicRoot: musicRootInput?.value || "Music",
        sourceRoot: sourceRootInput?.value || ".",
        targetRoot: targetRootInput?.value || ".",
        webdavMovieRoot: webdavMovieRootInput?.value || "",
        webdavTvRoot: webdavTvRootInput?.value || "",
        webdavMusicRoot: webdavMusicRootInput?.value || "",
        collisionPolicy: (collisionPolicyInput?.value as "skip" | "overwrite" | "rename-new" | undefined) || "skip",
      },
      providers: {
        omdbApiKey: omdbKeyInput?.value || undefined,
        movieSearchProvider: (movieSearchProviderInput?.value as "google" | "imdb" | undefined) || "imdb",
        tvSearchProvider: (tvSearchProviderInput?.value as "google" | "tvmaze" | undefined) || "tvmaze",
        musicSearchProvider: (musicSearchProviderInput?.value as "google" | "musicbrainz" | undefined) || "musicbrainz",
      },
    });
  });

  applyNativeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const input = button.dataset.input ?? "";
      await controller.applyNativeExecution(input);
    });
  });

  applyVisibleBatchButton?.addEventListener("click", async () => {
    await controller.applyVisibleNativeBatch();
  });

  retryFailedBatchButton?.addEventListener("click", async () => {
    await controller.retryFailedNativeBatch();
  });

  undoNativeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const input = button.dataset.input ?? "";
      await controller.undoNativeExecution(input);
    });
  });

  filterAllButton?.addEventListener("click", () => {
    controller.setReviewFilter("all");
  });

  filterNeedsReviewButton?.addEventListener("click", () => {
    controller.setReviewFilter("needs-review");
  });

  filterProviderBackedButton?.addEventListener("click", () => {
    controller.setReviewFilter("provider-backed");
  });

  filterFailedBatchButton?.addEventListener("click", () => {
    controller.setReviewFilter("failed-batch");
  });
}

function createController(root: HTMLElement): AppController {
  const rerender = (markup: string) => {
    root.innerHTML = markup;
    wireApp(root);
  };

  return createAppController(rerender);
}
