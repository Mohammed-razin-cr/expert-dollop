/**
 * A user's picture, falling back to their initial when they have not set
 * one. Both states draw the same circle at the same size, so a picture
 * appearing or being removed never shifts the layout around it.
 */
export function Avatar({
  src,
  name,
  size,
  className = '',
}: {
  src?: string | null
  name: string
  size: number
  className?: string
}) {
  const initial = name.trim().slice(0, 1).toUpperCase() || '?'

  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-blue-100 font-semibold text-blue-700 ${className}`}
      style={{ height: size, width: size, fontSize: Math.round(size * 0.4) }}
    >
      {src ? (
        // A plain <img> like the rest of the app: the URL is signed and
        // short-lived, which next/image would try to cache and rewrite.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  )
}
