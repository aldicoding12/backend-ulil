// utils/pdfGenerator.js
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import moment from "moment-hijri";

/* 
INSTALASI LIBRARY:
npm install moment-hijri
*/

// Helper function untuk format currency Indonesia
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

// Helper function untuk format tanggal Indonesia
const formatDate = (date) => {
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const d = new Date(date);
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  return `${day} ${month} ${year}`;
};

// Helper function untuk format tanggal Hijriah menggunakan moment-hijri
const formatHijriDate = (date) => {
  const hijriMonths = [
    "Muharram",
    "Safar",
    "Rabiul Awal",
    "Rabiul Akhir",
    "Jumadil Awal",
    "Jumadil Akhir",
    "Rajab",
    "Sya'ban",
    "Ramadhan",
    "Syawal",
    "Dzulqaidah",
    "Dzulhijjah",
  ];

  try {
    const hijriMoment = moment(date);
    const day = hijriMoment.iDate();
    const month = hijriMonths[hijriMoment.iMonth()];
    const year = hijriMoment.iYear();

    return `${day} ${month} ${year} H`;
  } catch (error) {
    console.log("Error converting to Hijri date:", error);
    return formatHijriDateFallback(date);
  }
};

// Fallback function jika library hijri tidak tersedia
const formatHijriDateFallback = (date) => {
  const hijriMonths = [
    "Muharram",
    "Safar",
    "Rabiul Awal",
    "Rabiul Akhir",
    "Jumadil Awal",
    "Jumadil Akhir",
    "Rajab",
    "Sya'ban",
    "Ramadhan",
    "Syawal",
    "Dzulqaidah",
    "Dzulhijjah",
  ];

  const gregorianDate = new Date(date);
  const gregorianDays = Math.floor(
    gregorianDate.getTime() / (1000 * 60 * 60 * 24)
  );

  const hijriEpoch = Math.floor(
    new Date(622, 6, 16).getTime() / (1000 * 60 * 60 * 24)
  );
  const daysSinceHijriEpoch = gregorianDays - hijriEpoch;

  const hijriYear = Math.floor(daysSinceHijriEpoch / 354.37) + 1;
  const remainingDays = daysSinceHijriEpoch % 354.37;

  const hijriMonth = Math.floor(remainingDays / 29.53);
  const hijriDay = Math.floor(remainingDays % 29.53) + 1;

  const monthName = hijriMonths[Math.min(hijriMonth, 11)];

  return `${hijriDay} ${monthName} ${Math.floor(hijriYear)} H`;
};

// Helper function untuk mendapatkan tanggal 7 hari yang lalu
const getSevenDaysAgoDate = () => {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  return sevenDaysAgo;
};

// Helper function untuk mendapatkan range tanggal dari 7 hari yang lalu sampai hari ini
const getWeeklyRange = () => {
  const today = new Date();
  const sevenDaysAgo = getSevenDaysAgoDate();

  return {
    start: sevenDaysAgo,
    end: today,
  };
};

// Helper function untuk mendapatkan tanggal terakhir bulan sebelumnya
const getLastMonthEndDate = () => {
  const today = new Date();
  const lastDayOfPreviousMonth = new Date(
    today.getFullYear(),
    today.getMonth(),
    0
  );
  return lastDayOfPreviousMonth;
};

// Helper function untuk mendapatkan tanggal terakhir tahun sebelumnya
const getLastYearEndDate = () => {
  const today = new Date();
  const lastDayOfPreviousYear = new Date(today.getFullYear() - 1, 11, 31);
  return lastDayOfPreviousYear;
};

// Helper function untuk register Playfair Display font
const registerPlayfairDisplayFont = (doc) => {
  try {
    const playfairRegular = path.join(
      process.cwd(),
      "public/fonts/PlayfairDisplay-Regular.ttf"
    );
    const playfairBold = path.join(
      process.cwd(),
      "public/fonts/PlayfairDisplay-Bold.ttf"
    );

    if (fs.existsSync(playfairRegular)) {
      doc.registerFont("PlayfairDisplay-Regular", playfairRegular);
    }
    if (fs.existsSync(playfairBold)) {
      doc.registerFont("PlayfairDisplay-Bold", playfairBold);
    }

    return true;
  } catch (error) {
    console.log(
      "Playfair Display font files not found, using built-in Times fonts"
    );
    return false;
  }
};

