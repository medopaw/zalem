/*
  # Make first user admin

  This migration adds a trigger to automatically set the first user as an admin.
*/

CREATE OR REPLACE FUNCTION set_first_user_as_admin()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE role = 'admin'
  ) THEN
    UPDATE users SET role = 'admin' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_set_admin ON public.users;
CREATE TRIGGER on_user_created_set_admin
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION set_first_user_as_admin();