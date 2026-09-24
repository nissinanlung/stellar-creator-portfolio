import { FormSkeleton } from '@/components/skeletons/card-skeleton';

export default function Loading() {
  return (
    <div className="container max-w-2xl py-10">
      <FormSkeleton />
    </div>
  );
}
