"use client";

import { useEffect, useState } from "react";
import { isLocalFormPreview } from "@/components/utils/recaptcha";

export default function useLocalFormPreview() {
  const [preview, setPreview] = useState(false);
  useEffect(() => setPreview(isLocalFormPreview()), []);
  return preview;
}
