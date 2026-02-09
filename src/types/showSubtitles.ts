export interface SubtitleLine {
  index: number;
  text: string;
}

export interface Episode {
  number: number;
  title: string;
  slug: string;
}

export interface Season {
  number: number;
  episodes: Episode[];
}

export interface Transcript {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  lines: SubtitleLine[];
}
