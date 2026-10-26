import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const LandingNetworkScene = lazy(() =>
  import("./LandingNetworkScene").then((module) => ({ default: module.LandingNetworkScene })),
);

export function LandingNetwork() {
  const [resetKey, setResetKey] = useState(0);
  const fallback = (
    <div className="model-loading" role="status">
      Loading network…
    </div>
  );
  return (
    <div className="landing-model" role="region" aria-label="Interactive AEGIS demo network">
      <div className="landing-model-viewport">
        <ClientOnly fallback={fallback}>
          <Suspense fallback={fallback}>
            <LandingNetworkScene resetKey={resetKey} />
          </Suspense>
        </ClientOnly>
      </div>
      <div className="landing-model-tools">
        <Button
          variant="outline"
          size="icon"
          aria-label="Reset demo view"
          title="Reset demo view"
          onClick={() => setResetKey((key) => key + 1)}
        >
          <RotateCcw size={14} />
        </Button>
      </div>
    </div>
  );
}
