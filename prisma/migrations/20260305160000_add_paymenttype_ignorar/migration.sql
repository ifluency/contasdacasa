DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentType' AND e.enumlabel = 'IGNORAR'
  ) THEN
    ALTER TYPE "PaymentType" ADD VALUE 'IGNORAR';
  END IF;
END $$;
