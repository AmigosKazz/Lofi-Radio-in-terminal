import chalk from 'chalk';
import ora from 'ora';
import type { Station } from '../types/index.js';

export const formatStation = (station: Station): string => {
  return `${chalk.cyan(station.name)}
   ${chalk.dim(station.description)}
   ${chalk.yellow('Genre:')} ${station.genre}
   ${chalk.yellow('Quality:')} ${station.quality}`;
};

export const formatError = (message: string): string => {
  return chalk.red(`❌ Error: ${message}`);
};

export const formatSuccess = (message: string): string => {
  return chalk.green(`✅ ${message}`);
};

export const formatInfo = (message: string): string => {
  return chalk.cyan(`💡 ${message}`);
};

export const formatMusic = (message: string): string => {
  return chalk.cyan(`🎵 ${message}`);
};

export const formatControl = (message: string): string => {
  return chalk.yellow(`⏹️ ${message}`);
};

export const createSpinner = (text: string): any => {
  return ora({
    text,
    spinner: 'dots'
  });
};

export const validateVolume = (value: string): number | null => {
  const volume = parseInt(value, 10);
  if (isNaN(volume) || volume < 0 || volume > 100) {
    return null;
  }
  return volume;
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const clearConsole = (): void => {
  process.stdout.write('\x1Bc');
};

export const checkFFmpeg = async (): Promise<boolean> => {
  try {
    const { execSync } = await import('child_process');
    // Try different commands based on OS
    if (process.platform === 'win32') {
      try {
        // Try PowerShell command first
        execSync('powershell -Command "ffplay -version"', { stdio: 'ignore' });
        return true;
      } catch {
        // Try cmd
        execSync('cmd /c ffplay -version', { stdio: 'ignore' });
        return true;
      }
    } else {
      execSync('ffplay -version', { stdio: 'ignore' });
      return true;
    }
  } catch {
    return false;
  }
};