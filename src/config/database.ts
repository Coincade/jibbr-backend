import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient({
    log: ['error'], // Only log errors to improve performance
    errorFormat: 'pretty',
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
})

export default prisma
