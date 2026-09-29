import { Skeleton } from '@/components/ui/Skeleton'
export default function Loading() { return <main className="space-y-5 p-6 lg:p-10"><Skeleton className="h-28 w-full"/><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-40"/><Skeleton className="h-40"/><Skeleton className="h-40"/></div><Skeleton className="h-80 w-full"/></main> }