// Helper function untuk mengambil logo dari file lokal
const getLogoBuffer = async (logoFileName) => {
  try {
    const logoPath = path.join(process.cwd(), "public/images", logoFileName);
    if (fs.existsSync(logoPath)) {
      return fs.readFileSync(logoPath);
    }
    return null;
  } catch (error) {
    console.log(`Error loading logo ${logoFileName}:`, error);
    return null;
  }
};

export const generateFinanceReport = async (
  reportData,
  reportType = "weekly"
) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
      });

      let buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        let pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const hasPlayfairDisplay = registerPlayfairDisplayFont(doc);

      const unmLogoBuffer = await getLogoBuffer("unm.png");
      const ulilLogoBuffer = await getLogoBuffer("ulil.png");

      let finalReportData = { ...reportData };

      // Set default range berdasarkan report type jika tidak ada
      if (!reportData.range) {
        switch (reportType) {
          case "weekly":
            finalReportData.range = getWeeklyRange();
            break;
          case "monthly":
            // Untuk monthly, set range ke bulan sekarang (bukan bulan lalu)
            const currentMonth = new Date();
            finalReportData.range = {
              start: new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth(),
                1
              ),
              end: currentMonth,
            };
            break;
          case "yearly":
            // Untuk yearly, set range ke tahun sekarang (bukan tahun lalu)
            const currentYear = new Date();
            finalReportData.range = {
              start: new Date(currentYear.getFullYear(), 0, 1),
              end: currentYear,
            };
            break;
          // custom tidak perlu default range karena harus diberikan dari luar
        }
      }

      await drawHeader(doc, unmLogoBuffer, ulilLogoBuffer, hasPlayfairDisplay);
      drawReportTitle(doc, reportType, finalReportData, hasPlayfairDisplay);
      drawFinanceContent(doc, finalReportData, reportType, hasPlayfairDisplay);
      drawFooter(doc, finalReportData, hasPlayfairDisplay);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

async function drawHeader(
  doc,
  unmLogoBuffer,
  ulilLogoBuffer,
  hasPlayfairDisplay
) {
  const pageWidth = doc.page.width;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  // Menggunakan Playfair Display atau fallback ke Times-Roman built-in
  const titleFont = hasPlayfairDisplay ? "PlayfairDisplay-Bold" : "Times-Bold";
  const regularFont = hasPlayfairDisplay
    ? "PlayfairDisplay-Regular"
    : "Times-Roman";

  // Logo UNM (kiri)
  if (unmLogoBuffer) {
    try {
      doc.image(unmLogoBuffer, margin + 5, 20, { width: 45, height: 45 });
    } catch (error) {
      console.log("Error loading UNM logo:", error);
      doc.circle(margin + 27, 42, 22).stroke();
      doc.fontSize(12).text("UNM", margin + 20, 38);
    }
  } else {
    doc.circle(margin + 27, 42, 22).stroke();
    doc.fontSize(12).text("UNM", margin + 20, 38);
  }

  // Judul institusi (tengah)
  doc
    .fontSize(12)
    .font(titleFont)
    .text("PENGURUS MASJID", margin + 70, 20, {
      width: contentWidth - 140,
      align: "center",
    });

  doc
    .fontSize(12)
    .fillColor("green")
    .text("ULIL ALBAB", margin + 70, 35, {
      width: contentWidth - 140,
      align: "center",
    });

  doc
    .fontSize(12)
    .fillColor("black")
    .font(regularFont)
    .text("UNIVERSITAS NEGERI MAKASSAR", margin + 70, 50, {
      width: contentWidth - 140,
      align: "center",
    });

  // Logo Ulil Albab (kanan)
  if (ulilLogoBuffer) {
    try {
      doc.image(ulilLogoBuffer, pageWidth - margin - 50, 20, {
        width: 45,
        height: 45,
      });
    } catch (error) {
      console.log("Error loading Ulil Albab logo:", error);
      doc.rect(pageWidth - margin - 50, 20, 45, 35).stroke();
      doc.fontSize(12).text("Ulil", pageWidth - margin - 45, 35);
    }
  } else {
    doc.rect(pageWidth - margin - 50, 20, 45, 35).stroke();
    doc.fontSize(12).text("Ulil", pageWidth - margin - 45, 35);
  }

  // Garis atas header
  doc
    .moveTo(margin, 75)
    .lineTo(pageWidth - margin, 75)
    .lineWidth(2)
    .stroke();

  // Alamat
  doc
    .fontSize(12)
    .font(regularFont)
    .text(
      "Sekretariat: Kompleks Masjid Ulil Albab UNM Makassar, 90224. Telp: 082187502481",
      margin,
      80,
      {
        width: contentWidth,
        align: "center",
      }
    );

  // Garis bawah header
  doc
    .moveTo(margin, 100)
    .lineTo(pageWidth - margin, 100)
    .lineWidth(1)
    .stroke();

  doc.y = 110;
}

