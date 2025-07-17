// services/socketService.js - Real-time Socket Client
import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.listeners = new Map();
  }

  // 🚀 Initialize Socket Connection
  connect(serverUrl = "http://localhost:5000") {
    if (this.socket && this.isConnected) {
      console.log("🔗 Socket already connected");
      return;
    }

    console.log("🔗 Connecting to real-time server...");

    this.socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
  }

  // 🔧 Setup Core Event Listeners
  setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on("connect", () => {
      console.log("✅ Real-time connection established");
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Identify user (opsional)
      const userData = this.getUserData();
      if (userData) {
        this.socket.emit("identify", userData);
      }
    });

    this.socket.on("disconnect", (reason) => {
      console.log("❌ Real-time connection lost:", reason);
      this.isConnected = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error("🔌 Connection error:", error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error("🚫 Max reconnection attempts reached");
      }
    });

    // Real-time finance events
    this.socket.on("balanceUpdate", (data) => {
      console.log("💰 Real-time balance update:", data);
      this.emit("balance-updated", data);
    });

    this.socket.on("transactionUpdate", (data) => {
      console.log("📊 Real-time transaction update:", data);
      this.emit("transaction-updated", data);
    });

    this.socket.on("reportDataUpdate", (data) => {
      console.log("📈 Real-time report data update:", data);
      this.emit("report-data-updated", data);
    });

    this.socket.on("financeUpdate", (data) => {
      console.log("🔄 Real-time finance update:", data);
      this.emit("finance-updated", data);
    });

    // User activity events
    this.socket.on("onlineUsersUpdate", (data) => {
      console.log("👥 Online users update:", data);
      this.emit("online-users-updated", data);
    });

    this.socket.on("userJoined", (data) => {
      console.log("👤 User joined:", data);
      this.emit("user-joined", data);
    });

    this.socket.on("userLeft", (data) => {
      console.log("👋 User left:", data);
      this.emit("user-left", data);
    });

    this.socket.on("dataRefreshRequested", (data) => {
      console.log("🔄 Data refresh requested by another user:", data);
      this.emit("data-refresh-requested", data);
    });
  }

  // 🎯 Event Emitter untuk Frontend
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
  }

  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      const callbacks = this.listeners.get(eventName);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(eventName, data) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventName}:`, error);
        }
      });
    }
  }

  // 📤 Send Events to Server
  requestDataRefresh() {
    if (this.socket && this.isConnected) {
      this.socket.emit("requestDataRefresh");
      console.log("🔄 Requested data refresh for all users");
    }
  }

  // 🔧 Utility Methods
  getUserData() {
    // Get user data from localStorage atau context
    const userData = localStorage.getItem("userData");
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
    return {
      userId: `user_${Date.now()}`,
      name: "Anonymous User",
    };
  }

  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }

  disconnect() {
    if (this.socket) {
      console.log("🔌 Disconnecting real-time connection...");
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // 📊 Get Connection Status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
      transport: this.socket?.io?.engine?.transport?.name,
    };
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;

// ===== ENHANCED ZUSTAND STORE dengan Real-time =====

// store/financeStore.js - Enhanced dengan Socket.IO
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { devtools } from "zustand/middleware";
import costumAPI from "../api";
import socketService from "../services/socketService";

// Helper function untuk format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

export const useFinanceStore = create(
  subscribeWithSelector(
    devtools(
      (set, get) => ({
        // 🚀 REAL-TIME CONNECTION STATE
        isRealTimeConnected: false,
        onlineUsers: 0,
        lastRealTimeUpdate: null,
        realTimeEvents: [],

        // Existing states...
        currentBalance: 0,
        formattedBalance: "Rp 0",
        balanceLoading: false,
        balanceError: null,

        reportData: {
          incomes: [],
          expenses: [],
          totalIncome: 0,
          totalExpense: 0,
          saldoAwal: 0,
          saldoAkhir: 0,
          chartData: [],
        },
        reportLoading: false,
        reportError: null,

        transactionLoading: false,
        transactionError: null,

        currentRange: "monthly",
        currentDate: new Date().toISOString().split("T")[0],

        syncStatus: "idle",
        lastSyncTime: null,

        // 🚀 REAL-TIME ACTIONS
        initializeRealTime: () => {
          console.log("🚀 Initializing real-time connection...");

          // Connect to Socket.IO server
          socketService.connect();

          // Setup real-time event listeners
          socketService.on("balance-updated", (data) => {
            console.log("💰 Real-time balance update received:", data);
            set({
              currentBalance: data.newBalance,
              formattedBalance: data.formattedBalance,
              lastRealTimeUpdate: new Date(),
            });

            // Add to events log
            get().addRealTimeEvent({
              type: "balance-update",
              data,
              timestamp: new Date(),
            });

            // Auto-refresh current report
            const { currentRange, currentDate } = get();
            get().fetchReport(currentRange, currentDate, true); // true = silent refresh
          });

          socketService.on("transaction-updated", (data) => {
            console.log("📊 Real-time transaction update received:", data);

            // Add to events log
            get().addRealTimeEvent({
              type: "transaction-update",
              data,
              timestamp: new Date(),
            });

            // Auto-refresh current report
            const { currentRange, currentDate } = get();
            get().fetchReport(currentRange, currentDate, true);
          });

          socketService.on("report-data-updated", (data) => {
            console.log("📈 Real-time report update received:", data);

            // Auto-refresh current report
            const { currentRange, currentDate } = get();
            get().fetchReport(currentRange, currentDate, true);
          });

          socketService.on("online-users-updated", (data) => {
            console.log("👥 Online users updated:", data);
            set({ onlineUsers: data.count });
          });

          socketService.on("user-joined", (data) => {
            console.log("👤 User joined:", data);
            get().addRealTimeEvent({
              type: "user-joined",
              data,
              timestamp: new Date(),
            });
          });

          socketService.on("user-left", (data) => {
            console.log("👋 User left:", data);
            get().addRealTimeEvent({
              type: "user-left",
              data,
              timestamp: new Date(),
            });
          });

          socketService.on("data-refresh-requested", (data) => {
            console.log("🔄 Data refresh requested by another user:", data);

            // Show notification dan auto-refresh
            get().addRealTimeEvent({
              type: "refresh-requested",
              data,
              timestamp: new Date(),
            });

            // Auto-refresh current data
            const { currentRange, currentDate } = get();
            get().fetchReport(currentRange, currentDate, true);
            get().fetchBalance();
          });

          // Update connection status
          set({ isRealTimeConnected: socketService.isSocketConnected() });
        },

        // 🚀 Add Real-time Event to Log
        addRealTimeEvent: (event) => {
          set((state) => ({
            realTimeEvents: [event, ...state.realTimeEvents].slice(0, 50), // Keep last 50 events
          }));
        },

        // 🚀 Request Manual Refresh for All Users
        requestGlobalRefresh: () => {
          socketService.requestDataRefresh();
          get().addRealTimeEvent({
            type: "refresh-sent",
            data: { message: "Refresh diminta untuk semua user" },
            timestamp: new Date(),
          });
        },

        // 🚀 Get Real-time Status
        getRealTimeStatus: () => {
          return {
            connected: socketService.isSocketConnected(),
            onlineUsers: get().onlineUsers,
            lastUpdate: get().lastRealTimeUpdate,
            recentEvents: get().realTimeEvents.slice(0, 5),
          };
        },

        // Enhanced fetchReport dengan silent mode untuk real-time updates
        fetchReport: async (range, date = null, silent = false) => {
          if (!silent) {
            set({
              reportLoading: true,
              reportError: null,
              currentRange: range,
              currentDate: date || get().currentDate,
            });
          }

          try {
            let url = `/finance/report/${range}-auto`;
            if (date) {
              url += `?date=${date}`;
            }

            const { data } = await costumAPI.get(url);

            if (!data?.data) {
              throw new Error("Invalid data format from API");
            }

            const apiData = data.data;

            // Process data (sama seperti sebelumnya)
            let incomes = [];
            let expenses = [];

            if (apiData.transactions) {
              incomes = Array.isArray(apiData.transactions.incomes)
                ? apiData.transactions.incomes
                : [];
              expenses = Array.isArray(apiData.transactions.expenses)
                ? apiData.transactions.expenses
                : [];
            } else {
              incomes = Array.isArray(apiData.incomes) ? apiData.incomes : [];
              expenses = Array.isArray(apiData.expenses)
                ? apiData.expenses
                : [];
            }

            const totalIncome = incomes.reduce(
              (sum, income) => sum + (income.amount || 0),
              0
            );
            const totalExpense = expenses.reduce(
              (sum, expense) => sum + (expense.amount || 0),
              0
            );

            let saldoAwal = 0;
            let saldoAkhir = 0;

            if (apiData.balance) {
              saldoAwal =
                apiData.balance.opening || apiData.balance.balanceStart || 0;
              saldoAkhir =
                apiData.balance.closing || apiData.balance.balanceEnd || 0;
            } else {
              saldoAwal = apiData.saldoAwal || 0;
              saldoAkhir = apiData.saldoAkhir || 0;
            }

            if (saldoAkhir === 0 || saldoAkhir === saldoAwal) {
              saldoAkhir = saldoAwal + totalIncome - totalExpense;
            }

            let chartData = [];
            if (apiData.chartData && Array.isArray(apiData.chartData)) {
              chartData = apiData.chartData;
            } else if (incomes.length > 0 || expenses.length > 0) {
              chartData = generateChartData(incomes, expenses, saldoAwal);
            }

            const newReportData = {
              incomes,
              expenses,
              totalIncome,
              totalExpense,
              saldoAwal,
              saldoAkhir,
              chartData,
            };

            set({
              reportData: newReportData,
              reportLoading: false,
              lastSyncTime: new Date(),
            });

            if (!silent) {
              console.log("✅ Report data fetched successfully");
            } else {
              console.log("🔄 Report data silently updated via real-time");
            }
          } catch (error) {
            console.error("❌ Failed to fetch report:", error);
            if (!silent) {
              set({
                reportError: "Gagal memuat data laporan. Silakan coba lagi.",
                reportLoading: false,
              });
            }
          }
        },

        // Enhanced CRUD operations dengan real-time awareness
        addIncome: async (incomeData) => {
          set({ transactionLoading: true, transactionError: null });

          try {
            const { data } = await costumAPI.post(
              "/finance/incomes/create",
              incomeData
            );

            // Update local state immediately (optimistic update)
            set({
              currentBalance: data.currentBalance,
              formattedBalance: formatCurrency(data.currentBalance),
              transactionLoading: false,
            });

            // Real-time akan handle update untuk user lain
            console.log("✅ Income added - real-time will notify other users");

            return {
              success: true,
              data: data.data,
              message: data.message,
              currentBalance: data.currentBalance,
            };
          } catch (error) {
            console.error("❌ Failed to add income:", error);
            const errorMessage =
              error.response?.data?.message || "Gagal menambah pemasukan";
            set({
              transactionError: errorMessage,
              transactionLoading: false,
            });
            return { success: false, message: errorMessage };
          }
        },

        addExpense: async (expenseData) => {
          set({ transactionLoading: true, transactionError: null });

          try {
            const { data } = await costumAPI.post(
              "/finance/expenses/create",
              expenseData
            );

            set({
              currentBalance: data.currentBalance,
              formattedBalance: formatCurrency(data.currentBalance),
              transactionLoading: false,
            });

            console.log("✅ Expense added - real-time will notify other users");

            return {
              success: true,
              data: data.data,
              message: data.message,
              currentBalance: data.currentBalance,
            };
          } catch (error) {
            console.error("❌ Failed to add expense:", error);
            const errorMessage =
              error.response?.data?.message || "Gagal menambah pengeluaran";
            set({
              transactionError: errorMessage,
              transactionLoading: false,
            });
            return { success: false, message: errorMessage };
          }
        },

        updateIncome: async (id, incomeData) => {
          set({ transactionLoading: true, transactionError: null });

          try {
            const { data } = await costumAPI.put(
              `/finance/incomes/${id}`,
              incomeData
            );

            set({
              currentBalance: data.currentBalance,
              formattedBalance: formatCurrency(data.currentBalance),
              transactionLoading: false,
            });

            console.log(
              "✅ Income updated - real-time will notify other users"
            );

            return {
              success: true,
              data: data.data,
              message: data.message,
              currentBalance: data.currentBalance,
            };
          } catch (error) {
            console.error("❌ Failed to update income:", error);
            const errorMessage =
              error.response?.data?.message || "Gagal mengupdate pemasukan";
            set({
              transactionError: errorMessage,
              transactionLoading: false,
            });
            return { success: false, message: errorMessage };
          }
        },

        updateExpense: async (id, expenseData) => {
          set({ transactionLoading: true, transactionError: null });

          try {
            const { data } = await costumAPI.put(
              `/finance/expenses/${id}`,
              expenseData
            );

            set({
              currentBalance: data.currentBalance,
              formattedBalance: formatCurrency(data.currentBalance),
              transactionLoading: false,
            });

            console.log(
              "✅ Expense updated - real-time will notify other users"
            );

            return {
              success: true,
              data: data.data,
              message: data.message,
              currentBalance: data.currentBalance,
            };
          } catch (error) {
            console.error("❌ Failed to update expense:", error);
            const errorMessage =
              error.response?.data?.message || "Gagal mengupdate pengeluaran";
            set({
              transactionError: errorMessage,
              transactionLoading: false,
            });
            return { success: false, message: errorMessage };
          }
        },

        deleteIncome: async (id) => {
          set({ transactionLoading: true, transactionError: null });

          try {
            const { data } = await costumAPI.delete(`/finance/incomes/${id}`);

            set({
              currentBalance: data.currentBalance,
              formattedBalance: formatCurrency(data.currentBalance),
              transactionLoading: false,
            });

            console.log(
              "✅ Income deleted - real-time will notify other users"
            );

            return {
              success: true,
              message: data.message,
              currentBalance: data.currentBalance,
            };
          } catch (error) {
            console.error("❌ Failed to delete income:", error);
            const errorMessage =
              error.response?.data?.message || "Gagal menghapus pemasukan";
            set({
              transactionError: errorMessage,
              transactionLoading: false,
            });
            return { success: false, message: errorMessage };
          }
        },

        deleteExpense: async (id) => {
          set({ transactionLoading: true, transactionError: null });

          try {
            const { data } = await costumAPI.delete(`/finance/expenses/${id}`);

            set({
              currentBalance: data.currentBalance,
              formattedBalance: formatCurrency(data.currentBalance),
              transactionLoading: false,
            });

            console.log(
              "✅ Expense deleted - real-time will notify other users"
            );

            return {
              success: true,
              message: data.message,
              currentBalance: data.currentBalance,
            };
          } catch (error) {
            console.error("❌ Failed to delete expense:", error);
            const errorMessage =
              error.response?.data?.message || "Gagal menghapus pengeluaran";
            set({
              transactionError: errorMessage,
              transactionLoading: false,
            });
            return { success: false, message: errorMessage };
          }
        },

        // Enhanced balance operations
        fetchBalance: async () => {
          set({ balanceLoading: true, balanceError: null });

          try {
            const { data } = await costumAPI.get("/finance/balance");

            set({
              currentBalance: data.balance,
              formattedBalance: data.formatted,
              balanceLoading: false,
              lastSyncTime: new Date(),
            });

            console.log("✅ Balance fetched:", data.balance);
          } catch (error) {
            console.error("❌ Failed to fetch balance:", error);
            set({
              balanceError: "Gagal memuat saldo",
              balanceLoading: false,
            });
          }
        },

        syncBalance: async () => {
          set({ syncStatus: "syncing" });

          try {
            const { data } = await costumAPI.post("/finance/balance/sync");

            set({
              currentBalance: data.balance,
              formattedBalance: data.formatted,
              syncStatus: "success",
              lastSyncTime: new Date(),
            });

            console.log(
              "✅ Balance synced and will notify other users via real-time"
            );

            return { success: true, message: data.message };
          } catch (error) {
            console.error("❌ Failed to sync balance:", error);
            set({ syncStatus: "error" });
            return {
              success: false,
              message: "Gagal melakukan sinkronisasi saldo",
            };
          } finally {
            setTimeout(() => set({ syncStatus: "idle" }), 3000);
          }
        },

        // Utility functions
        clearErrors: () => {
          set({
            balanceError: null,
            reportError: null,
            transactionError: null,
          });
        },

        setFilter: (range, date) => {
          set({
            currentRange: range,
            currentDate: date,
          });
          get().fetchReport(range, date);
        },

        // Clean up real-time connection
        disconnectRealTime: () => {
          socketService.disconnect();
          set({
            isRealTimeConnected: false,
            onlineUsers: 0,
            lastRealTimeUpdate: null,
          });
        },
      }),
      {
        name: "finance-store-realtime",
      }
    )
  )
);

// Helper function untuk generate chart data (sama seperti sebelumnya)
const generateChartData = (incomes, expenses, startingBalance = 0) => {
  if (!incomes.length && !expenses.length) return [];

  const dailyData = {};

  incomes.forEach((income) => {
    const date = new Date(income.date).toISOString().split("T")[0];
    if (!dailyData[date]) {
      dailyData[date] = { date, income: 0, expense: 0 };
    }
    dailyData[date].income += income.amount || 0;
  });

  expenses.forEach((expense) => {
    const date = new Date(expense.date).toISOString().split("T")[0];
    if (!dailyData[date]) {
      dailyData[date] = { date, income: 0, expense: 0 };
    }
    dailyData[date].expense += expense.amount || 0;
  });

  let balance = startingBalance;
  return Object.keys(dailyData)
    .sort()
    .map((date) => {
      const dayData = dailyData[date];
      balance += dayData.income - dayData.expense;
      return {
        date,
        income: dayData.income,
        expense: dayData.expense,
        balance,
      };
    });
};
