import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-40 w-full mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  )
}
