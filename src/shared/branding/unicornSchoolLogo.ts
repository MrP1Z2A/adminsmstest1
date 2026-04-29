const unicornSchoolLogoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="183" height="77" viewBox="0 0 183 77" fill="none">
  <rect width="183" height="77" rx="22" fill="#121A33"/>
  <rect x="17" y="16" width="44" height="44" rx="14" fill="white"/>
  <path d="M39 23c3.314 0 6 2.686 6 6 0 1.236-.374 2.385-1.015 3.341l3.674 3.674C48.615 35.374 49.764 35 51 35c3.314 0 6 2.686 6 6s-2.686 6-6 6c-1.236 0-2.385-.374-3.341-1.015l-3.674 3.674C44.626 50.615 45 51.764 45 53c0 3.314-2.686 6-6 6s-6-2.686-6-6c0-1.236.374-2.385 1.015-3.341l-3.674-3.674C29.385 46.626 28.236 47 27 47c-3.314 0-6-2.686-6-6s2.686-6 6-6c1.236 0 2.385.374 3.341 1.015l3.674-3.674C33.374 31.385 33 30.236 33 29c0-3.314 2.686-6 6-6z" fill="#68D6CC"/>
  <text x="73" y="49" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700">Unicorn</text>
</svg>
`.trim();

export const UNICORN_SCHOOL_LOGO_DATA_URI = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(unicornSchoolLogoSvg)}`;

export const isUnicornSchoolLogo = (value?: string | null) => String(value || '').trim() === UNICORN_SCHOOL_LOGO_DATA_URI;
