import readCSV from '@salesforce/apex/AccountsBulkUploadController.createChildAccs';
import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ReadCSVFileInLWC extends LightningElement {

    @api recordId;  //public attribute
    //private attributes
    accountObj = {};
    labels = {
        progressMsg: "Uploaded {0} out of {1} child account records...",
        successMsg: "Successfully uploaded {0} child accounts!",
        partialFailureMsg: "Upload process hit an unexpected error and failed to upload {0} out of {1} records!",
        failureMsg: "Upload process hit an unexpected error and couldn't upload any record!",
    };
    showProgressBar = false;

    get acceptedFormats() {
        return ['.csv'];
    }

    handleUpload(event) {
        const uploadedFile = event.detail.files[0];

        readCSV({ parentId: this.recordId, contentVersionId: uploadedFile.documentId })
            .then(result => {
                if (result.status) {
                    this.accountObj = JSON.parse(result.data);
                    var successMsg = 'Request to create ' + this.accountObj.Previous_Upload_Total_Count__c + ' child accounts has been queued successfully!'
                    this.showProgressBar = true;
                    this.dispatchEvent(
                        new ShowToastEvent({
                            variant: 'success',
                            message: successMsg,
                            title: 'Success!'
                        }),
                    );
                } else {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            variant: 'error',
                            title: 'Error!',
                            message: result.errorMessage
                        }),
                    );
                }
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        variant: 'error',
                        title: 'Error!',
                        message: JSON.stringify(error)
                    }),
                );
            })
    }

    progressEvtChange(event) {
        if (event.detail.newStatus == 'Successful') {
            this.showProgressBar = false;
        }
    }
}