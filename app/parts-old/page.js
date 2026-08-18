import { permanentRedirect } from "next/navigation";

export default function LegacyPartsPage() {
  permanentRedirect("/parts");
}
