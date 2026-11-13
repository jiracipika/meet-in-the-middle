/** Decorative animated backdrop: drifting hue-shifting blobs over a grid. */
export default function Background() {
  return (
    <div aria-hidden className="mitm-bg">
      <div className="mitm-blob mitm-blob-1" />
      <div className="mitm-blob mitm-blob-2" />
      <div className="mitm-blob mitm-blob-3" />
      <div className="mitm-grid" />
    </div>
  );
}
