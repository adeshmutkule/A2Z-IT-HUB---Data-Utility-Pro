if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js";
}

const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const dataTable = document.getElementById("dataTable");
const tableWrap = document.getElementById("tableWrap");
const pdfPreview = document.getElementById("pdfPreview");
const numbersInput = document.getElementById("numbersInput");
const removeBtn = document.getElementById("removeBtn");
const add91Btn = document.getElementById("add91Btn");
const cleanBtn = document.getElementById("cleanBtn");
const clearBtn = document.getElementById("clearBtn");
const message = document.getElementById("message");
const stats = document.getElementById("stats");
const uniqueOutput = document.getElementById("uniqueOutput");
const duplicateOutput = document.getElementById("duplicateOutput");
const prefixedOutput = document.getElementById("prefixedOutput");
const cleanedOutput = document.getElementById("cleanedOutput");
const copyButtons = document.querySelectorAll(".copy-btn");
const exportSource = document.getElementById("exportSource");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportExcelBtn = document.getElementById("exportExcelBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const exportTxtBtn = document.getElementById("exportTxtBtn");
const exportNote = document.getElementById("exportNote");

function parseNumbers(raw) {
  const tokens = raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const invalidTokens = tokens.filter((token) => !/^[-+]?\d+(\.\d+)?$/.test(token));

  if (invalidTokens.length > 0) {
    return {
      valid: false,
      invalidTokens,
      numbers: []
    };
  }

  return {
    valid: true,
    invalidTokens: [],
    numbers: tokens.map(Number)
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseCsvLine(line) {
  const row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  return row;
}

function parseCsvText(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  return lines.map(parseCsvLine);
}

function renderTable(rows) {
  if (!rows.length) {
    dataTable.innerHTML = "";
    fileInfo.textContent = "File preview: No rows found.";
    return;
  }

  const headerCells = rows[0].map((cell, index) => `<th>${escapeHtml(cell || `Column ${index + 1}`)}</th>`).join("");
  const bodyRows = rows.slice(1).map((row) => {
    const cells = row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  dataTable.innerHTML = `<thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody>`;
  fileInfo.textContent = `File preview: ${rows.length - 1} rows shown.`;
  tableWrap.style.display = "block";
  pdfPreview.style.display = "none";
}

async function previewCsv(file) {
  const text = await file.text();
  const rows = parseCsvText(text);
  renderTable(rows);
}

async function previewExcel(file) {
  if (!window.XLSX) {
    throw new Error("Excel library failed to load.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  renderTable(rows);
  fileInfo.textContent = `File preview: Sheet ${firstSheetName}, ${Math.max(rows.length - 1, 0)} rows.`;
}

async function previewPdf(file) {
  if (!window.pdfjsLib) {
    throw new Error("PDF library failed to load.");
  }

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
    pages.push(`Page ${pageNumber}: ${text}`);
  }

  tableWrap.style.display = "none";
  pdfPreview.style.display = "block";
  pdfPreview.textContent = pages.join("\n\n") || "No extractable text found.";
  fileInfo.textContent = `File preview: PDF ${pdf.numPages} pages.`;
}

function removeDuplicates(numbers) {
  const seen = new Set();
  const unique = [];
  const duplicates = [];

  for (const number of numbers) {
    if (seen.has(number)) {
      duplicates.push(number);
    } else {
      seen.add(number);
      unique.push(number);
    }
  }

  return { unique, duplicates };
}

function updateView(unique, duplicates, totalCount) {
  uniqueOutput.textContent = unique.length ? unique.join(", ") : "-";
  duplicateOutput.textContent = duplicates.length ? duplicates.join(", ") : "-";
  stats.textContent = `Total: ${totalCount} | Unique: ${unique.length} | Removed: ${duplicates.length}`;
}

function prefixAllWith91(values) {
  return values.map((value) => {
    const raw = String(value).trim().replace(/^\+/, "");
    return raw.startsWith("91") ? raw : `91${raw.replace(/^[-+]/, "")}`;
  });
}

function normalizeTokens(raw, strip91Prefix) {
  const tokens = raw
    .split(/[\n,;\t ]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const normalized = [];

  for (const token of tokens) {
    let digits = token.replace(/\D+/g, "");
    if (!digits) {
      continue;
    }

    if (strip91Prefix) {
      while (digits.length > 10 && digits.startsWith("91")) {
        digits = digits.slice(2);
      }
    }

    normalized.push(digits);
  }

  return normalized;
}

function handleEmptyInput(outputNode) {
  message.textContent = "Please enter at least one number.";
  outputNode.textContent = "-";
}

function formatForLineByLineCopy(text) {
  return text
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

async function copyAsLines(outputNode) {
  const raw = outputNode.textContent.trim();

  if (!raw || raw === "-") {
    message.textContent = "Nothing to copy yet.";
    return;
  }

  const lineByLine = formatForLineByLineCopy(raw);

  try {
    await navigator.clipboard.writeText(lineByLine);
  } catch (error) {
    const temp = document.createElement("textarea");
    temp.value = lineByLine;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
  }

  message.textContent = "Copied successfully. Numbers are line by line.";
}

function getOutputTextBySource(sourceKey) {
  const sourceMap = {
    unique: uniqueOutput,
    duplicates: duplicateOutput,
    prefixed: prefixedOutput,
    cleaned: cleanedOutput
  };

  const node = sourceMap[sourceKey] || uniqueOutput;
  return node.textContent.trim();
}

function getExportData() {
  const sourceKey = exportSource.value;
  const raw = getOutputTextBySource(sourceKey);

  if (!raw || raw === "-") {
    throw new Error("No export data available for selected source.");
  }

  const values = raw
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!values.length) {
    throw new Error("Selected output is empty.");
  }

  return { values, sourceKey };
}

function downloadBlob(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const { values, sourceKey } = getExportData();
  const content = ["number", ...values].join("\n");
  downloadBlob(content, `${sourceKey}-numbers.csv`, "text/csv;charset=utf-8;");
  exportNote.textContent = "CSV downloaded.";
}

function exportTxt() {
  const { values, sourceKey } = getExportData();
  downloadBlob(values.join("\n"), `${sourceKey}-numbers.txt`, "text/plain;charset=utf-8;");
  exportNote.textContent = "TXT downloaded.";
}

function exportExcel() {
  const { values, sourceKey } = getExportData();
  if (!window.XLSX) {
    throw new Error("Excel exporter unavailable.");
  }

  const rows = [["number"], ...values.map((value) => [value])];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Numbers");
  XLSX.writeFile(book, `${sourceKey}-numbers.xlsx`);
  exportNote.textContent = "Excel downloaded.";
}

function exportPdf() {
  const { values, sourceKey } = getExportData();
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("PDF exporter unavailable.");
  }

  const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Exported Numbers", 40, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  let y = 72;
  for (let i = 0; i < values.length; i += 1) {
    doc.text(`${i + 1}. ${String(values[i])}`, 40, y);
    y += 16;
    if (y > 800) {
      doc.addPage();
      y = 40;
    }
  }

  doc.save(`${sourceKey}-numbers.pdf`);
  exportNote.textContent = "PDF downloaded.";
}

fileInput.addEventListener("change", async () => {
  message.textContent = "";
  exportNote.textContent = "";

  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    return;
  }

  const name = file.name.toLowerCase();

  try {
    if (name.endsWith(".csv")) {
      await previewCsv(file);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      await previewExcel(file);
    } else if (name.endsWith(".pdf")) {
      await previewPdf(file);
    } else {
      throw new Error("Unsupported file type.");
    }
  } catch (error) {
    tableWrap.style.display = "none";
    pdfPreview.style.display = "block";
    pdfPreview.textContent = "Could not read this file.";
    fileInfo.textContent = "File preview: Error while reading file.";
  }
});

removeBtn.addEventListener("click", () => {
  message.textContent = "";
  exportNote.textContent = "";
  const raw = numbersInput.value.trim();

  if (!raw) {
    message.textContent = "Please enter at least one number.";
    updateView([], [], 0);
    return;
  }

  const parsed = parseNumbers(raw);

  if (!parsed.valid) {
    const sample = parsed.invalidTokens.slice(0, 4).join(", ");
    message.textContent = `Invalid input detected: ${sample}`;
    updateView([], [], 0);
    return;
  }

  const { unique, duplicates } = removeDuplicates(parsed.numbers);
  updateView(unique, duplicates, parsed.numbers.length);
  prefixedOutput.textContent = "-";
  cleanedOutput.textContent = "-";
});

add91Btn.addEventListener("click", () => {
  message.textContent = "";
  exportNote.textContent = "";
  const raw = numbersInput.value.trim();

  if (!raw) {
    message.textContent = "Please enter at least one number.";
    prefixedOutput.textContent = "-";
    return;
  }

  const parsed = parseNumbers(raw);

  if (!parsed.valid) {
    const sample = parsed.invalidTokens.slice(0, 4).join(", ");
    message.textContent = `Invalid input detected: ${sample}`;
    prefixedOutput.textContent = "-";
    return;
  }

  const { unique, duplicates } = removeDuplicates(parsed.numbers);
  updateView(unique, duplicates, parsed.numbers.length);

  const allWith91 = prefixAllWith91(unique);
  prefixedOutput.textContent = allWith91.length ? allWith91.join(", ") : "-";
  cleanedOutput.textContent = "-";
});

cleanBtn.addEventListener("click", () => {
  message.textContent = "";
  exportNote.textContent = "";
  const raw = numbersInput.value.trim();

  if (!raw) {
    handleEmptyInput(cleanedOutput);
    return;
  }

  const normalized = normalizeTokens(raw, true);

  if (!normalized.length) {
    message.textContent = "No numeric value found in input.";
    cleanedOutput.textContent = "-";
    updateView([], [], 0);
    prefixedOutput.textContent = "-";
    return;
  }

  const { unique, duplicates } = removeDuplicates(normalized);
  updateView(unique, duplicates, normalized.length);
  cleanedOutput.textContent = unique.join(", ");
  prefixedOutput.textContent = "-";
});

clearBtn.addEventListener("click", () => {
  numbersInput.value = "";
  message.textContent = "";
  exportNote.textContent = "";
  updateView([], [], 0);
  prefixedOutput.textContent = "-";
  cleanedOutput.textContent = "-";
  numbersInput.focus();
});

exportCsvBtn.addEventListener("click", () => {
  try {
    exportCsv();
  } catch (error) {
    exportNote.textContent = error.message;
  }
});

exportExcelBtn.addEventListener("click", () => {
  try {
    exportExcel();
  } catch (error) {
    exportNote.textContent = error.message;
  }
});

exportPdfBtn.addEventListener("click", () => {
  try {
    exportPdf();
  } catch (error) {
    exportNote.textContent = error.message;
  }
});

exportTxtBtn.addEventListener("click", () => {
  try {
    exportTxt();
  } catch (error) {
    exportNote.textContent = error.message;
  }
});

for (const button of copyButtons) {
  button.addEventListener("click", () => {
    const targetId = button.getAttribute("data-copy-target");
    const target = document.getElementById(targetId);
    copyAsLines(target);
  });
}
