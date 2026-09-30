import { Construction } from 'lucide-react'

export default async function ModulePlaceholder({
  params,
}: {
  params: Promise<{ module: string[] }>
}) {
  const { module } = await params
  const name = (module?.[0] ?? 'Module')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="grid h-full place-items-center">
      <div className="text-center">
        <Construction className="mx-auto h-10 w-10 text-slate-300" />
        <h1 className="mt-3 text-lg font-semibold text-slate-800">{name}</h1>
        <p className="mt-1 text-sm text-slate-500">Scheduled for an upcoming sprint.</p>
      </div>
    </div>
  )
}
