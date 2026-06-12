import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <Skeleton className="h-7 w-32 mb-6" />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-48 w-full mb-4" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
