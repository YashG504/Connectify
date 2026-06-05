import express from "express";
import { login, logout, onboard, signup, updateProfile, refreshAccessToken } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { signupValidation, loginValidation, onboardingValidation } from "../middleware/validate.js";

const router = express.Router();

// Public routes with rate limiting and validation
router.post("/signup", authLimiter, signupValidation, signup);
router.post("/login", authLimiter, loginValidation, login);
router.post("/logout", logout);

// Refresh token route — no protectRoute middleware needed (access token is expired)
router.post("/refresh", authLimiter, refreshAccessToken);

// Protected routes
router.post("/onboarding", protectRoute, onboardingValidation, onboard);
router.put("/update-profile", protectRoute, onboardingValidation, updateProfile);

// Check if user is logged in
router.get("/me", protectRoute, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

export default router;
