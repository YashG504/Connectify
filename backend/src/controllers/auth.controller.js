import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import { generateTokenPair } from "../lib/utils.js";
import cloudinary from "../lib/cloudinary.js";

// 1. CHECK AUTH
export const checkAuth = async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// 2. SIGNUP
export async function signup(req, res) {
  const { email, password, fullName } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already exists" });

    const idx = Math.floor(Math.random() * 100) + 1;
    const newUser = await User.create({
      email, 
      fullName, 
      password,
      profilePic: `https://avatar.iran.liara.run/public/${idx}.png`,
    });

    // Generate access + refresh token pair
    await generateTokenPair(newUser._id, res);

    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    console.error("Error in signup controller:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
}

// 3. LOGIN
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate access + refresh token pair
    await generateTokenPair(user._id, res);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json(userResponse);
  } catch (error) {
    console.error("Error in login controller:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
}

// 4. LOGOUT — revoke refresh token + clear both cookies
export async function logout(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;

    // Revoke the refresh token in DB so it can't be reused
    if (refreshToken) {
      await RefreshToken.findOneAndUpdate(
        { token: refreshToken },
        { isRevoked: true }
      );
    }

    res.clearCookie("jwt", { httpOnly: true, sameSite: "none", secure: true });
    res.clearCookie("refreshToken", { httpOnly: true, sameSite: "none", secure: true, path: "/api/auth" });

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error in logout controller:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
}

// 5. REFRESH TOKEN — issue new access token using a valid refresh token
export async function refreshAccessToken(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    // Find the refresh token in DB
    const storedToken = await RefreshToken.findOne({
      token: refreshToken,
      isRevoked: false,
    });

    if (!storedToken) {
      // Token reuse detected or token doesn't exist — revoke ALL tokens for this user
      // This is a security measure against token theft
      const decoded = await RefreshToken.findOne({ token: refreshToken });
      if (decoded) {
        await RefreshToken.updateMany(
          { userId: decoded.userId },
          { isRevoked: true }
        );
      }
      return res.status(401).json({ message: "Invalid refresh token. Please login again." });
    }

    // Check if token has expired
    if (storedToken.expiresAt < new Date()) {
      storedToken.isRevoked = true;
      await storedToken.save();
      return res.status(401).json({ message: "Refresh token expired. Please login again." });
    }

    // Rotate: Revoke old token, issue new pair
    storedToken.isRevoked = true;
    await storedToken.save();

    // Issue new token pair
    await generateTokenPair(storedToken.userId, res);

    // Fetch user data to return
    const user = await User.findById(storedToken.userId).select("-password");

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error in refreshAccessToken:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
}

// 6. ONBOARD
export async function onboard(req, res) {
  try {
    const allowedFields = ["fullName", "bio", "nativeLanguage", "learningLanguage", "location", "profilePic"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // If profilePic is a base64 data URI, upload to Cloudinary
    if (updates.profilePic && updates.profilePic.startsWith("data:image/")) {
      const uploadResult = await cloudinary.uploader.upload(updates.profilePic, {
        folder: "connectify/avatars",
        transformation: [{ width: 200, height: 200, crop: "fill", gravity: "face" }],
      });
      updates.profilePic = uploadResult.secure_url;
    }

    updates.isOnboarded = true;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    ).select("-password");
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in onboard controller:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
}

// 7. UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const allowedFields = ["fullName", "bio", "nativeLanguage", "learningLanguage", "location", "profilePic"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // If profilePic is a base64 data URI, upload to Cloudinary
    if (updates.profilePic && updates.profilePic.startsWith("data:image/")) {
      const uploadResult = await cloudinary.uploader.upload(updates.profilePic, {
        folder: "connectify/avatars",
        transformation: [{ width: 200, height: 200, crop: "fill", gravity: "face" }],
      });
      updates.profilePic = uploadResult.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updates, 
      { new: true }
    ).select("-password");
    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in updateProfile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};