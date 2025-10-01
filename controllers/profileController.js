import fs from "fs";
import asyncHandler from "../middlewares/asyncHandler.js";
import cloudinary from "../utils/uploadFileHandler.js";
import Profile from "../models/profileModel.js";
import mongoose from "mongoose";

// CREATE profile + image
export const createProfile = asyncHandler(async (req, res) => {
  const {
    mosqueName,
    fullAddress,
    streetName,
    establishmentYear,
    founderName,
    briefHistory,
    vision,
    mission,
    mosqueMotto,
    activeCongregationCount,
    // Demographics fields
    maleCount,
    femaleCount,
    childrenCount,
    elderlyCount,
    // Statistics arrays
    weeklyAttendance,
    monthlyGrowth,
  } = req.body;

  let imageUrl = null;
  let imagePublicId = null;

  // Parse and validate weeklyAttendance if provided
  let parsedWeeklyAttendance = null;
  if (weeklyAttendance) {
    try {
      parsedWeeklyAttendance =
        typeof weeklyAttendance === "string"
          ? JSON.parse(weeklyAttendance)
          : weeklyAttendance;
    } catch (error) {
      return res.status(400).json({
        message: "Format data kehadiran mingguan tidak valid",
      });
    }
  }

  // Parse and validate monthlyGrowth if provided
  let parsedMonthlyGrowth = null;
  if (monthlyGrowth) {
    try {
      parsedMonthlyGrowth =
        typeof monthlyGrowth === "string"
          ? JSON.parse(monthlyGrowth)
          : monthlyGrowth;
    } catch (error) {
      return res.status(400).json({
        message: "Format data pertumbuhan bulanan tidak valid",
      });
    }
  }

  // Validasi input wajib
  if (
    !mosqueName ||
    !fullAddress ||
    !streetName ||
    !establishmentYear ||
    !founderName
  ) {
    return res.status(400).json({
      message:
        "Nama masjid, alamat lengkap, nama jalan, tahun berdiri, dan nama pendiri wajib diisi",
    });
  }

  // Untuk create, gambar logo masjid wajib ada
  if (!req.file) {
    return res.status(400).json({
      message: "Logo masjid wajib diupload untuk profil masjid baru",
    });
  }

  try {
    // Upload logo masjid ke Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "mosque-logos",
    });

    imageUrl = result.secure_url;
    imagePublicId = result.public_id;

    // Hapus file temporary
    fs.unlinkSync(req.file.path);

    // Simpan ke database
    const profileData = {
      mosqueName,
      fullAddress,
      streetName,
      establishmentYear: parseInt(establishmentYear),
      founderName,
      briefHistory,
      vision,
      mission,
      mosqueMotto,
      activeCongregationCount: activeCongregationCount
        ? parseInt(activeCongregationCount)
        : 0,
      image: imageUrl,
      imagePublicId,
      // Demographics data
      maleCount: maleCount ? parseInt(maleCount) : 0,
      femaleCount: femaleCount ? parseInt(femaleCount) : 0,
      childrenCount: childrenCount ? parseInt(childrenCount) : 0,
      elderlyCount: elderlyCount ? parseInt(elderlyCount) : 0,
    };

    // Add parsed arrays if provided
    if (parsedWeeklyAttendance) {
      profileData.weeklyAttendance = parsedWeeklyAttendance;
    }
    if (parsedMonthlyGrowth) {
      profileData.monthlyGrowth = parsedMonthlyGrowth;
    }

    const newProfile = await Profile.create(profileData);
    res.status(201).json({
      message: "Profil masjid berhasil dibuat",
      data: newProfile,
    });
  } catch (error) {
    // Cleanup file jika ada error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw error;
  }
});

// UPDATE profile by ID
export const updateProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const {
    mosqueName,
    fullAddress,
    streetName,
    establishmentYear,
    founderName,
    briefHistory,
    vision,
    mission,
    mosqueMotto,
    activeCongregationCount,
    // Demographics fields
    maleCount,
    femaleCount,
    childrenCount,
    elderlyCount,
    // Statistics arrays
    weeklyAttendance,
    monthlyGrowth,
  } = req.body;

  const updateData = {
    mosqueName,
    fullAddress,
    streetName,
    establishmentYear: establishmentYear
      ? parseInt(establishmentYear)
      : undefined,
    founderName,
    briefHistory,
    vision,
    mission,
    mosqueMotto,
    activeCongregationCount: activeCongregationCount
      ? parseInt(activeCongregationCount)
      : undefined,
    // Demographics data
    maleCount: maleCount !== undefined ? parseInt(maleCount) : undefined,
    femaleCount: femaleCount !== undefined ? parseInt(femaleCount) : undefined,
    childrenCount:
      childrenCount !== undefined ? parseInt(childrenCount) : undefined,
    elderlyCount:
      elderlyCount !== undefined ? parseInt(elderlyCount) : undefined,
  };

  // Handle weeklyAttendance array
  if (weeklyAttendance !== undefined) {
    try {
      updateData.weeklyAttendance =
        typeof weeklyAttendance === "string"
          ? JSON.parse(weeklyAttendance)
          : weeklyAttendance;
    } catch (error) {
      return res.status(400).json({
        message: "Format data kehadiran mingguan tidak valid",
      });
    }
  }

  // Handle monthlyGrowth array
  if (monthlyGrowth !== undefined) {
    try {
      updateData.monthlyGrowth =
        typeof monthlyGrowth === "string"
          ? JSON.parse(monthlyGrowth)
          : monthlyGrowth;
    } catch (error) {
      return res.status(400).json({
        message: "Format data pertumbuhan bulanan tidak valid",
      });
    }
  }

  // Remove undefined values
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // Cari profil yang akan diupdate
  const existingProfile = await Profile.findById(id);
  if (!existingProfile) {
    return res.status(404).json({ message: "Profil masjid tidak ditemukan" });
  }

  try {
    // Jika ada file logo baru
    if (req.file) {
      // Hapus logo lama dari Cloudinary jika ada
      if (existingProfile.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(existingProfile.imagePublicId);
        } catch (deleteError) {
          // Lanjutkan proses meskipun gagal hapus logo lama
        }
      }

      // Upload logo baru
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "mosque-logos",
      });

      updateData.image = result.secure_url;
      updateData.imagePublicId = result.public_id;

      // Hapus file temporary
      fs.unlinkSync(req.file.path);
    } else {
    }

    // Update data di database
    const updated = await Profile.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    res.status(200).json({
      message: "Profil masjid berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    // Cleanup file jika ada error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw error;
  }
});

