// services/balanceService.js - Enhanced untuk Real-time Updates
import Balance from "../models/balanceModel.js";
import Income from "../models/incomesModel.js";
import Expense from "../models/expensesModel.js";
import PeriodBalance from "../models/periodBalanceModel.js";

// ===== CACHE INVALIDATION SYSTEM =====

/**
 * Invalidate semua cache yang terpengaruh oleh perubahan transaksi
 */
export const invalidateCache = async (
  transactionDate,
  transactionType = "all"
) => {
  try {
    console.log(
      `🗑️ Invalidating cache for transactions after: ${transactionDate}`
    );

    const changeDate = new Date(transactionDate);

    // Hapus semua period balance yang bisa terpengaruh
    const deleteResult = await PeriodBalance.deleteMany({
      $or: [
        { startDate: { $gte: changeDate } }, // Periode yang dimulai setelah perubahan
        { endDate: { $gte: changeDate } }, // Periode yang berakhir setelah perubahan
        {
          startDate: { $lte: changeDate },
          endDate: { $gte: changeDate },
        }, // Periode yang mengandung tanggal perubahan
      ],
    });

    console.log(`✅ Invalidated ${deleteResult.deletedCount} cached periods`);

    // Force recalculate current balance
    await calculateActualBalance();

    return {
      success: true,
      invalidatedCount: deleteResult.deletedCount,
      message: "Cache invalidated successfully",
    };
  } catch (error) {
    console.error("❌ Error invalidating cache:", error);
    throw error;
  }
};

/**
 * Smart cache invalidation - hanya hapus yang benar-benar terpengaruh
 */
export const smartInvalidateCache = async (
  oldTransaction,
  newTransaction = null
) => {
  try {
    const datesToInvalidate = [];

    if (oldTransaction) {
      datesToInvalidate.push(new Date(oldTransaction.date));
    }

    if (newTransaction && newTransaction.date !== oldTransaction?.date) {
      datesToInvalidate.push(new Date(newTransaction.date));
    }

    for (const date of datesToInvalidate) {
      await invalidateCache(date);
    }

    return { success: true, message: "Smart cache invalidation completed" };
  } catch (error) {
    console.error("❌ Error in smart cache invalidation:", error);
    throw error;
  }
};

// ===== ENHANCED BALANCE CALCULATION =====

/**
 * Menghitung saldo secara akurat berdasarkan semua transaksi
 * Selalu real-time, tidak bergantung pada cache
 */
