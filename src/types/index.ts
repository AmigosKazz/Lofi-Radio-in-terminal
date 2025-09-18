export interface Station {
  id: string;
  name: string;
  url: string;
  genre: string;
  description: string;
  quality: string;
}

export interface PlayerState {
  isPlaying: boolean;
  currentStation: Station | null;
  volume: number;
  startTime: Date | null;
  process: any | null;
}

export interface Config {
  lastStation: string | null;
  volume: number;
  favorites: string[];
}

export interface StreamError {
  code: string;
  message: string;
  station?: Station;
}

export type CommandAction = 'play' | 'stop' | 'status' | 'stations' | 'volume';

export interface VolumeOptions {
  level?: string;
}

export interface PlayOptions {
  station?: string;
  volume?: string;
}