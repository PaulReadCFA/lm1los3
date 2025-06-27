export function Card({ children }) {
  return <div className="rounded-xl border border-gray-300 bg-white p-4 shadow">{children}</div>;
}

export function CardContent({ children }) {
  return <div className="space-y-4">{children}</div>;
}