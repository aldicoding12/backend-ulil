export const formatTransactions = (incomes, expenses) => {
  const formattedIncomes = incomes.map((item) => ({
    _id: item._id,
    name: item.name,
    amount: item.amount,
    method: item.method,
    note: item.note,
    date: item.date,
    type: "income",
  }));

  const formattedExpenses = expenses.map((item) => ({
    _id: item._id,
    name: item.name,
    amount: item.amount,
    method: item.method,
    note: item.note,
    date: item.date,
    type: "expense",
  }));

  return { formattedIncomes, formattedExpenses };
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(amount);
};

export const formatDateToString = (date) => {
  return date.toISOString().split("T")[0];
};

export const generateReportData = (incomes, expenses, saldoAwal, range) => {
  const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);
  const totalExpense = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );
  const saldoAkhir = saldoAwal + totalIncome - totalExpense;

  const { formattedIncomes, formattedExpenses } = formatTransactions(
    incomes,
    expenses
  );

  return {
    range,
    saldoAwal,
    totalIncome,
    totalExpense,
    saldoAkhir,
    incomes: formattedIncomes,
    expenses: formattedExpenses,
  };
};
