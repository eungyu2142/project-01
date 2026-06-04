type IconName =
  | 'home'
  | 'reviews'
  | 'pets'
  | 'profile'
  | 'heart'
  | 'search'
  | 'location'
  | 'phone'
  | 'clock'
  | 'plus'
  | 'star'
  | 'calendar'
  | 'pill'
  | 'edit'
  | 'trash'
  | 'chevron'
  | 'mail'
  | 'paw'
  | 'camera'
  | 'mic'
  | 'stop'
  | 'upload'
  | 'sparkles'
  | 'check'
  | 'eye'
  | 'eyeOff'
  | 'x';

interface IconProps {
  name: IconName;
  className?: string;
  filled?: boolean;
}

export function Icon({ name, className = 'h-5 w-5', filled = false }: IconProps) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    className,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...commonProps}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10.5V20h14v-9.5" />
        </svg>
      );
    case 'reviews':
      return (
        <svg {...commonProps}>
          <path d="M4 5h16v10H8l-4 4V5Z" />
        </svg>
      );
    case 'pets':
      return (
        <svg {...commonProps}>
          <path d="M7 14c-2.5 0-4 1.7-4 3.5S4.8 21 7 21c1.6 0 2.6-.9 5-3 2.4 2.1 3.4 3 5 3 2.2 0 4-1.8 4-3.5S19.5 14 17 14c-1.3 0-2.2.4-5 2.5C9.2 14.4 8.3 14 7 14Z" />
          <circle cx="7.5" cy="7" r="2.5" />
          <circle cx="16.5" cy="7" r="2.5" />
          <circle cx="12" cy="4.5" r="2.5" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...commonProps} fill={filled ? 'currentColor' : 'none'}>
          <path d="m12 20-1.2-1C5.4 14.3 2 11.2 2 7.4 2 4.6 4.2 2.5 7 2.5c1.6 0 3.1.7 4 1.9.9-1.2 2.4-1.9 4-1.9 2.8 0 5 2.1 5 4.9 0 3.8-3.4 6.9-8.8 11.6L12 20Z" />
        </svg>
      );
    case 'search':
      return (
        <svg {...commonProps}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case 'location':
      return (
        <svg {...commonProps}>
          <path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...commonProps}>
          <path d="M6.5 3.5h3l1.5 4-2 1.5a15.2 15.2 0 0 0 6 6l1.5-2 4 1.5v3A2.5 2.5 0 0 1 18 20C10 20 4 14 4 6A2.5 2.5 0 0 1 6.5 3.5Z" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7.5v5l3 2" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...commonProps}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'star':
      return (
        <svg {...commonProps}>
          <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.1L12 17.2 6.5 20l1-6.1L3 9.6l6.2-.9L12 3Z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...commonProps}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
    case 'pill':
      return (
        <svg {...commonProps}>
          <path d="m9 15 6-6" />
          <rect x="4" y="9" width="16" height="6" rx="3" transform="rotate(-45 12 12)" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...commonProps}>
          <path d="M4 20h4l10-10-4-4L4 16v4Z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...commonProps}>
          <path d="M4 7h16" />
          <path d="M9 7V4h6v3" />
          <path d="M7 7l1 13h8l1-13" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...commonProps}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case 'paw':
      return (
        <svg {...commonProps}>
          <circle cx="6" cy="9" r="1.8" />
          <circle cx="10" cy="6.5" r="1.8" />
          <circle cx="14" cy="6.5" r="1.8" />
          <circle cx="18" cy="9" r="1.8" />
          <path d="M8 16.5c0-2.2 1.8-4 4-4s4 1.8 4 4c0 1.4-1 2.5-2.2 2.5-.9 0-1.3-.4-1.8-.8-.5.4-.9.8-1.8.8-1.2 0-2.2-1.1-2.2-2.5Z" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...commonProps}>
          <path d="M4 8h3l2-2h6l2 2h3v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      );
    case 'mic':
      return (
        <svg {...commonProps}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
          <path d="M8.5 21h7" />
        </svg>
      );
    case 'stop':
      return (
        <svg {...commonProps}>
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      );
    case 'upload':
      return (
        <svg {...commonProps}>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 20h14" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...commonProps}>
          <path d="m12 3 1.6 4.5L18 9l-4.4 1.5L12 15l-1.6-4.5L6 9l4.4-1.5L12 3Z" />
          <path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
          <path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" />
        </svg>
      );
    case 'check':
      return (
        <svg {...commonProps}>
          <path d="m5 12 4 4 10-10" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...commonProps}>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'eyeOff':
      return (
        <svg {...commonProps}>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
          <path d="M7.3 7.3C4.3 8.8 2.5 12 2.5 12s3.5 6 9.5 6c1.7 0 3.2-.5 4.4-1.2" />
          <path d="M14.1 6.3C19 7.1 21.5 12 21.5 12a15 15 0 0 1-2.2 2.9" />
        </svg>
      );
    case 'x':
      return (
        <svg {...commonProps}>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </svg>
      );
    default:
      return null;
  }
}
