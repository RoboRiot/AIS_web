"use client"
import React, {useEffect, useState } from 'react';
import styles from "./SidebarfoundYourPart.module.scss";
import { db } from '@/firebase/Firebase';

export default function SidebarFoundYourPart() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [partNumber, setPartNumber] = useState("");
    const [message, setMessage] = useState("");
    const [feedbackMessage, setFeedbackMessage] = useState("");
    const [isError, setIsError] = useState(false);

    // useEffect(() => {
    //     // Load reCAPTCHA script dynamically when the component mounts
    //     const script = document.createElement('script');
    //     script.src = `https://www.google.com/recaptcha/api.js?render=6LcmZyIqAAAAAIztRJsHyudfi22qgQzTvkSVm82X`; // Replace with your site key
    //     script.async = true;
    //     script.defer = true;
    //     document.head.appendChild(script);

    //     return () => {
    //         document.head.removeChild(script);
    //     };
    // }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Execute reCAPTCHA and get the token
        // const token = await new Promise((resolve) => {
        //     if (typeof grecaptcha !== 'undefined') {
        //         grecaptcha.execute().then(resolve);
        //     } else {
        //         console.error('reCAPTCHA not loaded');
        //         resolve(null);
        //     }
        // });

        // if (!token) {
        //     setIsError(true);
        //     setFeedbackMessage("Error with reCAPTCHA. Please try again.");
        //     return;
        // }

        try {
            await db.collection("mail").add({
                to: process.env.emailAccount,
                message: {
                    subject: `Part Request Form | Advanced Imaging`,
                    text: message,
                    email: email,
                    partNumber: partNumber,
                    html: `<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" mc:repeatable="product-name-1"><tr><td height="50px"></td></tr><tr><td align="center"><table align="center" bgcolor="#f7f7f7" cellpadding="0" cellspacing="0" width="600" style="border-radius:10px"><tr><td><table align="center" border="0" cellpadding="0" cellspacing="0" width="500"><tr><td height="30"></td></tr><tr><td align="center" width="100%" style="padding:0 15px"><a target="_blank" href="https://advanced-imaging.vercel.app/"><img width="250px" src="https://frontend.development-env.com/advancedimaging/logo.png" alt="logo"></a></td></tr><tr><td height="30"></td></tr><tr><td align="left" style="color:#000;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;letter-spacing:1px"><table align="left" border="1" cellpadding="0" cellspacing="0" width="500" style="border-radius:10px;padding:10px 0"><tr><th align="left" style="font-size:13px;border:none;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;color:#000;width:30%;padding:10px 20px">Name:</th><td align="left" style="font-size:13px;border:none;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;color:#000;padding:10px 20px">${name}</td></tr><tr><th align="left" style="font-size:13px;border:none;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;color:#000;width:30%;padding:10px 20px">Email Address:</th><td style="font-size:13px;border:none;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;color:#000;padding:10px 20px">${email}</td></tr><tr><th align="left" style="font-size:13px;border:none;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;color:#000;width:30%;padding:10px 20px">Part Number:</th><td style="font-size:13px;border:none;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;color:#000;padding:10px 20px">${partNumber}</td></tr><tr><th align="left" style="font-size:13px;border:none;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;color:#000;width:30%;padding:10px 20px">Message:</th><td style="font-size:13px;border:none;font-family:'Segoe UI',sans-serif,Arial,Helvetica,Lato;color:#000;padding:10px 20px">${message}</td></tr></table></td></tr></table></td></tr><tr><td height="40"></td></tr></table></td></tr></table>`,
                },
                // token,
            });
            setIsError(false);
            setFeedbackMessage("Thank you! We have received your message. We will contact you soon.");
        } catch (error) {
            console.error("Error sending email: ", error);
            setIsError(true);
            setFeedbackMessage("Error sending email. Please try again.");
        }

        setName("");
        setEmail("");
        setMessage("");
        setPartNumber("");
        // closeModal();
    };
    return(
        <>
            <div className={styles.side_found_part}>
                <div className="container">
                    <h2>Haven’t found your item yet?</h2>
                    <p>Let us know what you are looking for.</p>
                    <form className="flex w-100" onSubmit={handleSubmit}>
                        <ul className="list-none">
                            <li>
                                <input placeholder="Name" type='text'
                                    value={name}
                                    pattern=".{3,}"
                                    title="Please enter at least 3 characters"
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </li>
                            <li><input placeholder="Email" type="email"
                                        value={email}
                                        name="email"
                                        id="email"
                                        pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                                        title="Please enter valid email address"
                                        onChange={(e) => setEmail(e.target.value)}
                                        required/></li>
                            <li><input placeholder="Part Number" type="text"
                                        value={partNumber}
                                        onChange={(e) => setPartNumber(e.target.value)}
                                        required/></li>
                        <li><textarea placeholder="Message" type="text"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        required></textarea></li>
                            <li><button type="submit" className="simple-btn">Send</button></li>
                        </ul>
                    </form>
                    {feedbackMessage && 
                        <div className={isError ? 'response error' : 'response'}>
                            {
                                isError ?
                                <svg width="800px" height="800px" viewBox="-0.5 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.5C17.1086 21.5 21.25 17.3586 21.25 12.25C21.25 7.14137 17.1086 3 12 3C6.89137 3 2.75 7.14137 2.75 12.25C2.75 17.3586 6.89137 21.5 12 21.5Z" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path id="inner" d="M12.9309 8.15005C12.9256 8.39231 12.825 8.62272 12.6509 8.79123C12.4767 8.95974 12.2431 9.05271 12.0008 9.05002C11.8242 9.04413 11.6533 8.98641 11.5093 8.884C11.3652 8.7816 11.2546 8.63903 11.1911 8.47415C11.1275 8.30927 11.1139 8.12932 11.152 7.95675C11.19 7.78419 11.278 7.6267 11.405 7.50381C11.532 7.38093 11.6923 7.29814 11.866 7.26578C12.0397 7.23341 12.2192 7.25289 12.3819 7.32181C12.5446 7.39072 12.6834 7.506 12.781 7.65329C12.8787 7.80057 12.9308 7.97335 12.9309 8.15005ZM11.2909 16.5301V11.1501C11.2882 11.0556 11.3046 10.9615 11.3392 10.8736C11.3738 10.7857 11.4258 10.7057 11.4922 10.6385C11.5585 10.5712 11.6378 10.518 11.7252 10.4822C11.8126 10.4464 11.9064 10.4286 12.0008 10.43C12.094 10.4299 12.1863 10.4487 12.272 10.4853C12.3577 10.5218 12.4352 10.5753 12.4997 10.6426C12.5642 10.7099 12.6143 10.7895 12.6472 10.8767C12.6801 10.9639 12.6949 11.0569 12.6908 11.1501V16.5301C12.6908 16.622 12.6727 16.713 12.6376 16.7979C12.6024 16.8828 12.5508 16.96 12.4858 17.025C12.4208 17.09 12.3437 17.1415 12.2588 17.1767C12.1738 17.2119 12.0828 17.23 11.9909 17.23C11.899 17.23 11.8079 17.2119 11.723 17.1767C11.6381 17.1415 11.5609 17.09 11.4959 17.025C11.4309 16.96 11.3793 16.8828 11.3442 16.7979C11.309 16.713 11.2909 16.622 11.2909 16.5301Z" fill="#000000"/></svg>:
                                <svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12.6111L8.92308 17.5L20 6.5" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            }
                            {feedbackMessage}
                        </div>
                    }
                </div>
            </div>
        </>
    )
}