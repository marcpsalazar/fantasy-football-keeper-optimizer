const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#047857"/>
  <path fill="#ffffff" d="M18 43c-3.9-8.7-.9-19.6 7.3-25.4 7.5-5.3 17.1-5.1 22.8.2 2.6 7.4-.8 16.4-8.3 21.7C33.1 44.2 24.7 45.4 18 43Z"/>
  <path fill="none" stroke="#047857" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M25 39 45 20M29 26l9 9M24 32l8 8M35 20l8 8"/>
</svg>`;

export function GET() {
  return new Response(iconSvg, {
    headers: {
      "content-type": "image/svg+xml",
    },
  });
}
