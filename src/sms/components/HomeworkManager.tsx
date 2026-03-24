import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

type AppClass = {
  id: string;
  name: string;
  school_id?: string | null;
  class_code: string | null;
  image_url: string | null;
  avatar: string | null;
  avatar_url: string | null;
  profile_image_url: string | null;
  color: string | null;
  outer_color: string | null;
};
type AppCourse = {
  id: string;
  class_id: string;
  name: string;
  image_url?: string | null;
  avatar?: string | null;
  avatar_url?: string | null;
  profile_image_url?: string | null;
};
type HomeworkItem = {
  id: string;
  class_id: string;
  class_course_id: string;
  title: string;
  description: string;
  attachment_url: string | null;
  due_date: string | null;
  created_at?: string;
};

type CourseFolder = {
  name: string;
  files_count: number;
};

type CourseFolderFile = {
  name: string;
  path: string;
  url: string;
  size: number;
  updated_at?: string;
};

const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_FOLDER_FILE_SIZE = 50 * 1024 * 1024;
const COURSE_RESOURCES_BUCKET = 'resources';
const FOLDER_MARKER_FILE = '__folder__.pdf';
const isFolderMarker = (name: string) => name === '.keep' || name === FOLDER_MARKER_FILE;
const FOLDER_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp3,.wav,.mp4,.mov,.zip,.rar,.7z,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/json,image/*,audio/*,video/*,application/zip,application/x-rar-compressed,application/x-7z-compressed';

export default function HomeworkManager({ schoolId }: { schoolId: string | undefined }) {
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<AppClass[]>([]);
  const [courses, setCourses] = useState<AppCourse[]>([]);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const [homeworkItems, setHomeworkItems] = useState<HomeworkItem[]>([]);
  const [openHomework, setOpenHomework] = useState<Record<string, boolean>>({});

  const [isLoadingAcademic, setIsLoadingAcademic] = useState(true);
  const [isLoadingHomework, setIsLoadingHomework] = useState(false);
  const [isSavingHomework, setIsSavingHomework] = useState(false);

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingHomeworkId, setEditingHomeworkId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);
  const [existingAttachmentPath, setExistingAttachmentPath] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => Promise<void> | void } | null>(null);
  const [isConfirmActionSubmitting, setIsConfirmActionSubmitting] = useState(false);
  const [courseFolders, setCourseFolders] = useState<CourseFolder[]>([]);
  const [openCourseFolders, setOpenCourseFolders] = useState<Record<string, boolean>>({});
  const [courseFolderFiles, setCourseFolderFiles] = useState<Record<string, CourseFolderFile[]>>({});
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [uploadingFolderName, setUploadingFolderName] = useState<string | null>(null);
  const folderUploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedClass = useMemo(
    () => classes.find(item => item.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const classCourses = useMemo(
    () => courses.filter(item => item.class_id === selectedClassId),
    [courses, selectedClassId]
  );

  const selectedCourse = useMemo(
    () => classCourses.find(item => item.id === selectedCourseId) || null,
    [classCourses, selectedCourseId]
  );

  const courseFolderBasePath = useMemo(() => {
    if (!selectedClassId || !selectedCourseId) return '';
    return `course_folders/${selectedClassId}/${selectedCourseId}`;
  }, [selectedClassId, selectedCourseId]);

  const resolveStorageUrl = (rawValue: unknown, buckets: string[]) => {
    if (typeof rawValue !== 'string') return '';
    const candidate = rawValue.trim();
    if (!candidate) return '';
    if (/^(https?:|data:|blob:)/i.test(candidate)) {
      return candidate;
    }

    const cleanedPath = candidate.replace(/^\/+/, '');
    for (const bucket of buckets) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(cleanedPath);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    }

    return '';
  };

  const guessFileNameFromUrl = (url: string, fallback = 'downloaded-file') => {
    try {
      const parsedUrl = new URL(url);
      const segment = parsedUrl.pathname.split('/').filter(Boolean).pop() || fallback;
      return decodeURIComponent(segment);
    } catch {
      return fallback;
    }
  };

  const downloadFileDirectly = async (url: string, fallbackName?: string) => {
    if (!url) return;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fallbackName || guessFileNameFromUrl(url);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError: any) {
      setError(downloadError?.message || 'Failed to download file.');
    }
  };

  const resolveClassImageUrl = (item: AppClass) => {
    const candidate = item.image_url || item.avatar_url || item.avatar || item.profile_image_url;
    return resolveStorageUrl(candidate, ['class_image', 'course_profile', 'student_profile']);
  };

  const resolveCourseImageUrl = (item: AppCourse) => {
    const candidate = item.image_url || item.avatar_url || item.avatar || item.profile_image_url;
    return resolveStorageUrl(candidate, ['course_profile', 'class_image', 'student_profile']);
  };

  const resolveHomeworkAttachmentUrl = (rawValue: unknown) => {
    const resolved = resolveStorageUrl(rawValue, ['homework_files']);
    return resolved || '';
  };

  const extractHomeworkStoragePath = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const candidate = value.trim();
    if (!candidate) return null;

    if (/^https?:\/\//i.test(candidate)) {
      const marker = '/object/public/homework_files/';
      const markerIndex = candidate.indexOf(marker);
      if (markerIndex >= 0) {
        const remainder = candidate.slice(markerIndex + marker.length).split('?')[0];
        return decodeURIComponent(remainder);
      }
      return null;
    }

    const cleaned = candidate.replace(/^\/+/, '').replace(/^homework_files\//, '');
    return cleaned || null;
  };

  const getAttachmentValueFromRow = (row: any): string | null => {
    const rawValue =
      row?.attachment_url
      ?? row?.attachmentUrl
      ?? row?.file_url
      ?? row?.fileUrl
      ?? row?.document_url
      ?? row?.documentUrl
      ?? row?.attachment
      ?? row?.file_path
      ?? row?.filePath
      ?? null;

    if (!rawValue) return null;
    const asString = String(rawValue);
    return resolveHomeworkAttachmentUrl(asString) || asString;
  };

  const resetComposer = () => {
    setEditingHomeworkId(null);
    setTitle('');
    setBody('');
    setDueDate('');
    setSelectedFile(null);
    setExistingAttachmentUrl(null);
    setExistingAttachmentPath(null);
    setIsComposerOpen(false);
  };

  const clearAttachmentReference = async (homeworkId: string) => {
    const candidatePayloads = [
      { attachment_url: null },
      { file_url: null },
      { document_url: null },
      { file_path: null },
    ];

    let lastError: any = null;

    for (const payload of candidatePayloads) {
      const { error: updateError } = await supabase
        .from('homework_assignments')
        .update(payload)
        .eq('id', homeworkId);

      if (!updateError) {
        return;
      }

      lastError = updateError;
      if (!/column|schema cache|does not exist/i.test(updateError.message || '')) {
        throw updateError;
      }
    }

    if (lastError) {
      throw lastError;
    }
  };

  const deleteAttachmentFile = async (rawReference: string | null) => {
    if (!rawReference) return;
    const storagePath = extractHomeworkStoragePath(rawReference);
    if (!storagePath) return;

    const { error: removeError } = await supabase.storage
      .from('homework_files')
      .remove([storagePath]);

    if (removeError) {
      console.warn('Failed to delete homework file from storage:', removeError.message);
    }
  };

  const openConfirmDialog = (message: string, action: () => Promise<void> | void) => {
    setConfirmDialog({
      message,
      onConfirm: async () => {
        setIsConfirmActionSubmitting(true);
        try {
          await action();
          setConfirmDialog(null);
        } finally {
          setIsConfirmActionSubmitting(false);
        }
      },
    });
  };

  const fetchAcademicData = async () => {
    if (!schoolId) {
      setClasses([]);
      setCourses([]);
      setIsLoadingAcademic(false);
      return;
    }
    setIsLoadingAcademic(true);
    setError(null);

    try {
      let classRows: any[] = [];
      let classError: any = null;

      {
        const result = await supabase
          .from('classes')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });
        classRows = result.data || [];
        classError = result.error;
      }

      if (classError && /created_at|column|schema cache|does not exist/i.test(classError.message || '')) {
        const fallbackClassResult = await supabase
          .from('classes')
          .select('*')
          .eq('school_id', schoolId);
        classRows = fallbackClassResult.data || [];
        classError = fallbackClassResult.error;
      }

      if (classError) {
        throw classError;
      }

      let courseRows: any[] = [];
      let courseError: any = null;

      {
        const result = await supabase
          .from('class_courses')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });
        courseRows = result.data || [];
        courseError = result.error;
      }

      if (courseError && /created_at|column|schema cache|does not exist/i.test(courseError.message || '')) {
        const fallbackCourseResult = await supabase
          .from('class_courses')
          .select('*')
          .eq('school_id', schoolId);
        courseRows = fallbackCourseResult.data || [];
        courseError = fallbackCourseResult.error;
      }

      if (courseError) {
        throw courseError;
      }

      setClasses(
        classRows.map((row: any) => ({
          id: String(row.id),
          school_id: row.school_id ? String(row.school_id) : null,
          name: String(row.name || ''),
          class_code: row.class_code ? String(row.class_code) : null,
          image_url: row.image_url ? String(row.image_url) : null,
          avatar: row.avatar ? String(row.avatar) : null,
          avatar_url: row.avatar_url ? String(row.avatar_url) : null,
          profile_image_url: row.profile_image_url ? String(row.profile_image_url) : null,
          color: row.color ? String(row.color) : null,
          outer_color: row.outer_color ? String(row.outer_color) : null,
        }))
      );

      setCourses(
        courseRows.map((row: any) => ({
          id: String(row.id),
          class_id: String(row.class_id),
          name: String(row.name || ''),
          image_url: row.image_url ? String(row.image_url) : null,
          avatar: row.avatar ? String(row.avatar) : null,
          avatar_url: row.avatar_url ? String(row.avatar_url) : null,
          profile_image_url: row.profile_image_url ? String(row.profile_image_url) : null,
        }))
      );
    } catch (loadError: any) {
      console.error('Failed to load classes/courses:', loadError);
      setError(loadError?.message || 'Failed to load classes and courses.');
    } finally {
      setIsLoadingAcademic(false);
    }
  };

  const fetchHomework = async (classId: string, courseId: string) => {
    if (!classId || !courseId || !schoolId) {
      setHomeworkItems([]);
      setOpenHomework({});
      return;
    }

    setIsLoadingHomework(true);
    setError(null);

    try {
      let rows: any[] = [];
      let fetchError: any = null;
      let bucketFileUrls: string[] = [];

      {
        const result = await supabase
          .from('homework_assignments')
          .select('*')
          .eq('class_id', classId)
          .eq('class_course_id', courseId)
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        rows = result.data || [];
        fetchError = result.error;
      }

      if (fetchError) {
        throw fetchError;
      }

      {
        const folder = `homework/${classId}/${courseId}`;
        const listResult = await supabase.storage
          .from('homework_files')
          .list(folder, {
            limit: 100,
            sortBy: { column: 'created_at', order: 'desc' },
          });

        if (!listResult.error) {
          bucketFileUrls = (listResult.data || [])
            .filter((file: any) => file?.name)
            .map((file: any) => {
              const path = `${folder}/${file.name}`;
              const { data } = supabase.storage.from('homework_files').getPublicUrl(path);
              return data?.publicUrl || '';
            })
            .filter((url: string) => Boolean(url));
        }
      }

      const mappedItems: HomeworkItem[] = rows.map((row: any, index: number) => {
        const dbAttachment = getAttachmentValueFromRow(row);
        const bucketAttachment = bucketFileUrls[index] || null;

        return {
          id: String(row.id),
          class_id: String(row.class_id),
          class_course_id: String(row.class_course_id),
          title: String(row.title || ''),
          description: String(row.description || ''),
          attachment_url: dbAttachment || bucketAttachment,
          due_date: row.due_date ? String(row.due_date) : null,
          created_at: row.created_at ? String(row.created_at) : undefined,
        };
      });

      setHomeworkItems(mappedItems);
      setOpenHomework({});
    } catch (loadError: any) {
      console.error('Failed to load homework:', loadError);
      setError(loadError?.message || 'Failed to load homework for this course.');
      setHomeworkItems([]);
      setOpenHomework({});
    } finally {
      setIsLoadingHomework(false);
    }
  };

  const loadCourseFolders = async () => {
    if (!courseFolderBasePath) {
      setCourseFolders([]);
      setOpenCourseFolders({});
      setCourseFolderFiles({});
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from(COURSE_RESOURCES_BUCKET)
        .list(courseFolderBasePath, { limit: 200 });

      if (error) {
        throw error;
      }

      const folderNames = (data || [])
        .filter((entry: any) => !entry?.id && entry?.name)
        .map((entry: any) => String(entry.name));

      const nextFolders: CourseFolder[] = [];

      for (const folderName of folderNames) {
        const folderPath = `${courseFolderBasePath}/${folderName}`;
        const listResult = await supabase.storage
          .from(COURSE_RESOURCES_BUCKET)
          .list(folderPath, {
            limit: 200,
            sortBy: { column: 'updated_at', order: 'desc' },
          });

        const files = (listResult.data || []).filter((item: any) => item?.name && !isFolderMarker(String(item.name)) && !!item.id);
        nextFolders.push({
          name: folderName,
          files_count: files.length,
        });
      }

      nextFolders.sort((a, b) => a.name.localeCompare(b.name));
      setCourseFolders(nextFolders);
    } catch (folderError: any) {
      console.error('Failed to load course folders:', folderError);
      setError(folderError?.message || 'Failed to load course folders.');
      setCourseFolders([]);
    }
  };

  const createCourseFolder = async () => {
    if (!courseFolderBasePath) {
      setError('Please select class and course first.');
      return;
    }

    const normalizedName = newFolderName.trim().replace(/[\\/:*?"<>|]+/g, '_');
    if (!normalizedName) {
      setError('Please enter a folder name.');
      return;
    }

    setIsCreatingFolder(true);
    setError(null);

    try {
      const keepPath = `${courseFolderBasePath}/${normalizedName}/${FOLDER_MARKER_FILE}`;
      const marker = new Blob([new Uint8Array([37, 80, 68, 70])], { type: 'application/pdf' });

      const uploadResult = await supabase.storage
        .from(COURSE_RESOURCES_BUCKET)
        .upload(keepPath, marker, {
          upsert: true,
          contentType: 'application/pdf',
        });

      if (uploadResult.error) {
        throw uploadResult.error;
      }

      const activeClass = classes.find(c => c.id === selectedClassId);
      const schoolId = activeClass?.school_id || undefined;

      const { data: publicUrlData } = supabase.storage.from(COURSE_RESOURCES_BUCKET).getPublicUrl(keepPath);

      const { error: dbError } = await supabase.from('resources_buckets').insert([{
        school_id: schoolId,
        class_id: selectedClassId,
        class_course_id: selectedCourseId,
        name: normalizedName,
        metadata: { type: 'folder', size: 0 },
        image_url: publicUrlData?.publicUrl || null
      }]);

      if (dbError) {
        console.warn('Failed to log folder creation in resources_buckets:', dbError);
        throw dbError;
      }

      setNewFolderName('');
      await loadCourseFolders();
    } catch (createError: any) {
      console.error('Failed to create folder:', createError);
      setError(createError?.message || 'Failed to create folder.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const loadFilesForFolder = async (folderName: string) => {
    if (!courseFolderBasePath) return;
    const folderPath = `${courseFolderBasePath}/${folderName}`;

    const { data, error } = await supabase.storage
      .from(COURSE_RESOURCES_BUCKET)
      .list(folderPath, {
        limit: 200,
        sortBy: { column: 'updated_at', order: 'desc' },
      });

    if (error) {
      throw error;
    }

    const files = (data || [])
      .filter((item: any) => item?.name && !isFolderMarker(String(item.name)) && !!item.id)
      .map((item: any) => {
        const fullPath = `${folderPath}/${item.name}`;
        const { data: urlData } = supabase.storage.from(COURSE_RESOURCES_BUCKET).getPublicUrl(fullPath);
        return {
          name: String(item.name),
          path: fullPath,
          url: urlData?.publicUrl || '',
          size: Number(item.metadata?.size || 0),
          updated_at: item.updated_at ? String(item.updated_at) : undefined,
        };
      });

    setCourseFolderFiles(prev => ({ ...prev, [folderName]: files }));
  };

  const toggleCourseFolderOpen = async (folderName: string) => {
    const nextOpen = !openCourseFolders[folderName];
    setOpenCourseFolders(prev => ({ ...prev, [folderName]: nextOpen }));
    if (nextOpen) {
      try {
        await loadFilesForFolder(folderName);
      } catch (loadError: any) {
        console.error('Failed to load folder files:', loadError);
        setError(loadError?.message || 'Failed to load folder files.');
      }
    }
  };

  const uploadFilesToFolder = async (folderName: string, files: FileList | null) => {
    if (!courseFolderBasePath || !files?.length) return;

    const fileList = Array.from(files);
    const oversized = fileList.find(file => file.size > MAX_FOLDER_FILE_SIZE);
    if (oversized) {
      setError(`File too large: ${oversized.name}. Max size is 50MB.`);
      return;
    }

    setUploadingFolderName(folderName);
    setError(null);

    try {
      for (const file of fileList) {
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${courseFolderBasePath}/${folderName}/${Date.now()}-${sanitized}`;

        const result = await supabase.storage
          .from(COURSE_RESOURCES_BUCKET)
          .upload(path, file, {
            upsert: false,
            contentType: file.type || undefined,
          });

        if (result.error) {
          throw result.error;
        }

        const activeClass = classes.find(c => c.id === selectedClassId);
        const schoolId = activeClass?.school_id || undefined;

        const { data: publicUrlData } = supabase.storage.from(COURSE_RESOURCES_BUCKET).getPublicUrl(path);

        const { error: dbError } = await supabase.from('resources_buckets').insert([{
          school_id: schoolId,
          class_id: selectedClassId,
          class_course_id: selectedCourseId,
          name: file.name,
          metadata: { type: 'file', size: file.size, mime_type: file.type, folder: folderName },
          image_url: publicUrlData?.publicUrl || null
        }]);

        if (dbError) {
          console.warn('Failed to log file upload in resources_buckets:', dbError);
          throw dbError;
        }
      }

      await loadFilesForFolder(folderName);
      await loadCourseFolders();
    } catch (uploadError: any) {
      console.error('Failed to upload folder files:', uploadError);
      setError(uploadError?.message || 'Failed to upload files.');
    } finally {
      setUploadingFolderName(null);
    }
  };

  const uploadHomeworkFile = async (file: File) => {
    if (!selectedClassId || !selectedCourseId) {
      throw new Error('Select class and course before uploading files.');
    }

    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `homework/${selectedClassId}/${selectedCourseId}/${Date.now()}-${sanitized}`;

    const uploadResult = await supabase
      .storage
      .from('homework_files')
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const publicUrlResult = supabase.storage.from('homework_files').getPublicUrl(path);
    return publicUrlResult.data.publicUrl;
  };

  const handleSaveHomework = async () => {
    if (!selectedClassId || !selectedCourseId) {
      setError('Please select class and course first.');
      return;
    }

    if (!title.trim()) {
      setError('Homework heading is required.');
      return;
    }

    if (!body.trim()) {
      setError('Homework body is required.');
      return;
    }

    if (selectedFile) {
      if (!ALLOWED_FILE_TYPES.has(selectedFile.type)) {
        setError('Only PDF, DOC, and DOCX files are allowed.');
        return;
      }
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError('File must be 15MB or smaller.');
        return;
      }
    }

    setError(null);
    setIsSavingHomework(true);

    try {
      let uploadedUrl: string | null | undefined;
      if (selectedFile) {
        uploadedUrl = await uploadHomeworkFile(selectedFile);
      }

      if (editingHomeworkId) {
        const payload: any = {
          title: title.trim(),
          description: body.trim(),
          due_date: dueDate || null,
          class_name: selectedClass?.name || null,
          course_name: selectedCourse?.name || null,
        };

        if (uploadedUrl !== undefined) {
          payload.attachment_url = uploadedUrl || null;
        } else if (!existingAttachmentUrl) {
          payload.attachment_url = null;
        }

        let updateError: any = null;

        {
          const result = await supabase
            .from('homework_assignments')
            .update(payload)
            .eq('id', editingHomeworkId)
            .eq('school_id', schoolId);
          updateError = result.error;
        }

        if (updateError && /attachment_url|column|schema cache|does not exist/i.test(updateError.message || '')) {
          const { attachment_url, ...payloadWithoutAttachment } = payload;
          const fallbackUpdate = await supabase
            .from('homework_assignments')
            .update(payloadWithoutAttachment)
            .eq('id', editingHomeworkId)
            .eq('school_id', schoolId);
          updateError = fallbackUpdate.error;
        }

        if (updateError) {
          throw updateError;
        }

        if (uploadedUrl && existingAttachmentPath) {
          await deleteAttachmentFile(existingAttachmentPath);
        }
      } else {
        const payload: any = {
          class_id: selectedClassId,
          class_course_id: selectedCourseId,
          title: title.trim(),
          description: body.trim(),
          attachment_url: uploadedUrl || null,
          due_date: dueDate || null,
          class_name: selectedClass?.name || null,
          course_name: selectedCourse?.name || null,
        };

        let insertError: any = null;

        {
          const result = await supabase
            .from('homework_assignments')
            .insert([{ ...payload, school_id: schoolId }]);
          insertError = result.error;
        }

        if (insertError && /attachment_url|column|schema cache|does not exist/i.test(insertError.message || '')) {
          const { attachment_url, ...payloadWithoutAttachment } = payload;
          const fallbackInsert = await supabase
            .from('homework_assignments')
            .insert([payloadWithoutAttachment]);
          insertError = fallbackInsert.error;
        }

        if (insertError) {
          throw insertError;
        }
      }

      await fetchHomework(selectedClassId, selectedCourseId);
      resetComposer();
    } catch (saveError: any) {
      console.error('Failed to save homework:', saveError);
      setError(saveError?.message || 'Failed to save homework.');
    } finally {
      setIsSavingHomework(false);
    }
  };

  const handleEditHomework = (item: HomeworkItem) => {
    setEditingHomeworkId(item.id);
    setTitle(item.title);
    setBody(item.description || '');
    setSelectedFile(null);
    setExistingAttachmentUrl(item.attachment_url || null);
    setExistingAttachmentPath(extractHomeworkStoragePath(item.attachment_url || null));
    setIsComposerOpen(true);
  };

  const handleDeleteAttachmentOnly = async (homeworkId: string, attachmentRef: string | null, keepEditorOpen = false) => {
    openConfirmDialog('Delete this attached file?', async () => {
      setIsSavingHomework(true);
      setError(null);

      try {
        await clearAttachmentReference(homeworkId);
        await deleteAttachmentFile(attachmentRef);

        if (keepEditorOpen) {
          setExistingAttachmentUrl(null);
          setExistingAttachmentPath(null);
        }

        await fetchHomework(selectedClassId, selectedCourseId);
      } catch (deleteError: any) {
        console.error('Failed to delete attachment:', deleteError);
        setError(deleteError?.message || 'Failed to delete attachment.');
      } finally {
        setIsSavingHomework(false);
      }
    });
  };

  const handleDeleteHomework = async (id: string) => {
    openConfirmDialog('Delete this homework item?', async () => {
      setIsSavingHomework(true);
      setError(null);

      try {
        const { error: deleteError } = await supabase
          .from('homework_assignments')
          .delete()
          .eq('id', id);

        if (deleteError) {
          throw deleteError;
        }

        await fetchHomework(selectedClassId, selectedCourseId);
      } catch (deleteError: any) {
        console.error('Failed to delete homework:', deleteError);
        setError(deleteError?.message || 'Failed to delete homework.');
      } finally {
        setIsSavingHomework(false);
      }
    });
  };

  const toggleHomeworkOpen = (id: string) => {
    setOpenHomework(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    void fetchAcademicData();
  }, []);

  useEffect(() => {
    void fetchHomework(selectedClassId, selectedCourseId);
  }, [selectedClassId, selectedCourseId]);

  useEffect(() => {
    void loadCourseFolders();
  }, [courseFolderBasePath]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Homework Manager</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400 font-semibold">Pick class → pick course → create and manage homework.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[48px] p-6 sm:p-8 lg:p-10 shadow-premium space-y-6">
        {error && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {!selectedClassId && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-500">Classes</h3>
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">{classes.length} Class Blocks</span>
            </div>

            {isLoadingAcademic ? (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/30 p-6 text-sm font-bold text-slate-500">
                Loading classes...
              </div>
            ) : classes.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/30 p-8 text-sm font-bold text-slate-500">
                No classes found. Create classes first.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {classes.map(item => {
                  const classImageUrl = resolveClassImageUrl(item);
                  return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedClassId(item.id);
                      setSelectedCourseId('');
                      resetComposer();
                    }}
                    className="group p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left hover:-translate-y-0.5 transition-all"
                  >
                    <div className="w-full aspect-square" style={{ backgroundColor: item.color || item.outer_color || '#f8fafc' }}>
                      {classImageUrl ? (
                        <img src={classImageUrl} alt={item.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-1 bg-white dark:bg-slate-900 mt-2 rounded-xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class</p>
                      <p className="font-black text-sm truncate text-brand-500">{item.name}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {item.class_code || `${item.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'class'}1`}
                      </p>
                    </div>
                  </button>
                )})}
              </div>
            )}
          </>
        )}

        {selectedClassId && !selectedCourseId && (
          <>
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setSelectedClassId('');
                  setSelectedCourseId('');
                  resetComposer();
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 text-xs font-black uppercase tracking-widest"
              >
                Back to Classes
              </button>
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                {selectedClass?.name || 'Selected Class'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-500">Courses</h3>
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">{classCourses.length} Course Blocks</span>
            </div>

            {classCourses.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/30 p-8 text-sm font-bold text-slate-500">
                No courses found for this class.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {classCourses.map(item => {
                  const courseImageUrl = resolveCourseImageUrl(item);
                  return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedCourseId(item.id);
                      setIsComposerOpen(false);
                      setEditingHomeworkId(null);
                    }}
                    className="group p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left hover:-translate-y-0.5 transition-all"
                  >
                    {courseImageUrl ? (
                      <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                        <img src={courseImageUrl} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-xl mb-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">
                        No Image
                      </div>
                    )}
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course</p>
                    <p className="text-sm font-black text-brand-500 mt-1 line-clamp-3">{item.name}</p>
                  </button>
                )})}
              </div>
            )}
          </>
        )}

        {selectedClassId && selectedCourseId && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedCourseId('');
                    resetComposer();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 text-xs font-black uppercase tracking-widest"
                >
                  Back to Courses
                </button>
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {selectedClass?.name} / {selectedCourse?.name}
                </span>
              </div>

              <button
                onClick={() => {
                  if (isComposerOpen && !editingHomeworkId) {
                    resetComposer();
                    return;
                  }
                  setIsComposerOpen(true);
                  if (!editingHomeworkId) {
                    setTitle('');
                    setBody('');
                    setSelectedFile(null);
                    setExistingAttachmentUrl(null);
                    setExistingAttachmentPath(null);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-brand-500 text-white text-xs font-black uppercase tracking-widest"
              >
                {editingHomeworkId ? 'Editing Homework' : isComposerOpen ? 'Close Create Homework' : 'Create Homework'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="w-full aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" style={{ backgroundColor: selectedClass?.color || selectedClass?.outer_color || '#f8fafc' }}>
                  {selectedClass && resolveClassImageUrl(selectedClass) ? (
                    <img src={resolveClassImageUrl(selectedClass)} alt={selectedClass.name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">No Image</div>
                  )}
                </div>
                <div className="p-3 space-y-1 bg-white dark:bg-slate-900 mt-2 rounded-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class</p>
                  <p className="font-black text-sm truncate text-brand-500">{selectedClass?.name || 'Selected Class'}</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {selectedCourse && resolveCourseImageUrl(selectedCourse) ? (
                  <div className="w-full aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <img src={resolveCourseImageUrl(selectedCourse)} alt={selectedCourse.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full aspect-square rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">
                    No Image
                  </div>
                )}
                <div className="p-3 space-y-1 bg-white dark:bg-slate-900 mt-2 rounded-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course</p>
                  <p className="font-black text-sm truncate text-brand-500">{selectedCourse?.name || 'Selected Course'}</p>
                </div>
              </div>
            </div>

            {isComposerOpen && (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 space-y-4 bg-slate-50/80 dark:bg-slate-950/40">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">
                  {editingHomeworkId ? 'Update Homework' : 'Create Homework'}
                </h4>

                <input
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder="Homework heading"
                  className="w-full bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-semibold"
                />

                <textarea
                  value={body}
                  onChange={event => setBody(event.target.value)}
                  placeholder="Homework body"
                  rows={6}
                  className="w-full bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-semibold"
                />

                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due Date (Optional)</p>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Attach PDF / DOC / DOCX</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={event => setSelectedFile(event.target.files?.[0] || null)}
                    className="w-full text-sm"
                  />
                  {selectedFile && (
                    <p className="text-xs font-semibold text-slate-500">Selected: {selectedFile.name}</p>
                  )}
                  {!selectedFile && existingAttachmentUrl && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void downloadFileDirectly(existingAttachmentUrl, 'homework-attachment')}
                        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-500"
                      >
                        <i className="fas fa-paperclip"></i>
                        Download Current Attachment
                      </button>
                      {editingHomeworkId && (
                        <button
                          onClick={() => void handleDeleteAttachmentOnly(editingHomeworkId, existingAttachmentPath || existingAttachmentUrl, true)}
                          disabled={isSavingHomework}
                          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-500 disabled:opacity-60"
                        >
                          <i className="fas fa-trash"></i>
                          Delete Attachment
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => void handleSaveHomework()}
                    disabled={isSavingHomework}
                    className="px-4 py-2.5 rounded-xl bg-brand-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
                  >
                    {isSavingHomework ? 'Saving...' : editingHomeworkId ? 'Update Homework' : 'Create Homework'}
                  </button>

                  <button
                    onClick={resetComposer}
                    disabled={isSavingHomework}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-950/40">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Homework List</h4>
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">{homeworkItems.length} Items</span>
              </div>

              {isLoadingHomework ? (
                <p className="text-sm text-slate-500 font-semibold">Loading homework...</p>
              ) : homeworkItems.length === 0 ? (
                <p className="text-sm text-slate-500 font-semibold">No homework yet for this course.</p>
              ) : (
                <div className="space-y-3">
                  {homeworkItems.map(item => {
                    const isOpen = Boolean(openHomework[item.id]);
                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="flex items-center justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <p className="font-black tracking-tight truncate">{item.title}</p>
                            <p className="text-[11px] uppercase tracking-widest font-black text-slate-400 mt-1">
                              {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditHomework(item)}
                              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500"
                            >
                              <i className="fas fa-pen-to-square text-xs"></i>
                            </button>
                            <button
                              onClick={() => void handleDeleteHomework(item.id)}
                              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500"
                            >
                              <i className="fas fa-trash text-xs"></i>
                            </button>
                            <button
                              onClick={() => toggleHomeworkOpen(item.id)}
                              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500"
                            >
                              <i className={`fas fa-chevron-down text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                            </button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{item.description}</p>
                            {item.attachment_url ? (
                              <div className="flex flex-wrap items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => void downloadFileDirectly(item.attachment_url || '', 'homework-attachment')}
                                  className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-500"
                                >
                                  <i className="fas fa-paperclip"></i>
                                  Download Attachment
                                </button>
                                <button
                                  onClick={() => void handleDeleteAttachmentOnly(item.id, item.attachment_url)}
                                  disabled={isSavingHomework}
                                  className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-500 disabled:opacity-60"
                                >
                                  <i className="fas fa-trash"></i>
                                  Delete Attachment
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs font-semibold text-slate-400">No attachment</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </>
        )}
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-premium">
            <h5 className="text-sm font-black uppercase tracking-widest text-slate-500">Confirm Action</h5>
            <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{confirmDialog.message}</p>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={isConfirmActionSubmitting}
                className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-black uppercase tracking-widest disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDialog.onConfirm()}
                disabled={isConfirmActionSubmitting}
                className="px-4 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
              >
                {isConfirmActionSubmitting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
