import User from "../models/User.js";
import jwt from "jsonwebtoken";

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
    if (!email || !password || !fullName) return res.status(400).json({ message: "All fields required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 chars" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already exists" });

    const idx = Math.floor(Math.random() * 100) + 1;
    const newUser = await User.create({
      email, 
      fullName, 
      password,
      profilePic: `https://avatar.iran.liara.run/public/${idx}.png`,
    });

    // JWT Generation
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" });
    
    res.cookie("jwt", token, { 
      maxAge: 7*24*60*60*1000, 
      httpOnly: true, 
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", 
      secure: process.env.NODE_ENV === "production" 
    });

    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
}

// 3. LOGIN
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "All fields required" });

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" });
    
    res.cookie("jwt", token, { 
      maxAge: 7*24*60*60*1000, 
      httpOnly: true, 
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", 
      secure: process.env.NODE_ENV === "production" 
    });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
}

// 4. LOGOUT
export function logout(req, res) {
  res.clearCookie("jwt");
  res.status(200).json({ message: "Logout successful" });
}

// 5. ONBOARD
export async function onboard(req, res) {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { ...req.body, isOnboarded: true },
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
}

// 6. UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      req.body, 
      { new: true }
    );
    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in updateProfile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};