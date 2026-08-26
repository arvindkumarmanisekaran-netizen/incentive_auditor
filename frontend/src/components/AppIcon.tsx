type AppIconName =
  | "alert"
  | "assistant"
  | "calendar"
  | "check"
  | "database"
  | "dna"
  | "file"
  | "folder"
  | "edit"
  | "trash";

type AppIconProps = {
  name: AppIconName;
  className?: string;
  size?: number;
};

const paths: Record<AppIconName, React.ReactNode> = {
  alert: <><path d="M12 3 2.8 19a2 2 0 0 0 1.73 3h14.94a2 2 0 0 0 1.73-3L12 3Z"/><path d="M12 9v5"/><path d="M12 18h.01"/></>,
  assistant: <><path d="M12 2.8 14 8l5.2 2-5.2 2-2 5.2-2-5.2-5.2-2L10 8z"/><path d="m18.2 15 .9 2.2 2.1.8-2.1.9-.9 2.1-.8-2.1-2.2-.9 2.2-.8z"/><circle cx="5.2" cy="17.5" r="1.4"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
  check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
  dna: <><path d="M7 3c0 7 10 11 10 18M17 3C17 10 7 14 7 21M8.5 6h7M7.5 10h9M7.5 14h9M8.5 18h7"/></>,
  file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
  folder: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="M3 10h18"/></>,
  edit: <><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4M4 20l4-1-3-3z"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
};

export default function AppIcon({ name, className = "", size = 20 }: AppIconProps) {
  return (
    <svg
      className={`app-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
