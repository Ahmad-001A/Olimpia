export function Notice({ message, type = "error" }: { message?: string; type?: "error" | "success" }) {
  if (!message) return null;
  return <div className={`notice-message notice-${type}`} role={type === "error" ? "alert" : "status"}>{message}</div>;
}
