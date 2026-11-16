import { Camera } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { buttonClass } from "@/components/ui/field";

/** The detail pane on a large screen when no model or ball is open. A phone does not show it. */
export function PaneHome({ base = "" }: { base?: string }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <LogoMark className="size-12 opacity-90" />
      <p className="font-heading mt-5 text-xl font-semibold">Select a weight to see its balls</p>
      <p className="mt-1.5 max-w-xs text-muted-foreground">
        Each weight in the list opens here, with the serial number and the values of each ball. The list stays in view.
      </p>
      <Link href={`${base}/scan`} className={`${buttonClass.action} mt-6 self-start`}>
        <Camera className="size-5" aria-hidden="true" />
        Scan label
      </Link>
    </div>
  );
}