// DELETE profile + image
export const deleteProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const profile = await Profile.findById(id);
  if (!profile)
    return res.status(404).json({ message: "Profil masjid tidak ditemukan" });

  // Hapus logo dari Cloudinary
  if (profile.imagePublicId) {
    try {
      await cloudinary.uploader.destroy(profile.imagePublicId);
    } catch (error) {
      // Lanjutkan menghapus data meskipun gagal hapus logo
    }
  }

  // Hapus dokumen dari MongoDB
  await profile.deleteOne();

  res.status(200).json({ message: "Profil masjid berhasil dihapus" });
});

// GET profile (biasanya hanya ada satu profil masjid)
export const getProfile = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne().lean();

  if (!profile) {
    return res.status(404).json({ message: "Profil masjid belum tersedia" });
  }

  res.status(200).json({
    message: "Berhasil menampilkan profil masjid",
    data: profile,
  });
});

// GET profile statistics summary
export const getProfileStatistics = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne().lean();

  if (!profile) {
    return res.status(404).json({ message: "Profil masjid belum tersedia" });
  }

  // Calculate statistics
  const totalDemographics =
    (profile.maleCount || 0) +
    (profile.femaleCount || 0) +
    (profile.childrenCount || 0) +
    (profile.elderlyCount || 0);

  const totalWeeklyAttendance = profile.weeklyAttendance
    ? profile.weeklyAttendance.reduce(
        (total, day) => total + (day.count || 0),
        0
      )
    : 0;

  const latestMonthlyGrowth =
    profile.monthlyGrowth && profile.monthlyGrowth.length > 0
      ? profile.monthlyGrowth[profile.monthlyGrowth.length - 1].jamaah || 0
      : 0;

  const statistics = {
    totalActiveCongregation: Math.max(
      profile.activeCongregationCount || 0,
      totalDemographics
    ),
    demographics: {
      maleCount: profile.maleCount || 0,
      femaleCount: profile.femaleCount || 0,
      childrenCount: profile.childrenCount || 0,
      elderlyCount: profile.elderlyCount || 0,
      total: totalDemographics,
    },
    weeklyAttendance: {
      data: profile.weeklyAttendance || [],
      totalWeekly: totalWeeklyAttendance,
      averageDaily: profile.weeklyAttendance
        ? Math.round(totalWeeklyAttendance / 7)
        : 0,
    },
    monthlyGrowth: {
      data: profile.monthlyGrowth || [],
      latestMonth: latestMonthlyGrowth,
    },
  };

  res.status(200).json({
    message: "Berhasil menampilkan statistik profil masjid",
    data: statistics,
  });
});

// UPDATE weekly attendance for specific day
export const updateWeeklyAttendance = asyncHandler(async (req, res) => {
  const { day, count } = req.body;

  if (!day || count === undefined) {
    return res.status(400).json({
      message: "Hari dan jumlah kehadiran wajib diisi",
    });
  }

  const validDays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  if (!validDays.includes(day)) {
    return res.status(400).json({
      message: "Hari tidak valid. Gunakan: Sen, Sel, Rab, Kam, Jum, Sab, Min",
    });
  }

  const profile = await Profile.findOne();
  if (!profile) {
    return res.status(404).json({ message: "Profil masjid belum tersedia" });
  }

  await profile.updateWeeklyAttendance(day, parseInt(count));

  res.status(200).json({
    message: `Kehadiran hari ${day} berhasil diperbarui`,
    data: profile.weeklyAttendance,
  });
});

// UPDATE monthly growth for specific month
export const updateMonthlyGrowth = asyncHandler(async (req, res) => {
  const { month, jamaah } = req.body;

  if (!month || jamaah === undefined) {
    return res.status(400).json({
      message: "Bulan dan jumlah jamaah wajib diisi",
    });
  }

  const validMonths = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  if (!validMonths.includes(month)) {
    return res.status(400).json({
      message:
        "Bulan tidak valid. Gunakan: Jan, Feb, Mar, Apr, Mei, Jun, Jul, Agu, Sep, Okt, Nov, Des",
    });
  }

  const profile = await Profile.findOne();
  if (!profile) {
    return res.status(404).json({ message: "Profil masjid belum tersedia" });
  }

  await profile.updateMonthlyGrowth(month, parseInt(jamaah));

  res.status(200).json({
    message: `Data pertumbuhan bulan ${month} berhasil diperbarui`,
    data: profile.monthlyGrowth,
  });
});
