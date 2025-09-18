import readline from 'readline';
import chalk from 'chalk';
import { StreamPlayer } from '../player/StreamPlayer.js';
import { stations, getStationById, getStationByName } from '../config/stations.js';
import {
  formatStation,
  formatError,
  formatSuccess,
  formatInfo,
  formatMusic,
  formatControl,
  createSpinner,
  validateVolume,
  clearConsole
} from '../utils/helpers.js';
import type { Station, Config } from '../types/index.js';
import Conf from 'conf';

export class RadioREPL {
  private rl: readline.Interface;
  private player: StreamPlayer;
  private config: Conf<Config>;
  private isPlaying: boolean = false;
  private currentStation: Station | null = null;
  private spinner: any = null;
  private version: string = '1.0.0';

  constructor(player: StreamPlayer, config: Conf<Config>) {
    this.player = player;
    this.config = config;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('radio> ')
    });

    this.setupPlayerListeners();
  }

  private setupPlayerListeners(): void {
    this.player.on('playing', (station: Station) => {
      if (this.spinner) {
        this.spinner.succeed(formatSuccess(`Connected to ${station.name}`));
        this.spinner = null;
      }
      this.isPlaying = true;
      this.currentStation = station;
      this.showNowPlaying();
      this.rl.prompt();
    });

    this.player.on('stopped', () => {
      this.isPlaying = false;
      this.currentStation = null;
      console.log(formatControl('Playback stopped'));
      this.rl.prompt();
    });

    this.player.on('error', (error) => {
      if (this.spinner) {
        this.spinner.fail(formatError(error.message));
        this.spinner = null;
      }
      this.rl.prompt();
    });

    this.player.on('reconnecting', (attempt: number) => {
      console.log(formatInfo(`Reconnecting... (attempt ${attempt})`));
    });
  }

  public start(): void {
    clearConsole();
    this.showWelcome();
    this.showStatusBar();

    this.rl.prompt();

    this.rl.on('line', async (input: string) => {
      const command = input.trim().toLowerCase();

      if (!command) {
        this.rl.prompt();
        return;
      }

      await this.handleCommand(command);
    });

    this.rl.on('close', async () => {
      console.log('\n' + formatInfo('Shutting down...'));
      await this.player.stop();
      process.exit(0);
    });
  }

  private showWelcome(): void {
    const boxWidth = 56;
    const topBorder = '╔' + '═'.repeat(boxWidth) + '╗';
    const bottomBorder = '╚' + '═'.repeat(boxWidth) + '╝';

    const title = '🎵 LOFI RADIO TERMINAL 🎵';
    const author = 'Made by AMIGOSKAZZ';

    const titlePadding = Math.floor((boxWidth - title.length) / 2);
    const authorPadding = Math.floor((boxWidth - author.length) / 2);

    console.log(chalk.cyan.bold('\n' + topBorder));
    console.log(chalk.cyan.bold('║' + ' '.repeat(titlePadding) + title + ' '.repeat(boxWidth - titlePadding - title.length) + '║'));
    console.log(chalk.cyan.bold('║' + ' '.repeat(authorPadding) + author + ' '.repeat(boxWidth - authorPadding - author.length) + '║'));
    console.log(chalk.cyan.bold(bottomBorder + '\n'));
  }

  private showStatusBar(): void {
    console.log(chalk.dim('─'.repeat(58)));
    console.log(chalk.dim(`Version ${this.version} | Type 'help' for commands | 'exit' to quit`));
    console.log(chalk.dim('─'.repeat(58)));
    console.log();
  }

  private showNowPlaying(): void {
    if (this.currentStation) {
      console.log(formatMusic(`Now playing: ${this.currentStation.name}`));
      console.log(chalk.dim(`   ${this.currentStation.description}`));
      console.log(chalk.dim(`   Quality: ${this.currentStation.quality}`));
      console.log(chalk.dim(`   Volume: ${this.player.getState().volume}%`));
      console.log();
    }
  }

  private async handleCommand(input: string): Promise<void> {
    const parts = input.split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    switch (command) {
      case 'play':
      case 'p':
        await this.handlePlay(args.join(' '));
        break;

      case 'stop':
      case 's':
        await this.handleStop();
        break;

      case 'stations':
      case 'list':
      case 'l':
        this.handleStations();
        break;

      case 'status':
      case 'now':
      case 'n':
        this.handleStatus();
        break;

      case 'volume':
      case 'vol':
      case 'v':
        this.handleVolume(args[0]);
        break;

      case 'clear':
      case 'cls':
        clearConsole();
        this.showWelcome();
        this.showStatusBar();
        if (this.isPlaying && this.currentStation) {
          this.showNowPlaying();
        }
        break;

      case 'help':
      case 'h':
      case '?':
        this.showHelp();
        break;

      case 'exit':
      case 'quit':
      case 'q':
        this.rl.close();
        return;

      default:
        console.log(formatError(`Unknown command: ${command}`));
        console.log(chalk.dim(`Type 'help' to see available commands`));
        break;
    }

    this.rl.prompt();
  }

  private async handlePlay(stationInput: string): Promise<void> {
    let selectedStation: Station | undefined;

    if (stationInput) {
      selectedStation = getStationById(stationInput) || getStationByName(stationInput);
      if (!selectedStation) {
        // Try to match by number
        const stationIndex = parseInt(stationInput, 10) - 1;
        if (!isNaN(stationIndex) && stationIndex >= 0 && stationIndex < stations.length) {
          selectedStation = stations[stationIndex];
        }
      }

      if (!selectedStation) {
        console.log(formatError(`Station "${stationInput}" not found`));
        console.log(formatInfo(`Type 'stations' to see available stations`));
        return;
      }
    } else {
      // Show station selector
      console.log(formatMusic('Available Stations:'));
      stations.forEach((station, index) => {
        console.log(`  ${chalk.yellow(`[${index + 1}]`)} ${station.name} - ${chalk.dim(station.genre)}`);
      });
      console.log(chalk.dim('\nEnter station number or ID (e.g., "play 1" or "play rp-mellow")'));
      return;
    }

    const volume = this.config.get('volume') as number;
    this.config.set('lastStation', selectedStation.id);

    this.spinner = createSpinner(`Connecting to ${selectedStation.name}...`);
    this.spinner.start();

    try {
      await this.player.play(selectedStation, volume);
    } catch (error: any) {
      if (this.spinner) {
        this.spinner.fail(formatError(error.message));
        this.spinner = null;
      }
    }
  }

  private async handleStop(): Promise<void> {
    if (!this.isPlaying) {
      console.log(formatInfo('No station is currently playing'));
      return;
    }
    await this.player.stop();
  }

  private handleStations(): void {
    console.log(formatMusic('Available Stations:\n'));
    stations.forEach((station, index) => {
      console.log(`${chalk.yellow(`[${index + 1}]`)} ${chalk.cyan(`[${station.id}]`)}`);
      console.log(`   ${formatStation(station)}`);
      console.log();
    });
  }

  private handleStatus(): void {
    const state = this.player.getState();

    if (!state.isPlaying || !state.currentStation) {
      console.log(formatMusic('Status: Not playing'));
    } else {
      console.log(formatMusic('Status: Playing'));
      console.log(`   Station: ${state.currentStation.name}`);
      console.log(`   Genre: ${state.currentStation.genre}`);
      console.log(`   Uptime: ${this.player.getUptime()}`);
      console.log(`   Volume: ${state.volume}%`);
    }
  }

  private handleVolume(level?: string): void {
    if (!level) {
      const currentVolume = this.config.get('volume');
      console.log(formatInfo(`Current volume: ${currentVolume}%`));
      return;
    }

    const volume = validateVolume(level);
    if (volume === null) {
      console.log(formatError('Volume must be between 0 and 100'));
      return;
    }

    this.config.set('volume', volume);
    this.player.setVolume(volume);
    console.log(formatSuccess(`Volume set to ${volume}%`));
  }

  private showHelp(): void {
    console.log(chalk.cyan.bold('\n📻 Radio Commands:\n'));

    const commands = [
      { cmd: 'play [station]', alias: 'p', desc: 'Play a station (by number, ID, or name)' },
      { cmd: 'stop', alias: 's', desc: 'Stop current playback' },
      { cmd: 'stations', alias: 'l', desc: 'List all available stations' },
      { cmd: 'status', alias: 'n', desc: 'Show current playback status' },
      { cmd: 'volume [0-100]', alias: 'v', desc: 'Set or show volume level' },
      { cmd: 'clear', alias: 'cls', desc: 'Clear the screen' },
      { cmd: 'help', alias: 'h, ?', desc: 'Show this help message' },
      { cmd: 'exit', alias: 'q', desc: 'Exit the radio' }
    ];

    commands.forEach(({ cmd, alias, desc }) => {
      const cmdStr = chalk.yellow(cmd.padEnd(18));
      const aliasStr = chalk.dim(`(${alias})`.padEnd(8));
      console.log(`  ${cmdStr} ${aliasStr} ${desc}`);
    });

    console.log(chalk.dim('\nExamples:'));
    console.log(chalk.dim('  play 1           - Play station #1'));
    console.log(chalk.dim('  play rp-mellow   - Play by station ID'));
    console.log(chalk.dim('  play paradise    - Play by partial name'));
    console.log(chalk.dim('  volume 50        - Set volume to 50%'));
    console.log();
  }
}