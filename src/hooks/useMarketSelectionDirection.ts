import { useEffect, useRef, useState } from 'react';

export function useMarketSelectionDirection(
  selectedIndex: number,
): 'forward' | 'backward' {
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const prevIndexRef = useRef<number>(selectedIndex);

  useEffect(() => {
    if (selectedIndex !== prevIndexRef.current && selectedIndex !== -1) {
      setDirection(selectedIndex >= prevIndexRef.current ? 'forward' : 'backward');
      prevIndexRef.current = selectedIndex;
    }
  }, [selectedIndex]);

  return direction;
}