function drawReportTitle(doc, reportType, reportData, hasPlayfairDisplay) {
  const pageWidth = doc.page.width;
  const margin = 40;
  const titleFont = hasPlayfairDisplay ? "PlayfairDisplay-Bold" : "Times-Bold";
  const regularFont = hasPlayfairDisplay
    ? "PlayfairDisplay-Regular"
    : "Times-Roman";

  doc
    .fontSize(12)
    .font(titleFont)
    .text("LAPORAN KEUANGAN", margin, doc.y, {
      width: pageWidth - margin * 2,
      align: "center",
    });

  let reportTitle = "";
  switch (reportType) {
    case "weekly":
      reportTitle = "MASJID ULIL ALBAB UNM (MINGGUAN)";
      break;
    case "monthly":
      reportTitle = "MASJID ULIL ALBAB UNM (BULANAN)";
      break;
    case "yearly":
      reportTitle = "MASJID ULIL ALBAB UNM (TAHUNAN)";
      break;
    case "custom":
      reportTitle = "MASJID ULIL ALBAB UNM (PERIODE KHUSUS)";
      break;
    default:
      reportTitle = "MASJID ULIL ALBAB UNM";
  }

  doc
    .fontSize(12)
    .font(regularFont)
    .text(reportTitle, margin, doc.y + 15, {
      width: pageWidth - margin * 2,
      align: "center",
    });

  doc.y += 40;
}

