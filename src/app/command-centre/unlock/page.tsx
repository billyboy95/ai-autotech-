import { redirect } from "next/navigation";

// The CRM password gate was removed; any old unlock link goes straight to the CRM.
export default function UnlockPage() {
  redirect("/command-centre");
}
