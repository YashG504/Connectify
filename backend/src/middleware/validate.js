import { body, validationResult } from "express-validator";

/**
 * Middleware to check validation results.
 * If there are validation errors, returns a 400 response with details.
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Validation rules for user signup.
 */
export const signupValidation = [
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Full name must be between 2 and 50 characters")
    .escape(), // Sanitize to prevent XSS
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  handleValidationErrors,
];

/**
 * Validation rules for user login.
 */
export const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Password is required"),
  handleValidationErrors,
];

/**
 * Validation rules for sending a message.
 */
export const messageValidation = [
  body("text")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Message cannot exceed 5000 characters"),
  body("image")
    .optional()
    .trim()
    .isString()
    .withMessage("Image must be a valid string URL"),
  handleValidationErrors,
];

/**
 * Validation rules for onboarding profile completion.
 */
export const onboardingValidation = [
  body("fullName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Full name must be between 2 and 50 characters")
    .escape(),
  body("bio")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Bio cannot exceed 500 characters")
    .escape(),
  body("nativeLanguage")
    .optional()
    .trim()
    .escape(),
  body("learningLanguage")
    .optional()
    .trim()
    .escape(),
  body("location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot exceed 100 characters")
    .escape(),
  handleValidationErrors,
];
