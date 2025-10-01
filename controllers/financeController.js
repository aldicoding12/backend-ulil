// controllers/financeController.js - Enhanced untuk Real-time Updates

import asyncHandler from "../middlewares/asyncHandler.js";
import { validateDate } from "../utils/dateUtils.js";
import { debugLog, logError } from "../utils/debugUtils.js";
import {
  syncBalance,
  getCurrentBalance,
  syncBalanceAfterTransaction,
  smartInvalidateCache,
  invalidateCache,
} from "../services/balanceService.js";
import {
  createIncome,
  createExpense,
  updateIncome,
  updateExpense,
  deleteIncome,
  deleteExpense,
  getIncomeById,
  getExpenseById,
} from "../services/transactionService.js";
import {
  generateWeeklyReportData,
  generateMonthlyReportData,
  generateYearlyReportData,
} from "../services/reportService.js";
import { handlePDFResponse, generatePDFFilename } from "../utils/pdfUtils.js";
import {
  generateWeeklyReportPDF,
  generateMonthlyReportPDF,
  generateYearlyReportPDF,
} from "../utils/pdfGenerator.js";

// ===== ENHANCED TRANSACTION CONTROLLERS =====

// ✅ CREATE INCOME - Enhanced dengan real-time sync
export const addIncome = asyncHandler(async (req, res) => {
  try {
    const newIncome = await createIncome(req.body);

    // Enhanced: Sync balance dengan invalidation cache
    const syncResult = await syncBalanceAfterTransaction(newIncome, "create");

    // Broadcast real-time update (jika menggunakan WebSocket)
    // broadcastFinanceUpdate('income_created', newIncome, syncResult.balance);

    res.status(201).json({
      message:
        "Pemasukan berhasil ditambahkan dan sistem diperbarui secara real-time",
      data: newIncome,
      currentBalance: syncResult.balance,
      syncInfo: {
        operation: syncResult.operation,
        timestamp: syncResult.timestamp,
      },
    });
  } catch (error) {
    logError("Add Income", error);
    res.status(400).json({
      message: error.message,
      context: "Failed to add income",
    });
  }
});

// ✅ CREATE EXPENSE - Enhanced dengan real-time sync
export const addExpense = asyncHandler(async (req, res) => {
  try {
    const newExpense = await createExpense(req.body);

    // Enhanced: Sync balance dengan invalidation cache
    const syncResult = await syncBalanceAfterTransaction(newExpense, "create");

    // Broadcast real-time update (jika menggunakan WebSocket)
    // broadcastFinanceUpdate('expense_created', newExpense, syncResult.balance);

    res.status(201).json({
      message:
        "Pengeluaran berhasil ditambahkan dan sistem diperbarui secara real-time",
      data: newExpense,
      currentBalance: syncResult.balance,
      syncInfo: {
        operation: syncResult.operation,
        timestamp: syncResult.timestamp,
      },
    });
  } catch (error) {
    logError("Add Expense", error);
    res.status(400).json({
      message: error.message,
      context: "Failed to add expense",
    });
  }
});

// ✅ UPDATE INCOME - Enhanced dengan smart cache invalidation
export const editIncome = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Get original data untuk smart invalidation
    const originalIncome = await getIncomeById(id);
    if (!originalIncome) {
      return res.status(404).json({ message: "Pemasukan tidak ditemukan" });
    }

    const updatedIncome = await updateIncome(id, req.body);

    // Smart cache invalidation - hanya invalidate yang terpengaruh
    await smartInvalidateCache(originalIncome, updatedIncome);

    // Sync balance setelah update
    const syncResult = await syncBalanceAfterTransaction(
      updatedIncome,
      "update"
    );

    // Broadcast real-time update
    // broadcastFinanceUpdate('income_updated', { original: originalIncome, updated: updatedIncome }, syncResult.balance);

    res.status(200).json({
      message:
        "Pemasukan berhasil diperbarui dan sistem disinkronisasi secara real-time",
      data: updatedIncome,
      currentBalance: syncResult.balance,
      syncInfo: {
        operation: syncResult.operation,
        affectedDates: [originalIncome.date, updatedIncome.date].filter(
          (v, i, a) => a.indexOf(v) === i
        ),
        timestamp: syncResult.timestamp,
      },
    });
  } catch (error) {
    logError("Update Income", error);
    res.status(400).json({
      message: error.message,
      context: "Failed to update income",
    });
  }
});

