import Subheader from "@/components/subheader/Subheader";
import ExpertMriServices from "./expert-mri-services/ExpertMriServices";
import MobileMri from "./mobile-mri/MobileMri";
import CtServices from "./ct-services/CtServices";

export default function Services() {
    return(
        <>
            <Subheader
                title={['Our ', <span key="1">Services</span>]}
                extraClass="services_bg"
            />
            <MobileMri/>
            <ExpertMriServices/>
            <CtServices/>
        </>
    )
}