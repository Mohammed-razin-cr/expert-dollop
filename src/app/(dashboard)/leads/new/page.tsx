import Link from "next/link";
import { createClient } from "@/lib/api/server";
import { AddLeadForm } from "@/components/leads/AddLeadForm";

export default async function AddLeadPage() {
  const supabase = await createClient();

  const { data: courses = [] } = await supabase
    .from("courses")
    .select("id,name")
    .order("name");

  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="text-blue-600 hover:underline"
      >
        ← Back to Leads
      </Link>

      <div>
        <h1 className="text-2xl font-bold">
          Add New Lead
        </h1>

        <p className="text-slate-500">
          Enter lead details below.
        </p>
      </div>

      <AddLeadForm courses={courses as any} />
    </div>
  );
}