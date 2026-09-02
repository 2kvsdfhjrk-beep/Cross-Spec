/* feed-football.js — global fixture list for ScoreMore.
   Club and competition names are real; every price, score, lineup and player
   name below is generated sample data. */
(function (BS) {
  'use strict';
  const C = BS.core;

  const REGIONS = [
    { id: 'eng', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', order: 1 },
    { id: 'ucl', name: 'European club', flag: '🏆', order: 2 },
    { id: 'esp', name: 'Spain', flag: '🇪🇸', order: 3 },
    { id: 'ita', name: 'Italy', flag: '🇮🇹', order: 4 },
    { id: 'ger', name: 'Germany', flag: '🇩🇪', order: 5 },
    { id: 'fra', name: 'France', flag: '🇫🇷', order: 6 },
    { id: 'eur', name: 'Rest of Europe', flag: '🇪🇺', order: 7 },
    { id: 'nam', name: 'North America', flag: '🇺🇸', order: 8 },
    { id: 'sam', name: 'South America', flag: '🇧🇷', order: 9 },
    { id: 'apc', name: 'Asia & Pacific', flag: '🌏', order: 10 }
  ];

  // [id, name, region, tz, kickoff slots (local 24h), days (0=Sun), teams]
  const COMPS = [
    ['epl', 'Premier League', 'eng', 'Europe/London', ['12:30', '15:00', '17:30', '20:00'], [6, 0, 2, 3],
      ['Arsenal', 'Aston Villa', 'Brighton', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham',
        'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United', 'Nottingham Forest',
        'Tottenham Hotspur', 'West Ham United', 'Wolves', 'Brentford', 'Bournemouth', 'Leeds United']],
    ['championship', 'EFL Championship', 'eng', 'Europe/London', ['12:30', '15:00', '19:45'], [6, 2],
      ['Norwich City', 'Leicester City', 'Southampton', 'Middlesbrough', 'Coventry City', 'Watford',
        'Sheffield United', 'Stoke City', 'Millwall', 'Preston North End', 'Bristol City', 'Swansea City']],
    ['ucl', 'UEFA Champions League', 'ucl', 'Europe/Berlin', ['18:45', '21:00'], [2, 3],
      ['Real Madrid', 'Bayern Munich', 'Manchester City', 'Inter Milan', 'Paris Saint-Germain',
        'Barcelona', 'Liverpool', 'Bayer Leverkusen', 'Atlético Madrid', 'Borussia Dortmund',
        'Napoli', 'Benfica', 'PSV Eindhoven', 'Sporting CP', 'Arsenal', 'Juventus']],
    ['uel', 'UEFA Europa League', 'ucl', 'Europe/Berlin', ['18:45', '21:00'], [4],
      ['Roma', 'Villarreal', 'Ajax', 'Feyenoord', 'Lazio', 'Real Betis', 'Rangers', 'Celtic',
        'Olympique Lyonnais', 'Eintracht Frankfurt', 'Fenerbahçe', 'Galatasaray']],
    ['laliga', 'La Liga', 'esp', 'Europe/Madrid', ['14:00', '16:15', '18:30', '21:00'], [6, 0, 5],
      ['Real Madrid', 'Barcelona', 'Atlético Madrid', 'Athletic Club', 'Real Sociedad', 'Real Betis',
        'Villarreal', 'Valencia', 'Sevilla', 'Girona', 'Celta Vigo', 'Osasuna', 'Rayo Vallecano', 'Mallorca']],
    ['seriea', 'Serie A', 'ita', 'Europe/Rome', ['15:00', '18:00', '20:45'], [6, 0, 1],
      ['Inter Milan', 'AC Milan', 'Juventus', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 'Fiorentina',
        'Bologna', 'Torino', 'Udinese', 'Genoa', 'Como', 'Cagliari']],
    ['bundesliga', 'Bundesliga', 'ger', 'Europe/Berlin', ['15:30', '18:30', '20:30'], [6, 0, 5],
      ['Bayern Munich', 'Bayer Leverkusen', 'RB Leipzig', 'Borussia Dortmund', 'Eintracht Frankfurt',
        'VfB Stuttgart', 'Werder Bremen', 'Freiburg', 'Wolfsburg', 'Hoffenheim', 'Mainz 05', 'Union Berlin']],
    ['ligue1', 'Ligue 1', 'fra', 'Europe/Paris', ['17:00', '19:00', '21:00'], [6, 0, 5],
      ['Paris Saint-Germain', 'Marseille', 'Monaco', 'Lille', 'Olympique Lyonnais', 'Nice', 'Lens',
        'Rennes', 'Strasbourg', 'Nantes', 'Toulouse', 'Brest']],
    ['eredivisie', 'Eredivisie', 'eur', 'Europe/Amsterdam', ['14:30', '16:45', '20:00'], [6, 0],
      ['Ajax', 'PSV Eindhoven', 'Feyenoord', 'AZ Alkmaar', 'Twente', 'Utrecht', 'Sparta Rotterdam', 'Heerenveen']],
    ['primeira', 'Primeira Liga', 'eur', 'Europe/Lisbon', ['15:30', '18:00', '20:30'], [6, 0, 5],
      ['Benfica', 'Porto', 'Sporting CP', 'Braga', 'Vitória Guimarães', 'Boavista', 'Famalicão', 'Rio Ave']],
    ['spfl', 'Scottish Premiership', 'eur', 'Europe/London', ['12:30', '15:00', '19:45'], [6, 0, 3],
      ['Celtic', 'Rangers', 'Hearts', 'Hibernian', 'Aberdeen', 'Dundee United', 'Motherwell', 'Kilmarnock']],
    ['mls', 'Major League Soccer', 'nam', 'America/New_York', ['19:30', '20:30', '22:00'], [6, 3],
      ['Inter Miami', 'LAFC', 'LA Galaxy', 'Seattle Sounders', 'Atlanta United', 'Columbus Crew',
        'New York City FC', 'New York Red Bulls', 'Philadelphia Union', 'Portland Timbers',
        'FC Cincinnati', 'Austin FC']],
    ['ligamx', 'Liga MX', 'nam', 'America/Mexico_City', ['17:00', '19:00', '21:05'], [6, 0, 5],
      ['Club América', 'Chivas Guadalajara', 'Cruz Azul', 'Tigres UANL', 'Monterrey', 'Pumas UNAM',
        'Toluca', 'Santos Laguna', 'León', 'Pachuca']],
    ['brasileirao', 'Brasileirão Série A', 'sam', 'America/Sao_Paulo', ['16:00', '18:30', '21:00'], [6, 0, 3],
      ['Flamengo', 'Palmeiras', 'Botafogo', 'São Paulo', 'Corinthians', 'Fluminense', 'Grêmio',
        'Internacional', 'Atlético Mineiro', 'Cruzeiro', 'Vasco da Gama', 'Bahia']],
    ['argentina', 'Liga Profesional', 'sam', 'America/Argentina/Buenos_Aires', ['17:00', '19:15', '21:30'], [6, 0, 1],
      ['River Plate', 'Boca Juniors', 'Racing Club', 'Independiente', 'San Lorenzo', 'Estudiantes',
        'Vélez Sarsfield', 'Talleres', 'Lanús', 'Newell\'s Old Boys']],
    ['j1', 'J1 League', 'apc', 'Asia/Tokyo', ['14:00', '16:00', '19:00'], [6, 0],
      ['Kawasaki Frontale', 'Yokohama F. Marinos', 'Vissel Kobe', 'Urawa Red Diamonds', 'FC Tokyo',
        'Sanfrecce Hiroshima', 'Cerezo Osaka', 'Gamba Osaka', 'Kashima Antlers', 'Nagoya Grampus']],
    ['saudi', 'Saudi Pro League', 'apc', 'Asia/Riyadh', ['18:00', '20:00', '21:45'], [4, 5, 6],
      ['Al Hilal', 'Al Nassr', 'Al Ittihad', 'Al Ahli', 'Al Shabab', 'Al Ettifaq', 'Al Taawoun', 'Al Fateh']],
    ['aleague', 'A-League Men', 'apc', 'Australia/Sydney', ['15:00', '17:45', '19:45'], [6, 0],
      ['Melbourne City', 'Melbourne Victory', 'Sydney FC', 'Western Sydney Wanderers', 'Adelaide United',
        'Brisbane Roar', 'Central Coast Mariners', 'Wellington Phoenix']]
  ].map(c => ({
    id: c[0], name: c[1], region: c[2], tz: c[3], slots: c[4], days: c[5], teams: c[6]
  }));

  const SURNAMES = ['Okonkwo', 'Vasilev', 'Lindqvist', 'Moreau', 'Baptista', 'Halvorsen', 'Ferrante',
    'Nakagawa', 'Rasmussen', 'Delgado', 'Kowalczyk', 'Aitken', 'Mbeki', 'Sorrentino', 'Bakker',
    'Petrov', 'Duarte', 'Novak', 'Haugen', 'Marchetti', 'Yilmaz', 'Dembélé', 'Ferreira', 'Kováč',
    'Bergström', 'Salvatore', 'Adeyemi', 'Toskić', 'Renard', 'Whitlow'];
  const FORMATIONS = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2', '3-4-2-1'];

  function lineup(r) {
    const names = C.pickN(r, SURNAMES, 11);
    return { formation: C.pick(r, FORMATIONS), players: names };
  }

  /** Goal times generated up front so an in-play score is consistent all match. */
  function goalScript(r, pH, pA) {
    const goals = [];
    const expH = 0.6 + pH * 2.4, expA = 0.4 + pA * 2.2;
    for (const side of ['H', 'A']) {
      const lambda = side === 'H' ? expH : expA;
      let n = 0, p = Math.exp(-lambda), cum = p, u = r();
      while (u > cum && n < 6) { n++; p = p * lambda / n; cum += p; }
      for (let i = 0; i < n; i++) goals.push({ minute: C.rint(r, 2, 93), side: side });
    }
    return goals.sort((a, b) => a.minute - b.minute);
  }

  function buildFixtures(comp, dayOffset, now) {
    const parts = C.zonedDateParts(now, comp.tz, dayOffset);
    const dateKey = parts.y + '-' + String(parts.mo).padStart(2, '0') + '-' + String(parts.d).padStart(2, '0');
    const dow = new Date(Date.UTC(parts.y, parts.mo - 1, parts.d)).getUTCDay();
    const r = C.rng(comp.id + '|' + dateKey);
    const isMatchday = comp.days.indexOf(dow) >= 0;
    if (!isMatchday || r() > 0.82) return [];

    const teams = C.pickN(r, comp.teams, Math.min(comp.teams.length, C.rint(r, 4, 10) * 2 / 2 * 2));
    const out = [];
    for (let i = 0; i + 1 < teams.length; i += 2) {
      const fr = C.rng(comp.id + '|' + dateKey + '|' + i);
      const slot = C.pick(fr, comp.slots).split(':');
      const koTs = C.zonedToUtc(parts.y, parts.mo, parts.d, +slot[0], +slot[1], comp.tz);
      // Home edge plus a random quality gap, converted into a priced-up book.
      const sH = Math.max(0.15, C.gauss(fr, 1.35, 0.45));
      const sA = Math.max(0.15, C.gauss(fr, 1.0, 0.45));
      const sD = 0.78 + fr() * 0.25;
      const odds = C.priceUp([sH, sD, sA], 1.06 + fr() * 0.04, 26);
      const tot = sH + sD + sA;
      const goals = goalScript(fr, sH / tot, sA / tot);
      const ouProbs = [0.52 + fr() * 0.16, 0.48 - fr() * 0.16];
      const bttsProbs = [0.5 + fr() * 0.14, 0.5 - fr() * 0.14];
      out.push({
        id: comp.id + '-' + dateKey + '-' + i,
        compId: comp.id, comp: comp.name, region: comp.region, tz: comp.tz,
        home: teams[i], away: teams[i + 1], koTs: koTs, dateKey: dateKey, dayOffset: dayOffset,
        odds: { home: odds[0], draw: odds[1], away: odds[2] },
        ou25: C.priceUp(ouProbs, 1.05, 12), btts: C.priceUp(bttsProbs, 1.05, 12),
        probs: { home: sH / tot, draw: sD / tot, away: sA / tot },
        form: {
          home: Array.from({ length: 5 }, () => C.pick(fr, ['W', 'W', 'D', 'L'])).join(''),
          away: Array.from({ length: 5 }, () => C.pick(fr, ['W', 'D', 'L', 'L'])).join('')
        },
        goals: goals,
        lineups: { home: lineup(fr), away: lineup(fr) },
        venue: teams[i] + ' Stadium'
      });
    }
    return out;
  }

  /** upcoming | live | ft — plus the minute and score for a live match. */
  function fixtureState(fx, now) {
    const elapsedMs = now - fx.koTs;
    if (elapsedMs < 0) return { state: 'upcoming', minute: 0, score: [0, 0] };
    const minute = Math.floor(elapsedMs / 60000);
    const played = minute >= 105 ? 95 : minute > 50 ? Math.min(95, minute - 15) : minute;
    const score = [0, 0];
    for (const g of fx.goals) if (g.minute <= played) score[g.side === 'H' ? 0 : 1]++;
    if (minute >= 115) return { state: 'ft', minute: 90, score: score };
    return { state: 'live', minute: Math.min(90, played), score: score, ht: minute > 45 && minute <= 60 };
  }

  const finalScore = fx => fx.goals.reduce((a, g) => (a[g.side === 'H' ? 0 : 1]++, a), [0, 0]);

  /** Lineups firm up as kick-off approaches, like the real feeds do. */
  function lineupState(fx, now) {
    const mins = (fx.koTs - now) / 60000;
    if (mins <= 60) return 'confirmed';
    if (mins <= 48 * 60) return 'probable';
    return 'squad';
  }

  function fixturesFor(dayOffset, now) {
    const out = [];
    for (const c of COMPS) out.push.apply(out, buildFixtures(c, dayOffset, now));
    return out;
  }

  BS.football = { REGIONS, COMPS, fixturesFor, fixtureState, lineupState, finalScore };
})(window.BS = window.BS || {});
