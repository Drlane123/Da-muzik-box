/**
 * Chord Generator compose phrase library — genre profiles + instruction rules.
 * Matcher/scoring lives in se2ChordGenieAutoCompose.ts.
 */

export type ChordGenieGenreProfile = {
  genreId: string;
  strong: readonly string[];
  medium: readonly string[];
  weak: readonly string[];
};

export type ChordGenieInstructionRule = {
  genres?: readonly string[];
  anyOf: readonly string[];
  allOf?: readonly string[];
  /** Substrings matched against preset id or label. */
  idBoosts?: readonly string[];
  /** Full preset id `${genreId}::${progressionId}`. */
  pickId?: string;
  pickByGenre?: Partial<Record<string, string>>;
  label: string;
};

export const CHORD_GENIE_GENRE_PROFILES: readonly ChordGenieGenreProfile[] = [
  {
    genreId: 'pop-eras',
    strong: ['70s pop', '80s pop', '90s pop', '2000s pop', 'yacht', 'teen', 'arena', 'writer'],
    medium: ['soft rock', 'piano bar', 'power ballad', 'era'],
    weak: ['decade', 'classic pop'],
  },
  {
    genreId: 'kpop-eras',
    strong: ['kpop', 'k-pop', 'k pop', 'idol', 'korean', 'comeback'],
    medium: ['chant', 'hook', 'title track', 'chorus'],
    weak: ['bright', 'cute'],
  },
  {
    genreId: 'neo-soul-eras',
    strong: ['neo soul', 'neosoul', 'neo-soul', 'dangelo', 'erykah', 'maxwell', 'jill scott'],
    medium: ['silk', 'velvet', 'warm glide', 'lush vamp', 'modern turn'],
    weak: ['groove', 'smooth'],
  },
  {
    genreId: 'soul-eras',
    strong: ['classic soul', 'motown', 'philly soul', 'memphis soul'],
    medium: ['curtis', 'aretha', 'al green', 'stevie soul'],
    weak: ['soul'],
  },
  {
    genreId: 'deep-rnb',
    strong: ['deep rnb', 'deep r&b', 'deep chords', 'deep cards', 'deep soul', 'deep rnb chords', 'deep rnb cards'],
    medium: ['quiet storm', 'velvet crawl', 'candle glow', 'late neon', 'orchid haze'],
    weak: ['deep', 'midnight', 'silk porch'],
  },
  {
    genreId: 'rich-jazz',
    strong: [
      'rich jazz',
      'neo jazz',
      'neojazz',
      'neo-jazz',
      'jazz neo',
      '70s soul jazz',
      'soul jazz',
      'building blocks jazz',
    ],
    medium: ['lush ii v', 'modal crawl', 'velvet soul jazz', 'dark jazz', 'gospel jazz'],
    weak: ['jazz', 'bebop', 'swing', 'rhodes'],
  },
  {
    genreId: 'deep-neo',
    strong: ['deep neo', 'deepneo', 'deep neo soul', 'maj13', '6/9', 'm11 palette'],
    medium: ['lush colors', 'rhodes 6/9', 'quiet storm colors', 'rearrangeable chords'],
    weak: ['deep', 'palette', 'colors'],
  },
  {
    genreId: 'rnb-true',
    strong: ['modern rnb', 'true rnb', 'contemporary rnb', 'true r&b'],
    medium: ['silk', 'velvet', 'late night'],
    weak: ['smooth'],
  },
  {
    genreId: 'rnb',
    strong: ['rnb', 'r and b', 'r&b', 'slow jam', 'quiet storm', 'bedroom'],
    medium: ['soulful', 'smooth', 'velvet', 'silk', 'intimate', 'late night', 'modern rnb'],
    weak: ['soft', 'warm', 'mellow', 'turnaround'],
  },
  {
    genreId: 'rnb-eras',
    strong: ['slow jam era', 'rnb eras', 'club rnb', 'alt rnb'],
    medium: ['babyface', 'usher', 'weeknd', 'sza', 'neo loop'],
    weak: ['late night', 'piano soul'],
  },
  {
    genreId: 'rnb-70s80s',
    strong: ['70s soul', '80s soul', '70s rnb', '80s rnb', 'philly', 'quiet storm', 'marvin', 'stevie'],
    medium: ['soul train', 'horn section', 'vandross', 'curtis', 'ewf'],
    weak: ['mercy', 'lovely day'],
  },
  {
    genreId: 'rnb-90s',
    strong: ['90s rnb', '90s r&b', 'jodeci', 'boyz', 'mariah', 'slow jam', 'new jack'],
    medium: ['group harmony', 'diva', '90s soul', 'tlc', 'babyface'],
    weak: ['heart', 'cloud'],
  },
  {
    genreId: 'gospel',
    strong: ['gospel', 'church', 'praise', 'worship', 'amen', 'spiritual'],
    medium: ['2-5-1', '2 5 1', 'back door', 'circle', 'lift'],
    weak: ['resolve', 'shout'],
  },
  {
    genreId: 'jazz',
    strong: ['jazz', 'bebop', 'swing', 'standards', 'coltrane', 'bossa'],
    medium: ['ii v', '2 5', 'rhythm changes', '251', '2-5-1', 'turnaround'],
    weak: ['walk', 'substitution'],
  },
  {
    genreId: 'trap',
    strong: ['trap', 'drill', 'metro', 'dark trap', '808 chords', 'phonk'],
    medium: ['haunt', 'step', 'rise', 'minor trap'],
    weak: ['sparse', 'moody'],
  },
  {
    genreId: 'house',
    strong: ['house', 'deep house', 'tech house', 'chicago', 'warehouse'],
    medium: ['four on the floor', 'club', 'loop', 'uplift'],
    weak: ['driving', 'jack'],
  },
  {
    genreId: 'dance',
    strong: ['dance', 'edm', 'festival', 'club banger', 'mainstage', 'kpop', 'k-pop', 'k pop', 'idol'],
    medium: ['drop', 'anthem', 'build', 'rave', 'dark club', 'brat'],
    weak: ['energy', 'peak', 'chant'],
  },
  {
    genreId: 'disco',
    strong: ['disco', 'funk', '70s', 'four on the floor', 'boogie'],
    medium: ['shine', 'vamp', 'turnaround'],
    weak: ['mirror ball', 'groove'],
  },
  {
    genreId: 'ballad-80s',
    strong: ['ballad', 'power ballad', '80s ballad', 'slow dance', 'soft rock ballad'],
    medium: ['careless', 'endless love', 'inspirational', 'prayer'],
    weak: ['emotional', 'tearjerker'],
  },
  {
    genreId: 'doowop',
    strong: ['doowop', 'doo wop', '50s', 'oldies', 'ice cream changes'],
    medium: ['street corner', 'crooner', 'sweetheart', 'teenager'],
    weak: ['classic frame'],
  },
  {
    genreId: 'hiphop',
    strong: ['hip hop', 'hiphop', 'boom bap', 'sample flip'],
    medium: ['loop', 'vinyl', 'head nod'],
    weak: ['dusty', 'classic'],
  },
  {
    genreId: 'rock',
    strong: ['rock', 'arena', 'anthem rock', 'power chord'],
    medium: ['open fifth', 'stadium'],
    weak: ['driving', 'crunch'],
  },
  {
    genreId: 'blues',
    strong: ['blues', 'shuffle', '12 bar', '12-bar', 'delta'],
    medium: ['turnaround', 'dominant'],
    weak: ['gritty', 'swamp'],
  },
  {
    genreId: 'lofi',
    strong: ['lofi', 'lo-fi', 'lo fi', 'study beat', 'chill hop'],
    medium: ['dusty', 'warm', 'vinyl'],
    weak: ['mellow', 'sleep'],
  },
  {
    genreId: 'funk',
    strong: ['funk', 'p funk', 'groove pocket', 'syncopated'],
    medium: ['clav', 'slap', 'one chord'],
    weak: ['tight', 'pocket'],
  },
  {
    genreId: 'country',
    strong: ['country', 'nashville', 'honky tonk', 'americana'],
    medium: ['train beat', 'twang'],
    weak: ['story', 'open road'],
  },
  {
    genreId: 'afrobeat',
    strong: ['afro', 'afrobeats', 'afropop', 'amapiano', 'naija', 'highlife', 'log drum'],
    medium: ['lagos', 'makosa', 'piano'],
    weak: ['bounce', 'gbedu'],
  },
  {
    genreId: 'reggae',
    strong: ['reggae', 'dub', 'dancehall', 'ska', 'roots', 'rocksteady'],
    medium: ['one drop', 'island', 'riddim'],
    weak: ['offbeat', 'skank'],
  },
  {
    genreId: 'uk-garage',
    strong: ['uk garage', 'garage', '2 step', '2step', 'speed garage'],
    medium: ['shuffle', 'swing'],
    weak: ['skippy'],
  },
] as const;

