import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';

const links = [
  { to: '/', label: '홈', icon: 'home' as const },
  { to: '/reviews', label: '리뷰', icon: 'reviews' as const },
  { to: '/mypets', label: '마이 펫', icon: 'pets' as const },
  { to: '/profile', label: 'user', icon: 'profile' as const },
];

export function BottomNav() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-0">
      <nav className="pointer-events-auto grid h-[5.5rem] w-full max-w-md grid-cols-4 border-t border-emerald-100/80 bg-[linear-gradient(180deg,_rgba(230,255,245,0.97),_rgba(186,241,224,0.98))] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(15,118,110,0.10)] backdrop-blur sm:rounded-b-[2.5rem]">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex h-full flex-col items-center justify-center gap-1 rounded-2xl px-2 text-xs font-medium text-[#064e3b] transition ${
                isActive ? 'bg-white/45' : ''
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`rounded-full p-2 ${
                    isActive ? 'bg-white text-[#064e3b] shadow-sm' : 'bg-transparent text-[#064e3b]'
                  }`}
                >
                  <Icon name={link.icon} className="h-5 w-5" />
                </span>
                <span>{link.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
