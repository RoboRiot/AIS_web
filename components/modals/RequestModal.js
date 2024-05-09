export default function RequestModal({closeModal}) {
    return(
        <>
            <div class="modal fade" id="exampleModalCenter" tabindex="-1" role="dialog" aria-labelledby="exampleModalCenterTitle" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="exampleModalLongTitle">Request Box</h5>
                            <button type="button" onClick={closeModal} class="close" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <ul className="list-none">
                                <li><input placeholder="Name" /></li>
                                <li><input placeholder="Email" /></li>
                                <li><input placeholder="Part Number" /></li>
                                <li><textarea placeholder="Message"></textarea></li>
                            </ul>
                        </div>
                        <div class="modal-footer">
                            <button type="button" onClick={closeModal} class="simple-btn close-btn" data-dismiss="modal">Close</button>
                            <button type="button" className="simple-btn">Submit</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}