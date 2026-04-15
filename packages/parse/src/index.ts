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
  "dl",
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
  "extended",
  "unrated",
  "criterion",
  "collection",
  "directors",
  "director",
  "cut",
  "ultimate",
  "edition",
  "special",
  "imax",
  "dubbed",
  "subbed",
  "multi",
  "internal",
  "readnfo",
  "complete",
  "properly",
]);

const STOP_TOKENS = new Set(["part", "pt", "disc", "disk", "cd", "vol", "volume"]);
const EDITION_PHRASES = [
  ["final", "cut"],
  ["directors", "cut"],
  ["director", "cut"],
  ["special", "edition"],
  ["criterion", "collection"],
  ["ultimate", "edition"],
];

export function parseFilename(input: string): ParsedMedia {
  const [baseName, extension] = splitExtension(input);
  const normalizedName = normalizeSeparators(baseName);
  const tokens = normalizedName.split(/\s+/).filter(Boolean);
  const episode = detectEpisode(tokens);
  const year = detectYear(tokens);
  const noiseTokens = tokens.filter((token) => isNoiseToken(token));
  const titleTokens = extractTitleTokens(tokens, year, episode);

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
    .replace(/([([{])+/g, " ")
    .replace(/([\])}])+/g, " ")
    .replace(/[._\-+,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectEpisode(tokens: string[]): EpisodeInfo | undefined {
  const explicitMarkers = tokens
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => /^S\d{2}E\d{2}(?:E\d{2})*$/i.test(candidate));

  if (!explicitMarkers.length) return undefined;

  const firstMarker = explicitMarkers[0]!;
  const token = firstMarker.candidate;
  const episodes = Array.from(token.matchAll(/E(\d{2})/gi)).map((match) => Number(match[1]));
  const primaryEpisode = episodes[0];
  if (!primaryEpisode) return undefined;

  const seriesTokens = tokens.slice(0, firstMarker.index).filter((candidate) => !isNoiseToken(candidate));
  const episodeTitleTokens = tokens
    .slice(firstMarker.index + 1)
    .filter((candidate, index, list) => !isNoiseToken(candidate))
    .filter((candidate, index, list) => !looksLikePartOrDiscTail(candidate, index, list));

  return {
    season: Number(token.slice(1, 3)),
    episode: primaryEpisode,
    seriesTitle: cleanupTitle(seriesTokens.join(" ")) || undefined,
    episodeTitle: cleanupTitle(episodeTitleTokens.join(" ")) || undefined,
  };
}

function detectYear(tokens: string[]): number | undefined {
  return tokens
    .map((token) => Number(token))
    .find((year) => Number.isInteger(year) && year >= 1900 && year <= 2099);
}

function extractTitleTokens(tokens: string[], year?: number, episode?: EpisodeInfo): string[] {
  const episodeMarkerIndex = tokens.findIndex((token) => /^S\d{2}E\d{2}(?:E\d{2})*$/i.test(token));
  const sourceTokens = episodeMarkerIndex >= 0 ? tokens.slice(0, episodeMarkerIndex) : tokens;
  const result: string[] = [];

  for (let index = 0; index < sourceTokens.length; index += 1) {
    const token = sourceTokens[index]!;
    const lower = token.toLowerCase();

    if (isNoiseToken(token) || looksLikeExtension(token) || isEpisodeToken(token)) {
      continue;
    }

    if (year && token === String(year)) {
      break;
    }

    if (STOP_TOKENS.has(lower)) {
      const next = sourceTokens[index + 1];
      if (next && /^\d+$/i.test(next)) {
        break;
      }
    }

    if (startsEditionPhrase(sourceTokens, index)) {
      result.push(...collectEditionPhrase(sourceTokens, index));
      index += collectEditionPhrase(sourceTokens, index).length - 1;
      continue;
    }

    if (/^(part|pt|disc|disk|cd|vol|volume)\d+$/i.test(token)) {
      break;
    }

    result.push(token);
  }

  if (episode?.seriesTitle) {
    return episode.seriesTitle.split(/\s+/).filter(Boolean);
  }

  return result;
}

function looksLikePartOrDiscTail(token: string, index: number, tokens: string[]): boolean {
  if (/^(part|pt|disc|disk|cd|vol|volume)$/i.test(token)) {
    const next = tokens[index + 1];
    return Boolean(next && /^\d+$/i.test(next));
  }
  if (/^\d+$/i.test(token)) {
    const previous = tokens[index - 1];
    return Boolean(previous && /^(part|pt|disc|disk|cd|vol|volume)$/i.test(previous));
  }
  return false;
}

function startsEditionPhrase(tokens: string[], index: number): boolean {
  return EDITION_PHRASES.some((phrase) =>
    phrase.every((part, phraseIndex) => tokens[index + phraseIndex]?.toLowerCase() === part),
  );
}

function collectEditionPhrase(tokens: string[], index: number): string[] {
  const phrase = EDITION_PHRASES.find((candidate) =>
    candidate.every((part, phraseIndex) => tokens[index + phraseIndex]?.toLowerCase() === part),
  );
  return phrase ? tokens.slice(index, index + phrase.length) : [tokens[index]!];
}

function isNoiseToken(token: string): boolean {
  return KNOWN_NOISE.has(token.toLowerCase());
}

function looksLikeExtension(token: string): boolean {
  return ["mkv", "mp4", "avi", "mov", "m4v", "mp3", "flac", "wav"].includes(token.toLowerCase());
}

function isEpisodeToken(token: string): boolean {
  return /^S\d{2}E\d{2}(?:E\d{2})*$/i.test(token);
}

function cleanupTitle(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (/^(ii|iii|iv|vi|vii|viii|ix|x)$/i.test(token)) {
        return token.toUpperCase();
      }
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
}
