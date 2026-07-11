export function SkeletonText({ width = '100%', height = 14 }: { width?: string; height?: number }) {
  return (
    <div
      className="sg-skeleton"
      style={{ width, height, borderRadius: 4 }}
    />
  );
}

export function SkeletonBlock({ width = '100%', height = 100 }: { width?: string; height?: number }) {
  return (
    <div
      className="sg-skeleton"
      style={{ width, height, borderRadius: 12 }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="sg-skeleton-card">
      <SkeletonBlock height={140} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SkeletonText width="70%" height={16} />
        <SkeletonText width="50%" height={13} />
      </div>
    </div>
  );
}

export function SkeletonEventList() {
  return (
    <div className="sg-event-grid" style={{ opacity: 0.5 }}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div style={{ opacity: 0.5 }}>
      <SkeletonBlock height={80} />
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <div className="sg-skeleton" style={{ width: 130, height: 36, borderRadius: 8 }} />
        <div className="sg-skeleton" style={{ width: 100, height: 36, borderRadius: 8 }} />
        <div className="sg-skeleton" style={{ width: 160, height: 36, borderRadius: 8 }} />
      </div>
      <div style={{ marginTop: 16 }}>
        <SkeletonBlock height={240} />
      </div>
    </div>
  );
}

export function SkeletonSignerList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.5 }}>
      <div className="sg-skeleton" style={{ width: '100%', height: 56, borderRadius: 12 }} />
      <div className="sg-skeleton" style={{ width: '100%', height: 56, borderRadius: 12 }} />
      <div className="sg-skeleton" style={{ width: '100%', height: 56, borderRadius: 12 }} />
      <div className="sg-skeleton" style={{ width: '100%', height: 56, borderRadius: 12 }} />
      <div className="sg-skeleton" style={{ width: '100%', height: 56, borderRadius: 12 }} />
    </div>
  );
}
