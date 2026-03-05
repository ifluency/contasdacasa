-- 1) Category table
CREATE TABLE IF NOT EXISTS "Category" (
  "id" TEXT NOT NULL,
  "groupName" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "person" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Category_groupName_idx" ON "Category"("groupName");
CREATE INDEX IF NOT EXISTS "Category_person_idx" ON "Category"("person");

-- 2) Income table
CREATE TABLE IF NOT EXISTS "Income" (
  "id" TEXT NOT NULL,
  "person" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "monthKey" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Income_monthKey_idx" ON "Income"("monthKey");
CREATE INDEX IF NOT EXISTS "Income_person_idx" ON "Income"("person");
CREATE INDEX IF NOT EXISTS "Income_type_idx" ON "Income"("type");

-- 3) Alter Transaction: add columns
ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "monthKey" TEXT,
  ADD COLUMN IF NOT EXISTS "person" TEXT NOT NULL DEFAULT 'AMBOS',
  ADD COLUMN IF NOT EXISTS "paymentType" TEXT NOT NULL DEFAULT 'DEBITO_PIX',
  ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "installmentCurrent" INTEGER,
  ADD COLUMN IF NOT EXISTS "installmentTotal" INTEGER;

-- Backfill monthKey for existing rows (use occurredAt UTC month)
UPDATE "Transaction"
SET "monthKey" = to_char("occurredAt", 'YYYY-MM')
WHERE "monthKey" IS NULL;

ALTER TABLE "Transaction"
  ALTER COLUMN "monthKey" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Transaction_monthKey_idx" ON "Transaction"("monthKey");
CREATE INDEX IF NOT EXISTS "Transaction_person_idx" ON "Transaction"("person");
CREATE INDEX IF NOT EXISTS "Transaction_paymentType_idx" ON "Transaction"("paymentType");
CREATE INDEX IF NOT EXISTS "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_categoryId_fkey'
  ) THEN
    ALTER TABLE "Transaction"
      ADD CONSTRAINT "Transaction_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
