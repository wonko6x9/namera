import type { DestinationProfile, MediaKind, Phase3DestinationPlan, Phase3TransferPlan, RenamePlan } from "@namera/core";

export function createPhase3DestinationPlan(
  plan: RenamePlan,
  mediaKind: MediaKind,
  config?: DestinationProfile,
  backend: "local" | "webdav" = "webdav",
): Phase3DestinationPlan {
  if (backend === "local") {
    return {
      backend,
      targetPath: plan.proposedPath,
      status: "ready",
      note: "Local destination path ready.",
    };
  }

  const webdavRoot = resolveWebdavRoot(mediaKind, config);
  if (!webdavRoot) {
    return {
      backend,
      targetPath: plan.proposedPath,
      status: "stub",
      note: "Phase 3 routing knows the media type, but no WebDAV root is configured for it yet.",
    };
  }

  return {
    backend,
    targetPath: joinRemotePath(webdavRoot, stripLibraryRoot(plan.proposedPath, mediaKind, config)),
    status: "ready",
    note: `WebDAV destination prepared for ${mediaKind}. Transfer/upload still not implemented.`,
  };
}

export function createPhase3TransferPlan(
  plan: RenamePlan,
  mediaKind: MediaKind,
  config?: DestinationProfile,
): Phase3TransferPlan {
  const destination = createPhase3DestinationPlan(plan, mediaKind, config, "webdav");
  if (destination.status !== "ready") {
    return {
      backend: "webdav",
      status: "blocked",
      actions: [
        `Resolve a WebDAV root for ${mediaKind}`,
        "Then generate remote mkdir/upload/verify steps",
      ],
      summary: destination.note,
    };
  }

  return {
    backend: "webdav",
    status: "planned",
    actions: [
      `Create remote parent folders for ${dirname(destination.targetPath)}`,
      `Upload/copy renamed file to ${destination.targetPath}`,
      `Verify remote file exists and size/checksum expectations pass before any cleanup`,
    ],
    summary: "Phase 3 transfer contract prepared. Remote transfer is planned, but execution is not wired yet.",
  };
}

function resolveWebdavRoot(mediaKind: MediaKind, config?: DestinationProfile): string | undefined {
  const raw = mediaKind === "movie"
    ? config?.webdavMovieRoot
    : mediaKind === "episode"
      ? config?.webdavTvRoot
      : mediaKind === "music"
        ? config?.webdavMusicRoot
        : undefined;

  const trimmed = raw?.trim();
  return trimmed || undefined;
}

function stripLibraryRoot(path: string, mediaKind: MediaKind, config?: DestinationProfile): string {
  const libraryRoot = mediaKind === "movie"
    ? config?.movieRoot ?? "Movies"
    : mediaKind === "episode"
      ? config?.tvRoot ?? "TV Shows"
      : mediaKind === "music"
        ? config?.musicRoot ?? "Music"
        : undefined;

  if (!libraryRoot) {
    return path;
  }

  const prefix = `${trimSlashes(libraryRoot)}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function joinRemotePath(root: string, relativePath: string): string {
  return `${trimTrailingSlash(root)}/${trimLeadingSlash(relativePath)}`;
}

function dirname(path: string): string {
  const trimmed = trimTrailingSlash(path);
  const index = trimmed.lastIndexOf("/");
  return index > 0 ? trimmed.slice(0, index) : trimmed;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}
