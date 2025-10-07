// models/galeri.model.js
import mongoose from "mongoose";

const galeriSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Judul galeri wajib diisi"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Kategori wajib diisi"],
      enum: ["Kegiatan", "Pembelajaran", "Prestasi", "Fasilitas"],
    },
    description: {
      type: String,
      required: [true, "description wajib diisi"],
    },
    date: {
      type: Date,
      required: [true, "Tanggal wajib diisi"],
    },
    images: [
      {
        full: {
          type: String,
          required: true,
        },
        thumb: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Galeri = mongoose.model("Galeri", galeriSchema);

export default Galeri;
