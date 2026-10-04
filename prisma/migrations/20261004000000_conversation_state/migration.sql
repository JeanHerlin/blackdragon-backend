-- CreateTable: per-user step tracker for the Messenger bot adapter
CREATE TABLE "ConversationState" (
    "id" TEXT NOT NULL,
    "psid" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'start',
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationState_psid_key" ON "ConversationState"("psid");
