import {
  UtensilsCrossed,
  Bus,
  Home,
  Zap,
  ShoppingBag,
  HeartPulse,
  Film,
  Plane,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from '../lib/types';

const MAP: Record<Category, { icon: LucideIcon; bg: string; fg: string }> = {
  Food:          { icon: UtensilsCrossed, bg: 'bg-orange-100',  fg: 'text-orange-600'  },
  Transport:     { icon: Bus,             bg: 'bg-sky-100',     fg: 'text-sky-600'     },
  Housing:       { icon: Home,            bg: 'bg-emerald-100', fg: 'text-emerald-600' },
  Utilities:     { icon: Zap,             bg: 'bg-yellow-100',  fg: 'text-yellow-600'  },
  Shopping:      { icon: ShoppingBag,     bg: 'bg-pink-100',    fg: 'text-pink-600'    },
  Health:        { icon: HeartPulse,      bg: 'bg-red-100',     fg: 'text-red-600'     },
  Entertainment: { icon: Film,            bg: 'bg-purple-100',  fg: 'text-purple-600'  },
  Travel:        { icon: Plane,           bg: 'bg-indigo-100',  fg: 'text-indigo-600'  },
  Other:         { icon: Tag,             bg: 'bg-ink-100',     fg: 'text-ink-600'     },
};

export function CategoryIcon({ category }: { category: Category }) {
  const { icon: Icon, bg, fg } = MAP[category];
  return (
    <div
      className={`grid place-items-center w-9 h-9 rounded-xl ${bg} ${fg} shrink-0`}
    >
      <Icon size={16} />
    </div>
  );
}
