import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <Skeleton className="h-7 w-40 mb-6" />
      <Skeleton className="h-36 w-full mb-4" />
      <Skeleton className="h-48 w-full mb-4" />
      <Skeleton className="h-28 w-full" />
    </div>
  )
}
