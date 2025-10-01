import asyncHandler from "../middlewares/asyncHandler.js";
import User from "../models/userModels.js";
import jwt from "jsonwebtoken";

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "6d",
  });
};

const createSendResToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const isDev = process.env.NODE_ENV === "development";

  // PERBAIKAN: Cookie option yang konsisten
  const cookieOption = {
    expires: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 hari
    httpOnly: true, // Tidak bisa diakses via JavaScript
    secure: !isDev, // false untuk development, true untuk production
    sameSite: isDev ? "lax" : "strict", // lax untuk development
    path: "/", // Cookie berlaku untuk semua path
  };

  res.cookie("jwt", token, cookieOption);

  user.password = undefined;

  res.status(statusCode).json({
    data: user,
    token: token, // Kirim token juga di response
  });
};

export const userRegistration = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const pengurus = (await User.countDocuments()) === 0;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "Email sudah digunakan" });
  }

  const role = pengurus ? "pengurus" : "jamaah";

  const createUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    role: role,
  });
  createSendResToken(createUser, 201, res);
});

export const userLogin = asyncHandler(async (req, res) => {
  if (!req.body.email && !req.body.password) {
    return res.status(400).json({ message: "Email dan password harus diisi" });
  }

  const userData = await User.findOne({
    email: req.body.email,
  });

  if (userData && (await userData.comparePassword(req.body.password))) {
    createSendResToken(userData, 200, res);
  } else {
    res
      .status(400)
      .json({ message: "Email atau Password yang anda masukkan salah" });
  }
});

export const userLogout = asyncHandler(async (req, res) => {
  const isDev = process.env.NODE_ENV === "development";

  // PERBAIKAN: Cookie option yang sama dengan saat login
  res.cookie("jwt", "", {
    httpOnly: true,
    expires: new Date(0), // Expire immediately
    secure: !isDev,
    sameSite: isDev ? "lax" : "strict",
    path: "/",
  });

  res.status(200).json({
    success: true,
    message: "Berhasil logout",
  });
});

export const verifyToken = asyncHandler(async (req, res) => {
  let token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
});

export const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const totalUsers = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          hasNextPage: page < Math.ceil(totalUsers / limit),
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
});

export const getUserById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Format ID tidak valid",
      });
    }

    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Format ID tidak valid",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
});

export const updateUser = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email sudah digunakan oleh user lain",
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    updateData.updatedAt = new Date();

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.status(200).json({
      success: true,
      message: "User berhasil diupdate",
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
});

export const updateUserPassword = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Password lama dan password baru harus diisi",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Password lama tidak benar",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password berhasil diupdate",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating password",
      error: error.message,
    });
  }
});

export const deleteUser = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const totalUsers = await User.countDocuments();
    if (totalUsers === 1 && user.role === "pengurus") {
      return res.status(400).json({
        success: false,
        message: "Tidak dapat menghapus pengurus terakhir",
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "User berhasil dihapus",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
});

export const getUserStats = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalUsers = await User.countDocuments();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: thirtyDaysAgo },
    });

    const newUsers = await User.countDocuments({
      createdAt: { $gte: startOfMonth },
    });

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthUsers = await User.countDocuments({
      createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
    });

    const growthRate =
      lastMonthUsers > 0
        ? (((newUsers - lastMonthUsers) / lastMonthUsers) * 100).toFixed(1)
        : 100;

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        newUsers,
        growthRate: parseFloat(growthRate),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user statistics",
      error: error.message,
    });
  }
});
