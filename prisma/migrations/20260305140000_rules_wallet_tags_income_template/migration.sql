-- 1) Enums (Prisma usa TEXT; aqui só garantimos compatibilidade)

-- 2) Rule table
CREATE TABLE IF NOT EXISTS "Rule" (
  "id" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "target" TEXT NOT NULL,
  "matchType" TEXT NOT NULL,
  "pattern" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "renameTo" TEXT,
  "categoryId" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "person" TEXT,
  "paymentType" TEXT,
  "wallet" TEXT,
  "incomeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Rule_target_isActive_idx" ON "Rule"("target","isActive");
CREATE INDEX IF NOT EXISTS "Rule_priority_idx" ON "Rule"("priority");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Rule_categoryId_fkey'
  ) THEN
    ALTER TABLE "Rule"
      ADD CONSTRAINT "Rule_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) IncomeTemplate
CREATE TABLE IF NOT EXISTS "IncomeTemplate" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "wallet" TEXT NOT NULL,
  "person" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncomeTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IncomeTemplate_isActive_idx" ON "IncomeTemplate"("isActive");
CREATE INDEX IF NOT EXISTS "IncomeTemplate_type_idx" ON "IncomeTemplate"("type");
CREATE INDEX IF NOT EXISTS "IncomeTemplate_wallet_idx" ON "IncomeTemplate"("wallet");
CREATE INDEX IF NOT EXISTS "IncomeTemplate_person_idx" ON "IncomeTemplate"("person");

-- 4) Alter Income: add wallet if missing
ALTER TABLE "Income"
  ADD COLUMN IF NOT EXISTS "wallet" TEXT NOT NULL DEFAULT 'SALARIO';

CREATE INDEX IF NOT EXISTS "Income_wallet_idx" ON "Income"("wallet");

-- 5) Alter Transaction: add wallet/tags/normalized
ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "wallet" TEXT NOT NULL DEFAULT 'SALARIO',
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "normalized" TEXT;

CREATE INDEX IF NOT EXISTS "Transaction_wallet_idx" ON "Transaction"("wallet");
