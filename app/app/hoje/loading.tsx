import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <Skeleton className="h-7 w-48 mb-2" />
      <Skeleton className="h-4 w-32 mb-6" />
      <Skeleton className="h-32 w-full mb-4" />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-24 w-full mb-3" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
