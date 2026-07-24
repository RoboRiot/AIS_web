import Image from "next/image"
import styles from "./homeCard.module.scss"
import homeCardList from "./homeCardList.json"

export default function HomeCard() {
    return(
        <>
            <div className={`card_wrapper ${styles.card_wrapper}`}>
                <div className="container">
                    <div className={styles.card_list}>
                        <ul className="list-none flex">
                            {
                                homeCardList.map(({IconImage,BoxText}, index)=>{
                                    return(
                                        <li key={`card-${index}`} data-aos="fade-up">
                                            <div className={`flex items-center justify-start direction-column ${styles.card_box}`}>
                                                <Image width={80} height={80} src={IconImage} alt="icon" />
                                                <span>{BoxText}</span>
                                            </div>
                                        </li>
                                    )
                                })
                            }
                        </ul>
                    </div>
                </div>
            </div>
        </>
    )
}
