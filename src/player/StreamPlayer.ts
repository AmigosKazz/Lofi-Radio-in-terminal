import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import type { Station, PlayerState, StreamError } from '../types/index.js';

export class StreamPlayer extends EventEmitter {
  private state: PlayerState;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;

  constructor() {
    super();
    this.state = {
      isPlaying: false,
      currentStation: null,
      volume: 70,
      startTime: null,
      process: null
    };
  }

  async play(station: Station, volume?: number): Promise<void> {
    if (this.state.isPlaying) {
      await this.stop();
    }

    this.state.currentStation = station;
    this.state.volume = volume || this.state.volume;
    this.state.startTime = new Date();

    return new Promise((resolve, reject) => {
      try {
        const volumeArg = (this.state.volume / 100).toFixed(2);

        const args = [
          '-nodisp',
          '-loglevel', 'error',
          '-af', `volume=${volumeArg}`,
          '-vn',
          station.url
        ];

        // On Windows, we need to use shell: true for ffplay to work properly
        this.state.process = spawn('ffplay', args, {
          stdio: ['ignore', 'ignore', 'pipe'],
          shell: process.platform === 'win32'
        });

        this.state.isPlaying = true;
        this.reconnectAttempts = 0;

        this.state.process.stderr?.on('data', (data: Buffer) => {
          const error = data.toString();
          if (error.includes('Invalid data') || error.includes('Connection refused')) {
            this.handleStreamError({
              code: 'STREAM_ERROR',
              message: error,
              station
            });
          }
        });

        this.state.process.on('error', (error: Error) => {
          this.state.isPlaying = false;
          if (error.message.includes('ENOENT')) {
            reject(new Error('ffplay not found. Please install ffmpeg: https://ffmpeg.org/download.html'));
          } else {
            this.handleStreamError({
              code: 'PROCESS_ERROR',
              message: error.message,
              station
            });
          }
        });

        this.state.process.on('exit', (code: number | null) => {
          if (this.state.isPlaying && code !== 0) {
            this.handleStreamError({
              code: 'UNEXPECTED_EXIT',
              message: `Process exited with code ${code}`,
              station
            });
          }
          this.state.isPlaying = false;
          this.state.process = null;
        });

        setTimeout(() => {
          if (this.state.isPlaying) {
            this.emit('playing', station);
            resolve();
          }
        }, 1000);

      } catch (error) {
        this.state.isPlaying = false;
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.state.process) {
      return;
    }

    return new Promise((resolve) => {
      const process = this.state.process;
      this.state.isPlaying = false;
      this.state.currentStation = null;
      this.state.startTime = null;

      if (process) {
        process.removeAllListeners();

        process.on('exit', () => {
          this.state.process = null;
          this.emit('stopped');
          resolve();
        });

        if (process.kill) {
          process.kill('SIGTERM');

          setTimeout(() => {
            if (this.state.process === process) {
              process.kill('SIGKILL');
            }
          }, 2000);
        }
      } else {
        resolve();
      }
    });
  }

  setVolume(volume: number): void {
    if (volume < 0 || volume > 100) {
      throw new Error('Volume must be between 0 and 100');
    }

    this.state.volume = volume;

    if (this.state.isPlaying && this.state.currentStation) {
      const station = this.state.currentStation;
      this.stop().then(() => {
        this.play(station, volume);
      });
    }
  }

  getState(): PlayerState {
    return { ...this.state };
  }

  getUptime(): string {
    if (!this.state.startTime || !this.state.isPlaying) {
      return 'Not playing';
    }

    const now = new Date();
    const diff = now.getTime() - this.state.startTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private async handleStreamError(error: StreamError): Promise<void> {
    this.emit('error', error);

    if (this.reconnectAttempts < this.maxReconnectAttempts && error.station) {
      this.reconnectAttempts++;
      this.emit('reconnecting', this.reconnectAttempts);

      setTimeout(async () => {
        if (error.station) {
          try {
            await this.play(error.station, this.state.volume);
          } catch (reconnectError) {
            this.handleStreamError({
              code: 'RECONNECT_FAILED',
              message: `Reconnection attempt ${this.reconnectAttempts} failed`,
              station: error.station
            });
          }
        }
      }, this.reconnectDelay);
    } else {
      this.emit('connection_lost', error);
      await this.stop();
    }
  }
}