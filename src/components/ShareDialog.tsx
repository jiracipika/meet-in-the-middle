"use client";
import { useEffect, useRef } from "react";
export default function ShareDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onClose={onClose} className="share-dialog" aria-labelledby="share-title">
    <h2 id="share-title">Your plan, ready to share</h2><p>Copy this link to invite your friends. It includes their names and locations.</p>
    <input autoFocus readOnly aria-label="Plan link" value={url} onFocus={e => e.target.select()} />
    <form method="dialog"><button className="button primary">Done</button></form>
  </dialog>;
}
