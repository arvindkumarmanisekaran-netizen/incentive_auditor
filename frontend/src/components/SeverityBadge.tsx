interface Props {
  severity?: string;
}

export default function SeverityBadge({ severity }: Props) {
  const value = severity ?? "UNKNOWN";

  return <span className={`severity-badge ${value.toLowerCase()}`}>{value}</span>;
}
