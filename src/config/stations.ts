import type { Station } from '../types/index.js';

export const stations: Station[] = [
  {
    id: 'rp-mellow',
    name: 'Radio Paradise - Mellow Mix',
    url: 'http://stream.radioparadise.com/mellow-320',
    genre: 'Eclectic/Chill',
    description: 'DJ-mixed blend of modern and classic rock, electronica, world music',
    quality: '320kbps AAC'
  },
  {
    id: 'soma-groove',
    name: 'SomaFM - Groove Salad',
    url: 'http://ice1.somafm.com/groovesalad-256-mp3',
    genre: 'Chill/Ambient',
    description: 'A nicely chilled plate of ambient/downtempo beats and grooves',
    quality: '256kbps MP3'
  },
  {
    id: 'soma-deep',
    name: 'SomaFM - Deep Space One',
    url: 'http://ice1.somafm.com/deepspaceone-128-mp3',
    genre: 'Deep Ambient',
    description: 'Deep ambient electronic, experimental and space music',
    quality: '128kbps MP3'
  },
  {
    id: 'soma-lush',
    name: 'SomaFM - Lush',
    url: 'http://ice1.somafm.com/lush-128-mp3',
    genre: 'Mellow/Vocal',
    description: 'Sensuous and mellow vocals with an electronic influence',
    quality: '128kbps MP3'
  }
];

export const getStationById = (id: string): Station | undefined => {
  return stations.find(station => station.id === id);
};

export const getStationByName = (name: string): Station | undefined => {
  return stations.find(station =>
    station.name.toLowerCase().includes(name.toLowerCase())
  );
};

export const getDefaultStation = (): Station => {
  return stations[0];
};