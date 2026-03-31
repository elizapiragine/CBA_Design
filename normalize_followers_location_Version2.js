function normalizeFollowersLocation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName('Followers Location');
  const dst = ss.getSheetByName('Followers_Location_Clean') || ss.insertSheet('Followers_Location_Clean');

  const data = src.getDataRange().getValues();

  const out = [[
    'Date',
    'City',
    'Region',
    'Country',
    'Continent',
    'Subcontinent',
    'Total followers'
  ]];

  for (let i = 1; i < data.length; i++) {
    const [date, raw, followers] = data[i];
    if (!raw) continue;

    const parts = raw.split(',');

    const countryName = parts[parts.length - 1].trim();
    const countryISO = countryToISO(countryName);

    const geo = GEO_MAP[countryISO] || {};

    let regionRaw = parts[0]
      .replace(/Greater /gi, '')
      .replace(/Metropolitan Region/gi, '')
      .replace(/Metropolitan Area/gi, '')
      .replace(/Area/gi, '')
      .trim();

    const city = extractCity(regionRaw);
    const region = normalizeRegion(countryISO, city, regionRaw);

    out.push([
      date,
      city,
      region,
      countryName,
      geo.continent || '',
      geo.subcontinent || '',
      followers
    ]);
  }

  dst.clearContents();
  dst.getRange(1,1,out.length,out[0].length).setValues(out);
}


// ---------- COUNTRY → ISO ----------
function countryToISO(name) {
  const map = {
    'France': 'FR',
    'Germany': 'DE',
    'Spain': 'ES',
    'Italy': 'IT',
    'Portugal': 'PT',
    'Netherlands': 'NL',
    'Belgium': 'BE',
    'United Kingdom': 'GB',

    'United States': 'US',
    'USA': 'US',
    'Canada': 'CA',
    'Brazil': 'BR',
    'Argentina': 'AR',
    'Mexico': 'MX',

    'India': 'IN',
    'China': 'CN',
    'Japan': 'JP',
    'United Arab Emirates': 'AE',

    'South Africa': 'ZA',
    'Egypt': 'EG',

    'Australia': 'AU',
    'New Zealand': 'NZ'
  };

  return map[name] || '';
}


// ---------- GEO MAP ----------
const GEO_MAP = {
  FR: { continent: 'Europe', subcontinent: 'Western Europe' },
  DE: { continent: 'Europe', subcontinent: 'Western Europe' },
  ES: { continent: 'Europe', subcontinent: 'Southern Europe' },
  IT: { continent: 'Europe', subcontinent: 'Southern Europe' },
  PT: { continent: 'Europe', subcontinent: 'Southern Europe' },
  NL: { continent: 'Europe', subcontinent: 'Western Europe' },
  BE: { continent: 'Europe', subcontinent: 'Western Europe' },
  GB: { continent: 'Europe', subcontinent: 'Northern Europe' },

  US: { continent: 'Americas', subcontinent: 'Northern America' },
  CA: { continent: 'Americas', subcontinent: 'Northern America' },
  BR: { continent: 'Americas', subcontinent: 'South America' },
  AR: { continent: 'Americas', subcontinent: 'South America' },
  MX: { continent: 'Americas', subcontinent: 'Central America' },

  IN: { continent: 'Asia', subcontinent: 'Southern Asia' },
  CN: { continent: 'Asia', subcontinent: 'Eastern Asia' },
  JP: { continent: 'Asia', subcontinent: 'Eastern Asia' },
  AE: { continent: 'Asia', subcontinent: 'Western Asia' },

  ZA: { continent: 'Africa', subcontinent: 'Southern Africa' },
  EG: { continent: 'Africa', subcontinent: 'Northern Africa' },

  AU: { continent: 'Oceania', subcontinent: 'Australia and New Zealand' },
  NZ: { continent: 'Oceania', subcontinent: 'Australia and New Zealand' }
};


// ---------- CITY / REGION ----------
function extractCity(regionRaw) {
  return regionRaw.split(' ').slice(-1)[0];
}

function normalizeRegion(countryISO, city, regionRaw) {
  if (countryISO === 'FR' && city === 'Paris') return 'Île-de-France';
  if (countryISO === 'IN' && city === 'Delhi') return 'Delhi';
  return regionRaw;
}