export const calculateActualBalance = async () => {
  console.log("🧮 Calculating actual balance from all transactions...");

  const [totalIncome, totalExpense] = await Promise.all([
    Income.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);

  const actualBalance =
    (totalIncome[0]?.total || 0) - (totalExpense[0]?.total || 0);

  console.log(`💰 Calculated balance: ${actualBalance}`);
  console.log(`   - Total Income: ${totalIncome[0]?.total || 0}`);
  console.log(`   - Total Expense: ${totalExpense[0]?.total || 0}`);

  // Update balance record
  await updateBalanceRecord(actualBalance);

  return actualBalance;
};

/**
 * Enhanced: Menghitung saldo pada tanggal tertentu dengan caching pintar
 */
export const getBalanceBeforeDate = async (date, useCache = true) => {
  const cacheKey = `balance_before_${date.toISOString().split("T")[0]}`;

  // Check cache first if enabled
  if (useCache) {
    const cached = await getCachedBalance(cacheKey);
    if (cached !== null) {
      console.log(`📋 Using cached balance before ${date}: ${cached}`);
      return cached;
    }
  }

  console.log(`🧮 Calculating balance before ${date}...`);

  const [incomesBefore, expensesBefore] = await Promise.all([
    Income.aggregate([
      { $match: { date: { $lt: date } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Expense.aggregate([
      { $match: { date: { $lt: date } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const balance =
    (incomesBefore[0]?.total || 0) - (expensesBefore[0]?.total || 0);

  // Cache the result
  if (useCache) {
    await setCachedBalance(cacheKey, balance);
  }

  return balance;
};

/**
 * Enhanced: Menghitung saldo periode dengan real-time option
 */
export const getBalanceInPeriod = async (
  startDate,
  endDate,
  forceRecalculate = false
) => {
  console.log(`📊 Getting balance for period: ${startDate} to ${endDate}`);
  console.log(`🔄 Force recalculate: ${forceRecalculate}`);

  const balanceBefore = await getBalanceBeforeDate(
    startDate,
    !forceRecalculate
  );

  const [incomeInPeriod, expenseInPeriod] = await Promise.all([
    Income.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const incomeTotal = incomeInPeriod[0]?.total || 0;
  const expenseTotal = expenseInPeriod[0]?.total || 0;
  const balanceEnd = balanceBefore + incomeTotal - expenseTotal;

  const result = {
    balanceStart: balanceBefore,
    totalIncome: incomeTotal,
    totalExpense: expenseTotal,
    balanceEnd: balanceEnd,
    netChange: incomeTotal - expenseTotal,
    calculatedAt: new Date(),
    isRealTime: forceRecalculate,
  };

  console.log("📊 Period balance calculated:", result);

  return result;
};

// ===== CACHE MANAGEMENT HELPERS =====

const balanceCache = new Map();

const getCachedBalance = async (key) => {
  // In production, you might want to use Redis
  return balanceCache.get(key) || null;
};

const setCachedBalance = async (key, value) => {
  // In production, you might want to use Redis with TTL
  balanceCache.set(key, value);

  // Auto-expire cache after 1 hour
  setTimeout(() => {
    balanceCache.delete(key);
  }, 60 * 60 * 1000);
};

const clearBalanceCache = () => {
  balanceCache.clear();
  console.log("🗑️ Balance cache cleared");
};

// ===== ENHANCED PERIOD BALANCE MANAGEMENT =====

/**
 * Enhanced: Save period balance dengan metadata tambahan
 */
export const savePeriodBalance = async (
  periodType,
  startDate,
  endDate,
  year,
  month = null,
  week = null,
  forceRecalculate = false
) => {
  const balanceData = await getBalanceInPeriod(
    startDate,
    endDate,
    forceRecalculate
  );

  const periodBalance = await PeriodBalance.findOneAndUpdate(
    {
      periodType,
      year,
      month,
      week,
      startDate,
      endDate,
    },
    {
      ...balanceData,
      lastCalculatedAt: new Date(),
      isRealTime: forceRecalculate,
      updatedAt: new Date(),
    },
    {
      upsert: true,
      new: true,
    }
  );

  console.log(`💾 Saved ${periodType} period balance:`, {
    period: `${startDate.toISOString().split("T")[0]} to ${
      endDate.toISOString().split("T")[0]
    }`,
    balanceEnd: balanceData.balanceEnd,
    isRealTime: forceRecalculate,
  });

  return periodBalance;
};

/**
 * Enhanced: Get period balance dengan freshness check
 */
export const getPeriodBalance = async (
  periodType,
  year,
  month = null,
  week = null,
  maxAge = 3600000 // 1 hour default
) => {
  const cached = await PeriodBalance.findOne({
    periodType,
    year,
    month,
    week,
  });

  if (!cached) {
    console.log(`📋 No cached ${periodType} period balance found`);
    return null;
  }

  const age = new Date() - new Date(cached.updatedAt);
  if (age > maxAge) {
    console.log(
      `⏰ Cached ${periodType} period balance is stale (${Math.round(
        age / 1000
      )}s old)`
    );
    return null;
  }

  console.log(`📋 Using fresh cached ${periodType} period balance`);
  return cached;
};

// ===== REAL-TIME SYNC FUNCTIONS =====

/**
 * Enhanced sync - với invalidation otomatis
 */
export const syncBalance = async (invalidateRelatedCache = true) => {
  console.log("🔄 Starting enhanced balance sync...");

  if (invalidateRelatedCache) {
    clearBalanceCache();
    console.log("🗑️ Cleared balance cache for fresh calculation");
  }

  const actualBalance = await calculateActualBalance();

  console.log(`✅ Balance synced successfully: ${actualBalance}`);
  return actualBalance;
};

/**
 * Sync balance setelah transaksi CRUD dengan cache invalidation
 */
export const syncBalanceAfterTransaction = async (
  transactionData,
  operation = "create"
) => {
  console.log(`🔄 Syncing balance after ${operation} transaction...`);

  try {
    // Invalidate affected caches
    if (transactionData.date) {
      await invalidateCache(transactionData.date);
    }

    // Recalculate actual balance
    const newBalance = await calculateActualBalance();

    console.log(`✅ Balance synced after ${operation}: ${newBalance}`);

    return {
      success: true,
      balance: newBalance,
      operation,
      message: `Balance updated after ${operation}`,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error(`❌ Error syncing balance after ${operation}:`, error);
    throw error;
  }
};

// ===== UTILITY FUNCTIONS =====

const updateBalanceRecord = async (amount) => {
  let balance = await Balance.findOne();
  if (!balance) {
    balance = new Balance({ amount });
  } else {
    balance.amount = amount;
    balance.updatedAt = new Date();
  }
  await balance.save();
  return balance;
};

/**
 * Mendapatkan saldo saat ini (selalu akurat)
 */
export const getCurrentBalance = async () => {
  return await calculateActualBalance();
};

/**
 * Enhanced validation dengan detail
 */
export const validateBalanceConsistency = async () => {
  const balanceInDB = await Balance.findOne();
  const actualBalance = await calculateActualBalance();

  const isConsistent =
    Math.abs((balanceInDB?.amount || 0) - actualBalance) < 0.01; // Allow for floating point errors

  return {
    isConsistent,
    balanceInDB: balanceInDB?.amount || 0,
    actualBalance,
    difference: (balanceInDB?.amount || 0) - actualBalance,
    lastUpdated: balanceInDB?.updatedAt,
    needsSync: !isConsistent,
  };
};

/**
 * Repair balance dengan full cache clear
 */
export const repairBalance = async () => {
  console.log("🔧 Starting balance repair...");

  // Clear all caches
  clearBalanceCache();
  await PeriodBalance.deleteMany({});

  // Recalculate everything
  const actualBalance = await calculateActualBalance();

  console.log(`✅ Balance repaired to: ${actualBalance}`);
  return actualBalance;
};

// ===== BATCH OPERATIONS =====

/**
 * Bulk invalidate untuk multiple transactions
 */
export const bulkInvalidateCache = async (transactionDates) => {
  console.log(
    `🗑️ Bulk invalidating cache for ${transactionDates.length} dates`
  );

  const uniqueDates = [
    ...new Set(transactionDates.map((d) => d.toISOString().split("T")[0])),
  ];

  for (const dateStr of uniqueDates) {
    await invalidateCache(new Date(dateStr));
  }

  console.log(
    `✅ Bulk invalidation completed for ${uniqueDates.length} unique dates`
  );
};

/**
 * Health check untuk balance system
 */
export const healthCheck = async () => {
  try {
    const consistency = await validateBalanceConsistency();
    const totalTransactions = await Promise.all([
      Income.countDocuments(),
      Expense.countDocuments(),
    ]);

    const cachedPeriods = await PeriodBalance.countDocuments();

    return {
      status: consistency.isConsistent ? "healthy" : "needs_repair",
      consistency,
      totalIncomes: totalTransactions[0],
      totalExpenses: totalTransactions[1],
      cachedPeriods,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      status: "error",
      error: error.message,
      timestamp: new Date(),
    };
  }
};
