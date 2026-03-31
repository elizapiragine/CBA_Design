function normalizeLinkedInAllPosts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName('LinkedIn_AllPosts'); // <-- nome da aba bruta
  const dst = ss.getSheetByName('LinkedIn_Normalized_Posts') || ss.insertSheet('LinkedIn_Normalized_Posts');

  const data = src.getDataRange().getValues();
  if (data.length < 3) throw new Error('LinkedIn_AllPosts precisa ter descrição + header + dados.');

  // linha 0 = texto, linha 1 = cabeçalho real
  const header = data[1];

  const idx = {
    title: header.indexOf('Post title'),
    link: header.indexOf('Post link'),
    postType: header.indexOf('Post type'),
    campaignName: header.indexOf('Campaign name'),
    postedBy: header.indexOf('Posted by'),
    createdDate: header.indexOf('Created date'),
    audience: header.indexOf('Audience'),
    impressions: header.indexOf('Impressions'),
    views: header.indexOf('Views'),
    offsiteViews: header.indexOf('Offsite Views'),
    clicks: header.indexOf('Clicks'),
    ctr: header.indexOf('Click through rate (CTR)'),
    likes: header.indexOf('Likes'),
    comments: header.indexOf('Comments'),
    reposts: header.indexOf('Reposts'),
    follows: header.indexOf('Follows'),
    engagement: header.indexOf('Engagement rate'),
    contentType: header.indexOf('Content Type')
  };

  // adicionamos 3 colunas no fim
  const outHeader = [
    'post_title',
    'post_link',
    'post_type',
    'campaign_name',
    'posted_by',
    'created_date',
    'audience',
    'impressions',
    'views',
    'offsite_views',
    'clicks',
    'ctr',
    'likes',
    'comments',
    'reposts',
    'follows',
    'engagement_rate',          // do LinkedIn
    'content_type',
    'engagement_rate_custom',   // (likes + comments + reposts) / impressions
    'interaction_rate_custom',   // (likes + comments + reposts + clicks) / impressions
    'language'
  ];

  const outRows = [];
  for (let r = 2; r < data.length; r++) {
    const row = data[r];
    if (row.every(c => c === '' || c === null)) continue;

    const impressions = num(val(row, idx.impressions));
    const likes = num(val(row, idx.likes));
    const comments = num(val(row, idx.comments));
    const reposts = num(val(row, idx.reposts));
    const clicks = num(val(row, idx.clicks));

    // suas fórmulas
    const engCustom = impressions > 0 ? (likes + comments + reposts) / impressions : 0;
    const interCustom = impressions > 0 ? (likes + comments + reposts + clicks) / impressions : 0;

    outRows.push([
      val(row, idx.title),
      val(row, idx.link),
      val(row, idx.postType),
      val(row, idx.campaignName),
      val(row, idx.postedBy),
      val(row, idx.createdDate),
      val(row, idx.audience),
      impressions,
      num(val(row, idx.views)),
      num(val(row, idx.offsiteViews)),
      clicks,
      val(row, idx.ctr),           // vem string tipo "3.45%"
      likes,
      comments,
      reposts,
      num(val(row, idx.follows)),
      val(row, idx.engagement),    // do LinkedIn, deixa como string
      val(row, idx.contentType),
      engCustom,
      interCustom,
      '' // language (fórmula)
    ]);
  }

  dst.clearContents();
  dst.getRange(1,1,1,outHeader.length).setValues([outHeader]);
  if (outRows.length) {
    dst.getRange(2,1,outRows.length,outHeader.length).setValues(outRows);
  }
  // formata data (coluna 6 = created_date)
  dst.getRange(2,6,Math.max(outRows.length,1),1).setNumberFormat('yyyy-mm-dd');
  // formata as 2 métricas novas como %
  // elas estão nas 19ª e 20ª colunas
  if (outRows.length) {
    dst.getRange(2,19,outRows.length,2).setNumberFormat('0.00%');
// -------- coluna language (DETECTLANGUAGE do post_title - coluna A) --------
const languageCol = outHeader.length; // última coluna
const n = outRows.length;

if (n > 0) {
  const langFormulas = Array.from({ length: n }, (_, i) => ([
    `=IF(LEN(A${i + 2})>=5,DETECTLANGUAGE(A${i + 2}),"")`
  ]));

  dst.getRange(2, languageCol, n, 1).setFormulas(langFormulas);
}

  }

  Logger.log('normalizeLinkedInAllPosts: ' + outRows.length + ' linhas.');
}

/***** helpers (mesmos de antes) *****/
function num(v) {
  return v === '' || v == null ? 0 : Number(v);
}
function val(row, idx) {
  return idx !== -1 ? row[idx] : '';
}