// ✅ UPDATE EXPENSE - Enhanced dengan smart cache invalidation
export const editExpense = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Get original data untuk smart invalidation
    const originalExpense = await getExpenseById(id);
    if (!originalExpense) {
      return res.status(404).json({ message: "Pengeluaran tidak ditemukan" });
    }

    const updatedExpense = await updateExpense(id, req.body);

    // Smart cache invalidation
    await smartInvalidateCache(originalExpense, updatedExpense);

    // Sync balance setelah update
    const syncResult = await syncBalanceAfterTransaction(
      updatedExpense,
      "update"
    );

    // Broadcast real-time update
    // broadcastFinanceUpdate('expense_updated', { original: originalExpense, updated: updatedExpense }, syncResult.balance);

    res.status(200).json({
      message:
        "Pengeluaran berhasil diperbarui dan sistem disinkronisasi secara real-time",
      data: updatedExpense,
      currentBalance: syncResult.balance,
      syncInfo: {
        operation: syncResult.operation,
        affectedDates: [originalExpense.date, updatedExpense.date].filter(
          (v, i, a) => a.indexOf(v) === i
        ),
        timestamp: syncResult.timestamp,
      },
    });
  } catch (error) {
    logError("Update Expense", error);
    res.status(400).json({
      message: error.message,
      context: "Failed to update expense",
    });
  }
});

// ✅ DELETE INCOME - Enhanced dengan cache invalidation
export const removeIncome = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Get data sebelum dihapus untuk invalidation
    const incomeToDelete = await getIncomeById(id);
    if (!incomeToDelete) {
      return res.status(404).json({ message: "Pemasukan tidak ditemukan" });
    }

    // Delete the income
    await deleteIncome(id);

    // Invalidate cache yang terpengaruh
    await invalidateCache(incomeToDelete.date);

    // Sync balance setelah penghapusan
    const syncResult = await syncBalanceAfterTransaction(
      incomeToDelete,
      "delete"
    );

    // Broadcast real-time update
    // broadcastFinanceUpdate('income_deleted', incomeToDelete, syncResult.balance);

    res.status(200).json({
      message:
        "Pemasukan berhasil dihapus dan sistem disinkronisasi secara real-time",
      deletedData: incomeToDelete,
      currentBalance: syncResult.balance,
      syncInfo: {
        operation: syncResult.operation,
        affectedDate: incomeToDelete.date,
        timestamp: syncResult.timestamp,
      },
    });
  } catch (error) {
    logError("Delete Income", error);
    res.status(400).json({
      message: error.message,
      context: "Failed to delete income",
    });
  }
});

// ✅ DELETE EXPENSE - Enhanced dengan cache invalidation
export const removeExpense = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Get data sebelum dihapus untuk invalidation
    const expenseToDelete = await getExpenseById(id);
    if (!expenseToDelete) {
      return res.status(404).json({ message: "Pengeluaran tidak ditemukan" });
    }

    // Delete the expense
    await deleteExpense(id);

    // Invalidate cache yang terpengaruh
    await invalidateCache(expenseToDelete.date);

    // Sync balance setelah penghapusan
    const syncResult = await syncBalanceAfterTransaction(
      expenseToDelete,
      "delete"
    );

    // Broadcast real-time update
    // broadcastFinanceUpdate('expense_deleted', expenseToDelete, syncResult.balance);

    res.status(200).json({
      message:
        "Pengeluaran berhasil dihapus dan sistem disinkronisasi secara real-time",
      deletedData: expenseToDelete,
      currentBalance: syncResult.balance,
      syncInfo: {
        operation: syncResult.operation,
        affectedDate: expenseToDelete.date,
        timestamp: syncResult.timestamp,
      },
    });
  } catch (error) {
    logError("Delete Expense", error);
    res.status(400).json({
      message: error.message,
      context: "Failed to delete expense",
    });
  }
});

// ===== ENHANCED BALANCE ENDPOINTS =====

// 🆕 GET CURRENT BALANCE - Enhanced dengan metadata
export const getBalance = asyncHandler(async (req, res) => {
  try {
    const currentBalance = await getCurrentBalance();

    res.status(200).json({
      message: "Saldo berhasil diambil",
      balance: currentBalance,
      formatted: new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(currentBalance),
      timestamp: new Date(),
      isRealTime: true,
    });
  } catch (error) {
    logError("Get Balance", error);
    res.status(500).json({
      message: "Gagal mengambil saldo",
      error: error.message,
    });
  }
});

