import styles from "./subheader.module.scss"

export default function Subheader(props) {
    return (
        <>
            <div className={`${styles.subheader_wrapper} ${styles[props.extraClass]}`}>
                <div className="container">
                    <h1>{props.title}</h1>
                </div>
            </div>
        </>
    )
}