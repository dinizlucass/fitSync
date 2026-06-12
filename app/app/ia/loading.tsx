import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <Skeleton className="h-7 w-40 mb-2" />
      <Skeleton className="h-4 w-64 mb-6" />
      <Skeleton className="h-10 w-full mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}
