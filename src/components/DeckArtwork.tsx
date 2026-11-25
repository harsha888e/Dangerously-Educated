import { useState } from 'react';
import {
  Brain,
  Calculator,
  Clapperboard,
  Compass,
  Gamepad2,
  Gauge,
} from 'lucide-react';
import { CategoryId } from '../types/game';

interface DeckArtworkProps {
  category: CategoryId;
  src: string;
  alt: string;
  className?: string;
}

export function DeckArtwork({
  category,
  src,
  alt,
  className = '',
}: DeckArtworkProps) {
  const [failed, setFailed] = useState(false);

  const renderFallbackIcon = () => {
    switch (category) {
      case 'movies':
        return <Clapperboard className="h-10 w-10 text-amber-400" />;
      case 'games':
        return <Gamepad2 className="h-10 w-10 text-emerald-400" />;
      case 'cars':
        return <Gauge className="h-10 w-10 text-sky-400" />;
      case 'everything':
        return <Compass className="h-10 w-10 text-pink-400" />;
      case 'maths':
        return <Calculator className="h-10 w-10 text-indigo-400" />;
      case 'aptitude':
        return <Brain className="h-10 w-10 text-teal-400" />;
    }
  };

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 ${className}`}
        role="img"
        aria-label={alt}
      >
        {renderFallbackIcon()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
