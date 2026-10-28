import {
  BUSINESS_PHONE, BUSINESS_PHONE_HREF, SUPPORT_PHONE, SUPPORT_PHONE_HREF,
} from "@/app/data/businessContact.mjs";
import styles from "./CustomerPhoneLinks.module.scss";

export default function CustomerPhoneLinks({ inline = false }) {
  return (
    <div className={`${styles.phones} ${inline ? styles.inline : ""}`}>
      <div>
        <span className={styles.label}>New Customers</span>
        <a data-ais-call-source="true" href={BUSINESS_PHONE_HREF}>{BUSINESS_PHONE}</a>
      </div>
      <div>
        <span className={styles.label}>Existing Customers</span>
        <a href={SUPPORT_PHONE_HREF}>{SUPPORT_PHONE}</a>
      </div>
    </div>
  );
}
