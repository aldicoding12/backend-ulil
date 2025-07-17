import Income from "../models/incomesModel.js";
import Expense from "../models/expensesModel.js";

// ===== EXISTING FUNCTIONS =====

export const getTransactionsInRange = async (startDate, endDate) => {
  const [incomes, expenses] = await Promise.all([
    Income.find({
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 }),
    Expense.find({
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 }),
  ]);

  return { incomes, expenses };
};

export const createIncome = async (incomeData) => {
  const { name, amount, method, note, date } = incomeData;

  if (!name || !amount || amount <= 0) {
    throw new Error("Nama dan jumlah harus diisi dan valid");
  }

  return await Income.create({
    name,
    amount,
    method,
    note,
    date,
  });
};

export const createExpense = async (expenseData) => {
  const { name, amount, method, note, date } = expenseData;

  if (!name || !amount || amount <= 0) {
    throw new Error("Nama dan jumlah harus diisi dan valid");
  }

  return await Expense.create({
    name,
    amount,
    method,
    note,
    date,
  });
};

export const getTransactionsByDateRange = async (
  startDate,
  endDate,
  type = "all"
) => {
  const queries = [];

  if (type === "income" || type === "all") {
    queries.push(
      Income.find({ date: { $gte: startDate, $lte: endDate } }).sort({
        date: 1,
      })
    );
  }

  if (type === "expense" || type === "all") {
    queries.push(
      Expense.find({ date: { $gte: startDate, $lte: endDate } }).sort({
        date: 1,
      })
    );
  }

  const results = await Promise.all(queries);

  if (type === "income") return { incomes: results[0], expenses: [] };
  if (type === "expense") return { incomes: [], expenses: results[0] };
  return { incomes: results[0], expenses: results[1] };
};

// ===== NEW FUNCTIONS FOR CRUD OPERATIONS =====

// 🔍 GET BY ID FUNCTIONS
export const getIncomeById = async (id) => {
  const income = await Income.findById(id);
  if (!income) {
    throw new Error("Pemasukan tidak ditemukan");
  }
  return income;
};

export const getExpenseById = async (id) => {
  const expense = await Expense.findById(id);
  if (!expense) {
    throw new Error("Pengeluaran tidak ditemukan");
  }
  return expense;
};

// ✏️ UPDATE FUNCTIONS
export const updateIncome = async (id, incomeData) => {
  const { name, amount, method, note, date } = incomeData;

  // Validation
  if (!name || !amount || amount <= 0) {
    throw new Error("Nama dan jumlah harus diisi dan valid");
  }

  const updatedIncome = await Income.findByIdAndUpdate(
    id,
    {
      name,
      amount,
      method,
      note,
      date,
      updatedAt: new Date(),
    },
    {
      new: true, // Return updated document
      runValidators: true, // Run mongoose validations
    }
  );

  if (!updatedIncome) {
    throw new Error("Pemasukan tidak ditemukan");
  }

  return updatedIncome;
};

export const updateExpense = async (id, expenseData) => {
  const { name, amount, method, note, date } = expenseData;

  const updatedExpense = await Expense.findByIdAndUpdate(
    id,
    {
      name,
      amount,
      method,
      note,
      date,
      updatedAt: new Date(),
    },
    {
      new: true, // Return updated document
      runValidators: true, // Run mongoose validations
    }
  );

  if (!updatedExpense) {
    throw new Error("Pengeluaran tidak ditemukan");
  }

  return updatedExpense;
};

// 🗑️ DELETE FUNCTIONS
export const deleteIncome = async (id) => {
  const deletedIncome = await Income.findByIdAndDelete(id);

  if (!deletedIncome) {
    throw new Error("Pemasukan tidak ditemukan");
  }

  return deletedIncome;
};

export const deleteExpense = async (id) => {
  const deletedExpense = await Expense.findByIdAndDelete(id);

  if (!deletedExpense) {
    throw new Error("Pengeluaran tidak ditemukan");
  }

  return deletedExpense;
};

// 📊 GET ALL FUNCTIONS (Optional - for listing all data)
export const getAllIncomes = async (options = {}) => {
  const { limit = 100, skip = 0, sortBy = "date", sortOrder = -1 } = options;

  return await Income.find()
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .skip(skip);
};

export const getAllExpenses = async (options = {}) => {
  const { limit = 100, skip = 0, sortBy = "date", sortOrder = -1 } = options;

  return await Expense.find()
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .skip(skip);
};

// 🔢 COUNT FUNCTIONS (Optional - for pagination)
export const getIncomeCount = async (filter = {}) => {
  return await Income.countDocuments(filter);
};

export const getExpenseCount = async (filter = {}) => {
  return await Expense.countDocuments(filter);
};

// 💰 TOTAL CALCULATION FUNCTIONS (Optional - for summary)
export const getTotalIncomeAmount = async (startDate, endDate) => {
  const result = await Income.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  return result.length > 0 ? result[0].total : 0;
};

export const getTotalExpenseAmount = async (startDate, endDate) => {
  const result = await Expense.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  return result.length > 0 ? result[0].total : 0;
};
