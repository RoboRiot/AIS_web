import { permanentRedirect } from "next/navigation";

export default function LegacyPhilipsMobileMriPage() {
  permanentRedirect("/services/mri-service");
}
