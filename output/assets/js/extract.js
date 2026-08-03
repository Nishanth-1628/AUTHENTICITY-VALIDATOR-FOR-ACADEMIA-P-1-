/* ==========================================================================
   Client-side text extraction — replaces the Python extract_text() pipeline
   (pdfplumber / python-docx / pytesseract) with in-browser equivalents:
     - PDF   -> pdf.js
     - DOCX  -> mammoth.js
     - Image -> Tesseract.js (OCR)
   All three libraries are loaded via CDN <script> tags in upload.html.
   ========================================================================== */

async function extractText(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  try {
    if (ext === "pdf") return await extractPdf(file);
    if (ext === "docx" || ext === "doc") return await extractDocx(file);
    if (["png", "jpg", "jpeg"].includes(ext)) return await extractImageOcr(file);
    return "";
  } catch (e) {
    console.error("[extract] failed:", e);
    return "";
  }
}

async function extractPdf(file) {
  if (typeof pdfjsLib === "undefined") {
    console.error("pdf.js not loaded");
    return "";
  }
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(" ") + "\n";
  }
  return text.trim();
}

async function extractDocx(file) {
  if (typeof mammoth === "undefined") {
    console.error("mammoth.js not loaded");
    return "";
  }
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value.trim();
}

async function extractImageOcr(file) {
  if (typeof Tesseract === "undefined") {
    console.error("Tesseract.js not loaded");
    return "";
  }
  const { data } = await Tesseract.recognize(file, "eng");
  return (data.text || "").trim();
}