export const CHORD_GENIE_INSTRUCTION_RULES: readonly ChordGenieInstructionRule[] = [
  {
    anyOf: ['axis', 'four chord', '1 5 6 4', 'i v vi iv', '1564'],
    idBoosts: ['axis', 'pop-axis'],
    label: 'Axis progression',
  },
  {
    anyOf: ['sensitive', 'vi iv i v', '6415'],
    idBoosts: ['sensitive', 'flip'],
    label: 'Sensitive progression',
  },
  {
    anyOf: ['50s', 'fifties', 'doo wop frame', 'i vi iv v'],
    genres: ['doowop', 'pop'],
    pickId: 'doowop::doowop-ice',
    label: '50s changes',
  },
  {
    anyOf: ['slow jam', 'slowjam', 'bedroom rnb'],
    pickId: 'rnb-90s::rnb90-ballad',
    label: 'Slow jam',
  },
  {
    anyOf: ['quiet storm'],
    idBoosts: ['quiet', 'rnb-quiet'],
    label: 'Quiet storm',
  },
  {
    anyOf: ['2-5-1', '2 5 1', '251', 'ii v i', 'two five one'],
    genres: ['jazz'],
    pickId: 'jazz::jazz-251',
    label: 'ii–V–I',
  },
  {
    anyOf: ['2-5-1', '2 5 1', '251', 'ii v i', 'two five one'],
    genres: ['rnb', 'rnb-90s', 'rnb-70s80s'],
    pickId: 'rnb::rnb-25',
    label: 'ii–V–I soul',
  },
  {
    anyOf: ['rhythm changes'],
    pickId: 'jazz::jazz-rhythm',
    label: 'Rhythm changes',
  },
  {
    anyOf: ['gospel amen', 'amen progression', 'amen loop'],
    pickId: 'gospel::gospel-amen',
    label: 'Gospel amen',
  },
  {
    anyOf: ['gospel 2-5', 'gospel two five', 'praise lift'],
    pickId: 'gospel::gospel-25',
    label: 'Gospel 2-5-1',
  },
  {
    anyOf: ['back door', 'backdoor'],
    pickId: 'gospel::gospel-back',
    label: 'Back door cadence',
  },
  {
    anyOf: ['trap dark', 'dark trap', 'haunting trap', 'drill chords'],
    pickId: 'trap::trap-haunt',
    label: 'Dark trap',
  },
  {
    anyOf: ['trap drill', 'drill progression'],
    pickId: 'trap::trap-drill',
    label: 'Drill loop',
  },
  {
    anyOf: ['deep house', 'house deep'],
    pickId: 'house::house-deep',
    label: 'Deep house',
  },
  {
    anyOf: ['kpop', 'k-pop', 'k pop', 'idol chorus'],
    idBoosts: ['kpop', 'dance-kpop'],
    label: 'K-Pop',
  },
  {
    anyOf: ['kpop glow', 'k-pop glow', 'idol glow'],
    pickId: 'dance::dance-kpopglow',
    label: 'K-Pop glow',
  },
  {
    anyOf: ['dark club', 'brat', 'night club dark'],
    pickId: 'dance::dance-darkbrat',
    label: 'Dark club',
  },
  {
    anyOf: ['disco vamp', 'disco loop'],
    pickId: 'dance::dance-discovamp',
    label: 'Disco vamp',
  },
  {
    anyOf: ['afro gospel', 'afro praise'],
    pickId: 'afrobeat::afro-gospel',
    label: 'Afro gospel',
  },
  {
    anyOf: ['amapiano', 'piano log'],
    pickId: 'afrobeat::afro-amapiano',
    label: 'Amapiano jazz',
  },
  {
    anyOf: ['reggae skank', 'one drop chords', 'island groove'],
    pickByGenre: { reggae: 'reggae::reg-skank' },
    pickId: 'reggae::reg-skank',
    label: 'Reggae skank',
  },
  {
    anyOf: ['power ballad', '80s ballad', 'slow dance ballad'],
    pickId: 'ballad-80s::ballad-power',
    label: 'Power ballad',
  },
  {
    anyOf: ['lofi loop', 'study chords', 'chill loop'],
    pickId: 'lofi::lofi-study',
    label: 'Lo-fi loop',
  },
  {
    anyOf: ['passing chord', 'passing chords', 'add passing', 'with passing'],
    label: 'Passing chords',
  },
  {
    anyOf: ['wheel walk', 'from wheel', 'tonic walk', 'key wheel'],
    label: 'Key wheel walk',
  },
  {
    anyOf: ['random', 'surprise me', 'roll', 'shuffle'],
    label: 'Random pick',
  },
] as const;

export const SE2_CHORD_GENIE_COMPOSE_EXAMPLES: readonly string[] = [
  'give me chords in G major four bar chart make it R&B bpm 88',
  'seventies soul R&B bpm 92',
  'eighties rnb 4 bars bpm 100',
  'nineties slow jam bpm 72',
  'sixties rnb bpm 88',
  'pop axis progression 8 bars bpm 120',
  'gospel 2-5-1 in F major',
  'trap dark minor 4 bars',
  'R&B slow jam with passing chord',
  'kpop chorus 8 bars bpm 128',
  'jazz ii v i in Bb major',
  'afro amapiano 4 bars',
  'reggae skank progression bpm 90',
];
