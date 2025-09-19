import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import type { Station } from '../types/index.js';

export const formatStation = (station: Station): string => {
    return `${chalk.white.bold(station.name)} ${chalk.dim('•')} ${chalk.cyan(station.genre)}
   ${chalk.dim(station.description)}
   ${chalk.yellow(station.quality)} ${chalk.dim('•')} ${chalk.green(station.url)}`;
};

export const formatError = (message: string): string => {
    return `${chalk.red('❌')} ${chalk.red(message)}`;
};

export const formatSuccess = (message: string): string => {
    return `${chalk.green('✅')} ${chalk.green(message)}`;
};

export const formatInfo = (message: string): string => {
    return `${chalk.blue('ℹ️')} ${chalk.blue(message)}`;
};

export const formatMusic = (message: string): string => {
    return `${chalk.magenta('🎵')} ${chalk.white.bold(message)}`;
};

export const formatControl = (message: string): string => {
    return `${chalk.yellow('⏹️')} ${chalk.yellow(message)}`;
};

export const createSpinner = (text: string): any => {
    return ora({
        text: chalk.cyan(text),
        color: 'cyan',
        spinner: {
            interval: 80,
            frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
        }
    });
};

export const validateVolume = (input: string): number | null => {
    const volume = parseInt(input, 10);
    if (isNaN(volume) || volume < 0 || volume > 100) {
        return null;
    }
    return volume;
};

export const clearConsole = (): void => {
    process.stdout.write('\x1Bc');
};

export const checkFFmpeg = async (): Promise<boolean> => {
    return new Promise((resolve) => {
        const process = spawn('ffplay', ['-version'], {
            stdio: 'ignore',
            shell: true
        });

        process.on('error', () => resolve(false));
        process.on('close', (code) => resolve(code === 0 || code === 1));

        setTimeout(() => {
            process.kill();
            resolve(false);
        }, 3000);
    });
};

export const createProgressBar = (current: number, total: number, width: number = 30): string => {
    const percentage = Math.min(current / total, 1);
    const filledWidth = Math.floor(percentage * width);
    const emptyWidth = width - filledWidth;

    const filled = '█'.repeat(filledWidth);
    const empty = '░'.repeat(emptyWidth);
    const percent = Math.floor(percentage * 100);

    return `${chalk.green(filled)}${chalk.dim(empty)} ${chalk.yellow(percent + '%')}`;
};

export const typeWriter = async (text: string, delay: number = 50): Promise<void> => {
    for (let i = 0; i < text.length; i++) {
        process.stdout.write(text[i]);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    process.stdout.write('\n');
};

export const createBox = (text: string, padding: number = 2): string => {
    const lines = text.split('\n');
    const maxLength = Math.max(...lines.map(line => line.length));
    const width = maxLength + (padding * 2);

    const topBorder = '╭' + '─'.repeat(width) + '╮';
    const bottomBorder = '╰' + '─'.repeat(width) + '╯';

    const boxedLines = [topBorder];
    lines.forEach(line => {
        const padded = line.padEnd(maxLength);
        boxedLines.push('│' + ' '.repeat(padding) + padded + ' '.repeat(padding) + '│');
    });
    boxedLines.push(bottomBorder);

    return boxedLines.join('\n');
};

export const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
};

export const createNotification = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): string => {
    const icons = {
        info: '🔔',
        success: '🎉',
        warning: '⚠️',
        error: '🚨'
    };

    const colors = {
        info: chalk.blue,
        success: chalk.green,
        warning: chalk.yellow,
        error: chalk.red
    };

    const color = colors[type];
    const icon = icons[type];

    return `${icon} ${color.bold(title)}\n   ${color(message)}`;
};

export const formatMetadata = (metadata: any): string => {
    const parts = [];

    if (metadata.artist && metadata.title) {
        parts.push(`${chalk.cyan(metadata.artist)} - ${chalk.white(metadata.title)}`);
    } else if (metadata.title) {
        parts.push(chalk.white(metadata.title));
    }

    if (metadata.album) {
        parts.push(chalk.dim(`from ${metadata.album}`));
    }

    return parts.join(' ');
};

export class ActivityIndicator {
    private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private interval: NodeJS.Timeout | null = null;
    private currentFrame = 0;
    private text: string;

    constructor(text: string) {
        this.text = text;
    }

    start(): void {
        this.interval = setInterval(() => {
            process.stdout.write(`\r${chalk.cyan(this.frames[this.currentFrame])} ${this.text}`);
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }, 80);
    }

    stop(finalMessage?: string): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        process.stdout.write('\r\x1b[K');
        if (finalMessage) {
            console.log(finalMessage);
        }
    }
}

export const createGradient = (text: string): string => {
    const colors = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta];
    const chars = text.split('');

    return chars.map((char, index) => {
        const colorIndex = Math.floor((index / chars.length) * colors.length);
        const color = colors[colorIndex] || chalk.white;
        return color(char);
    }).join('');
};