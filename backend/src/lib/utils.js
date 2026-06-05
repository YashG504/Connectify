import jwt from "jsonwebtoken";
import crypto from "crypto";
import RefreshToken from "../models/RefreshToken.js";

const ACCESS_TOKEN_EXPIRY = "15m";         // Short-lived access token
const REFRESH_TOKEN_EXPIRY_DAYS = 7;       // Long-lived refresh token
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;                       // 15 minutes in ms
const REFRESH_COOKIE_MAX_AGE = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Cookie options shared across access and refresh tokens.
 */
const cookieOptions = {
  httpOnly: true,
  sameSite: "none",
  secure: true,
};

/**
 * Generate an access token (JWT) and a refresh token (random hex stored in DB).
 * Sets both as httpOnly cookies on the response.
 * 
 * @param {string} userId - The MongoDB user ID
 * @param {object} res - Express response object
 */
export const generateTokenPair = async (userId, res) => {
  // 1. Short-lived access token (JWT)
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  // 2. Long-lived refresh token (cryptographically random, stored in DB)
  const refreshTokenValue = crypto.randomBytes(40).toString("hex");

  await RefreshToken.create({
    token: refreshTokenValue,
    userId,
    expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE),
  });

  // Set cookies
  res.cookie("jwt", accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  res.cookie("refreshToken", refreshTokenValue, {
    ...cookieOptions,
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: "/api/auth", // Only sent to auth routes (reduces attack surface)
  });

  return { accessToken, refreshToken: refreshTokenValue };
};

/**
 * Legacy single-token generator (kept for backward compatibility).
 * Use generateTokenPair for new code.
 */
export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });

  return token;
};
