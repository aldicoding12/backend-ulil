import mongoose from "mongoose";

/**
 * Model untuk menyimpan saldo per periode (mingguan, bulanan, tahunan)
 * Ini membantu mempercepat perhitungan laporan dan menjaga akurasi
 */
const periodBalanceSchema = new mongoose.Schema(
  {
    // Tipe periode: 'weekly', 'monthly', 'yearly'
    periodType: {
      type: String,
      required: true,
      enum: ["weekly", "monthly", "yearly"],
    },

    // Tahun periode
    year: {
      type: Number,
      required: true,
    },

    // Bulan (1-12) - null untuk yearly
    month: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },

    // Minggu ke berapa dalam bulan (1-5) - null untuk monthly/yearly
    week: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },

    // Range tanggal periode
    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    // Saldo awal periode (sebelum startDate)
    balanceStart: {
      type: Number,
      required: true,
      default: 0,
    },

    // Total pemasukan dalam periode
    totalIncome: {
      type: Number,
      required: true,
      default: 0,
    },

    // Total pengeluaran dalam periode
    totalExpense: {
      type: Number,
      required: true,
      default: 0,
    },

    // Saldo akhir periode
    balanceEnd: {
      type: Number,
      required: true,
      default: 0,
    },

    // Perubahan bersih (income - expense)
    netChange: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index untuk query cepat
periodBalanceSchema.index({ periodType: 1, year: 1, month: 1, week: 1 });
periodBalanceSchema.index({ startDate: 1, endDate: 1 });

const PeriodBalance = mongoose.model("PeriodBalance", periodBalanceSchema);
export default PeriodBalance;
