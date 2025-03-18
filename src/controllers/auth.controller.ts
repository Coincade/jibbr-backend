import { Request, Response } from "express";
import { registerSchema } from "../validation/auth.validations.js";
import { ZodError } from "zod";
import { formatError, renderEmailEjs } from "../helper.js";
import prisma from "../config/database.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { emailQueue, emailQueueName } from "../jobs/EmailJob.js";

export const register = async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const payload = registerSchema.parse(body);
        let user = await prisma.user.findUnique({where: {email: payload.email}});

        if(user) {
            return res.status(422).json(
                {errors: {email: "Email already exists"}}
            );
        }

        // Encrypt password
        const salt = await bcrypt.genSalt(10);
        payload.password = await bcrypt.hash(payload.password, salt);

        const token = await bcrypt.hash(uuidv4(), salt);
        const url = `${process.env.APP_URL}/verify-email?email=${payload.email}&token=${token}`;
        const emailBody = await renderEmailEjs("email-verify", {name: payload.name, url});

        //Send Email
        await emailQueue.add(emailQueueName, {to: payload.email, subject: "Jibbr | Verify your email", html: emailBody});

        await prisma.user.create({
            data:{
                name: payload.name,
                email: payload.email,
                password: payload.password,
                email_verify_token: token
            }
        });

        return res.status(201).json({message: "Please check your email to verify your account"});

    } catch (error) {
        console.log("Error in register controller:", error);
        if(error instanceof ZodError) {
            const errors = formatError(error);
            res.status(422).json({message: "Invalid data", errors});
        }
        return res.status(500).json({message: "Internal server error"});
    }
    
}
export const login = async (req: Request, res: Response) => {
    res.send("Logged in successfully!");
}
export const logout = async (req: Request, res: Response) => {
    res.send("Logged out successfully!");
}

export const verifyEmail = async (req: Request, res: Response) => {
    const {email, token} = req.query;
    if(email && token){
        const user = await prisma.user.findUnique({where: {email: email as string}});

        if(user){
            if(token === user.email_verify_token){
                //Redirect to front page
                await prisma.user.update({
                    data:{
                        email_verify_token: null,
                        email_verified_at:new Date().toISOString()
                    },
                    where:{email: email as string}
                })
                return res.redirect(`${process.env.CLIENT_APP_URL}/login`);
            }
        }
        res.redirect("/verify-error");
    }
    res.redirect("/verify-error");
}

export const verifyError = async (req: Request, res: Response) => {
    res.render("auth/emailVerifyError");
}
