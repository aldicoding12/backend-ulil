import { getTransactionsInRange } from "./transactionService.js";
import { getBalanceBeforeDate } from "./balanceService.js";
import {
  formatTransactions,
  generateReportData,
} from "../utils/formatUtils.js";
import {
  getWeekRange,
  getMonthRange,
  getDayRange,
} from "../utils/dateUtils.js";
import { debugLog } from "../utils/debugUtils.js";

export const generateWeeklyReportData = async (refDate) => {
  const { startDate, endDate } = getWeekRange(refDate);

  debugLog("Weekly Date Range", {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  const saldoAwal = await getBalanceBeforeDate(startDate);
  const { incomes, expenses } = await getTransactionsInRange(
    startDate,
    endDate
  );

  debugLog("Weekly Found Data", {
    incomesCount: incomes.length,
    expensesCount: expenses.length,
  });

  // Generate saldo harian
  let saldoHarian = saldoAwal;
  const weeklyBalance = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const { start: dayStart, end: dayEnd } = getDayRange(d);

    const incomeToday = incomes
      .filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= dayStart && itemDate <= dayEnd;
      })
      .reduce((acc, item) => acc + item.amount, 0);

    const expenseToday = expenses
      .filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= dayStart && itemDate <= dayEnd;
      })
      .reduce((acc, item) => acc + item.amount, 0);

    saldoHarian += incomeToday - expenseToday;

    weeklyBalance.push({
      date: dayStart.toISOString().split("T")[0],
      income: incomeToday,
      expense: expenseToday,
      balance: saldoHarian,
    });
  }

  const totalIncome = weeklyBalance.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = weeklyBalance.reduce((sum, d) => sum + d.expense, 0);
  const { formattedIncomes, formattedExpenses } = formatTransactions(
    incomes,
    expenses
  );

  return {
    range: { start: startDate.toISOString(), end: endDate.toISOString() },
    saldoAwal,
    totalIncome,
    totalExpense,
    saldoAkhir: saldoHarian,
    weeklyBalance,
    incomes: formattedIncomes,
    expenses: formattedExpenses,
  };
};

export const generateMonthlyReportData = async (refDate) => {
  const { startDate, endDate } = getMonthRange(refDate);

  const saldoAwal = await getBalanceBeforeDate(startDate);
  const { incomes, expenses } = await getTransactionsInRange(
    startDate,
    endDate
  );

  let saldoHarian = saldoAwal;
  const daysInMonth = new Date(
    refDate.getFullYear(),
    refDate.getMonth() + 1,
    0
  ).getDate();

  const monthlyBalance = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(
      refDate.getFullYear(),
      refDate.getMonth(),
      day
    );
    const { start: dayStart, end: dayEnd } = getDayRange(currentDate);

    const incomeToday = incomes
      .filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= dayStart && itemDate <= dayEnd;
      })
      .reduce((acc, item) => acc + item.amount, 0);

    const expenseToday = expenses
      .filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= dayStart && itemDate <= dayEnd;
      })
      .reduce((acc, item) => acc + item.amount, 0);

    saldoHarian += incomeToday - expenseToday;

    monthlyBalance.push({
      date: dayStart.toISOString().split("T")[0],
      income: incomeToday,
      expense: expenseToday,
      balance: saldoHarian,
    });
  }

  const totalIncome = monthlyBalance.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = monthlyBalance.reduce((sum, d) => sum + d.expense, 0);
  const { formattedIncomes, formattedExpenses } = formatTransactions(
    incomes,
    expenses
  );

  return {
    range: { start: startDate.toISOString(), end: endDate.toISOString() },
    saldoAwal,
    totalIncome,
    totalExpense,
    saldoAkhir: saldoHarian,
    monthlyBalance,
    incomes: formattedIncomes,
    expenses: formattedExpenses,
  };
};

export const generateYearlyReportData = async (startDate, endDate) => {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  const saldoAwal = await getBalanceBeforeDate(new Date(startYear, 0, 1));
  const { incomes, expenses } = await getTransactionsInRange(
    startDate,
    endDate
  );

  let saldoTiapTahun = saldoAwal;
  const yearlyBalance = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const incomeThisYear = incomes
      .filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= yearStart && itemDate <= yearEnd;
      })
      .reduce((acc, item) => acc + item.amount, 0);

    const expenseThisYear = expenses
      .filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= yearStart && itemDate <= yearEnd;
      })
      .reduce((acc, item) => acc + item.amount, 0);

    saldoTiapTahun += incomeThisYear - expenseThisYear;

    yearlyBalance.push({
      year,
      income: incomeThisYear,
      expense: expenseThisYear,
      balance: saldoTiapTahun,
    });
  }

  const totalIncome = yearlyBalance.reduce((sum, y) => sum + y.income, 0);
  const totalExpense = yearlyBalance.reduce((sum, y) => sum + y.expense, 0);
  const { formattedIncomes, formattedExpenses } = formatTransactions(
    incomes,
    expenses
  );

  return {
    range: { start: startDate.toISOString(), end: endDate.toISOString() },
    saldoAwal,
    totalIncome,
    totalExpense,
    saldoAkhir: saldoTiapTahun,
    yearlyBalance,
    incomes: formattedIncomes,
    expenses: formattedExpenses,
  };
};
