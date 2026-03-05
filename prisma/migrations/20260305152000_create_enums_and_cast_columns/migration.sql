-- Create missing enum types used by Prisma (PostgreSQL native enums)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Person') THEN
    CREATE TYPE "Person" AS ENUM ('PEDRO', 'MIRELA', 'AMBOS');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentType') THEN
    CREATE TYPE "PaymentType" AS ENUM ('DEBITO_PIX', 'CREDITO_A_VISTA', 'PARCELADO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Wallet') THEN
    CREATE TYPE "Wallet" AS ENUM ('SALARIO', 'VALE_ALIMENTACAO', 'OUTROS');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncomeType') THEN
    CREATE TYPE "IncomeType" AS ENUM ('SALARIO', 'VALE_ALIMENTACAO', 'OUTROS', 'RESTANTE_MES_ANTERIOR');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RuleTarget') THEN
    CREATE TYPE "RuleTarget" AS ENUM ('TRANSACTION', 'INCOME');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RuleMatchType') THEN
    CREATE TYPE "RuleMatchType" AS ENUM ('CONTAINS', 'STARTS_WITH', 'REGEX');
  END IF;
END $$;

-- Cast existing TEXT columns to enum types where applicable.

-- Category.person
ALTER TABLE "Category"
  ALTER COLUMN "person" TYPE "Person"
  USING CASE
    WHEN "person" IS NULL OR "person" = '' THEN NULL
    ELSE "person"::"Person"
  END;

-- Transaction enums
ALTER TABLE "Transaction"
  ALTER COLUMN "person" TYPE "Person" USING "person"::"Person";

ALTER TABLE "Transaction"
  ALTER COLUMN "paymentType" TYPE "PaymentType" USING "paymentType"::"PaymentType";

ALTER TABLE "Transaction"
  ALTER COLUMN "wallet" TYPE "Wallet" USING "wallet"::"Wallet";

-- Income enums
ALTER TABLE "Income"
  ALTER COLUMN "person" TYPE "Person" USING "person"::"Person";

ALTER TABLE "Income"
  ALTER COLUMN "type" TYPE "IncomeType" USING "type"::"IncomeType";

ALTER TABLE "Income"
  ALTER COLUMN "wallet" TYPE "Wallet" USING "wallet"::"Wallet";

-- IncomeTemplate enums
ALTER TABLE "IncomeTemplate"
  ALTER COLUMN "person" TYPE "Person" USING "person"::"Person";

ALTER TABLE "IncomeTemplate"
  ALTER COLUMN "type" TYPE "IncomeType" USING "type"::"IncomeType";

ALTER TABLE "IncomeTemplate"
  ALTER COLUMN "wallet" TYPE "Wallet" USING "wallet"::"Wallet";

-- Rule enums
ALTER TABLE "Rule"
  ALTER COLUMN "target" TYPE "RuleTarget" USING "target"::"RuleTarget";

ALTER TABLE "Rule"
  ALTER COLUMN "matchType" TYPE "RuleMatchType" USING "matchType"::"RuleMatchType";

ALTER TABLE "Rule"
  ALTER COLUMN "person" TYPE "Person"
  USING CASE
    WHEN "person" IS NULL OR "person" = '' THEN NULL
    ELSE "person"::"Person"
  END;

ALTER TABLE "Rule"
  ALTER COLUMN "paymentType" TYPE "PaymentType"
  USING CASE
    WHEN "paymentType" IS NULL OR "paymentType" = '' THEN NULL
    ELSE "paymentType"::"PaymentType"
  END;

ALTER TABLE "Rule"
  ALTER COLUMN "wallet" TYPE "Wallet"
  USING CASE
    WHEN "wallet" IS NULL OR "wallet" = '' THEN NULL
    ELSE "wallet"::"Wallet"
  END;

ALTER TABLE "Rule"
  ALTER COLUMN "incomeType" TYPE "IncomeType"
  USING CASE
    WHEN "incomeType" IS NULL OR "incomeType" = '' THEN NULL
    ELSE "incomeType"::"IncomeType"
  END;
