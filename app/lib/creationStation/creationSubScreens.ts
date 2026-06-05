/** Creation Station tools — shown as sub-nav under the Creation Station module. */

export type CreationSubScreenId =
  | 'beat-lab'
  | 'groove-lab'
  | 'chord-builder'
  | 'more'
  | '808-lab'
  | 'drum-kit-generator'
  | 'chord-bass-sequencer';

export type CreationStationTab =
  | 'grid'
  | 'groove-lab'
  | 'chord'
  | 'drums'
  | '808-lab'
  | 'chord-seq'
  | 'piano';

export const CREATION_SUB_SCREENS: {
  id: CreationSubScreenId;
  label: string;
  shortLabel: string;
  /** When false, hidden from Creation Station sub-nav (route still works). */
  navVisible?: boolean;
}[] = [
  { id: 'beat-lab', label: 'Beat Lab', shortLabel: 'Beat Lab' },
  { id: 'groove-lab', label: 'Groove Lab', shortLabel: 'Groove Lab' },
  { id: 'chord-builder', label: 'Chord Builder', shortLabel: 'Chord' },
  { id: 'more', label: 'More', shortLabel: 'More', navVisible: false },
  { id: '808-lab', label: '808 Lab', shortLabel: '808' },
  { id: 'drum-kit-generator', label: 'Drum Kit Generator', shortLabel: 'Kit Gen' },
  { id: 'chord-bass-sequencer', label: 'Chord / Bass Sequencer', shortLabel: 'Chord/Bass' },
];

/** Sub-nav picks under Creation Station (excludes reserved / future screens). */
export const CREATION_SUB_SCREENS_NAV = CREATION_SUB_SCREENS.filter((s) => s.navVisible !== false);

export function creationSubScreenToTab(sub: CreationSubScreenId): CreationStationTab {
  switch (sub) {
    case 'beat-lab':
      return 'grid';
    case 'groove-lab':
      return 'groove-lab';
    case 'chord-builder':
      return 'chord';
    case 'more':
      return 'drums';
    case '808-lab':
      return '808-lab';
    case 'drum-kit-generator':
      return 'grid';
    case 'chord-bass-sequencer':
      return 'chord-seq';
    default:
      return 'grid';
  }
}

export function creationTabToSubScreen(tab: CreationStationTab): CreationSubScreenId {
  switch (tab) {
    case 'grid':
      return 'beat-lab';
    case 'groove-lab':
      return 'groove-lab';
    case 'chord':
      return 'chord-builder';
    case 'drums':
      return 'more';
    case '808-lab':
      return '808-lab';
    case 'chord-seq':
      return 'chord-bass-sequencer';
    case 'piano':
      return 'beat-lab';
    default:
      return 'beat-lab';
  }
}
