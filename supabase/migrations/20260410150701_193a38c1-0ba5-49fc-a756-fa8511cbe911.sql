
-- Enable pgcrypto extension in the extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Create helper function to encrypt a token
CREATE OR REPLACE FUNCTION public.encrypt_token(plain_text text, encryption_key text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(plain_text, encryption_key)::bytea, 'base64');
END;
$$;

-- Create helper function to decrypt a token
CREATE OR REPLACE FUNCTION public.decrypt_token(cipher_text text, encryption_key text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(cipher_text, 'base64')::bytea, encryption_key);
END;
$$;

-- Remove the one-to-one unique constraint on user_id to allow multiple accounts per user
ALTER TABLE public.email_accounts DROP CONSTRAINT IF EXISTS email_accounts_user_id_key;

-- Add a unique constraint on (user_id, email) to prevent duplicate accounts
ALTER TABLE public.email_accounts ADD CONSTRAINT email_accounts_user_email_unique UNIQUE (user_id, email);