function drawFinanceContent(doc, reportData, reportType, hasPlayfairDisplay) {
  const margin = 40;
  const titleFont = hasPlayfairDisplay ? "PlayfairDisplay-Bold" : "Times-Bold";
  const regularFont = hasPlayfairDisplay
    ? "PlayfairDisplay-Regular"
    : "Times-Roman";

  // A. Laporan Keuangan
  doc.fontSize(12).font(titleFont).text("A. Laporan Keuangan", margin, doc.y);

  // Logic untuk menampilkan saldo awal atau periode
  if (reportType === "custom") {
    // Untuk custom report, hanya tampilkan periode tanpa saldo awal
    if (reportData.range && reportData.range.start && reportData.range.end) {
      const startDate = formatDate(reportData.range.start);
      const endDate = formatDate(reportData.range.end);

      doc
        .fontSize(12)
        .font(regularFont)
        .text(`Periode Laporan: ${startDate} - ${endDate}`, margin, doc.y + 18);

      doc.y += 40;
    } else {
      doc.y += 20;
    }
  } else {
    // Untuk weekly, monthly, yearly - tampilkan saldo awal jika ada
    if (reportData.saldoAwal !== undefined) {
      let referenceDate;
      let saldoLabel = "";

      switch (reportType) {
        case "weekly":
          // Untuk mingguan, gunakan tanggal 7 hari yang lalu
          referenceDate = getSevenDaysAgoDate();
          saldoLabel = "Saldo Kas 7 Hari Lalu";
          break;
        case "monthly":
          // Untuk bulanan, gunakan tanggal terakhir bulan sebelumnya
          referenceDate = getLastMonthEndDate();
          saldoLabel = "Saldo Kas Bulan Lalu";
          break;
        case "yearly":
          // Untuk tahunan, gunakan tanggal terakhir tahun sebelumnya
          referenceDate = getLastYearEndDate();
          saldoLabel = "Saldo Kas Tahun Lalu";
          break;
        default:
          referenceDate = new Date();
          saldoLabel = "Saldo Kas Sebelumnya";
      }

      const referenceDateGregorian = formatDate(referenceDate);
      const referenceDateHijri = formatHijriDate(referenceDate);

      const saldoKasSebelumnyaY = doc.y + 18;

      // Baris pertama: Label saldo
      doc
        .fontSize(12)
        .font(regularFont)
        .text(`${saldoLabel}`, margin, saldoKasSebelumnyaY);

      // Baris kedua: Tanggal
      doc.text(
        `${referenceDateGregorian} M / ${referenceDateHijri}`,
        margin,
        saldoKasSebelumnyaY + 15
      );

      // Nilai mata uang di sebelah kanan baris pertama
      doc.text(
        `: ${formatCurrency(reportData.saldoAwal)}`,
        margin + 350,
        saldoKasSebelumnyaY
      );

      doc.y += 45;
    } else {
      // Jika tidak ada saldoAwal, tampilkan periode laporan saja
      if (reportData.range && reportData.range.start && reportData.range.end) {
        const startDate = formatDate(reportData.range.start);
        const endDate = formatDate(reportData.range.end);

        let periodLabel = "";
        switch (reportType) {
          case "weekly":
            periodLabel = "Periode Mingguan";
            break;
          case "monthly":
            periodLabel = "Periode Bulanan";
            break;
          case "yearly":
            periodLabel = "Periode Tahunan";
            break;
          default:
            periodLabel = "Periode Laporan";
        }

        doc
          .fontSize(12)
          .font(regularFont)
          .text(
            `${periodLabel}: ${startDate} - ${endDate}`,
            margin,
            doc.y + 18
          );

        doc.y += 40;
      } else {
        doc.y += 20;
      }
    }
  }

  // Pemasukan
  doc.font(titleFont).text("Pemasukan", margin, doc.y);

  let yPos = doc.y + 18;

  if (reportData.incomes && reportData.incomes.length > 0) {
    reportData.incomes.forEach((income) => {
      doc
        .fontSize(12)
        .font(regularFont)
        .text(
          `• ${income.name || income.name || "Pemasukan"}`,
          margin + 20,
          yPos
        )
        .text(`: ${formatCurrency(income.amount)}`, margin + 320, yPos);
      yPos += 18;
    });
  } else {
    doc
      .fontSize(12)
      .font(regularFont)
      .text("• Isi kotak amal", margin + 20, yPos)
      .text(
        `: ${formatCurrency(reportData.totalIncome || 0)}`,
        margin + 320,
        yPos
      );
    yPos += 18;
  }

  // Total pemasukan
  doc
    .fontSize(12)
    .font(regularFont)
    .text(
      `Total Pemasukan: ${formatCurrency(reportData.totalIncome || 0)}`,
      margin + 220,
      yPos + 10
    );

  yPos += 35;
  doc.y = yPos;

  // Pengeluaran
  doc.font(titleFont).text("Pengeluaran", margin, doc.y);

  yPos = doc.y + 18;

  if (reportData.expenses && reportData.expenses.length > 0) {
    reportData.expenses.forEach((expense) => {
      doc
        .fontSize(12)
        .font(regularFont)
        .text(`• ${expense.name || expense.note}`, margin + 20, yPos)
        .text(`: ${formatCurrency(expense.amount)}`, margin + 320, yPos);
      yPos += 18;
    });
  } else {
    doc
      .fontSize(12)
      .font(regularFont)
      .text("• Tidak ada pengeluaran", margin + 20, yPos)
      .text(`: ${formatCurrency(0)}`, margin + 320, yPos);
    yPos += 18;
  }

  // Total pengeluaran
  doc
    .fontSize(12)
    .font(regularFont)
    .text(
      `Total Pengeluaran: ${formatCurrency(reportData.totalExpense || 0)}`,
      margin + 200,
      yPos + 10
    );

  yPos += 35;
  doc.y = yPos;

  // Saldo kas saat ini
  const saldoSaatIniY = doc.y;
  doc.font(titleFont).text("Saldo kas saat ini", margin + 20, saldoSaatIniY);

  doc.text(
    `: ${formatCurrency(reportData.saldoAkhir || 0)}`,
    margin + 350,
    saldoSaatIniY
  );

  doc.y += 40;

  // B. Acara Jum'at (hanya untuk laporan mingguan)
  if (reportType === "weekly") {
    doc.fontSize(12).font(titleFont).text("B. Acara Jum'at", margin, doc.y);

    const khatibName = reportData.khatib || "..............";

    let currentY = doc.y + 18;

    doc
      .fontSize(12)
      .font(regularFont)
      .text("Muadzin", margin + 20, currentY)
      .text(": PM ULIL ALBAB", margin + 80, currentY);

    currentY += 18;
    doc
      .text("Imam", margin + 20, currentY)
      .text(": .............................", margin + 80, currentY);

    currentY += 18;
    doc
      .text("Khatib", margin + 20, currentY)
      .text(`: ${khatibName}`, margin + 80, currentY);

    doc.y = currentY + 25;
  }
}

