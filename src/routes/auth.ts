import { Router, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import https from "https";
import { db } from "../db";
import { NewUser, users } from "../db/schema";
import { auth, AuthRequest } from "../middleware/auth";

const authRouter = Router();
const OTP_EXPIRY_MINUTES = 10;

interface SignUpBody {
  name: string;
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface VerifyOtpBody {
  email: string;
  otp: string;
}

interface ForgotPasswordBody {
  email: string;
}

interface ResetPasswordBody {
  email: string;
  otp: string;
  newPassword: string;
}

const getReadableAuthError = (error: unknown): string => {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  if (
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("users")
  ) {
    return "Database is not ready. Please run backend migrations and try again.";
  }

  if (
    message.includes("ENOTFOUND") ||
    message.includes("getaddrinfo") ||
    message.includes("connect ECONNREFUSED")
  ) {
    return "Database connection failed. Please check DATABASE_URL on deployment.";
  }

  return "Auth service error. Please try again.";
};

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

const sendBrevoEmail = async ({
  to,
  subject,
  htmlContent,
}: {
  to: string;
  subject: string;
  htmlContent: string;
}): Promise<void> => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Task App";

  if (!apiKey || !senderEmail) {
    throw new Error(
      "Email service not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.",
    );
  }

  const payload = JSON.stringify({
    sender: { email: senderEmail, name: senderName },
    to: [{ email: to }],
    subject,
    htmlContent,
  });

  await new Promise<void>((resolve, reject) => {
    const req = https.request(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`Brevo error ${res.statusCode}: ${body}`));
            return;
          }
          resolve();
        });
      },
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
};

const verificationHtml = (otp: string): string =>
  `<h2>Email Verification</h2><p>Your OTP is <b>${otp}</b>. It expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`;

const resetHtml = (otp: string): string =>
  `<h2>Reset Password</h2><p>Your reset OTP is <b>${otp}</b>. It expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`;

authRouter.post(
  "/signup",
  async (req: Request<{}, {}, SignUpBody>, res: Response) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        res.status(400).json({ error: "Name, email and password are required." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail));

      if (existingUser.length) {
        res
          .status(400)
          .json({ error: "User with the same email already exists!" });
        return;
      }

      const hashedPassword = await bcryptjs.hash(password, 8);
      const otp = generateOtp();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      const newUser: NewUser = {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        isVerified: false,
        verificationOtp: otp,
        verificationOtpExpiresAt: otpExpiry,
      };

      await db.insert(users).values(newUser).returning();

      await sendBrevoEmail({
        to: normalizedEmail,
        subject: "Verify your Task App account",
        htmlContent: verificationHtml(otp),
      });

      res.status(201).json({
        message: "Signup successful. OTP sent to email.",
        email: normalizedEmail,
      });
    } catch (e) {
      console.error("Signup error:", e);
      res.status(500).json({ error: getReadableAuthError(e) });
    }
  },
);

authRouter.post(
  "/verify-email",
  async (req: Request<{}, {}, VerifyOtpBody>, res: Response) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        res.status(400).json({ error: "Email and OTP are required." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail));

      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      if (user.isVerified) {
        res.json({ message: "Email already verified." });
        return;
      }

      if (!user.verificationOtp || user.verificationOtp !== otp.trim()) {
        res.status(400).json({ error: "Invalid OTP." });
        return;
      }

      if (
        !user.verificationOtpExpiresAt ||
        new Date(user.verificationOtpExpiresAt).getTime() < Date.now()
      ) {
        res.status(400).json({ error: "OTP expired. Please request a new OTP." });
        return;
      }

      await db
        .update(users)
        .set({
          isVerified: true,
          verificationOtp: null,
          verificationOtpExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.email, normalizedEmail));

      res.json({ message: "Email verification successful." });
    } catch (e) {
      console.error("Verify email error:", e);
      res.status(500).json({ error: getReadableAuthError(e) });
    }
  },
);

