function normalizeLinkedInPageMetrics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // origem 1: métricas de posts por dia
  const srcMetrics = ss.getSheetByName('LinkedIn_Export');
  if (!srcMetrics) throw new Error('Aba "LinkedIn_Export" não encontrada.');

  // origem 2: métricas de visitantes
  const srcVisitors = ss.getSheetByName('Visitor Metrics'); // pode existir ou não

  // origem 3: novos seguidores
  const srcFollowers = ss.getSheetByName('New Followers');  // pode existir ou não

  const dst = ss.getSheetByName('LinkedIn_Normalized_Metrics') || ss.insertSheet('LinkedIn_Normalized_Metrics');

  /************ 1) LinkedIn_Export (aquela com "Aggregated engagement...") ************/
  const raw1 = srcMetrics.getDataRange().getValues();
  if (raw1.length < 3) throw new Error('LinkedIn_Export precisa ter descrição + header + dados.');

  const header1 = raw1[1]; // linha 2 = cabeçalho real
  const mIdx = {
    date: header1.indexOf('Date'),
    impressions_total: header1.indexOf('Impressions (total)'),
    impressions_org: header1.indexOf('Impressions (organic)'),
    clicks_total: header1.indexOf('Clicks (total)'),
    clicks_org: header1.indexOf('Clicks (organic)'),
    reactions_total: header1.indexOf('Reactions (total)'),
    comments_total: header1.indexOf('Comments (total)'),
    reposts_total: header1.indexOf('Reposts (total)'),
    engagement_total: header1.indexOf('Engagement rate (total)'),
    engagement_org: header1.indexOf('Engagement rate (organic)')
  };

  // vamos guardar tudo num map por data
  const byDate = new Map();

  for (let r = 2; r < raw1.length; r++) {
    const row = raw1[r];
    const d = row[mIdx.date];
    if (!d) continue;
    const key = d.toString();
    byDate.set(key, {
      date: d,
      impressions_total: num(row[mIdx.impressions_total]),
      impressions_organic: num(row[mIdx.impressions_org]),
      clicks_total: num(row[mIdx.clicks_total]),
      clicks_organic: num(row[mIdx.clicks_org]),
      reactions_total: num(row[mIdx.reactions_total]),
      comments_total: num(row[mIdx.comments_total]),
      reposts_total: num(row[mIdx.reposts_total]),
      engagement_rate_total: row[mIdx.engagement_total] || '',
      engagement_rate_organic: row[mIdx.engagement_org] || ''
    });
  }

  /************ 2) Visitor Metrics (views e visitantes) ************/
  if (srcVisitors) {
    const raw2 = srcVisitors.getDataRange().getValues();
    const header2 = raw2[0];
    const vIdx = {
      date: header2.indexOf('Date'),
      overview_views: header2.indexOf('Overview page views (total)'),
      overview_unique: header2.indexOf('Overview unique visitors (total)'),
      life_views: header2.indexOf('Life page views (total)'),
      life_unique: header2.indexOf('Life unique visitors (total)'),
      jobs_views: header2.indexOf('Jobs page views (total)'),
      jobs_unique: header2.indexOf('Jobs unique visitors (total)'),
      total_views: header2.indexOf('Total page views (total)'),
      total_unique: header2.indexOf('Total unique visitors (total)')
    };

    for (let r = 1; r < raw2.length; r++) {
      const row = raw2[r];
      const d = row[vIdx.date];
      if (!d) continue;
      const key = d.toString();
      const obj = byDate.get(key) || { date: d };
      obj.overview_page_views = num(row[vIdx.overview_views]);
      obj.overview_unique_visitors = num(row[vIdx.overview_unique]);
      obj.life_page_views = num(row[vIdx.life_views]);
      obj.life_unique_visitors = num(row[vIdx.life_unique]);
      obj.jobs_page_views = num(row[vIdx.jobs_views]);
      obj.jobs_unique_visitors = num(row[vIdx.jobs_unique]);
      obj.total_page_views = num(row[vIdx.total_views]);
      obj.total_unique_visitors = num(row[vIdx.total_unique]);
      byDate.set(key, obj);
    }
  }

  /************ 3) New Followers (orgânico / patrocinado / auto-invite) ************/
  if (srcFollowers) {
    const raw3 = srcFollowers.getDataRange().getValues();
    const header3 = raw3[0];
    const fIdx = {
      date: header3.indexOf('Date'),
      sponsored: header3.indexOf('Sponsored followers'),
      organic: header3.indexOf('Organic followers'),
      autoInvited: header3.indexOf('Auto-invited followers'),
      total: header3.indexOf('Total new followers')
    };

    for (let r = 1; r < raw3.length; r++) {
      const row = raw3[r];
      const d = row[fIdx.date];
      if (!d) continue;
      const key = d.toString();
      const obj = byDate.get(key) || { date: d };
      obj.sponsored_followers = num(row[fIdx.sponsored]);
      obj.organic_followers = num(row[fIdx.organic]);
      obj.auto_invited_followers = num(row[fIdx.autoInvited]);
      obj.total_new_followers = row[fIdx.total] !== '' ? num(row[fIdx.total]) : ''; // se vier vazio, deixa vazio
      byDate.set(key, obj);
    }
  }

  /************ 4) montar saída ************/
  const allDates = Array.from(byDate.values())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const outHeader = [
    'date',
    'impressions_total',
    'impressions_organic',
    'clicks_total',
    'clicks_organic',
    'reactions_total',
    'comments_total',
    'reposts_total',
    'engagement_rate_total',
    'engagement_rate_organic',
    // novas colunas das abas novas:
    'total_page_views',
    'total_unique_visitors',
    'overview_page_views',
    'overview_unique_visitors',
    'life_page_views',
    'life_unique_visitors',
    'jobs_page_views',
    'jobs_unique_visitors',
    'organic_followers',
    'sponsored_followers',
    'auto_invited_followers',
    'total_new_followers',
    'total_followers'
  ];

  const outRows = allDates.map(o => [
    o.date,
    o.impressions_total || 0,
    o.impressions_organic || 0,
    o.clicks_total || 0,
    o.clicks_organic || 0,
    o.reactions_total || 0,
    o.comments_total || 0,
    o.reposts_total || 0,
    o.engagement_rate_total || '',
    o.engagement_rate_organic || '',
    o.total_page_views || 0,
    o.total_unique_visitors || 0,
    o.overview_page_views || 0,
    o.overview_unique_visitors || 0,
    o.life_page_views || 0,
    o.life_unique_visitors || 0,
    o.jobs_page_views || 0,
    o.jobs_unique_visitors || 0,
    o.organic_followers || 0,
    o.sponsored_followers || 0,
    o.auto_invited_followers || 0,
    o.total_new_followers ?? 0,
    ''
  ]);

  // escreve na mesma aba
  dst.clearContents();
  dst.getRange(1, 1, 1, outHeader.length).setValues([outHeader]);
  if (outRows.length) {
    dst.getRange(2, 1, outRows.length, outHeader.length).setValues(outRows);
  }

  // formatar data e % (as duas colunas de engagement)
  dst.getRange(2, 1, Math.max(outRows.length, 1), 1).setNumberFormat('yyyy-mm-dd');
  dst.getRange(2, 9, outRows.length, 2).setNumberFormat('0.00');

  Logger.log('normalizeLinkedInPageMetrics: ' + outRows.length + ' linhas.');

  // -------- coluna total_followers (acumulado com baseline na linha 758) --------
const TOTAL_FOLLOWERS_COL = 23; // W (ajuste se mudar)
const NEW_FOLLOWERS_COL = 22;   // V (ajuste se mudar)

const BASELINE_ROW = 758;
const BASELINE_VALUE = 35957;

const firstDataRow = 2;
const lastDataRow = outRows.length + 1;

if (outRows.length > 0) {
  const formulas = [];

  for (let r = firstDataRow; r <= lastDataRow; r++) {
    if (r === BASELINE_ROW) {
      // linha do baseline
      formulas.push([`${BASELINE_VALUE}`]);
    } else if (r > BASELINE_ROW) {
      // datas futuras → soma
      formulas.push([`=W${r - 1}+V${r}`]);
    } else {
      // datas passadas → subtrai
      formulas.push([`=W${r + 1}-V${r + 1}`]);
    }
  }

  dst
    .getRange(firstDataRow, TOTAL_FOLLOWERS_COL, formulas.length, 1)
    .setFormulas(formulas);
}

}

/***** helpers *****/
function num(v) {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