function drawFooter(doc, reportData, hasPlayfairDisplay) {
  const pageWidth = doc.page.width;
  const margin = 40;
  const currentDate = new Date();
  const hijriDate = formatHijriDate(currentDate);
  const titleFont = hasPlayfairDisplay ? "PlayfairDisplay-Bold" : "Times-Bold";
  const regularFont = hasPlayfairDisplay
    ? "PlayfairDisplay-Regular"
    : "Times-Roman";

  const gregorianDate = formatDate(currentDate);

  // Tanggal dan tempat
  doc
    .fontSize(12)
    .font(regularFont)
    .text(`Makassar, ${gregorianDate} M`, pageWidth - margin - 150, doc.y, {
      width: 150,
      align: "center",
    });

  doc.text(`${hijriDate}`, pageWidth - margin - 150, doc.y + 15, {
    width: 150,
    align: "center",
  });

  doc.y += 35;

  // Salam dan jabatan
  doc.text("Hormat kami,", pageWidth - margin - 150, doc.y, {
    width: 150,
    align: "center",
  });

  doc.text("Pengurus Masjid Ulil Albab", pageWidth - margin - 150, doc.y + 15, {
    width: 150,
    align: "center",
  });

  doc.y += 50;

  // Nama dan tanda tangan
  doc
    .font(titleFont)
    .text("Zulfikar, S.Pd., M.Si", pageWidth - margin - 150, doc.y, {
      width: 150,
      align: "center",
      underline: true,
    });
}

// Fungsi untuk menambahkan ke controller
export const generateWeeklyReportPDF = async (reportData) => {
  return await generateFinanceReport(reportData, "weekly");
};

export const generateMonthlyReportPDF = async (reportData) => {
  return await generateFinanceReport(reportData, "monthly");
};

export const generateYearlyReportPDF = async (reportData) => {
  return await generateFinanceReport(reportData, "yearly");
};

export const generateCustomReportPDF = async (reportData) => {
  return await generateFinanceReport(reportData, "custom");
};

// Export helper functions untuk digunakan di tempat lain jika diperlukan
export {
  getSevenDaysAgoDate,
  getWeeklyRange,
  getLastMonthEndDate,
  getLastYearEndDate,
};
