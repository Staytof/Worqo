import brandLogo from "@/assets/wklogo.png";
import raabertsLogo from "@/assets/logorb.png";

export function BrandSplash() {
  return (
    <div className="brand-splash-surface relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#0153dd]">
      <img
        src={brandLogo}
        alt="Worko"
        className="h-auto w-[min(72vw,300px)] object-contain"
      />

      <img
        src={raabertsLogo}
        alt="Raaberts Softwares"
        className="absolute h-auto w-12 object-contain"
        style={{ bottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
      />
    </div>
  );
}
