import Subheader from "@/components/subheader/Subheader"
import styles from "./parts.module.scss"

export default function Parts() {
    return(
        <>
            <Subheader title="Parts"/>
            <div className={styles.parts_wrap}>
                <h1>Coming Soon!</h1>
            </div>
        </>
    )
}