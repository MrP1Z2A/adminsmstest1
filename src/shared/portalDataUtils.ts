type PublicUrlClient = {
  storage: {
    from: (bucketName: string) => {
      getPublicUrl: (path: string) => {
        data: {
          publicUrl: string;
        };
      };
    };
  };
};

export const REPORT_CARD_BUCKET = 'report_cards';

export const isMissingColumnError = (message?: string | null, columnNames: string[] = []) => {
  const text = String(message || '').toLowerCase();
  if (!/column|schema cache|does not exist/.test(text)) {
    return false;
  }

  if (columnNames.length === 0) {
    return true;
  }

  return columnNames.some((columnName) => text.includes(String(columnName || '').toLowerCase()));
};

export const getStoragePublicUrl = (
  client: PublicUrlClient | null | undefined,
  bucketName: string,
  rawValue?: string | null
) => {
  const candidate = String(rawValue || '').trim();
  if (!client || !candidate) {
    return undefined;
  }

  if (/^https?:\/\//i.test(candidate)) {
    const marker = `/object/public/${bucketName}/`;
    const markerIndex = candidate.indexOf(marker);
    if (markerIndex < 0) {
      return candidate;
    }

    const objectPath = decodeURIComponent(candidate.slice(markerIndex + marker.length).split('?')[0] || '');
    if (!objectPath) {
      return candidate;
    }

    return client.storage.from(bucketName).getPublicUrl(objectPath).data.publicUrl;
  }

  const normalizedPath = candidate.replace(/^\/+/, '');
  const objectPath = normalizedPath.startsWith(`${bucketName}/`)
    ? normalizedPath.slice(bucketName.length + 1)
    : normalizedPath;

  if (!objectPath) {
    return undefined;
  }

  return client.storage.from(bucketName).getPublicUrl(objectPath).data.publicUrl;
};

export const getAchievementDateValue = (row: { achievement_date?: string | null; date?: string | null } | null | undefined) => {
  return row?.achievement_date || row?.date || null;
};

export const deriveFileName = (rawValue?: string | null) => {
  const candidate = String(rawValue || '').trim();
  if (!candidate) {
    return undefined;
  }

  const cleaned = candidate.split('?')[0] || candidate;
  const segments = cleaned.split('/');
  const fileName = segments[segments.length - 1] || '';
  return fileName ? decodeURIComponent(fileName) : undefined;
};
