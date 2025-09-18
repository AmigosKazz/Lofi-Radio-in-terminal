#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Conf from 'conf';
import { StreamPlayer } from '../player/StreamPlayer.js';
import { RadioREPL } from '../repl/RadioREPL.js';
import { stations, getStationById, getStationByName, getDefaultStation } from '../config/stations.js';
import {
  formatStation,
  formatError,
  formatSuccess,
  formatInfo,
  formatMusic,
  formatControl,
  createSpinner,
  validateVolume,
  checkFFmpeg
} from '../utils/helpers.js';
import type { Station, Config } from '../types/index.js';

const program = new Command();
const config = new Conf<Config>({
  projectName: 'lofi-radio',
  defaults: {
    lastStation: null,
    volume: 70,
    favorites: []
  }
});

const player = new StreamPlayer();
let currentSpinner: any = null;

player.on('playing', (station: Station) => {
  if (currentSpinner) {
    currentSpinner.succeed(formatSuccess(`Connected to ${station.name}`));
    currentSpinner = null;
  }
  console.log(formatMusic(`Now playing: ${station.name}`));
  console.log(chalk.dim(`   ${station.description}`));
  console.log(chalk.dim(`   Quality: ${station.quality}`));
  console.log(chalk.dim(`   Volume: ${player.getState().volume}%`));
  console.log('');
  console.log(chalk.dim('   Press Ctrl+C to stop or use "radio stop"'));
});

player.on('stopped', () => {
  console.log(formatControl('Playback stopped'));
});

player.on('error', (error) => {
  if (currentSpinner) {
    currentSpinner.fail(formatError(error.message));
    currentSpinner = null;
  }
});

player.on('reconnecting', (attempt: number) => {
  console.log(formatInfo(`Reconnecting... (attempt ${attempt})`));
});

program
  .name('radio')
  .description('A minimalist lofi radio CLI player')
  .version('1.0.0');

program
  .command('play [station]')
  .description('Play a lofi radio station')
  .option('-v, --volume <level>', 'Set volume (0-100)')
  .action(async (stationInput?: string, options?: any) => {
    const ffmpegInstalled = await checkFFmpeg();
    if (!ffmpegInstalled) {
      console.log(formatError('ffplay not found. Please install ffmpeg: https://ffmpeg.org/download.html'));
      process.exit(1);
    }

    let selectedStation: Station | undefined;

    if (stationInput) {
      selectedStation = getStationById(stationInput) || getStationByName(stationInput);
      if (!selectedStation) {
        console.log(formatError(`Station "${stationInput}" not found`));
        console.log(formatInfo('Use "radio stations" to see available stations'));
        process.exit(1);
      }
    } else {
      const lastStationId = config.get('lastStation');
      if (lastStationId) {
        selectedStation = getStationById(lastStationId);
      }

      if (!selectedStation) {
        const choices = stations.map(station => ({
          name: `${station.name} - ${station.genre}`,
          value: station.id
        }));

        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'station',
            message: 'Select a station:',
            choices
          }
        ]);

        selectedStation = getStationById(answer.station);
      }
    }

    if (!selectedStation) {
      selectedStation = getDefaultStation();
    }

    let volume = config.get('volume');
    if (options?.volume) {
      const parsedVolume = validateVolume(options.volume);
      if (parsedVolume === null) {
        console.log(formatError('Volume must be between 0 and 100'));
        process.exit(1);
      }
      volume = parsedVolume;
      config.set('volume', volume);
    }

    config.set('lastStation', selectedStation.id);

    currentSpinner = createSpinner(`Connecting to ${selectedStation.name}...`);
    currentSpinner.start();

    try {
      await player.play(selectedStation, volume);
    } catch (error: any) {
      if (currentSpinner) {
        currentSpinner.fail(formatError(error.message));
      }
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the current playback')
  .action(async () => {
    const state = player.getState();
    if (!state.isPlaying) {
      console.log(formatInfo('No station is currently playing'));
      process.exit(0);
    }

    await player.stop();
  });

program
  .command('status')
  .description('Show current playback status')
  .action(() => {
    const state = player.getState();

    if (!state.isPlaying || !state.currentStation) {
      console.log(formatMusic('Status: Not playing'));
    } else {
      console.log(formatMusic('Status: Playing'));
      console.log(`   Station: ${state.currentStation.name}`);
      console.log(`   Genre: ${state.currentStation.genre}`);
      console.log(`   Uptime: ${player.getUptime()}`);
      console.log(`   Volume: ${state.volume}%`);
    }
  });

program
  .command('stations')
  .description('List all available stations')
  .action(() => {
    console.log(formatMusic('Available Stations:\n'));
    stations.forEach((station, index) => {
      console.log(`${chalk.yellow(`[${station.id}]`)} ${formatStation(station)}`);
      if (index < stations.length - 1) {
        console.log('');
      }
    });
  });

program
  .command('volume [level]')
  .description('Set or show volume level (0-100)')
  .action((level?: string) => {
    if (!level) {
      const currentVolume = config.get('volume');
      console.log(formatInfo(`Current volume: ${currentVolume}%`));
      return;
    }

    const volume = validateVolume(level);
    if (volume === null) {
      console.log(formatError('Volume must be between 0 and 100'));
      process.exit(1);
    }

    config.set('volume', volume);
    player.setVolume(volume);
    console.log(formatSuccess(`Volume set to ${volume}%`));

    if (player.getState().isPlaying) {
      console.log(formatInfo('Volume will be applied on next play'));
    }
  });

// If no arguments provided, launch interactive REPL mode
if (process.argv.length === 2) {
  const ffmpegInstalled = await checkFFmpeg();
  if (!ffmpegInstalled) {
    console.log(formatError('ffplay not found. Please install ffmpeg: https://ffmpeg.org/download.html'));
    process.exit(1);
  }

  const repl = new RadioREPL(player, config);
  repl.start();
} else {
  // Normal CLI mode with commands
  process.on('SIGINT', async () => {
    console.log('\n' + formatInfo('Shutting down...'));
    await player.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await player.stop();
    process.exit(0);
  });

  program.parse();
}