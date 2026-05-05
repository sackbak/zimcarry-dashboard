type Props = {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  showZero?: boolean;
};

export function Sparkline({
  values,
  width = 64,
  height = 22,
  color = "#1565c0",
  showZero = false,
}: Props) {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 2) return <span className="text-gray-300">—</span>;

  const min = Math.min(...valid, showZero ? 0 : Math.min(...valid));
  const max = Math.max(...valid, showZero ? 0 : Math.max(...valid));
  const range = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);

  const pts: string[] = [];
  values.forEach((v, i) => {
    if (v == null) return;
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (pts.length < 2) return <span className="text-gray-300">—</span>;

  const last = values[values.length - 1];
  const lastValid = last != null;
  const lastX = (values.length - 1) * stepX;
  const lastY = lastValid ? height - ((last as number - min) / range) * height : null;
  const zeroY = showZero && min < 0 && max > 0 ? height - ((0 - min) / range) * height : null;

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      {zeroY != null && (
        <line
          x1={0}
          x2={width}
          y1={zeroY}
          y2={zeroY}
          stroke="#e5e7eb"
          strokeDasharray="2 2"
          strokeWidth={1}
        />
      )}
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {lastY != null && (
        <circle cx={lastX} cy={lastY} r={2} fill={color} />
      )}
    </svg>
  );
}