// 🆕 SYNC BALANCE MANUALLY - Enhanced dengan opsi
export const syncBalanceManually = asyncHandler(async (req, res) => {
  try {
    const { clearCache = true } = req.body;

    const syncedBalance = await syncBalance(clearCache);

    res.status(200).json({
      message: "Sinkronisasi saldo berhasil dilakukan",
      balance: syncedBalance,
      formatted: new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(syncedBalance),
      timestamp: new Date(),
      cacheCleared: clearCache,
    });
  } catch (error) {
    logError("Manual Sync Balance", error);
    res.status(500).json({
      message: "Gagal melakukan sinkronisasi saldo",
      error: error.message,
    });
  }
});

// ===== ENHANCED REPORT CONTROLLERS =====

export const weeklyReport = asyncHandler(async (req, res) => {
  const { date, forceRefresh = false } = req.query;
  const refDate = validateDate(date) || new Date();

  if (!refDate) {
    return res.status(400).json({ message: "Format tanggal tidak valid" });
  }

  refDate.setHours(0, 0, 0, 0);

  try {
    const reportData = await generateWeeklyReportData(
      refDate,
      forceRefresh === "true"
    );

    res.status(200).json({
      message: `Laporan mingguan yang mengandung tanggal ${
        refDate.toISOString().split("T")[0]
      } berhasil diambil`,
      data: reportData,
      meta: {
        isRealTime: forceRefresh === "true",
        generatedAt: new Date(),
        period: "weekly",
      },
    });
  } catch (error) {
    logError("Weekly Report", error);
    res.status(500).json({
      message: "Gagal mengambil laporan mingguan",
      error: error.message,
    });
  }
});

export const monthlyReport = asyncHandler(async (req, res) => {
  const { date, forceRefresh = false } = req.query;
  const refDate = validateDate(date) || new Date();

  if (!refDate) {
    return res.status(400).json({ message: "Format tanggal tidak valid" });
  }

  try {
    const reportData = await generateMonthlyReportData(
      refDate,
      forceRefresh === "true"
    );

    res.status(200).json({
      message: `Laporan bulanan yang mengandung tanggal ${
        refDate.toISOString().split("T")[0]
      } berhasil diambil`,
      data: reportData,
      meta: {
        isRealTime: forceRefresh === "true",
        generatedAt: new Date(),
        period: "monthly",
      },
    });
  } catch (error) {
    logError("Monthly Report", error);
    res.status(500).json({
      message: "Gagal mengambil laporan bulanan",
      error: error.message,
    });
  }
});

export const yearlyReport = asyncHandler(async (req, res) => {
  const { start, end, forceRefresh = false } = req.query;

  const startDate =
    validateDate(start) || new Date(new Date().getFullYear(), 0, 1);
  const endDate =
    validateDate(end) ||
    new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);

  if (!startDate || !endDate) {
    return res.status(400).json({ message: "Format tanggal tidak valid" });
  }

  try {
    const reportData = await generateYearlyReportData(
      startDate,
      endDate,
      forceRefresh === "true"
    );

    res.status(200).json({
      message: "Laporan multi-tahun berhasil diambil",
      data: reportData,
      meta: {
        isRealTime: forceRefresh === "true",
        generatedAt: new Date(),
        period: "yearly",
      },
    });
  } catch (error) {
    logError("Yearly Report", error);
    res.status(500).json({
      message: "Gagal mengambil laporan tahunan",
      error: error.message,
    });
  }
});

// ===== NEW REAL-TIME ENDPOINTS =====

// 🆕 GET REAL-TIME REPORT (Force fresh calculation)
export const getRealTimeReport = asyncHandler(async (req, res) => {
  const { type, date, start, end } = req.query;

  try {
    let reportData;
    let refDate;

    switch (type) {
      case "weekly":
        refDate = validateDate(date) || new Date();
        refDate.setHours(0, 0, 0, 0);
        reportData = await generateWeeklyReportData(refDate, true); // Force refresh
        break;

      case "monthly":
        refDate = validateDate(date) || new Date();
        reportData = await generateMonthlyReportData(refDate, true); // Force refresh
        break;

      case "yearly":
        const startDate =
          validateDate(start) || new Date(new Date().getFullYear(), 0, 1);
        const endDate =
          validateDate(end) ||
          new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);
        reportData = await generateYearlyReportData(startDate, endDate, true); // Force refresh
        break;

      default:
        return res.status(400).json({ message: "Tipe laporan tidak valid" });
    }

    res.status(200).json({
      message: `Laporan real-time ${type} berhasil diambil`,
      data: reportData,
      meta: {
        isRealTime: true,
        generatedAt: new Date(),
        period: type,
        forcedRefresh: true,
      },
    });
  } catch (error) {
    logError("Real-time Report", error);
    res.status(500).json({
      message: "Gagal mengambil laporan real-time",
      error: error.message,
    });
  }
});

