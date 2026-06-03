import React, { useState, useEffect } from 'react';
import { ensureRecaptchaScript, executeRecaptcha } from '@/components/utils/recaptcha';
import { evaluateBotSignals } from '@/components/utils/antiBot';
import { FORM_LIMITS, sanitizeLeadForm } from '@/components/utils/formSecurity';
import { submitLead } from '@/components/utils/submitLead';

export default function RequestModal({ closeModal }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [partNumber, setPartNumber] = useState("");
    const [message, setMessage] = useState("");
    const [honeypot, setHoneypot] = useState("");
    const [formStartedAt] = useState(() => Date.now());
    const [feedbackMessage, setFeedbackMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    useEffect(() => {
        try {
            const storedProduct = JSON.parse(localStorage.getItem('product'));
            setPartNumber(storedProduct?.PN || storedProduct?.Name || "");
        } catch {
            setPartNumber("");
        }
        ensureRecaptchaScript(recaptchaSiteKey);
    }, [recaptchaSiteKey]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const botSignals = evaluateBotSignals({
            honeypotValue: honeypot,
            startedAt: formStartedAt,
        });
        if (botSignals.blocked) {
            setIsError(true);
            setFeedbackMessage("Submission blocked. Please try again.");
            return;
        }

        const { sanitized, errors } = sanitizeLeadForm({ name, email, partNumber, message });
        if (errors.length) {
            setIsError(true);
            setFeedbackMessage(errors[0]);
            return;
        }

        setIsSubmitting(true);

        const token = await executeRecaptcha(recaptchaSiteKey, "part_request");
        if (!token) {
            setIsError(true);
            setFeedbackMessage("Error with reCAPTCHA. Please try again.");
            setIsSubmitting(false);
            return;
        }

        try {
            await submitLead({
                ...sanitized,
                token,
                action: "part_request",
                formType: "part_request",
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
        setIsSubmitting(false);
        // closeModal();
    };

    return (
        <>
            <form onSubmit={handleSubmit}>
                <div className="modal fade" id="exampleModalCenter" tabIndex="-1" role="dialog" aria-labelledby="exampleModalCenterTitle" aria-hidden="true">
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
                                    <li className="bot-field" aria-hidden="true">
                                        <label htmlFor="modal-part-website">Website</label>
                                        <input
                                            id="modal-part-website"
                                            name="website"
                                            type="text"
                                            value={honeypot}
                                            onChange={(e) => setHoneypot(e.target.value)}
                                            tabIndex={-1}
                                            autoComplete="off"
                                        />
                                    </li>
                                    <li><input placeholder="Name" type="text"
                                        value={name}
                                        maxLength={FORM_LIMITS.name}
                                        pattern=".{3,}"
                                        title="Please enter at least 3 characters"
                                        onChange={(e) => setName(e.target.value)}
                                        required /></li>
                                    <li><input placeholder="Email" type="email"
                                        value={email}
                                        maxLength={FORM_LIMITS.email}
                                        name="email"
                                        id="email"
                                        pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                                        title="Please enter a valid email address"
                                        onChange={(e) => setEmail(e.target.value)}
                                        required/></li>
                                    <li><input placeholder="Part Number" type="text"
                                        value={partNumber}
                                        maxLength={FORM_LIMITS.partNumber}
                                        onChange={(e) => setPartNumber(e.target.value)}
                                        required/></li>
                                    <li><textarea placeholder="Message" type="text"
                                        value={message}
                                        maxLength={FORM_LIMITS.message}
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
                                <button type="submit" className="simple-btn" disabled={isSubmitting}>{isSubmitting ? "Sending..." : "Send Request"}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}
