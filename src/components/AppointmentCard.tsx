"use client";

import Link from "next/link";
import type { AppointmentDTO } from "@/lib/bookings";

const STATUS_LABEL: Record<string, string> = {
  BOOKED: "Booked",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

interface Props {
  a: AppointmentDTO;
  onCancel?: () => void;
  onDelete?: () => void;
  busy?: boolean;
}

export default function AppointmentCard({ a, onCancel, onDelete, busy }: Props) {
  const removable = a.status === "CANCELLED" || a.isPast;
  return (
    <div className="card">
      <div className="spread">
        <div>
          <h3 style={{ margin: 0 }}>{a.dateLabel}</h3>
          <div className="muted">{a.timeLabel}</div>
        </div>
        <StatusBadge status={a.status} />
      </div>
      <ul style={{ paddingLeft: 18, margin: "12px 0" }}>
        {a.items.map((i) => (
          <li key={i.id}>
            {i.name} <span className="muted small">— {i.priceLabel}</span>
          </li>
        ))}
      </ul>
      <div className="small muted">
        {a.locationType === "HOME" ? `At home · ${a.address}, ${a.postalCode}` : "In studio"} · Stylist: {a.stylist?.name ?? "TBA"}
      </div>
      <div className="small" style={{ marginTop: 4 }}>
        Estimated total: <strong>{a.totalLabel}</strong>
        {a.travelFeeLabel && <span className="muted"> (incl. {a.travelFeeLabel} travel)</span>}
      </div>
      {a.notes && <div className="small muted" style={{ marginTop: 4 }}>Notes: {a.notes}</div>}
      <div className="row" style={{ marginTop: 14 }}>
        {a.canChange && <Link className="btn btn-sm" href={`/account/appointments/${a.id}`}>Reschedule</Link>}
        {a.canCancel && onCancel && <button className="btn btn-sm btn-danger" disabled={busy} onClick={onCancel}>Cancel</button>}
        {!a.isPast && a.status !== "CANCELLED" && (
          <a className="btn btn-sm btn-ghost" href={`/api/appointments/${a.id}/ics`}>Add to calendar</a>
        )}
        {(a.status === "COMPLETED" || (a.isPast && a.isActive)) && (
          <Link className="btn btn-sm btn-gold" href={`/account/feedback?appointment=${a.id}`}>★ Rate this visit</Link>
        )}
        {removable && onDelete && <button className="btn btn-sm btn-ghost" disabled={busy} onClick={onDelete}>Delete</button>}
        {!a.canCancel && !a.isPast && a.status !== "CANCELLED" && (
          <span className="small muted">Within 12 h of your visit — please call us to make changes.</span>
        )}
      </div>
    </div>
  );
}
