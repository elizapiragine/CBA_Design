/**
* INSTRUCTIONS BEFORE RUNNING:
* 1. Manually fill in column A ("Date") in the "Competitors LK" tab.
* 2. Use the YYYY-MM-DD format, for example: 2026-03-31.
* 3. Confirm that all rows in the period have the date filled in.
* 4. Only then run this script.
*
* NOTE:
* - The script identifies the reference by Page = "CBA Design".
* - The average number of competitors does NOT depend on a fixed position in the spreadsheet.
* - That is, it does not use C9 or any fixed row: it uses the page name.
 */
function buildCbaBenchmarkMonthly() {
  const INPUT_SHEET = "Competitors LK";
  const OUTPUT_SHEET = "CBA Benchmark";
  const REFERENCE_PAGE = "CBA Design";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inputSheet = ss.getSheetByName(INPUT_SHEET);

  if (!inputSheet) {
    throw new Error(`Sheet "${INPUT_SHEET}" não encontrada.`);
  }

  let outputSheet = ss.getSheetByName(OUTPUT_SHEET);
  if (!outputSheet) {
    outputSheet = ss.insertSheet(OUTPUT_SHEET);
  } else {
    outputSheet.clearContents();
  }

  const data = inputSheet.getDataRange().getValues();
  if (data.length < 2) {
    throw new Error("A planilha de input não tem dados suficientes.");
  }

  const headers = data[0];
  const rows = data.slice(1);

  const col = getColumnMap_(headers, [
    "Date",
    "Page",
    "New Followers",
    "Reactions"
  ]);

  const monthly = {};

  rows.forEach((row, index) => {
    const rawDate = row[col["Date"]];
    const page = String(row[col["Page"]] || "").trim();
    const newFollowers = Number(row[col["New Followers"]]) || 0;
    const reactions = Number(row[col["Reactions"]]) || 0;

    if (!page) return;

    if (!rawDate) {
      throw new Error(`Linha ${index + 2}: a coluna Date está vazia. Preencha a data em formato YYYY-MM-DD antes de rodar o script.`);
    }

    const month = formatMonth_(rawDate);

    if (!monthly[month]) {
      monthly[month] = {
        cbaFollowers: null,
        cbaInteractions: null,
        competitorsFollowers: [],
        competitorsInteractions: []
      };
    }

    if (page === REFERENCE_PAGE) {
      monthly[month].cbaFollowers = newFollowers;
      monthly[month].cbaInteractions = reactions;
    } else {
      monthly[month].competitorsFollowers.push(newFollowers);
      monthly[month].competitorsInteractions.push(reactions);
    }
  });

  const output = [[
    "Month",
    "New Followers CBA",
    "New Followers Avg",
    "%vsCBA Followers",
    "Interactions CBA",
    "Interactions Avg",
    "%vsCBA Interactions"
  ]];

  Object.keys(monthly).sort().forEach(month => {
    const row = monthly[month];

    const avgFollowers = average_(row.competitorsFollowers);
    const avgInteractions = average_(row.competitorsInteractions);

    const pctFollowers = safePctDiff_(row.cbaFollowers, avgFollowers);
    const pctInteractions = safePctDiff_(row.cbaInteractions, avgInteractions);

    output.push([
      month,
      row.cbaFollowers,
      round_(avgFollowers, 0),
      pctFollowers,
      row.cbaInteractions,
      round_(avgInteractions, 0),
      pctInteractions
    ]);
  });

  outputSheet.getRange(1, 1, output.length, output[0].length).setValues(output);

  if (output.length > 1) {
    outputSheet.getRange(2, 4, output.length - 1, 1).setNumberFormat("0.00%");
    outputSheet.getRange(2, 7, output.length - 1, 1).setNumberFormat("0.00%");
  }
}

function getColumnMap_(headers, requiredHeaders) {
  const map = {};
  requiredHeaders.forEach(name => {
    const idx = headers.indexOf(name);
    if (idx === -1) {
      throw new Error(`Coluna obrigatória não encontrada: "${name}"`);
    }
    map[name] = idx;
  });
  return map;
}

function formatMonth_(value) {
  let d;

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    d = value;
  } else {
    d = new Date(value);
  }

  if (isNaN(d)) {
    throw new Error(`Data inválida: ${value}. Use o formato YYYY-MM-DD na coluna A.`);
  }

  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM");
}

function average_(arr) {
  if (!arr || arr.length === 0) return null;
  const sum = arr.reduce((acc, n) => acc + (Number(n) || 0), 0);
  return sum / arr.length;
}

function safePctDiff_(reference, avg) {
  if (reference == null || avg == null || avg === 0) return null;
  return (reference - avg) / avg;
}

function round_(value, decimals) {
  if (value == null) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
