import ServiceRequestForm from "./ServiceRequestForm";

export const metadata = {
  title: "Request Imaging Equipment Service | Advanced Imaging Services",
  description:
    "Request MRI, CT, PET/CT, mammography, X-ray, or nuclear medicine equipment service from Advanced Imaging Services.",
  alternates: {
    canonical: "/service-request",
  },
};

export default function ServiceRequestPage() {
  return <ServiceRequestForm />;
}