authRouter.post(
  "/resend-verification-otp",
  async (req: Request<{}, {}, ForgotPasswordBody>, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: "Email is required." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail));

      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      if (user.isVerified) {
        res.status(400).json({ error: "Email already verified." });
        return;
      }

      const otp = generateOtp();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await db
        .update(users)
        .set({
          verificationOtp: otp,
          verificationOtpExpiresAt: otpExpiry,
          updatedAt: new Date(),
        })
        .where(eq(users.email, normalizedEmail));

      await sendBrevoEmail({
        to: normalizedEmail,
        subject: "Your new verification OTP",
        htmlContent: verificationHtml(otp),
      });

      res.json({ message: "Verification OTP resent." });
    } catch (e) {
      console.error("Resend verify OTP error:", e);
      res.status(500).json({ error: getReadableAuthError(e) });
    }
  },
);

authRouter.post(
  "/forgot-password",
  async (req: Request<{}, {}, ForgotPasswordBody>, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: "Email is required." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail));

      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const otp = generateOtp();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await db
        .update(users)
        .set({
          resetOtp: otp,
          resetOtpExpiresAt: otpExpiry,
          updatedAt: new Date(),
        })
        .where(eq(users.email, normalizedEmail));

      await sendBrevoEmail({
        to: normalizedEmail,
        subject: "Task App password reset OTP",
        htmlContent: resetHtml(otp),
      });

      res.json({ message: "Reset OTP sent to email.", email: normalizedEmail });
    } catch (e) {
      console.error("Forgot password error:", e);
      res.status(500).json({ error: getReadableAuthError(e) });
    }
  },
);

authRouter.post(
  "/reset-password",
  async (req: Request<{}, {}, ResetPasswordBody>, res: Response) => {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        res
          .status(400)
          .json({ error: "Email, OTP and new password are required." });
        return;
      }

      if (newPassword.trim().length < 6) {
        res
          .status(400)
          .json({ error: "New password must be at least 6 characters." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail));

      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      if (!user.resetOtp || user.resetOtp !== otp.trim()) {
        res.status(400).json({ error: "Invalid OTP." });
        return;
      }

      if (
        !user.resetOtpExpiresAt ||
        new Date(user.resetOtpExpiresAt).getTime() < Date.now()
      ) {
        res.status(400).json({ error: "OTP expired. Please request a new OTP." });
        return;
      }

      const hashedPassword = await bcryptjs.hash(newPassword.trim(), 8);

      await db
        .update(users)
        .set({
          password: hashedPassword,
          resetOtp: null,
          resetOtpExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(and(eq(users.email, normalizedEmail), eq(users.id, user.id)));

      res.json({ message: "Password reset successful." });
    } catch (e) {
      console.error("Reset password error:", e);
      res.status(500).json({ error: getReadableAuthError(e) });
    }
  },
);

authRouter.post(
  "/login",
  async (req: Request<{}, {}, LoginBody>, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail));

      if (!existingUser) {
        res.status(400).json({ error: "User with this email does not exist!" });
        return;
      }

      if (!existingUser.isVerified) {
        res
          .status(403)
          .json({ error: "Email is not verified. Please verify first." });
        return;
      }

      const isMatch = await bcryptjs.compare(password, existingUser.password);
      if (!isMatch) {
        res.status(400).json({ error: "Incorrect password!" });
        return;
      }

      const token = jwt.sign(
        { id: existingUser.id },
        process.env.JWT_SECRET || "passwordKey",
      );

      res.json({ token, ...existingUser });
    } catch (e) {
      console.error("Login error:", e);
      res.status(500).json({ error: getReadableAuthError(e) });
    }
  },
);

authRouter.post("/tokenIsValid", async (req, res) => {
  try {
    const token = req.header("x-auth-token");
    if (!token) {
      res.json(false);
      return;
    }

    const verified = jwt.verify(token, process.env.JWT_SECRET || "passwordKey");
    if (!verified) {
      res.json(false);
      return;
    }

    const verifiedToken = verified as { id: string };
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, verifiedToken.id));

    if (!user) {
      res.json(false);
      return;
    }

    res.json(true);
  } catch (_e) {
    res.status(500).json(false);
  }
});

authRouter.get("/", auth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not found!" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.user));
    res.json({ ...user, token: req.token });
  } catch (_e) {
    res.status(500).json(false);
  }
});

export default authRouter;
