import { prospectFromRow, type OutreachProspect } from "@/lib/outreach/funnel";

/** Fictional sample data for logged-out previews and CI. Not real businesses. */
export function fixtureProspects(): OutreachProspect[] {
  const day = (n: number) => new Date(Date.UTC(2026, 9, n, 8, 0)).toISOString();
  const rows = [
    { business: "Example Brokers A (sample)", area: "Benoni", stage: "closed", sent_at: day(1), replied_at: day(2), booked_call1_at: day(2), showed_at: day(5), call2_at: day(8), closed_at: day(8), priority: "A" },
    { business: "Example Brokers B (sample)", area: "Boksburg", stage: "call2", sent_at: day(1), replied_at: day(3), booked_call1_at: day(3), showed_at: day(6), call2_at: day(9), priority: "A" },
    { business: "Example Brokers C (sample)", area: "Germiston", stage: "showed", sent_at: day(2), replied_at: day(3), booked_call1_at: day(4), showed_at: day(7), priority: "A" },
    { business: "Example Brokers D (sample)", area: "Kempton Park", stage: "booked_call1", sent_at: day(2), replied_at: day(4), booked_call1_at: day(4), priority: "B" },
    { business: "Example Brokers E (sample)", area: "Alberton", stage: "lost", sent_at: day(2), replied_at: day(5), booked_call1_at: day(5), lost_at: day(9), priority: "B" },
    { business: "Example Brokers F (sample)", area: "Edenvale", stage: "replied", sent_at: day(3), replied_at: day(6), priority: "A" },
    { business: "Example Brokers G (sample)", area: "Springs", stage: "sent", sent_at: day(3), do_not_contact: true, dnc_reason: "Replied 'no thanks'", priority: "B" },
    { business: "Example Brokers H (sample)", area: "Brakpan", stage: "sent", sent_at: day(4), priority: "A" },
    { business: "Example Brokers I (sample)", area: "Nigel", stage: "sent", sent_at: day(4), priority: "B" },
    { business: "Example Brokers J (sample)", area: "Benoni", stage: "not_contacted", priority: "A" },
    { business: "Example Brokers K (sample)", area: "Bedfordview", stage: "not_contacted", priority: "C", channel: "phone" },
  ];
  return rows.map((row, index) =>
    prospectFromRow({ id: `sample-${index + 1}`, channel: "email", email: "", hook: "Sample hook from the broker's own website.", ...row }),
  );
}
