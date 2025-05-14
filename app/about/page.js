import Subheader from "@/components/subheader/Subheader";
import MriExperts from "./mri_experts/MriExperts";
import HowWeAre from "./how_we_are/HowWeAre";
import WhatWeDev from "./what_we_dev/WhatWeDev";
import Expansion from "./expansion/Expansion";

export default function About() {
  return (
    <>
      <Subheader
        title={['About ', <span key="1">Us</span>]}
        extraClass="about_bg"
      />
      <MriExperts/>
      <HowWeAre/>
      <WhatWeDev/>
      <Expansion/>
    </>
  );
}
