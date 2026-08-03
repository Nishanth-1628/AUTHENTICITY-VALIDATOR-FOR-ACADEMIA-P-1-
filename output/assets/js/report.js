/* ==========================================================================
   Report + export generation — runs entirely in the browser using jsPDF
   and SheetJS (loaded via CDN in the pages that need them), replacing the
   server-side /api/documents/:id/report, /api/export/csv, /api/export/excel
   endpoints.
   ========================================================================== */

function downloadReport(docId) {
  const doc = Documents.findById(docId);
  if (!doc) {
    showToast("Report not found", "error");
    return;
  }
  if (typeof window.jspdf === "undefined") {
    showToast("PDF library failed to load", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  let y = 20;

  const line = (text, size = 11, gap = 8) => {
    pdf.setFontSize(size);
    const wrapped = pdf.splitTextToSize(text, 170);
    pdf.text(wrapped, 20, y);
    y += gap * wrapped.length;
  };

  pdf.setFontSize(18);
  pdf.text("Authenticity Validator — Report", 20, y);
  y += 14;

  line(`File: ${doc.original_filename}`, 12);
  line(`Type: ${doc.doc_type} (${doc.file_type})`, 12);
  line(`Status: ${doc.status}`, 12);
  line(`Generated: ${new Date(doc.created_at).toLocaleString()}`, 12);
  y += 4;

  if (doc.analysis) {
    const a = doc.analysis;
    line(`Authenticity Score: ${a.authenticity_score} / 100  (${a.verdict})`, 13, 10);
    y += 2;
    line(`Plagiarism: ${a.plagiarism.plagiarism_percentage}%`);
    line(`AI-Generated Content: ${a.ai_detection.ai_content_percentage}% (confidence: ${a.ai_detection.confidence})`);
    line(`Citation Accuracy: ${a.citations.citation_accuracy}% (${a.citations.total_citations_found} citations found)`);
    line(`Grammar Score: ${a.grammar.grammar_score} / 100 (${a.grammar.issues_found} issues found)`);

    if (a.plagiarism.matches && a.plagiarism.matches.length) {
      y += 4;
      line("Top matching sources:", 12, 8);
      a.plagiarism.matches.forEach((m) => line(`  • ${m.source} — ${m.similarity}% similarity`, 10, 6));
    }
  } else if (doc.certificate_verification) {
    const c = doc.certificate_verification;
    line(`Certificate Verdict: ${c.verdict}`, 13, 10);
    line(`QR/Verification payload found: ${c.qr_found ? "Yes" : "No"}`);
    line(`Hash match: ${c.hash_match ? "Yes" : "No"}`);
  }

  pdf.save(`report_${docId}.pdf`);
}

function exportHistoryCsv() {
  const user = Users.findById(currentUserId());
  if (!user) return;
  const docs = isAdmin(user) ? Documents.all() : Documents.byUser(user.id);

  const headers = ["Filename", "Type", "Status", "Score", "Plagiarism %", "AI Content %", "Date"];
  const rows = docs.map((d) => [
    d.original_filename,
    d.file_type,
    d.status,
    d.authenticity_score ?? "",
    d.plagiarism_percentage ?? "",
    d.ai_content_percentage ?? "",
    new Date(d.created_at).toLocaleDateString(),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, "history.csv");
}

function exportHistoryExcel() {
  const user = Users.findById(currentUserId());
  if (!user) return;
  if (typeof XLSX === "undefined") {
    showToast("Excel library failed to load", "error");
    return;
  }
  const docs = isAdmin(user) ? Documents.all() : Documents.byUser(user.id);

  const rows = docs.map((d) => ({
    Filename: d.original_filename,
    Type: d.file_type,
    Status: d.status,
    Score: d.authenticity_score ?? "",
    "Plagiarism %": d.plagiarism_percentage ?? "",
    "AI Content %": d.ai_content_percentage ?? "",
    Date: new Date(d.created_at).toLocaleDateString(),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "History");
  XLSX.writeFile(wb, "history.xlsx");
}

function triggerDownload(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
