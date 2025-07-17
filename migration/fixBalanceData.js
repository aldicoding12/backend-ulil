import mongoose from "mongoose";
import Balance from "../models/balanceModel.js";
import Income from "../models/incomesModel.js";
import Expense from "../models/expensesModel.js";
import {
  calculateActualBalance,
  validateBalanceConsistency,
  repairBalance,
} from "../services/balanceService.js";

/**
 * 🔧 SCRIPT MIGRASI UNTUK MEMPERBAIKI SISTEM KEUANGAN MASJID
 *
 * Jalankan script ini untuk:
 * 1. Memperbaiki saldo yang tidak akurat
 * 2. Validasi konsistensi data
 */

const runMigration = async () => {
  try {
    console.log("🚀 Memulai perbaikan data saldo...");

    // Step 1: Validasi data sebelum migrasi
    await validateCurrentData();

    // Step 2: Perbaiki saldo utama
    await fixMainBalance();

    // Step 3: Validasi hasil migrasi
    await validateMigrationResults();

    console.log("✅ Migrasi berhasil completed!");
  } catch (error) {
    console.error("❌ Migrasi gagal:", error);
  }
};

// ===== VALIDASI DATA SEBELUM MIGRASI =====
const validateCurrentData = async () => {
  console.log("🔍 Memvalidasi data sebelum migrasi...");

  // Hitung total dari semua transaksi
  const [totalIncomeResult, totalExpenseResult] = await Promise.all([
    Income.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);

  const totalIncome = totalIncomeResult[0]?.total || 0;
  const totalExpense = totalExpenseResult[0]?.total || 0;
  const calculatedBalance = totalIncome - totalExpense;

  const currentBalance = await Balance.findOne();
  const balanceInDB = currentBalance?.amount || 0;

  console.log("📊 Analisis data:");
  console.log(`   Total Pemasukan: Rp ${totalIncome.toLocaleString("id-ID")}`);
  console.log(
    `   Total Pengeluaran: Rp ${totalExpense.toLocaleString("id-ID")}`
  );
  console.log(
    `   Saldo Seharusnya: Rp ${calculatedBalance.toLocaleString("id-ID")}`
  );
  console.log(
    `   Saldo di Database: Rp ${balanceInDB.toLocaleString("id-ID")}`
  );
  console.log(
    `   Selisih: Rp ${Math.abs(calculatedBalance - balanceInDB).toLocaleString(
      "id-ID"
    )}`
  );

  if (calculatedBalance !== balanceInDB) {
    console.log("⚠️  Ditemukan inkonsistensi saldo!");
  } else {
    console.log("✅ Saldo sudah konsisten");
  }
};

// ===== PERBAIKI SALDO UTAMA =====
const fixMainBalance = async () => {
  console.log("🔧 Memperbaiki saldo utama...");

  const validation = await validateBalanceConsistency();

  if (!validation.isConsistent) {
    console.log(
      `⚠️  Inkonsistensi ditemukan. Selisih: Rp ${Math.abs(
        validation.difference
      ).toLocaleString("id-ID")}`
    );

    const correctedBalance = await repairBalance();
    console.log(
      `✅ Saldo diperbaiki ke: Rp ${correctedBalance.toLocaleString("id-ID")}`
    );
  } else {
    console.log("✅ Saldo sudah akurat, tidak perlu diperbaiki");
  }
};

// ===== VALIDASI HASIL MIGRASI =====
const validateMigrationResults = async () => {
  console.log("🔍 Memvalidasi hasil migrasi...");

  // Validasi saldo utama
  const validation = await validateBalanceConsistency();
  console.log("📊 Validasi saldo utama:");
  console.log(`   Konsisten: ${validation.isConsistent ? "✅" : "❌"}`);
  console.log(
    `   Saldo di DB: Rp ${validation.balanceInDB.toLocaleString("id-ID")}`
  );
  console.log(
    `   Saldo Aktual: Rp ${validation.actualBalance.toLocaleString("id-ID")}`
  );

  console.log("✅ Validasi selesai");
};

// Export untuk digunakan di file lain
export { runMigration };

// CARA PENGGUNAAN:
// 1. Pastikan environment variables sudah diset (MONGODB_URI)
// 2. Backup database Anda terlebih dahulu
// 3. Buat file terpisah untuk menjalankan migrasi atau panggil langsung
