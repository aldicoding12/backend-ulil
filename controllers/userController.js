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

  const isDev = process.env.NODE_ENV === "development" ? false : true;

  // const cookieOption = {
  //   // ✅ PERUBAHAN: Set cookie expire sangat lama (10 tahun)
  //   expire: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 tahun
  //   httpOnly: true,
  //   secure: isDev, // ✅ PERBAIKAN: Typo "security" → "secure"
  // };
  // res.cookie("jwt", token, cookieOption);

  user.password = undefined;

  res.status(statusCode).json({
    data: user,
  });
};

export const userRegistration = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body; // Ambil email dari req.body
  const pengurus = (await User.countDocuments()) === 0;

  // Cek apakah email sudah terdaftar
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
  // tahap 1, cek apakah email diisi atau tidak
  if (!req.body.email && !req.body.password) {
    return res.status(400).json({ message: "Email dan password harus diisi" });
  }

  //tahap 2, cek apakah email ada di db atau tidak
  const userData = await User.findOne({
    email: req.body.email,
  });

  // tahap 3, cek apakah password benar?
  if (userData && (await userData.comparePassword(req.body.password))) {
    createSendResToken(userData, 200, res);
  } else {
    res
      .status(400)
      .json({ message: "Email atau Passwor yang anda masukkan salah" });
  }
});

export const userLogout = asyncHandler(async (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    expires: new Date(Date.now()),
  });
  res.status(200).json({ message: "Berhasil logout" });
});

//////////////////////
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
    console.error("Token verification error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
});
