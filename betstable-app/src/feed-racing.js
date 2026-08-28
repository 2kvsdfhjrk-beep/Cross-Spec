/* feed-racing.js — generates racecards for every major racing jurisdiction.
   Names of horses, jockeys and trainers are invented: this is sample data and
   should never attribute a fabricated record to a real person or animal. */
(function (BS) {
  'use strict';
  const C = BS.core;

  /* ---------- jurisdictions ----------
     Regions are the grouping the user sees. Ireland sits inside UK & Ireland,
     Canada inside USA & Canada, New Zealand inside Australia & NZ. */
  const REGIONS = [
    { id: 'uki', name: 'UK & Ireland', flag: '🇬🇧', style: 'euro', order: 1 },
    { id: 'usa', name: 'USA & Canada', flag: '🇺🇸', style: 'usa', order: 2 },
    { id: 'fra', name: 'France', flag: '🇫🇷', style: 'euro', order: 3 },
    { id: 'hkg', name: 'Hong Kong', flag: '🇭🇰', style: 'hkg', order: 4 },
    { id: 'aus', name: 'Australia & NZ', flag: '🇦🇺', style: 'aus', order: 5 },
    { id: 'jpn', name: 'Japan', flag: '🇯🇵', style: 'jpn', order: 6 },
    { id: 'uae', name: 'UAE', flag: '🇦🇪', style: 'euro', order: 7 },
    { id: 'saf', name: 'South Africa', flag: '🇿🇦', style: 'euro', order: 8 },
    { id: 'eur', name: 'Rest of Europe', flag: '🇪🇺', style: 'euro', order: 9 }
  ];

  // [name, country flag, tz, surface, first-race local hour, minute, races]
  const VENUES = [
    ['Ascot', 'uki', '🇬🇧', 'Europe/London', 'turf', 13, 50, 7],
    ['Newmarket', 'uki', '🇬🇧', 'Europe/London', 'turf', 14, 10, 7],
    ['York', 'uki', '🇬🇧', 'Europe/London', 'turf', 13, 30, 7],
    ['Doncaster', 'uki', '🇬🇧', 'Europe/London', 'turf', 14, 0, 7],
    ['Goodwood', 'uki', '🇬🇧', 'Europe/London', 'turf', 13, 15, 6],
    ['Haydock Park', 'uki', '🇬🇧', 'Europe/London', 'turf', 13, 45, 7],
    ['Chepstow', 'uki', '🇬🇧', 'Europe/London', 'turf', 14, 25, 6],
    ['Ayr', 'uki', '🇬🇧', 'Europe/London', 'turf', 13, 20, 7],
    ['Kempton Park (AW)', 'uki', '🇬🇧', 'Europe/London', 'aw', 17, 45, 8],
    ['Wolverhampton (AW)', 'uki', '🇬🇧', 'Europe/London', 'aw', 17, 30, 8],
    ['The Curragh', 'uki', '🇮🇪', 'Europe/Dublin', 'turf', 14, 5, 7],
    ['Leopardstown', 'uki', '🇮🇪', 'Europe/Dublin', 'turf', 14, 30, 7],
    ['Galway', 'uki', '🇮🇪', 'Europe/Dublin', 'turf', 17, 20, 7],
    ['Dundalk (AW)', 'uki', '🇮🇪', 'Europe/Dublin', 'aw', 18, 0, 8],
    ['Naas', 'uki', '🇮🇪', 'Europe/Dublin', 'turf', 13, 55, 7],

    ['Saratoga', 'usa', '🇺🇸', 'America/New_York', 'dirt', 13, 5, 9],
    ['Belmont at Aqueduct', 'usa', '🇺🇸', 'America/New_York', 'dirt', 12, 45, 9],
    ['Gulfstream Park', 'usa', '🇺🇸', 'America/New_York', 'dirt', 12, 30, 10],
    ['Churchill Downs', 'usa', '🇺🇸', 'America/New_York', 'dirt', 12, 45, 9],
    ['Keeneland', 'usa', '🇺🇸', 'America/New_York', 'dirt', 13, 0, 9],
    ['Del Mar', 'usa', '🇺🇸', 'America/Los_Angeles', 'dirt', 14, 0, 9],
    ['Santa Anita Park', 'usa', '🇺🇸', 'America/Los_Angeles', 'dirt', 12, 30, 8],
    ['Oaklawn Park', 'usa', '🇺🇸', 'America/Chicago', 'dirt', 13, 0, 9],
    ['Woodbine', 'usa', '🇨🇦', 'America/Toronto', 'aw', 13, 10, 9],

    ['ParisLongchamp', 'fra', '🇫🇷', 'Europe/Paris', 'turf', 13, 20, 8],
    ['Deauville', 'fra', '🇫🇷', 'Europe/Paris', 'turf', 13, 5, 8],
    ['Chantilly', 'fra', '🇫🇷', 'Europe/Paris', 'turf', 13, 40, 8],
    ['Saint-Cloud', 'fra', '🇫🇷', 'Europe/Paris', 'turf', 14, 0, 8],
    ['Maisons-Laffitte', 'fra', '🇫🇷', 'Europe/Paris', 'turf', 13, 30, 7],

    ['Sha Tin', 'hkg', '🇭🇰', 'Asia/Hong_Kong', 'turf', 12, 45, 10],
    ['Happy Valley', 'hkg', '🇭🇰', 'Asia/Hong_Kong', 'turf', 18, 45, 9],

    ['Flemington', 'aus', '🇦🇺', 'Australia/Melbourne', 'turf', 12, 10, 9],
    ['Caulfield', 'aus', '🇦🇺', 'Australia/Melbourne', 'turf', 12, 30, 9],
    ['Moonee Valley', 'aus', '🇦🇺', 'Australia/Melbourne', 'turf', 17, 40, 8],
    ['Randwick', 'aus', '🇦🇺', 'Australia/Sydney', 'turf', 12, 20, 9],
    ['Rosehill Gardens', 'aus', '🇦🇺', 'Australia/Sydney', 'turf', 12, 45, 8],
    ['Eagle Farm', 'aus', '🇦🇺', 'Australia/Brisbane', 'turf', 12, 0, 8],
    ['Ascot (Perth)', 'aus', '🇦🇺', 'Australia/Perth', 'turf', 12, 15, 8],
    ['Ellerslie', 'aus', '🇳🇿', 'Pacific/Auckland', 'turf', 12, 5, 8],
    ['Trentham', 'aus', '🇳🇿', 'Pacific/Auckland', 'turf', 12, 25, 8],

    ['Tokyo', 'jpn', '🇯🇵', 'Asia/Tokyo', 'turf', 9, 55, 12],
    ['Nakayama', 'jpn', '🇯🇵', 'Asia/Tokyo', 'turf', 9, 50, 12],
    ['Hanshin', 'jpn', '🇯🇵', 'Asia/Tokyo', 'turf', 10, 5, 12],
    ['Kyoto', 'jpn', '🇯🇵', 'Asia/Tokyo', 'turf', 10, 0, 11],
    ['Chukyo', 'jpn', '🇯🇵', 'Asia/Tokyo', 'dirt', 9, 45, 11],

    ['Meydan', 'uae', '🇦🇪', 'Asia/Dubai', 'turf', 16, 30, 8],
    ['Jebel Ali', 'uae', '🇦🇪', 'Asia/Dubai', 'dirt', 14, 15, 7],
    ['Abu Dhabi', 'uae', '🇦🇪', 'Asia/Dubai', 'turf', 16, 0, 7],

    ['Turffontein', 'saf', '🇿🇦', 'Africa/Johannesburg', 'turf', 12, 20, 8],
    ['Greyville', 'saf', '🇿🇦', 'Africa/Johannesburg', 'turf', 12, 40, 8],
    ['Kenilworth', 'saf', '🇿🇦', 'Africa/Johannesburg', 'turf', 13, 0, 8],
    ['Fairview', 'saf', '🇿🇦', 'Africa/Johannesburg', 'aw', 12, 50, 8],

    ['Baden-Baden', 'eur', '🇩🇪', 'Europe/Berlin', 'turf', 13, 30, 7],
    ['Cologne', 'eur', '🇩🇪', 'Europe/Berlin', 'turf', 14, 0, 7],
    ['Capannelle', 'eur', '🇮🇹', 'Europe/Rome', 'turf', 15, 10, 7],
    ['San Siro', 'eur', '🇮🇹', 'Europe/Rome', 'turf', 15, 30, 7],
    ['Bro Park', 'eur', '🇸🇪', 'Europe/Stockholm', 'turf', 13, 50, 8],
    ['Øvrevoll', 'eur', '🇳🇴', 'Europe/Oslo', 'turf', 14, 15, 7]
  ].map(v => ({
    id: v[0].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: v[0], region: v[1], flag: v[2], tz: v[3],
    surface: v[4], hour: v[5], min: v[6], nRaces: v[7]
  }));

  /* ---------- name pools (invented) ---------- */
  const HORSES = {
    euro: ['Ashcroft Lad', 'Quiet Furlong', 'Blackthorn Bay', 'Marram Grass', 'Copper Kettle',
      'Salt Marsh', 'Winter Bramble', 'Handsome Devil', 'Ravensworth', 'Little Compton',
      'Hedgerow King', 'Peat Fire', 'Silver Birch Lane', 'Mistle Thrush', 'Gorse Hill',
      'Barleycorn', 'Northern Draft', 'Fenwick Rose', 'Tumbledown', 'Lark Ascending',
      'Old Stone Wall', 'Clover Deep', 'Rowan Tree', 'Thistledown Boy', 'Harrow Gate',
      'Kestrel Watch', 'Bramblewick', 'Sorrel Meadow', 'Dunmore Prince', 'Cloudberry'],
    usa: ['Sundown Rambler', 'Bourbon County', 'Cold Creek Kid', 'Prairie Smoke', 'Dixie Freight',
      'Hard Eight', 'Mesquite Flats', 'Copper Penny Run', 'Nightshift Ned', 'Gulf Wind',
      'Ranger Station', 'Blue Ridge Holler', 'Tailgate Charlie', 'Sawgrass Silver', 'Diamond Lane',
      'Rustbelt Rocket', 'Painted Pony Bay', 'Louisiana Line', 'Big Sky Sonny', 'Two Lane Blacktop',
      'Hickory Switch', 'Cactus Junction', 'Foreman\'s Daughter', 'Roadhouse Red', 'Steamboat Sal',
      'Kentucky Cold Brew', 'Wildcat Draw', 'Pelican Bay Kid', 'Dust Devil Dan', 'Tin Roof Blues'],
    hkg: ['Golden Sixty Four', 'Lucky Sword', 'Winning Harbour', 'Beauty Runner', 'Fortune Panda',
      'Dragon Ascent', 'Happy Merchant', 'Jolly Banker', 'Red Lantern Sprint', 'Prosper Again',
      'Silver Star Ferry', 'Mighty Cargo', 'Victory Peak', 'Sunny Diamond', 'Rich Harvest Moon',
      'Kowloon Flyer', 'Ever Brilliant', 'Turbo Fortune', 'Champion Tycoon', 'Grand Bauhinia',
      'Sky Tower Blaze', 'Money Talks Fast', 'Noble Junction', 'Speedy Jade', 'Perfect Match Ten',
      'Great Wall Runner', 'Fortune Teller Bay', 'Regal Typhoon', 'Star Of Aberdeen', 'Golden Mile Kid'],
    jpn: ['Sakura Meteor', 'Kitasan Thunder', 'Meisho Aurora', 'Daiwa Horizon', 'Tosen Lantern',
      'Admire Falcon', 'Copano Nightfall', 'Satono Comet', 'Win Marigold', 'Shonan Blizzard',
      'Curren Sandpiper', 'Gold Ship Junior', 'Symboli Voyage', 'Narita Whisper', 'Air Cadenza',
      'Rey de Kyoto', 'Danon Cascade', 'Hishi Monsoon', 'Tanino Riverside', 'Mejiro Ember',
      'Seiun Skyline', 'Yamanin Torrent', 'Marvelous Pine', 'Taiki Vagabond', 'Nishino Drifter',
      'Fuji Kiseki Bay', 'Orfevre Echo', 'Suzuka Lantern', 'Tokai Frontier', 'Buena Serenade'],
    aus: ['Barcoo Drifter', 'Mallee Bull', 'Sandgroper Sam', 'Bondi Rip', 'Woolshed Winnie',
      'Ute Full Of Hay', 'Bunyip Express', 'Tallowwood', 'Silverwater Sal', 'Kalgoorlie Gold',
      'Paddock Bash', 'Coolabah Colt', 'Southerly Buster', 'Cattle Dog Crossing', 'Wattle Seed',
      'Redgum Rocket', 'Gundagai Grey', 'Snowy River Boy', 'Lorne Point', 'Billabong Blue',
      'Kiwi Crosswind', 'Waikato Warrior', 'Tasman Tide', 'Jindabyne Jack', 'Boomerang Bay',
      'Marlborough Sound', 'Dusty Bore', 'Pilbara Prince', 'Northland Nell', 'Great Barrier Gus']
  };
  const JOCKEYS = {
    euro: ['R. Callaghan', 'T. Mowbray', 'J. Devine', 'S. Hartnett', 'D. Fenwick', 'A. Doohan',
      'K. Rafferty', 'M. Ainsworth', 'P. Kilbride', 'L. Broadhurst', 'C. Naughton', 'E. Marchetti',
      'F. Lemoine', 'H. Pettigrew', 'N. Gallagher', 'B. Öhman'],
    usa: ['J. Whitfield', 'M. Delgado', 'R. Santoro', 'T. Beaumont', 'C. Ruiz Jr', 'D. Hollins',
      'A. Prewitt', 'L. Marchetti', 'K. Boudreaux', 'S. Vasquez', 'W. Tanner', 'P. Okafor',
      'G. Lindqvist', 'H. Camacho', 'E. Sandoval', 'B. Rowntree'],
    hkg: ['K. C. Leung', 'A. Badel-Fong', 'M. Chadwick Jr', 'H. T. Mo', 'V. Borges', 'C. Y. Ho',
      'D. Whyte-Lam', 'J. Poon', 'K. Teetan Jr', 'M. F. Poon', 'R. Maia', 'L. Hewitson Jr',
      'A. Atzeni Jr', 'Y. L. Chung', 'B. Avdulla Jr', 'K. H. Chan'],
    jpn: ['Y. Take Jr', 'C. Lemaire Jr', 'K. Matsuyama', 'H. Sakai', 'R. Iwata', 'M. Demuro Jr',
      'T. Yokoyama', 'S. Kawada Jr', 'A. Fujioka', 'N. Tosaki', 'K. Ikezoe', 'D. Nishimura',
      'Y. Fukunaga Jr', 'M. Katsuura', 'H. Miyuki', 'T. Danno'],
    aus: ['J. McDonald Jr', 'K. McEvoy Jr', 'C. Williams Jr', 'B. Melham Jr', 'T. Berry Jr',
      'R. King', 'D. Yendall Jr', 'M. Zahra Jr', 'L. Currie Jr', 'H. Coffey Jr', 'J. Bowman Jr',
      'A. Hyeronimus', 'W. Pike Jr', 'S. Collett Jr', 'O. Bosson Jr', 'N. Rawiller Jr']
  };
  const TRAINERS = {
    euro: ['Gosforth Lodge', 'A. Wetherby', 'M. O\'Halloran', 'C. Ridgeway', 'S. Delacroix',
      'P. Kinsella', 'J. Ashcombe', 'R. Vanderveld', 'T. Brennan', 'L. Moncrieff', 'D. Sartori', 'K. Halvorsen'],
    usa: ['R. Castellano Sr', 'B. Whitlock', 'M. Aguilar', 'S. Pemberton', 'D. Cruz Stables',
      'K. Lindstrom', 'T. Ravenwood', 'C. Oyelaran', 'J. Petrosian', 'A. Duquesne', 'H. Barlow', 'N. Ferraro'],
    hkg: ['C. S. Shum Jr', 'D. Hall-Wong', 'A. Cruz Jr', 'F. Lor Jr', 'P. Yiu Jr', 'M. Newnham Jr',
      'D. Eustace Jr', 'J. Size Jr', 'C. Fownes Jr', 'K. W. Lui', 'B. Cheung', 'T. P. Yung'],
    jpn: ['Y. Tomomichi', 'H. Otonashi', 'K. Sugai', 'M. Nakauchida', 'S. Kunieda Jr', 'T. Yasuda Jr',
      'N. Hori Jr', 'R. Takahashi', 'A. Fujiwara Jr', 'D. Kikuzawa', 'M. Ito', 'S. Shikato'],
    aus: ['Waller Park', 'C. Maher Jr', 'A. Freedman Jr', 'G. Waterhouse Jr', 'M. Price Jr',
      'B. Hayes Jr', 'K. Baker', 'J. Cummings Jr', 'T. Busuttin', 'R. Laming', 'S. Marsh Jr', 'P. Baker']
  };

  const GOING = {
    turf: ['Good', 'Good to Firm', 'Good to Soft', 'Firm', 'Soft', 'Heavy'],
    dirt: ['Fast', 'Fast', 'Muddy', 'Sloppy', 'Wet Fast'],
    aw: ['Standard', 'Standard', 'Standard to Slow', 'Standard to Fast']
  };
  const SILK_COLORS = ['#C4693D', '#2F5233', '#E4B363', '#7FB069', '#4A3323', '#F6EDDD',
    '#2C2016', '#8E4A2E', '#AECBA0', '#6B4A32', '#D9534F', '#3E6B8A'];
  const SILK_PATTERNS = ['solid', 'halved', 'hoops', 'stripes', 'chevron', 'star', 'sash'];

  function raceTitle(r, region, cls, dist) {
    const sponsors = ['Betstable', 'Racing Post', 'Tote', 'Watch & Bet', 'Racing TV', 'Bookmakers'];
    if (region === 'fra') return C.pick(r, ['Prix de la Chapelle', 'Prix des Tourelles', 'Prix du Bois Joli',
      'Prix de Meautry', 'Prix Vermeille Trial', 'Prix de la Cascade']);
    if (region === 'jpn') return C.pick(r, ['Yayoi Sho', 'Sapporo Nikkei Open', 'Fuji Stakes',
      'Kokura Kinen', 'Keisei Hai', 'Sankei Sho']);
    if (region === 'usa') return C.pick(r, ['Allowance Optional Claiming', 'Maiden Special Weight',
      'Starter Handicap', 'Claiming $25,000', 'Stakes — Listed', 'Maiden Claiming']);
    if (region === 'hkg') return C.pick(r, ['Class 3 Handicap', 'Class 4 Handicap', 'Class 2 Handicap',
      'Griffin Race', 'Class 5 Handicap']);
    return C.pick(r, sponsors) + ' ' + C.pick(r, ['Handicap', 'Novice Stakes', 'Maiden Stakes',
      'Classified Stakes', 'Nursery Handicap', 'Fillies\' Handicap']) + ' (' + cls + ')';
  }

  function distanceFor(r, region) {
    const metric = ['fra', 'hkg', 'jpn', 'aus', 'uae', 'saf', 'eur'].indexOf(region) >= 0;
    if (metric) return C.pick(r, [1000, 1200, 1400, 1600, 1800, 2000, 2400, 2800]) + 'm';
    const f = C.pick(r, [5, 6, 7, 8, 9, 10, 12, 14, 16]);
    return f < 8 ? f + 'f' : (Math.floor(f / 8) + 'm' + (f % 8 ? ' ' + (f % 8) + 'f' : ''));
  }

  function makeRunners(r, style, n, declared) {
    const horses = C.pickN(r, HORSES[style], n);
    const jockeys = C.pickN(r, JOCKEYS[style], n);
    const trainers = C.pickN(r, TRAINERS[style], Math.min(n, TRAINERS[style].length));
    // A plausible market: a couple of short prices, a long tail.
    const strengths = horses.map((_, i) => Math.pow(Math.max(0.05, C.gauss(r, 1, 0.55)), 2) * (i === 0 ? 2.2 : 1));
    const odds = C.priceUp(strengths, 1.14 + r() * 0.08);
    const total = strengths.reduce((a, b) => a + b, 0);
    return horses.map((horse, i) => ({
      no: i + 1,
      horse: horse,
      jockey: declared ? jockeys[i] : null,
      trainer: trainers[i % trainers.length],
      draw: i + 1,
      age: C.rint(r, 3, 8),
      weight: (C.rint(r, 8, 9)) + '-' + String(C.rint(r, 0, 13)).padStart(2, '0'),
      form: Array.from({ length: 5 }, () => C.pick(r, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'P', 'U'])).join(''),
      odds: declared ? odds[i] : null,
      prob: strengths[i] / total,
      silk: {
        a: C.pick(r, SILK_COLORS), b: C.pick(r, SILK_COLORS),
        pattern: C.pick(r, SILK_PATTERNS)
      }
    })).sort((a, b) => (a.odds || 99) - (b.odds || 99)).map((x, i) => (x.no = i + 1, x));
  }

  /** Build one meeting (a venue's card) for a given calendar day. */
  function buildMeeting(venue, dayOffset, now) {
    const region = REGIONS.find(x => x.id === venue.region);
    const parts = C.zonedDateParts(now, venue.tz, dayOffset);
    const dateKey = parts.y + '-' + String(parts.mo).padStart(2, '0') + '-' + String(parts.d).padStart(2, '0');
    const r = C.rng(venue.id + '|' + dateKey);

    // Not every course races every day. Deterministic per venue per date.
    const raceFrequency = venue.region === 'hkg' ? 0.34 : venue.region === 'jpn' ? 0.42 : 0.55;
    if (r() > raceFrequency) return null;

    const first = C.zonedToUtc(parts.y, parts.mo, parts.d, venue.hour, venue.min, venue.tz);
    const nRaces = venue.nRaces + C.rint(r, -1, 1);
    const going = C.pick(r, GOING[venue.surface] || GOING.turf);
    const races = [];
    let t = first;
    for (let i = 0; i < nRaces; i++) {
      const rr = C.rng(venue.id + '|' + dateKey + '|' + i);
      // Runners and riders are only published once a race is declared (~48h out).
      const declared = (t - now) < 48 * 3600e3;
      const fieldSize = C.rint(rr, 6, venue.region === 'hkg' ? 14 : 12);
      const cls = C.pick(rr, ['Class 2', 'Class 3', 'Class 4', 'Class 5', 'Group 3', 'Listed']);
      const dist = distanceFor(rr, venue.region);
      races.push({
        id: venue.id + '-' + dateKey + '-' + (i + 1),
        meetingId: venue.id + '-' + dateKey,
        no: i + 1,
        offTs: t,
        name: raceTitle(rr, venue.region, cls, dist),
        distance: dist,
        cls: cls,
        going: going,
        prize: C.rint(rr, 4, 90) * 1000,
        declared: declared,
        fieldSize: fieldSize,
        runners: makeRunners(rr, region.style, fieldSize, declared)
      });
      t += (25 + Math.floor(rr() * 12)) * 60000;
    }
    return {
      id: venue.id + '-' + dateKey,
      venue: venue.name, venueId: venue.id, flag: venue.flag, tz: venue.tz,
      surface: venue.surface, going: going, region: venue.region,
      regionName: region.name, dateKey: dateKey, dayOffset: dayOffset,
      races: races, firstOff: races[0].offTs, lastOff: races[races.length - 1].offTs
    };
  }

  /** Race state derived from the clock — the same rule everywhere in the app. */
  function raceState(race, now) {
    if (now < race.offTs) return 'upcoming';
    if (now < race.offTs + 4 * 60000) return 'off';
    return 'result';
  }

  /** Deterministic result, weighted by the market. Used for auto-settlement. */
  function resultFor(race) {
    const r = C.rng('result|' + race.id);
    const pool = race.runners.map(x => ({ no: x.no, w: Math.pow(x.prob, 0.9) * (0.5 + r()) }));
    pool.sort((a, b) => b.w - a.w);
    return { positions: pool.slice(0, 4).map(x => x.no) };
  }

  function meetingsFor(dayOffset, now) {
    const out = [];
    for (const v of VENUES) {
      const m = buildMeeting(v, dayOffset, now);
      if (m) out.push(m);
    }
    return out;
  }

  BS.racing = { REGIONS, VENUES, meetingsFor, raceState, resultFor, buildMeeting };
})(window.BS = window.BS || {});
