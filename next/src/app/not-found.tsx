import Link from "next/link";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";

export default function NotFoundPage() {
  return (
    <StandardShell>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <span className="text-[48px] text-[#DFFF00]">
          <i className="ri-error-warning-line" aria-hidden="true" />
        </span>
        <h1 className="text-[28px] font-medium text-[#F5F7FC] mt-4">
          Session or Route Not Found
        </h1>
        <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[480px]">
          The requested workspace does not exist or may belong to another session.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <Link href="/">
            <Button variant="primary" icon="ri-home-5-line">
              Return Home
            </Button>
          </Link>
          <Link href="/sessions">
            <Button variant="ghost">View All Sessions</Button>
          </Link>
        </div>
      </div>
    </StandardShell>
  );
}
