import { Request, Response } from "express";
import { forgetPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "../validation/auth.validations.js";
import { ZodError } from "zod";
import { checkDateHourDiff, formatError, renderEmailEjs } from "../helper.js";
import prisma from "../config/database.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { emailQueue, emailQueueName } from "../jobs/EmailJob.js";
import jwt from "jsonwebtoken";

export const register = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const payload = registerSchema.parse(body);
    let user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (user) {
      return res
        .status(422)
        .json({ errors: { email: "Email already exists" } });
    }

    // Encrypt password
    const salt = await bcrypt.genSalt(10);
    payload.password = await bcrypt.hash(payload.password, salt);

    const token = await bcrypt.hash(uuidv4(), salt);
    const url = `${process.env.APP_URL}/api/verify/verify-email?email=${payload.email}&token=${token}`;
    const emailBody = await renderEmailEjs("email-verify", {
      name: payload.name,
      url,
    });

    //Send Email
    await emailQueue.add(emailQueueName, {
      to: payload.email,
      subject: "Jibbr | Verify your email",
      body: emailBody,
    });

    await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        email_verify_token: token,
      },
    });

    return res
      .status(201)
      .json({ message: "Please check your email to verify your account" });
  } catch (error) {
    // console.log("Error in register controller:", error);
    if (error instanceof ZodError) {
      const errors = formatError(error);
      res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};
export const login = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const payload = loginSchema.parse(body);
    let user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user || user === null) {
      return res.status(422).json({
        errors: {
          email: "No user found with this email",
        },
      });
    }

    //Compare Password
    const isPasswordValid = await bcrypt.compare(
      payload.password,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(422).json({
        errors: {
          email: "Invalid email or password",
        },
      });
    }
    //JWT Payload
    const JWTPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    //Generate JWT Token
    let token = jwt.sign(JWTPayload, process.env.JWT_SECRET as string, {
      expiresIn: "30d",
    })

    return res.status(200).json({
      message: "Logged in successfully",
      data: {
        ...JWTPayload,
        token: `Bearer ${token}`,
      },
    });
  } catch (error) {
    // console.log("Error in Login controller:", error);
    if (error instanceof ZodError) {
      const errors = formatError(error);
      res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};
export const logout = async (req: Request, res: Response) => {
  res.send("Logged out successfully!");
};

export const verifyEmail = async (req: Request, res: Response) => {
  const { email, token } = req.query;
  if (email && token) {
    const user = await prisma.user.findUnique({
      where: { email: email as string },
    });

    if (user) {
      if (token === user.email_verify_token) {
        //Redirect to front page
        await prisma.user.update({
          data: {
            email_verify_token: null,
            email_verified_at: new Date().toISOString(),
          },
          where: { email: email as string },
        });
        return res.redirect(`${process.env.CLIENT_APP_URL}/login`);
      }
    }
    res.redirect("/verify-error");
  }
  res.redirect("/verify-error");
};

export const verifyError = async (req: Request, res: Response) => {
  res.render("auth/emailVerifyError");
};

export const getUser = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(422).json({message: "User Not Found"});
  }
  res.status(200).json({data: user});
}

export const forgetPassword = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const payload = forgetPasswordSchema.parse(body);

    const user = await prisma.user.findUnique({where: { email: payload.email }})

    if(!user || user === null) {
      return res.status(422).json({message: "User not found", errors: {email: "User not found with this email"}})
    }

   const salt = await bcrypt.genSalt(10);
   const token = await bcrypt.hash(uuidv4(), salt);
   await prisma.user.update({
    data:{
      password_reset_token: token,
      token_send_at: new Date().toISOString()
    },
    where:{ email: payload.email}
   })
   const url = `${process.env.CLIENT_APP_URL}/reset-password?email=${payload.email}&token=${token}`;

   const html = await renderEmailEjs("forget-password", {
    url,
   });

   await emailQueue.add(emailQueueName, {
    to: payload.email,
    subject: "Jibbr | Reset Password",
    body: html,
   });

   return res.status(200).json({message: "Password reset email sent"})
  } catch (error) {
    // console.log("Error in forgetPassword controller:", error);
    if (error instanceof ZodError) {
      const errors = formatError(error);
      res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try{
    const body = req.body;
    const payload = resetPasswordSchema.parse(body);

    const user = await prisma.user.findUnique({where: { email: payload.email }})

    if(!user || user === null) {
      return res.status(422).json({message: "User not found", errors: {email: "User not found with this email"}})
    }

    //Check token
    if(user.password_reset_token !== payload.token) {
      return res.status(422).json({message: "User not found", errors: {email: "Token is invalid"}})
    }

    //Check token expiration for 2 hrs time frame
    const hoursDiff = checkDateHourDiff(user.token_send_at!);
    if(hoursDiff > 2) {
      return res.status(422).json({message: "Token expired", errors: {email: "Token expired"}})
    }

    //Update password
    const salt = await bcrypt.genSalt(10);
    const newPass = await bcrypt.hash(payload.password, salt); 

    await prisma.user.update({
      data: {
        password: newPass,
        password_reset_token: null,
        token_send_at: null,
      },
      where: { email: payload.email },
    });

    return res.status(200).json({message: "Password reset successfully"})
    
    
  }
  catch (error) {
    // console.log("Error in resetPassword controller:", error);
    if (error instanceof ZodError) {
      const errors = formatError(error);
      res.status(422).json({ message: "Invalid data", errors });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}
