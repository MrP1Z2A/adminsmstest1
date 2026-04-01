-- Add missing columns to students table for enhanced profiles
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT; -- Ensuring it exists as it was in schema list but good to be sure
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE; -- Ensuring it exists
