export default function Logo({ compact = false, size = "md" }) {
  const box = size === "lg" ? "size-9" : "size-8";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`${box} grid shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm`}
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
          <path
            d="M4 9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-4.2L8 19v-3.1A3 3 0 0 1 4 13z"
            fill="white"
            fillOpacity="0.96"
          />
          <circle cx="9" cy="11" r="1.05" fill="#6d28d9" />
          <circle cx="12" cy="11" r="1.05" fill="#6d28d9" />
          <circle cx="15" cy="11" r="1.05" fill="#6d28d9" />
        </svg>
      </span>
      {!compact && (
        <span className={size === "lg" ? "text-[17px] font-bold" : "text-[15px] font-bold"}>
          Social<span className="text-brand-600 dark:text-brand-400">AI</span>
        </span>
      )}
    </span>
  );
}
