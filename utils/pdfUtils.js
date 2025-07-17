export const handlePDFResponse = (res, pdfBuffer, filename) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  res.send(pdfBuffer);
};

export const generatePDFFilename = (type, date, startYear, endYear) => {
  switch (type) {
    case "weekly":
      return `Laporan-Mingguan-${date.toISOString().split("T")[0]}.pdf`;
    case "monthly":
      return `Laporan-Bulanan-${date.toISOString().split("T")[0]}.pdf`;
    case "yearly":
      return `Laporan-Tahunan-${startYear}-${endYear}.pdf`;
    default:
      return `Laporan-${Date.now()}.pdf`;
  }
};
