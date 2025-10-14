-- CreateTable
CREATE TABLE "MessageCache" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceCache" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageCache_channelId_key" ON "MessageCache"("channelId");

-- CreateIndex
CREATE INDEX "MessageCache_channelId_idx" ON "MessageCache"("channelId");

-- CreateIndex
CREATE INDEX "MessageCache_expiresAt_idx" ON "MessageCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCache_userId_key" ON "SessionCache"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCache_token_key" ON "SessionCache"("token");

-- CreateIndex
CREATE INDEX "SessionCache_userId_idx" ON "SessionCache"("userId");

-- CreateIndex
CREATE INDEX "SessionCache_token_idx" ON "SessionCache"("token");

-- CreateIndex
CREATE INDEX "SessionCache_expiresAt_idx" ON "SessionCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceCache_workspaceId_key" ON "WorkspaceCache"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceCache_workspaceId_idx" ON "WorkspaceCache"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceCache_expiresAt_idx" ON "WorkspaceCache"("expiresAt");
