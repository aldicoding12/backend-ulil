import express from "express";
import {
  addIncome,
  editIncome,
  removeIncome,
  addExpense,
  editExpense,
  removeExpense,
  weeklyReport,
  monthlyReport,
  yearlyReport,
  weeklyReportPDF,
  monthlyReportPDF,
  yearlyReportPDF,
  // 🆕 TAMBAHAN BARU - Import fungsi balance
  getBalance,
  syncBalanceManually,
} from "../controllers/financeController.js"; // pakai .js
import { pengurus, jamaah } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Router untuk pemasukan
router.post("/incomes/create", addIncome);
router.put("/incomes/:id", editIncome);
router.delete("/incomes/:id", removeIncome);

// router untuk pengeluaran
router.post("/expenses/create", addExpense);
router.put("/expenses/:id", editExpense);
router.delete("/expenses/:id", removeExpense);

// 🆕 TAMBAHAN BARU - Routes untuk balance
router.get("/balance", getBalance);
router.post("/balance/sync", syncBalanceManually);

// catatan laporan mingguan
router.get("/report/weekly-auto", weeklyReport);
// catatan laporan bulanan
router.get("/report/monthly-auto", monthlyReport);
// catatan laporan mingguan
router.get("/report/yearly-auto", yearlyReport);

// Routes baru untuk PDF
router.get("/report/weekly/pdf", weeklyReportPDF);
router.get("/report/monthly/pdf", monthlyReportPDF);
router.get("/report/yearly/pdf", yearlyReportPDF);

export default router;
