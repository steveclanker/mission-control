import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <div className="border-b p-4">
          <Skeleton className="h-4 w-[250px]" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
              <Skeleton className="h-4 w-[100px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
        </div>
        <Skeleton className="h-[200px] w-full" />
        <div className="flex justify-center space-x-4">
          <Skeleton className="h-3 w-[60px]" />
          <Skeleton className="h-3 w-[60px]" />
          <Skeleton className="h-3 w-[60px]" />
        </div>
      </div>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-8 w-[80px]" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="mt-4">
            <Skeleton className="h-3 w-[120px]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function LoadingSpinner({ size = "default" }: { size?: "sm" | "default" | "lg" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-6 w-6", 
    lg: "h-8 w-8"
  }
  
  return (
    <div className="flex justify-center items-center p-4">
      <div className={cn("animate-spin rounded-full border-2 border-primary border-t-transparent", sizeClasses[size])} />
    </div>
  )
}

export { 
  Skeleton, 
  CardSkeleton, 
  TableSkeleton, 
  ChartSkeleton, 
  StatsSkeleton, 
  LoadingSpinner 
}