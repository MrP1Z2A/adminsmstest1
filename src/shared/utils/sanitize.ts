import DOMPurify from 'dompurify';

/**
 * Sanitizes a string using DOMPurify to prevent XSS attacks.
 * It removes malicious scripts while preserving safe text.
 * 
 * @param input The raw string input from the user.
 * @returns The sanitized string safe for storage and rendering.
 */
export const sanitizeInput = (input: string | undefined | null): string => {
  if (input === undefined || input === null) {
    return '';
  }
  
  if (typeof input !== 'string') {
    // If it's not a string, we return it as a stringified version (safely)
    return String(input);
  }

  // Use DOMPurify to strip any dangerous HTML/scripts
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // We disallow all tags to make it strict for standard text inputs
    ALLOWED_ATTR: [], // Disallow all attributes
  });
};

/**
 * Sanitizes an object deeply by applying sanitizeInput to all string values.
 * Useful for form data objects before sending to the server/database.
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitizedObj = { ...obj } as Record<string, any>;

  for (const key in sanitizedObj) {
    if (Object.prototype.hasOwnProperty.call(sanitizedObj, key)) {
      const value = sanitizedObj[key];
      
      if (typeof value === 'string') {
        sanitizedObj[key] = sanitizeInput(value);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitizedObj[key] = sanitizeObject(value);
      } else if (Array.isArray(value)) {
        sanitizedObj[key] = value.map(item => 
          typeof item === 'string' ? sanitizeInput(item) : 
          (item && typeof item === 'object' ? sanitizeObject(item) : item)
        );
      }
    }
  }

  return sanitizedObj as T;
};
