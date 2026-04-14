import type { EpisodeInfo, MediaKind, MovieInfo, ParsedMedia } from "@namera/core";

const KNOWN_NOISE = new Set([
  "2160p",
  "1080p",
  "720p",
  "480p",
  "web",
  "webrip",
  "web-dl",
  "webdl",
  "bluray",
  "brrip",
  "dvdrip",
  "hdrip",
  "x264",
  "x265",
  "h264",
  "h265",
  "hevc",
  "aac",
  "ddp5",
  "ddp5.1",
  "atmos",
  "dts",
  "proper",
  "repack",
  "remux",
  "nf",
  "amzn",
  "yts",
  "rarbg",
]);

export function parseFilename(input: string): ParsedMedia {
  const [baseName, extension] = splitExtension(input);
  const normalizedName = normalizeSeparators(baseName);
  const tokens = normalizedName.split(/\s+/).filter(Boolean);
  const episode = detectEpisode(tokens);
  const year = detectYear(tokens);
  const noiseTokens = tokens.filter((token) => isNoiseToken(token));
  const titleTokens = tokens.filter(
    (token) =>
      !isNoiseToken(token) &&
      !looksLikeExtension(token) &&
      !isEpisodeToken(token) &&
      !(year && token === String(year)),
  );

  let kind: MediaKind = "unknown";
  if (episode) kind = "episode";
  else if (year) kind = "movie";

  const title = cleanupTitle(titleTokens.join(" "));
  const movie: MovieInfo | undefined = year ? { year } : undefined;

  return {
    rawName: input,
    extension,
    normalizedName,
    title,
    kind,
    movie,
    episode,
    noiseTokens,
    tokens,
  };
}

function splitExtension(input: string): [string, string | undefined] {
  const parts = input.split(".");
  if (parts.length < 2) return [input, undefined];
  const extension = parts.pop();
  return [parts.join("."), extension?.toLowerCase()];
}

function normalizeSeparators(input: string): string {
  return input
    .replace(/[._\-[\](){},]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectEpisode(tokens: string[]): EpisodeInfo | undefined {
  const token = tokens.find((candidate) => /^S\d{2}E\d{2}$/i.test(candidate));
  if (!token) return undefined;
  return {
    season: Number(token.slice(1, 3)),
    episode: Number(token.slice(4, 6)),
  };
}

function detectYear(tokens: string[]): number | undefined {
  return tokens
    .map((token) => Number(token))
    .find((year) => Number.isInteger(year) && year >= 1900 && year <= 2099);
}

function isNoiseToken(token: string): boolean {
  return KNOWN_NOISE.has(token.toLowerCase());
}

function looksLikeExtension(token: string): boolean {
  return ["mkv", "mp4", "avi", "mov"].includes(token.toLowerCase());
}

function isEpisodeToken(token: string): boolean {
  return /^S\d{2}E\d{2}$/i.test(token);
}

function cleanupTitle(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}