// 🆕 HEALTH CHECK ENDPOINT
export const healthCheck = asyncHandler(async (req, res) => {
  try {
    const { healthCheck } = await import("../services/balanceService.js");
    const health = await healthCheck();

    res.status(health.status === "healthy" ? 200 : 500).json({
      message: "Health check completed",
      ...health,
    });
  } catch (error) {
    logError("Health Check", error);
    res.status(500).json({
      status: "error",
      message: "Health check failed",
      error: error.message,
      timestamp: new Date(),
    });
  }
});

// 🆕 CACHE MANAGEMENT ENDPOINTS
export const clearCache = asyncHandler(async (req, res) => {
  try {
    const { type = "all", date } = req.body;

    if (type === "all") {
      const { repairBalance } = await import("../services/balanceService.js");
      const newBalance = await repairBalance();

      res.status(200).json({
        message: "Semua cache berhasil dibersihkan dan saldo diperbaiki",
        balance: newBalance,
        timestamp: new Date(),
      });
    } else if (type === "date" && date) {
      const { invalidateCache } = await import("../services/balanceService.js");
      await invalidateCache(new Date(date));

      res.status(200).json({
        message: `Cache untuk tanggal ${date} berhasil dibersihkan`,
        timestamp: new Date(),
      });
    } else {
      res.status(400).json({ message: "Parameter tidak valid" });
    }
  } catch (error) {
    logError("Clear Cache", error);
    res.status(500).json({
      message: "Gagal membersihkan cache",
      error: error.message,
    });
  }
});

// ===== PDF CONTROLLERS (Enhanced) =====

export const weeklyReportPDF = asyncHandler(async (req, res) => {
  const { date, forceRefresh = false } = req.query;
  const refDate = validateDate(date) || new Date();

  if (!refDate) {
    return res.status(400).json({ message: "Format tanggal tidak valid" });
  }

  refDate.setHours(0, 0, 0, 0);

  try {
    const reportData = await generateWeeklyReportData(
      refDate,
      forceRefresh === "true"
    );
    const pdfBuffer = await generateWeeklyReportPDF(reportData);
    const filename = generatePDFFilename("weekly", refDate);

    handlePDFResponse(res, pdfBuffer, filename);
  } catch (error) {
    logError("Weekly PDF", error);
    res.status(500).json({
      message: "Gagal membuat PDF laporan mingguan",
      error: error.message,
    });
  }
});

export const monthlyReportPDF = asyncHandler(async (req, res) => {
  const { date, forceRefresh = false } = req.query;
  const refDate = validateDate(date) || new Date();

  if (!refDate) {
    return res.status(400).json({ message: "Format tanggal tidak valid" });
  }

  try {
    const reportData = await generateMonthlyReportData(
      refDate,
      forceRefresh === "true"
    );
    const pdfBuffer = await generateMonthlyReportPDF(reportData);
    const filename = generatePDFFilename("monthly", refDate);

    handlePDFResponse(res, pdfBuffer, filename);
  } catch (error) {
    logError("Monthly PDF", error);
    res.status(500).json({
      message: "Gagal membuat PDF laporan bulanan",
      error: error.message,
    });
  }
});

export const yearlyReportPDF = asyncHandler(async (req, res) => {
  const { start, end, forceRefresh = false } = req.query;

  const startDate =
    validateDate(start) || new Date(new Date().getFullYear(), 0, 1);
  const endDate =
    validateDate(end) ||
    new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);

  if (!startDate || !endDate) {
    return res.status(400).json({ message: "Format tanggal tidak valid" });
  }

  try {
    const reportData = await generateYearlyReportData(
      startDate,
      endDate,
      forceRefresh === "true"
    );
    const pdfBuffer = await generateYearlyReportPDF(reportData);
    const filename = generatePDFFilename(
      "yearly",
      null,
      startDate.getFullYear(),
      endDate.getFullYear()
    );

    handlePDFResponse(res, pdfBuffer, filename);
  } catch (error) {
    logError("Yearly PDF", error);
    res.status(500).json({
      message: "Gagal membuat PDF laporan tahunan",
      error: error.message,
    });
  }
});

// ===== WEBSOCKET SUPPORT (Optional) =====

// Fungsi untuk broadcast real-time updates (jika menggunakan WebSocket)
const broadcastFinanceUpdate = (eventType, data, currentBalance) => {
  // Implementasi WebSocket broadcast di sini

  // Contoh struktur event:
  const event = {
    type: eventType,
    data,
    currentBalance,
    timestamp: new Date(),
  };

  // ws.broadcast(event); // Uncomment jika menggunakan WebSocket
};
