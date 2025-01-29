import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/Firebase';

export default function RequestModal({ closeModal }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [partNumber, setPartNumber] = useState("");
    const [message, setMessage] = useState("");
    const [feedbackMessage, setFeedbackMessage] = useState("");
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        setPartNumber(JSON.parse(localStorage.getItem('product')).PN);

        // Load reCAPTCHA script dynamically when the component mounts
        // const script = document.createElement('script');
        // script.src = `https://www.google.com/recaptcha/api.js?render=6LcmZyIqAAAAAIztRJsHyudfi22qgQzTvkSVm82X`; // Replace with your site key
        // script.async = true;
        // script.defer = true;
        // document.head.appendChild(script);

        // return () => {
        //     document.head.removeChild(script);
        // };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Execute reCAPTCHA and get the token
        // const token = await new Promise((resolve) => {
        //     if (typeof grecaptcha !== 'undefined') {
        //         grecaptcha?.execute().then(resolve);
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

    return (
        <>
            <form onSubmit={handleSubmit}>
                <div className="modal fade" id="exampleModalCenter" tabindex="-1" role="dialog" aria-labelledby="exampleModalCenterTitle" aria-hidden="true">
                    <div className="modal-dialog modal-dialog-centered" role="document">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title" id="exampleModalLongTitle">Request Box</h5>
                                <button type="button" onClick={closeModal} className="close" data-dismiss="modal" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div className="modal-body">
                                <ul className="list-none">
                                    <li><input placeholder="Name" type="text"
                                        value={name}
                                        pattern=".{3,}"
                                        title="Please enter at least 3 characters"
                                        onChange={(e) => setName(e.target.value)}
                                        required /></li>
                                    <li><input placeholder="Email" type="email"
                                        value={email}
                                        name="email"
                                        id="email"
                                        pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                                        title="Please enter a valid email address"
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
                                </ul>
                                {feedbackMessage && 
                                    <div className={isError ? 'response error' : 'response'}>
                                        {
                                            isError ?
                                            <svg width="800px" height="800px" viewBox="-0.5 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.5C17.1086 21.5 21.25 17.3586 21.25 12.25C21.25 7.14137 17.1086 3 12 3C6.89137 3 2.75 7.14137 2.75 12.25C2.75 17.3586 6.89137 21.5 12 21.5Z" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path id="inner" d="M12.9309 8.15005C12.9256 8.39231 12.825 8.62272 12.6509 8.79123C12.4767 8.95974 12.2431 9.05271 12.0008 9.05002C11.8242 9.04413 11.6533 8.98641 11.5093 8.884C11.3652 8.7816 11.2546 8.63903 11.1911 8.47415C11.1275 8.30927 11.1139 8.12932 11.152 7.95675C11.19 7.78419 11.278 7.6267 11.405 7.50381C11.532 7.380" /></svg>
                                            :
                                            <svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M12 2.25C6.77995 2.25 2.25 6.77995 2.25 12C2.25 17.22 6.77995 21.75 12 21.75C17.22 21.75 21.75 17.22 21.75 12C21.75 6.77995 17.22 2.25 12 2.25ZM12 19.875C11.1975 19.875 10.5 19.1775 10.5 18.375C10.5 17.5725 11.1975 16.875 12 16.875C12.8025 16.875 13.5 17.5725 13.5 18.375C13.5 19.1775 12.8025 19.875 12 19.875ZM13.5 14.25H10.5V8.25H13.5V14.25Z" fill="#00C853"/></svg>
                                        }
                                        <p>{feedbackMessage}</p>
                                    </div>
                                }
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={closeModal} className="simple-btn close-btn" data-dismiss="modal">Close</button>
                                <button type="submit" className="simple-btn">Send Request</button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}
