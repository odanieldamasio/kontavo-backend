-- CreateEnum
CREATE TYPE "WhatsappMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "transactionId" TEXT,
    "messageId" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "direction" "WhatsappMessageDirection" NOT NULL,
    "text" TEXT NOT NULL,
    "parsed" BOOLEAN NOT NULL DEFAULT false,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_messages_userId_idx" ON "whatsapp_messages"("userId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_messageId_idx" ON "whatsapp_messages"("messageId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_remoteJid_idx" ON "whatsapp_messages"("remoteJid");

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
