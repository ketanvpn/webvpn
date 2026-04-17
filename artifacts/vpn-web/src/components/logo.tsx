export function LogoIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="180" rx="40" fill="#0a1510" />
      <circle cx="90" cy="90" r="72" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.25" />
      <path
        d="M90 28 L150 56 L150 105 Q150 148 90 168 Q30 148 30 105 L30 56 Z"
        fill="#10b981" fillOpacity="0.12" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round"
      />
      <line x1="68" y1="68" x2="68" y2="118" stroke="#10b981" strokeWidth="9" strokeLinecap="round" />
      <line x1="68" y1="93" x2="112" y2="68" stroke="#10b981" strokeWidth="9" strokeLinecap="round" />
      <line x1="68" y1="93" x2="112" y2="118" stroke="#10b981" strokeWidth="9" strokeLinecap="round" />
      <circle cx="90" cy="28" r="5" fill="#10b981" opacity="0.8" />
    </svg>
  );
}

export function LogoBrand({ iconSize = 32 }: { iconSize?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoIcon size={iconSize} />
      <div className="flex flex-col leading-none">
        <span className="font-extrabold text-base tracking-tight text-foreground">KETANTECH</span>
        <span className="text-[10px] font-medium text-primary tracking-widest uppercase">VPN Store</span>
      </div>
    </div>
  );
}
