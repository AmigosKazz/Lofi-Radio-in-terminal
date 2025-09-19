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
    private commandHistory: string[] = [];
    private historyIndex: number = -1;

    constructor(player: StreamPlayer, config: Conf<Config>) {
        this.player = player;
        this.config = config;

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '',
            completer: this.completer.bind(this)
        });

        this.refreshPrompt();
        this.setupPlayerListeners();
        this.setupAdvancedInput();
        this.enableNonBlockingInput();

    }

    private refreshPrompt() : void {
        setInterval(() => {
            if (this.rl.terminal && !this.rl.line) {
                this.rl.prompt(true);
            }
        }, 2000);
    }

    private setupAdvancedInput(): void {
        this.rl.on('keypress', (_char, key) => {
            if (key) {
                switch (key.name) {
                    case 'up':
                        this.navigateHistory('up');
                        break;
                    case 'down':
                        this.navigateHistory('down');
                        break;
                    case 'tab':
                        // Tab completion is handled by the completer
                        break;
                }
            }
        });

        // Enable keypress events
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(true);
        }
    }

    private completer(line: string): [string[], string] {
        const commands = [
            'play', 'stop', 'stations', 'status', 'volume', 'help', 'clear', 'exit',
            'p', 's', 'l', 'n', 'v', 'h', 'q', 'cls'
        ];

        const stationIds = stations.map(s => s.id);
        const allCompletions = [...commands, ...stationIds];

        const hits = allCompletions.filter(c => c.startsWith(line));
        return [hits.length ? hits : allCompletions, line];
    }

    private navigateHistory(direction: 'up' | 'down'): void {
        if (this.commandHistory.length === 0) return;

        if (direction === 'up' && this.historyIndex < this.commandHistory.length - 1) {
            this.historyIndex++;
        } else if (direction === 'down' && this.historyIndex > -1) {
            this.historyIndex--;
        }

        if (this.historyIndex >= 0) {
            const command = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
            this.rl.write(null, { ctrl: true, name: 'u' }); // Clear line
            this.rl.write(command);
        }
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
            this.showPrompt();
        });

        this.player.on('stopped', () => {
            this.isPlaying = false;
            this.currentStation = null;
            console.log(formatControl('Playback stopped'));
            this.showPrompt();
        });

        this.player.on('error', (error) => {
            if (this.spinner) {
                this.spinner.fail(formatError(error.message));
                this.spinner = null;
            }
            this.showPrompt();
        });

        this.player.on('reconnecting', (attempt: number) => {
            console.log(formatInfo(`Reconnecting... (attempt ${attempt})`));
        });
    }

    public start(): void {
        clearConsole();
        this.showWelcome();
        this.showStatusBar();
        this.showPrompt();

        this.rl.on('line', async (input: string) => {
            const command = input.trim();

            if (!command) {
                this.showPrompt();
                return;
            }

            // Add to history (avoid duplicates)
            if (command !== this.commandHistory[this.commandHistory.length - 1]) {
                this.commandHistory.push(command);
                if (this.commandHistory.length > 50) { // Keep only last 50 commands
                    this.commandHistory.shift();
                }
            }
            this.historyIndex = -1;

            await this.handleCommand(command.toLowerCase());
        });

        this.rl.on('close', async () => {
            console.log('\n' + formatInfo('Shutting down...'));
            await this.player.stop();
            process.exit(0);
        });

        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
            console.log('\n' + chalk.yellow('Use "exit" command or Ctrl+D to quit safely'));
            this.showPrompt();
        });
    }

    private showWelcome(): void {
        const boxWidth = 58;

        // Beautiful gradient border
        const topBorder = '╭' + '─'.repeat(boxWidth) + '╮';
        const bottomBorder = '╰' + '─'.repeat(boxWidth) + '╯';

        console.log('');
        console.log(chalk.cyan(topBorder));

        // Title with gradient effect
        const title = '🎵 LOFI RADIO TERMINAL 🎵';
        const titlePadding = Math.floor((boxWidth - title.length) / 2);
        const titleLine = '│' + ' '.repeat(titlePadding) + title + ' '.repeat(boxWidth - titlePadding - title.length) + '│';
        console.log(chalk.cyan(titleLine));

        // Empty line
        console.log(chalk.cyan('│' + ' '.repeat(boxWidth) + '│'));

        // Author line
        const author = 'Made by AMIGOSKAZZ';
        const authorPadding = Math.floor((boxWidth - author.length) / 2);
        const authorLine = '│' + ' '.repeat(authorPadding) + author + ' '.repeat(boxWidth - authorPadding - author.length) + '│';
        console.log(chalk.cyan(authorLine));

        console.log(chalk.cyan(bottomBorder));
        console.log('');
    }

    private showStatusBar(): void {
        const statusWidth = 60;
        console.log(chalk.dim('─'.repeat(statusWidth)));

        // Status line with icons
        const versionInfo = `v${this.version}`;
        const helpInfo = `Type "help" for commands`;
        const exitInfo = `"exit" to quit`;

        const statusLine = `${chalk.dim('🔧')} ${chalk.white(versionInfo)} ${chalk.dim('|')} ${chalk.dim('💡')} ${chalk.white(helpInfo)} ${chalk.dim('|')} ${chalk.dim('🚪')} ${chalk.white(exitInfo)}`;
        console.log(statusLine);

        console.log(chalk.dim('─'.repeat(statusWidth)));
        console.log('');
    }

    private showPrompt(): void {
        // Create a beautiful prompt similar to Claude
        const promptPrefix = this.isPlaying && this.currentStation
            ? chalk.green('♪')
            : chalk.dim('○');

        const stationName = this.currentStation
            ? chalk.dim(` ${this.currentStation.name.split(' - ')[0]}`)
            : '';

        const prompt = `${promptPrefix}${stationName} ${chalk.cyan('▶')} `;

        // Clear any existing prompt and set new one
        this.rl.setPrompt(prompt);
        this.rl.prompt();
    }

    private showNowPlaying(): void {
        if (this.currentStation) {
            console.log('');
            console.log(chalk.bgCyan.black(' NOW PLAYING '));
            console.log('');
            console.log(formatMusic(`${this.currentStation.name}`));
            console.log(chalk.dim(`   ${this.currentStation.description}`));
            console.log(chalk.dim(`   Quality: ${this.currentStation.quality} | Volume: ${this.player.getState().volume}%`));
            console.log('');

            // Add a subtle separator
            console.log(chalk.dim('─'.repeat(50)));
            console.log('');
        }
    }

    private async handleCommand(input: string): Promise<void> {
        const parts = input.split(' ');
        const command = parts[0];
        const args = parts.slice(1);

        // Show typing indicator for longer operations
        const isLongOperation = ['play', 'p'].includes(command);
        let typingIndicator: NodeJS.Timeout | null = null;

        if (isLongOperation) {
            typingIndicator = setTimeout(() => {
                process.stdout.write(chalk.dim('⠋ Processing...'));
            }, 100);
        }

        try {
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
                    this.handleClear();
                    break;

                case 'help':
                case 'h':
                case '?':
                    this.showHelp();
                    break;

                case 'history':
                    this.showHistory();
                    break;

                case 'exit':
                case 'quit':
                case 'q':
                    this.rl.close();
                    return;

                default:
                    this.showCommandSuggestion(command);
                    break;
            }
        } finally {
            if (typingIndicator) {
                clearTimeout(typingIndicator);
                process.stdout.write('\r\x1b[K'); // Clear the typing indicator
            }
            this.showPrompt();
        }
    }

    private showCommandSuggestion(command: string): void {
        const commands = ['play', 'stop', 'stations', 'status', 'volume', 'help', 'clear', 'exit'];
        const suggestions = commands.filter(cmd => cmd.includes(command) || command.includes(cmd.substring(0, 2)));

        console.log(formatError(`Unknown command: "${command}"`));

        if (suggestions.length > 0) {
            console.log(chalk.dim(`Did you mean: ${suggestions.map(s => chalk.yellow(s)).join(', ')}?`));
        } else {
            console.log(chalk.dim(`Type ${chalk.yellow('help')} to see available commands`));
        }
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
                this.showQuickStationList();
                return;
            }
        } else {
            this.showQuickStationList();
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

    private showQuickStationList(): void {
        console.log(chalk.cyan('🎵 Quick Station Selection:'));
        console.log('');
        stations.forEach((station, index) => {
            const number = chalk.bgBlue.white(` ${index + 1} `);
            const id = chalk.dim(`[${station.id}]`);
            const name = chalk.white(station.name);
            const genre = chalk.dim(`- ${station.genre}`);

            console.log(`${number} ${id} ${name} ${genre}`);
        });
        console.log('');
        console.log(chalk.dim(`Usage: ${chalk.yellow('play 1')} or ${chalk.yellow('play rp-mellow')} or ${chalk.yellow('play paradise')}`));
    }

    private async handleStop(): Promise<void> {
        if (!this.isPlaying) {
            console.log(formatInfo('No station is currently playing'));
            return;
        }
        await this.player.stop();
    }

    private handleStations(): void {
        console.log('');
        console.log(chalk.bgMagenta.white(' AVAILABLE STATIONS '));
        console.log('');

        stations.forEach((station, index) => {
            const isPlaying = this.currentStation?.id === station.id;
            const icon = isPlaying ? chalk.green('♪') : chalk.dim('○');
            const number = chalk.yellow(`[${index + 1}]`);
            const id = chalk.cyan(`[${station.id}]`);

            console.log(`${icon} ${number} ${id}`);
            console.log(`   ${formatStation(station)}`);
            if (isPlaying) {
                console.log(chalk.green('   ► Currently playing'));
            }
            console.log('');
        });
    }

    private handleStatus(): void {
        const state = this.player.getState();

        console.log('');
        console.log(chalk.bgYellow.black(' STATUS '));
        console.log('');

        if (!state.isPlaying || !state.currentStation) {
            console.log(chalk.dim('○') + ' ' + formatMusic('Not playing'));
        } else {
            console.log(chalk.green('♪') + ' ' + formatMusic('Playing'));
            console.log(`   Station: ${chalk.white(state.currentStation.name)}`);
            console.log(`   Genre: ${chalk.dim(state.currentStation.genre)}`);
            console.log(`   Uptime: ${chalk.green(this.player.getUptime())}`);
            console.log(`   Volume: ${chalk.yellow(state.volume + '%')}`);
        }
        console.log('');
    }

    private handleVolume(level?: string): void {
        if (!level) {
            const currentVolume = this.config.get('volume');
            console.log(formatInfo(`Current volume: ${chalk.yellow(currentVolume + '%')}`));
            return;
        }

        const volume = validateVolume(level);
        if (volume === null) {
            console.log(formatError('Volume must be between 0 and 100'));
            return;
        }

        this.config.set('volume', volume);
        this.player.setVolume(volume);

        // Visual volume bar
        const barLength = 20;
        const filledLength = Math.floor((volume / 100) * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

        console.log(formatSuccess(`Volume set to ${volume}%`));
        console.log(`   ${chalk.green(bar)} ${chalk.yellow(volume + '%')}`);
    }

    private handleClear(): void {
        clearConsole();
        this.showWelcome();
        this.showStatusBar();
        if (this.isPlaying && this.currentStation) {
            this.showNowPlaying();
        }
    }

    private showHistory(): void {
        if (this.commandHistory.length === 0) {
            console.log(formatInfo('No command history'));
            return;
        }

        console.log('');
        console.log(chalk.bgCyan.black(' COMMAND HISTORY '));
        console.log('');

        const recentCommands = this.commandHistory.slice(-10); // Show last 10 commands
        recentCommands.forEach((cmd, index) => {
            console.log(`${chalk.dim((index + 1).toString().padStart(2))} ${chalk.yellow(cmd)}`);
        });
        console.log('');
    }

    private showHelp(): void {
        console.log('');
        console.log(chalk.bgGreen.black(' COMMANDS '));
        console.log('');

        const commands = [
            { cmd: 'play [station]', alias: 'p', desc: 'Play a station (by number, ID, or name)', example: 'play 1, play rp-mellow' },
            { cmd: 'stop', alias: 's', desc: 'Stop current playback', example: 'stop' },
            { cmd: 'stations', alias: 'l', desc: 'List all available stations', example: 'stations' },
            { cmd: 'status', alias: 'n', desc: 'Show current playback status', example: 'status' },
            { cmd: 'volume [0-100]', alias: 'v', desc: 'Set or show volume level', example: 'volume 50' },
            { cmd: 'clear', alias: 'cls', desc: 'Clear the screen', example: 'clear' },
            { cmd: 'history', alias: '', desc: 'Show command history', example: 'history' },
            { cmd: 'help', alias: 'h, ?', desc: 'Show this help message', example: 'help' },
            { cmd: 'exit', alias: 'q', desc: 'Exit the radio', example: 'exit' }
        ];

        commands.forEach(({ cmd, alias, desc, example }) => {
            const cmdStr = chalk.yellow(cmd.padEnd(18));
            const aliasStr = alias ? chalk.dim(`(${alias})`.padEnd(8)) : ' '.repeat(8);
            console.log(`  ${cmdStr} ${aliasStr} ${desc}`);
            if (example) {
                console.log(`    ${chalk.dim('Example:')} ${chalk.cyan(example)}`);
            }
            console.log('');
        });

        console.log(chalk.bgBlue.white(' TIPS '));
        console.log('');
        console.log(`  ${chalk.dim('•')} Use ${chalk.yellow('Tab')} for auto-completion`);
        console.log(`  ${chalk.dim('•')} Use ${chalk.yellow('↑/↓')} arrows for command history`);
        console.log(`  ${chalk.dim('•')} Commands are case-insensitive`);
        console.log(`  ${chalk.dim('•')} Type partial station names (e.g., "play paradise")`);
        console.log('');
    }

    private enableNonBlockingInput(): void {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false)
        }

        this.rl.on('SIGINT', () => {
            // Don't exit on Ctrl+C, just show help
            console.log('\n' + chalk.yellow('Tip: Use "stop" to stop playback, "exit" to quit'));
            this.showPrompt();
        });

        setInterval(() => {
            if (!this.rl.line && this.rl.terminal) {
                // Only refresh prompt if there's no active input
                this.rl.prompt(true);
            }
        }, 1000);
    }
}