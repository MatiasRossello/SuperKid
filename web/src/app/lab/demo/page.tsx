import { Suspense } from "react";
import DemoLab from "./DemoLab";

// The demo reads today's date (Date.now) while rendering: Suspense makes it render per visit, not at build time.
export default function Page() {
  return (
    <Suspense>
      <DemoLab />
    </Suspense>
  );
}
