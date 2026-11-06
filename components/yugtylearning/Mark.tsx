/** The YugtyLearning mark: a graduation cap in the Learn amber gradient. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="yl-m" x1="2" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffb02e" />
          <stop offset="1" stopColor="#ff6a2f" />
        </linearGradient>
      </defs>
      <path d="M16 4 2 11l14 7 14-7-14-7Z" fill="url(#yl-m)" />
      <path d="M8 15.5v5.2c0 1.6 3.6 3.8 8 3.8s8-2.2 8-3.8v-5.2L16 20l-8-4.5Z" fill="url(#yl-m)" opacity=".85" />
      <path d="M28 12v9" stroke="#ffd76a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="28" cy="22.5" r="1.8" fill="#ffd76a" />
    </svg>
  );
}
