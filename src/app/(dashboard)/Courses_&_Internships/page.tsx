import { createClient } from '@/lib/api/server'
import { ProgramsManager, type ProgramRow } from '@/components/programs/ProgramsManager'

export default async function ProgramsPage() {
  const supabase = await createClient()
  const { data: rows = [] } = await supabase
    .from('leads')
    .select(`
      id,
      name,
      mobile,
      email,
      college,
      status,
      enquiry_date,
      created_at,
      courses (
        id,
        name
      )
    `)
    // The board shows the enquiry date, so it sorts on the same column —
    // ordering on created_at instead made an ordered list look shuffled.
    // Leads with no enquiry date fall to the end rather than the top.
    .order('enquiry_date', { ascending: false, nullsFirst: false })
    .range(0, 4999)
    .is('deleted_at', null)

  return <ProgramsManager rows={(rows ?? []) as unknown as ProgramRow[]} />
}
