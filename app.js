const fileInput = document.getElementById("csv-file");
const uploadMeta = document.getElementById("upload-meta");
const genderSelect = document.getElementById("gender-column");
const decisionSelect = document.getElementById("decision-column");
const decisionTypeSelect = document.getElementById("decision-type");
const testNameInput = document.getElementById("test-name");
const selectedValuesField = document.getElementById("selected-values-field");
const selectedValuesList = document.getElementById("selected-values-list");
const selectedValuesOther = document.getElementById("selected-values-other");
const referenceGroupSelect = document.getElementById("reference-group");
const cutScoreField = document.getElementById("cut-score-field");
const cutScoreInput = document.getElementById("cut-score");
const cutScoreNote = document.getElementById("cut-score-note");
const runButton = document.getElementById("run-analysis");
const generateOptionsButton = document.getElementById("generate-options");
const resultsEmpty = document.getElementById("results-empty");
const resultsWrap = document.getElementById("results");
const resultsContent = document.getElementById("results-content");
const summaryEl = document.getElementById("summary");
const downloadReportBtn = document.getElementById("download-report");
const downloadResultsBtn = document.getElementById("download-results");
const printReportBtn = document.getElementById("print-report");
const downloadSampleBtn = document.getElementById("download-sample");

const state = {
  fileName: null,
  headers: [],
  rows: [],
  lastResults: null,
  lastCutScoreOptions: null,
};

function parseXLSX(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return { headers: [], data: [] };
  const worksheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  if (!rows.length) return { headers: [], data: [] };
  const headers = rows[0].map((header) => String(header).trim());
  const data = rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] !== undefined && row[index] !== null ? String(row[index]).trim() : "";
    });
    return record;
  });
  return { headers, data };
}

function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim() !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim() !== "")) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: [], data: [] };
  }

  const headers = rows[0].map((header) => header.trim());
  const data = rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ? String(row[index]).trim() : "";
    });
    return record;
  });

  return { headers, data };
}

function resetSelections() {
  genderSelect.innerHTML = "";
  decisionSelect.innerHTML = "";
  selectedValuesList.innerHTML = "";
  selectedValuesOther.value = "";
  cutScoreInput.value = "";
  if (cutScoreNote) cutScoreNote.textContent = "";
  genderSelect.disabled = true;
  decisionSelect.disabled = true;
  decisionTypeSelect.disabled = true;
  testNameInput.disabled = true;
  selectedValuesOther.disabled = true;
  referenceGroupSelect.disabled = true;
  cutScoreInput.disabled = true;
  runButton.disabled = true;
  generateOptionsButton.disabled = true;
}

function populateSelect(select, headers) {
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a column";
  select.appendChild(placeholder);

  headers.forEach((header) => {
    const option = document.createElement("option");
    option.value = header;
    option.textContent = header;
    select.appendChild(option);
  });

  select.disabled = false;
}

function updateDecisionTypeUI() {
  const decisionType = decisionTypeSelect.value;
  const isScore = decisionType === "score";
  selectedValuesField.classList.toggle("hidden", isScore);
  selectedValuesOther.disabled = isScore;
  cutScoreInput.disabled = !isScore;
  cutScoreField.classList.toggle("hidden", !isScore);
  generateOptionsButton.classList.toggle("hidden", !isScore);
  if (isScore) {
    selectedValuesList.innerHTML = "";
    selectedValuesOther.value = "";
    if (state.rows.length && decisionSelect.value) {
      buildCutScoreOptions();
    }
  } else {
    cutScoreInput.value = "";
  }
}

function guessColumn(headers, keywords) {
  const lowered = headers.map((h) => h.toLowerCase());
  const matchIndex = lowered.findIndex((h) => keywords.some((key) => h.includes(key)));
  return matchIndex >= 0 ? headers[matchIndex] : "";
}

function guessSelectedValues(values) {
  const normalized = values.map((v) => v.trim().toLowerCase());
  const options = ["hired", "hire", "selected", "yes", "y", "1", "true", "offer", "pass"];
  const matches = options.filter((opt) => normalized.includes(opt));
  if (matches.length > 0) {
    return matches.join(", ");
  }
  return "";
}

function listColumnValues(column) {
  return state.rows.map((row) => row[column]).filter((v) => v !== undefined && v !== "");
}

