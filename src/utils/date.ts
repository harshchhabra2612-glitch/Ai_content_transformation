/**
 * Reusable exact date and time formatter for ERA workspace documents and transformations.
 * Formats timestamps in the user's local timezone.
 * Example output: "Sep 11, 2026 · 03:28 PM"
 */
export function formatExactDateTime(timestamp?: string | Date | number | null): string {
  if (!timestamp) return "Creation time unavailable";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "Creation time unavailable";

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, "0");

  return `${month} ${day}, ${year} · ${formattedHours}:${minutes} ${ampm}`;
}

/**
 * Formats media generation timestamp into ERA standard display format: "15 Sep 2026, 10:42 AM"
 */
export function formatMediaTimestamp(timestamp?: string | Date | number | null): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return String(timestamp);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

