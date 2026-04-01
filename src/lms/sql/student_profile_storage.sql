-- Ensure the student_profile bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('student_profile', 'student_profile', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public upload to the student_profile bucket
DROP POLICY IF EXISTS "Allow student profile upload" ON storage.objects;
CREATE POLICY "Allow student profile upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'student_profile');

-- Allow public download from the student_profile bucket
DROP POLICY IF EXISTS "Allow student profile download" ON storage.objects;
CREATE POLICY "Allow student profile download" ON storage.objects 
FOR SELECT USING (bucket_id = 'student_profile');

-- Allow update/overwrite of profile images
DROP POLICY IF EXISTS "Allow student profile update" ON storage.objects;
CREATE POLICY "Allow student profile update" ON storage.objects 
FOR UPDATE USING (bucket_id = 'student_profile');