function populateReferenceGroups(values) {
  referenceGroupSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Use highest selection rate";
  referenceGroupSelect.appendChild(placeholder);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    referenceGroupSelect.appendChild(option);
  });
  referenceGroupSelect.disabled = false;
}

function renderSelectedValueOptions(values) {
  selectedValuesList.innerHTML = "";
  values.forEach((value) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = value;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(value));
    selectedValuesList.appendChild(label);
  });
}

function getSelectedValues() {
  const checked = Array.from(selectedValuesList.querySelectorAll('input[type="checkbox"]:checked')).map(
    (input) => input.value.trim()
  );
  const others = selectedValuesOther.value
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
  return Array.from(new Set([...checked, ...others]));
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function formatPValue(value) {
  if (!Number.isFinite(value)) return "N/A";
  return value < 0.05 ? "p < 0.05" : "p > 0.05";
}

function snapScore(value, step) {
  if (!Number.isFinite(value)) return value;
  const snapped = Math.round(value / step) * step;
  return Math.round(snapped * 100) / 100;
}

function gammaln(z) {
  const cof = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.001208650973866179,
    -0.000005395239384953,
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < cof.length; j += 1) {
    y += 1;
    ser += cof[j] / y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function gammaincLower(a, x) {
  const itmax = 100;
  const eps = 1e-8;
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= itmax; n += 1) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * eps) {
        return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
      }
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
  }

  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= itmax; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return 1 - h * Math.exp(-x + a * Math.log(x) - gammaln(a));
}

function chiSquarePValue(chi2, df) {
  if (!Number.isFinite(chi2) || !Number.isFinite(df) || df <= 0) return NaN;
  const a = df / 2;
  const x = chi2 / 2;
  const cdf = gammaincLower(a, x);
  return 1 - cdf;
}


function computeChiSquare(groups) {
  const totals = groups.reduce(
    (acc, group) => {
      acc.total += group.total;
      acc.selected += group.selected;
      return acc;
    },
    { total: 0, selected: 0 }
  );
  const notSelectedTotal = totals.total - totals.selected;
  if (totals.total === 0) return { chi2: NaN, df: NaN, pValue: NaN };

  let chi2 = 0;
  groups.forEach((group) => {
    const selected = group.selected;
    const notSelected = group.total - group.selected;
    const expectedSelected = (group.total * totals.selected) / totals.total;
    const expectedNotSelected = (group.total * notSelectedTotal) / totals.total;
    if (expectedSelected > 0) {
      chi2 += (selected - expectedSelected) ** 2 / expectedSelected;
    }
    if (expectedNotSelected > 0) {
      chi2 += (notSelected - expectedNotSelected) ** 2 / expectedNotSelected;
    }
  });

  const df = Math.max(groups.length - 1, 1);
  const pValue = chiSquarePValue(chi2, df);
  return { chi2, df, pValue };
}

function computeGroups(rows, genderColumn, decisionColumn, isSelectedFn) {
  const counts = new Map();
  let rowsUsed = 0;

  rows.forEach((row) => {
    const genderRaw = row[genderColumn] ? row[genderColumn].trim() : "";
    const decisionRaw = row[decisionColumn] ? row[decisionColumn].trim() : "";
    if (!genderRaw || !decisionRaw) return;

    rowsUsed += 1;
    if (!counts.has(genderRaw)) {
      counts.set(genderRaw, { total: 0, selected: 0 });
    }
    const bucket = counts.get(genderRaw);
    bucket.total += 1;
    if (isSelectedFn(decisionRaw)) {
      bucket.selected += 1;
    }
  });

  const groups = Array.from(counts.entries()).map(([label, data]) => {
    const selectionRate = data.total ? data.selected / data.total : 0;
    return { label, ...data, selectionRate };
  });

  const maxSelectionRate = Math.max(...groups.map((g) => g.selectionRate), 0);
  groups.forEach((group) => {
    group.adverseImpactRatio = maxSelectionRate > 0 ? group.selectionRate / maxSelectionRate : NaN;
    group.ruleStatus =
      maxSelectionRate === 0
        ? "N/A"
        : group.adverseImpactRatio >= 0.8
        ? '<span class="badge pass">Pass</span>'
        : '<span class="badge fail">Fail</span>';
  });

  groups.sort((a, b) => b.total - a.total);
  return { groups, rowsUsed, maxSelectionRate };
}


