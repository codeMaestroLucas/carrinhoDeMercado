import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast(durationMs = 3000) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const showToast = useCallback(
    (msg: string) => {
      setMessage(msg);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setMessage(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  return { message, showToast };
}
