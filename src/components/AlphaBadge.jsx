export default function AlphaBadge({ compact = false }) {
  return <span className={`alpha-badge ${compact ? 'alpha-badge-compact' : ''}`.trim()}>PRIVATE ALPHA</span>;
}