function applyReferenceGroup(groups, referenceLabel) {
  const reference = groups.find((group) => group.label === referenceLabel);
  const referenceRate = reference
    ? reference.selectionRate
    : Math.max(...groups.map((g) => g.selectionRate), 0);
  groups.forEach((group) => {
    group.adverseImpactRatio = referenceRate > 0 ? group.selectionRate / referenceRate : NaN;
    group.isReference = referenceLabel
      ? group.label === referenceLabel
      : group.selectionRate === referenceRate && referenceRate > 0;
    group.ruleStatus =
      referenceRate === 0
        ? "N/A"
        : group.adverseImpactRatio >= 0.8
        ? '<span class="badge pass">Pass</span>'
        : '<span class="badge fail">Fail</span>';
  });
  return referenceRate;
}

function sortGroups(groups) {
  groups.sort((a, b) => {
    if (a.isReference !== b.isReference) {
      return a.isReference ? -1 : 1;
    }
    return b.total - a.total;
  });
}

function buildResultsTableHtml(groups) {
  const rowsHtml = groups
    .map((group) => {
      const ratioDisplay = group.isReference
        ? "Reference"
        : Number.isFinite(group.adverseImpactRatio)
        ? group.adverseImpactRatio.toFixed(2)
        : "N/A";
      const sizeBadge =
        group.total < 30 ? '<span class="badge warn">Small sample</span>' : "";
      return `
        <tr>
          <td>${group.label}</td>
          <td>${group.total}</td>
          <td>${group.selected}</td>
          <td>${formatPercent(group.selectionRate)}</td>
          <td>${ratioDisplay}</td>
          <td>${group.ruleStatus} ${sizeBadge}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Total Count (N)</th>
            <th>Pass Count</th>
            <th>Pass Rate</th>
            <th>4/5ths Ratio</th>
            <th>Four Fifths Rule</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

function renderResultsBlocks(resultsList) {
  resultsContent.innerHTML = resultsList
    .map((result) => {
      const cutScoreText =
        result.decisionType === "score"
          ? `Cut score: <strong>${result.cutScore}</strong>`
          : "Decision: <strong>Binary</strong>";
      const referenceText = result.referenceGroup
        ? `Reference: <strong>${result.referenceGroup}</strong>`
        : "Reference: <strong>Highest selection rate</strong>";
      const pClass = Number.isFinite(result.pValue) && result.pValue < 0.05 ? "bad" : "good";
      const pValueText = Number.isFinite(result.pValue)
        ? `P-value: <strong class="metric ${pClass}">${formatPValue(result.pValue)}</strong><span class="help" data-tip="If p < 0.05, the differences may be meaningful, not just random.">?</span>`
        : "P-value: <strong>N/A</strong>";
      const chiClass = Number.isFinite(result.chi2) ? "good" : "";
      const chiSquareText = Number.isFinite(result.chi2)
        ? `Chi-square: <strong class="metric ${chiClass}">${result.chi2.toFixed(2)}</strong> (df=${result.df})<span class="help" data-tip="Compares each group to what we'd expect if selection were even.">?</span>`
        : "Chi-square: <strong>N/A</strong>";
      const maxSelection = `Max selection rate: <strong>${formatPercent(
        result.maxSelectionRate
      )}</strong>`;
      const header =
        result.decisionType === "score" ? `Cut score ${result.cutScore}` : "Binary decision";

      return `
        <div class="results-block">
          <h4>${header}</h4>
          <div class="summary">${[cutScoreText, referenceText, maxSelection, pValueText, chiSquareText]
            .filter(Boolean)
            .join(" | ")}</div>
          ${buildResultsTableHtml(result.groups)}
        </div>
      `;
    })
    .join("");
}

function analyze() {
  const genderColumn = genderSelect.value;
  const decisionColumn = decisionSelect.value;
  const decisionType = decisionTypeSelect.value;
  const testName = testNameInput.value.trim();
  const selectedValues = decisionType === "score" ? [] : getSelectedValues();

  if (!genderColumn || !decisionColumn) {
    alert("Please select both the gender and decision columns.");
    return;
  }

  let resultsList = [];
  if (decisionType === "score") {
    const cutScores = cutScoreInput.value
      .split(";")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
    if (cutScores.length === 0) {
      alert("Please enter at least one cut score (e.g. 75; 77.5; 80).");
      return;
    }
    resultsList = cutScores.map((cutScore) => {
      const analysis = computeGroups(state.rows, genderColumn, decisionColumn, (decisionRaw) => {
        const score = Number(decisionRaw);
        return Number.isFinite(score) && score >= cutScore;
      });
      const referenceRate = applyReferenceGroup(analysis.groups, referenceGroupSelect.value);
      sortGroups(analysis.groups);
      const result = {
        fileName: state.fileName,
        testName,
        rowsTotal: state.rows.length,
        rowsUsed: analysis.rowsUsed,
        selectedValues,
        maxSelectionRate: analysis.maxSelectionRate,
        groups: analysis.groups,
        genderColumn,
        decisionColumn,
        decisionType,
        cutScore,
        referenceGroup: referenceGroupSelect.value,
        referenceRate,
        generatedAt: new Date(),
      };
      const stats = computeChiSquare(result.groups);
      result.chi2 = stats.chi2;
      result.df = stats.df;
      result.pValue = stats.pValue;
      return result;
    });
  } else {
    if (selectedValues.length === 0) {
      alert("Please select at least one selected value.");
      return;
    }
    const selectedSet = new Set(selectedValues.map((value) => value.toLowerCase()));
    const analysis = computeGroups(state.rows, genderColumn, decisionColumn, (decisionRaw) =>
      selectedSet.has(decisionRaw.toLowerCase())
    );
    const referenceRate = applyReferenceGroup(analysis.groups, referenceGroupSelect.value);
    sortGroups(analysis.groups);
    const result = {
      fileName: state.fileName,
      testName,
      rowsTotal: state.rows.length,
      rowsUsed: analysis.rowsUsed,
      selectedValues,
      maxSelectionRate: analysis.maxSelectionRate,
      groups: analysis.groups,
      genderColumn,
      decisionColumn,
      decisionType,
      cutScore: null,
      referenceGroup: referenceGroupSelect.value,
      referenceRate,
      generatedAt: new Date(),
    };
    const stats = computeChiSquare(result.groups);
    result.chi2 = stats.chi2;
    result.df = stats.df;
    result.pValue = stats.pValue;
    resultsList = [result];
  }

  state.lastResults = resultsList;
  resultsEmpty.classList.add("hidden");
  resultsWrap.classList.remove("hidden");
  const base = resultsList[0];
  summaryEl.innerHTML = `
    File: <strong>${base.fileName}</strong> | Rows analyzed: <strong>${base.rowsUsed}</strong> / ${base.rowsTotal}
  `;
  renderResultsBlocks(resultsList);
}

function toResultsCSV(resultsList) {
  const headers = [
    "CutScore",
    "Gender",
    "Total",
    "Selected",
    "SelectionRate",
    "AdverseImpactRatio",
    "FourFifthsRule",
  ];

  const lines = [headers.join(",")];
  resultsList.forEach((results) => {
    results.groups.forEach((group) => {
      const ratio = Number.isFinite(group.adverseImpactRatio)
        ? group.adverseImpactRatio.toFixed(2)
        : "";
      const statusText = group.ruleStatus.includes("Pass")
        ? "Pass"
        : group.ruleStatus.includes("Fail")
        ? "Fail"
        : "N/A";
      lines.push(
        [
          results.cutScore ?? "",
          escapeCsv(group.label),
          group.total,
          group.selected,
          group.selectionRate.toFixed(4),
          ratio,
          statusText,
        ].join(",")
      );
    });
  });

  return lines.join("\n");
}

function downloadResultsXLSX(resultsList) {
  const headers = [
    "CutScore",
    "Group",
    "TotalCount",
    "PassCount",
    "PassRate",
    "FourFifthsRatio",
    "FourFifthsRule",
  ];
  const rows = [headers];

  resultsList.forEach((results) => {
    results.groups.forEach((group) => {
      const ratio = Number.isFinite(group.adverseImpactRatio) ? group.adverseImpactRatio.toFixed(2) : "";
      const statusText = group.ruleStatus.includes("Pass")
        ? "Pass"
        : group.ruleStatus.includes("Fail")
        ? "Fail"
        : "N/A";
      rows.push([
        results.cutScore ?? "",
        group.label,
        group.total,
        group.selected,
        Number.isFinite(group.selectionRate) ? group.selectionRate : "",
        ratio,
        statusText,
      ]);
    });
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
  const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "adverse-impact-results.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildReportHtml(resultsList) {
  const sectionsHtml = resultsList
    .map((results) => {
      const rowsHtml = results.groups
        .map((group) => {
          const ratioDisplay = group.isReference
            ? "Reference"
            : Number.isFinite(group.adverseImpactRatio)
            ? group.adverseImpactRatio.toFixed(2)
            : "N/A";
          const statusText = group.ruleStatus.includes("Pass")
            ? "Pass"
            : group.ruleStatus.includes("Fail")
            ? "Fail"
            : "N/A";
          return `
            <tr>
              <td>${group.label}</td>
              <td>${group.total}</td>
              <td>${group.selected}</td>
              <td>${formatPercent(group.selectionRate)}</td>
              <td>${ratioDisplay}</td>
              <td>${statusText}</td>
            </tr>
          `;
        })
        .join("");

      const heading = results.cutScore === null ? "Pass/Fail decision" : `Cut Score = ${results.cutScore}%`;
      return `
        <div class="report-section">
          <div class="section-title">${heading}</div>
          <table>
            <thead>
              <tr>
                <th>Group</th>
                <th>Total Count (N)</th>
                <th>Pass Count</th>
                <th>Pass Rate</th>
                <th>4/5ths Ratio</th>
                <th>Four Fifths Rule</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    })
    .join("");

  const testName = resultsList[0].testName || "Adverse Impact Analysis";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Adverse Impact Analysis</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 28px; color: #1c1c1c; }
          h1 { margin: 0 0 6px 0; font-size: 22px; }
          h2 { margin: 0; font-size: 16px; font-weight: 600; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 13px; }
          th { text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; color: #555; }
          .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
          .meta { font-size: 12px; color: #555; margin-top: 6px; }
          .ideal-box { border: 1px solid #999; padding: 8px 10px; font-size: 11px; min-width: 220px; text-align: center; }
          .ideal-title { font-weight: 700; margin-bottom: 4px; }
          .report-section { border: 1px solid #999; margin-bottom: 14px; }
          .section-title { font-size: 12px; font-weight: 700; padding: 6px 10px; border-bottom: 1px solid #999; background: #f4f4f4; }
          .note { margin-top: 16px; font-size: 11px; color: #555; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Adverse Impact Analysis</h1>
            <h2>${testName}</h2>
            <div class="meta">
              Demographic column: ${resultsList[0].genderColumn} &nbsp;|&nbsp;
              Decision column: ${resultsList[0].decisionColumn}
            </div>
          </div>
          <div class="ideal-box">
            <div class="ideal-title">Ideal Adverse Impact Outcome</div>
            <div>4/5ths Ratio ≥ 0.80</div>
            <div>p-value ≥ 0.05</div>
          </div>
        </div>

        ${sectionsHtml}

        <div class="note">
          Disclaimer: This report is an informational screening aligned with EEOC 4/5ths guidance.
          It is not legal advice and should be reviewed by qualified counsel.
        </div>
      </body>
    </html>
  `;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handleReportDownload() {
  if (!state.lastResults) return;
  const html = buildReportHtml(state.lastResults);
  downloadFile("adverse-impact-report.html", html, "text/html");
}

function handleResultsDownload() {
  if (!state.lastResults) return;
  downloadResultsXLSX(state.lastResults);
}

function handlePrint() {
  if (!state.lastResults) return;
  const html = buildReportHtml(state.lastResults);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function handleSampleDownload() {
  const data = [
    ["CandidateEmail", "Demographic", "Decision", "PercentScore", "TestName"],
    ["cora@example.com", "Female", "Hired", 92.5, "Sample Assessment"],
    ["matt@example.com", "Male", "Not Selected", 71.0, "Sample Assessment"],
    ["sasha@example.com", "Female", "Hired", 88.0, "Sample Assessment"],
    ["li@example.com", "Male", "Hired", 95.0, "Sample Assessment"],
    ["jules@example.com", "Nonbinary", "Not Selected", 64.5, "Sample Assessment"],
    ["riley@example.com", "Female", "Hired", 90.0, "Sample Assessment"],
    ["omar@example.com", "Male", "Not Selected", 73.5, "Sample Assessment"],
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sample");
  const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sample-hiring.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildCutScoreOptions() {
  const genderColumn = genderSelect.value;
  const decisionColumn = decisionSelect.value;
  if (!genderColumn || !decisionColumn) {
    alert("Please select both the gender and decision columns.");
    return;
  }

  const scores = listColumnValues(decisionColumn)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (scores.length === 0) {
    alert("No numeric scores found in the decision column.");
    return;
  }

  const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const variance =
    scores.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(scores.length - 1, 1);
  const stdDev = Math.sqrt(variance);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const candidates = [
    mean - 2 * stdDev,
    mean - stdDev,
    mean,
    mean + stdDev,
    mean + 2 * stdDev,
  ]
    .map((value) => Math.min(Math.max(value, minScore), maxScore))
    .map((value) => Math.round(value * 10) / 10);

  const uniqueCandidates = Array.from(new Set(candidates)).sort((a, b) => b - a);

  const cutScoresText = uniqueCandidates.join("; ");
  cutScoreInput.value = cutScoresText;
  if (cutScoreNote) {
    cutScoreNote.textContent = `Suggestions are based on mean ± 1 and ± 2 standard deviations (mean=${mean.toFixed(
      1
    )}, SD=${stdDev.toFixed(1)}), rounded to 1 decimal.`;
  }
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
    let parsed = { headers: [], data: [] };

    if (isCsv) {
      const text = loadEvent.target.result;
      parsed = parseCSV(text);
    } else if (isXlsx) {
      const arrayBuffer = loadEvent.target.result;
      parsed = parseXLSX(arrayBuffer);
    }

    const { headers, data } = parsed;

    if (!headers.length) {
      alert("Could not parse file headers. Please check the file format.");
      resetSelections();
      return;
    }

    state.fileName = file.name;
    state.headers = headers;
    state.rows = data;

    uploadMeta.textContent = `${file.name} (${data.length} rows)`;
    populateSelect(genderSelect, headers);
    populateSelect(decisionSelect, headers);
    decisionTypeSelect.disabled = false;
    testNameInput.disabled = false;
    selectedValuesOther.disabled = false;
    runButton.disabled = false;
    generateOptionsButton.disabled = false;

    const genderGuess = guessColumn(headers, ["gender", "sex"]);
    if (genderGuess) genderSelect.value = genderGuess;

    const decisionGuess = guessColumn(headers, ["decision", "status", "outcome", "hire", "selected"]);
    if (decisionGuess) decisionSelect.value = decisionGuess;

    if (decisionGuess) {
      const values = listColumnValues(decisionGuess);
      const guess = guessSelectedValues(values);
      if (guess) selectedValuesOther.value = guess;
    }
    const genderValues = Array.from(new Set(listColumnValues(genderSelect.value))).sort();
    if (genderValues.length) {
      populateReferenceGroups(genderValues);
    }
    if (decisionSelect.value) {
      const decisionValues = Array.from(new Set(listColumnValues(decisionSelect.value))).slice(0, 18);
      renderSelectedValueOptions(decisionValues);
      if (selectedValuesOther.value) {
        const guessed = selectedValuesOther.value.split(",").map((value) => value.trim().toLowerCase());
        selectedValuesList.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          if (guessed.includes(input.value.trim().toLowerCase())) {
            input.checked = true;
          }
        });
      }
    }
    updateDecisionTypeUI();
    if (decisionTypeSelect.value === "score") {
      buildCutScoreOptions();
    }

    resultsEmpty.classList.remove("hidden");
    resultsWrap.classList.add("hidden");
    state.lastResults = null;
    state.lastCutScoreOptions = null;
  };

  if (file.name.toLowerCase().endsWith(".csv")) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
});

runButton.addEventListener("click", analyze);
generateOptionsButton.addEventListener("click", buildCutScoreOptions);
decisionTypeSelect.addEventListener("change", updateDecisionTypeUI);
genderSelect.addEventListener("change", () => {
  const genderValues = Array.from(new Set(listColumnValues(genderSelect.value))).sort();
  if (genderValues.length) {
    populateReferenceGroups(genderValues);
  }
});
decisionSelect.addEventListener("change", () => {
  if (decisionTypeSelect.value === "score") {
    buildCutScoreOptions();
  }
  if (decisionTypeSelect.value !== "score") {
    const decisionValues = Array.from(new Set(listColumnValues(decisionSelect.value))).slice(0, 18);
    renderSelectedValueOptions(decisionValues);
  }
});

downloadReportBtn.addEventListener("click", handleReportDownload);

downloadResultsBtn.addEventListener("click", handleResultsDownload);

printReportBtn.addEventListener("click", handlePrint);

downloadSampleBtn.addEventListener("click", handleSampleDownload);

resetSelections();
