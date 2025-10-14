import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { CacheService } from "../services/cache.service.js";

const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader === null || authHeader === undefined) {
            return res.status(401).json({status: 401,message: "Unauthorized"});
        }
        const token = authHeader.split(" ")[1];

        // First check session cache
        const cachedUser = await CacheService.validateSessionToken(token);
        if (cachedUser) {
            req.user = cachedUser as AuthUser;
            return next();
        }

        // Fallback to JWT verification
        jwt.verify(token, process.env.JWT_SECRET as string, async (err, user) => {
            if(err) return res.status(401).json({status: 401,message: "Unauthorized"});
            
            const authUser = user as AuthUser;
            
            // Cache the session for future requests
            await CacheService.cacheUserSession(
                authUser.id, 
                token, 
                authUser, 
                24 // 24 hours
            );
            
            req.user = authUser;
            next();
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({status: 401,message: "Unauthorized"});
    }
}

export default authMiddleware;