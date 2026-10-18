export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Черновик",
    pending: "На проверке",
    published: "Опубликовано",
    rejected: "Нужно исправить",
    archived: "В архиве",
    submitted: "Завершено",
    timed_out: "Время вышло",
    in_progress: "В процессе",
    approved: "Одобрено",
    declined: "Отклонено",
    rejected_application: "Отклонено",
  };
  return labels[status] ?? status;
}

export function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}
