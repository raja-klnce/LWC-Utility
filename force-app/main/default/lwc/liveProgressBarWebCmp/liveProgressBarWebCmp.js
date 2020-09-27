import { LightningElement, api } from 'lwc';
import { subscribe, unsubscribe, onError, setDebugFlag, isEmpEnabled } from 'lightning/empApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class LiveProgressBarWebCmp extends LightningElement {

    @api size;                              //x-small, small, medium, and large
    @api variant;                           //base or circular
    @api containerClass;                    //slds css class name for the container of the progress bar
    @api progressCountMsg;                  //Progress msg - should in this format "Processed {0} of {1}"
    @api successMsg;                 //Parent cmp should send this via custom label
    @api partialFailureMsg;          //Parent cmp should send this via custom label
    @api failureMsg;              //Parent cmp should send this via custom label
    @api sectionHeader;
    @api hideWhenProcessComplete;           //Progress stops showing when progress reaches 100%
    @api freezeWhenProcessFails;            //Do not hide progress bar when process is completed but failed
    //@api partialFailureStickyBanner;          //Set to true to see a banner in case process fails partially or completely    
    @api initialSobjectRecord;              //Set to send initial record values before push event takes it over
    // -- Push Topic related fields start
    @api usePushTopicEvent;                 //Boolean to say if the progress data to be received from streaming api via push event
    @api pushTopicName;                     //Name of the push topic. This cmp tries to create a new one if not already present
    @api recordId;                          //When pushTopic message is received only this record will be considered
    @api totalCountFieldName;               //Field name in the response object in which total value will be present
    @api successCountFieldName;           //Field name in the response object in which completed value will be present
    @api statusFieldName;              //Field name in the response object in which current process status value will be present
    // -- Push Topic related fields end
    progressTotalValue = 0;
    progressCurrentValue = 0;
    processRunning = false;
    processCompleted = false;
    processFailed = false;
    processPartiallyFailed = false;
    processError = false;
    //showAlert = false;
    //alertMsg = "";
    isInitialized = false;
    hasRendered = false;
    statusInProgressValue = "In Progress";          //Field value in the Status field which indicates process is started and running (please note progress bar will be shown only with this value)
    statusSuccessValue = "Successful";              //Field value in the Status field which indicates process is completed
    statusFailureValue = "Failed";                  //Field value in the Status field which indicates process is failed
    statusPartialSuccessValue = "Partially Successful";           //Field value in the Status field which indicates process is partially failed

    @api
    get totalValue() {          //(N/A if you use push/platform event) Total value against which progress is calculated
        return this.progressTotalValue;
    }

    set totalValue(value) {     //(N/A if you use push/platform event) Total value against which progress is calculated
        this.progressTotalValue = value;
    }

    @api
    get completedValue() {      //(N/A if you use push/platform event) Completed value against which progress is calculated
        return this.progressCurrentValue;
    }

    set completedValue(value) { //(N/A if you use push/platform event) Completed value against which progress is calculated
        this.progressCurrentValue = value;
    }

    get showSpinner() {
        return this.processRunning;
    }

    get progressHolderClass() {
        return (this.processRunning ? "progressHolder slds-p-left_small usepartial" : "progressHolder slds-p-left_small usefull");
    }

    get progressPercentValue() {
        console.log("inside get progressPercentValue");
        var progressPercent = 0;
        try {
            console.log("this.progressTotalValue=" + this.progressTotalValue);
            console.log("this.progressCurrentValue=" + this.progressCurrentValue);
            if (this.progressTotalValue != undefined && this.progressCurrentValue != undefined) {
                console.log("before setting progressPercent value=");
                progressPercent = (parseInt(this.progressCurrentValue) / parseInt(this.progressTotalValue)) * 100;
                console.log("setting progressPercent value=" + progressPercent);
            }
            console.log("progressPercent=" + progressPercent);
        } catch (error) {
            console.log("***** error ***** = " + error.message + error.stack);
        }
        return progressPercent;
    }

    get progressText() {
        console.log("inside set progressText");
        var progressText = "";
        if (this.progressCountMsg != undefined && this.progressCountMsg != "") {
            if (this.progressCountMsg.includes("{")) {
                if (this.progressTotalValue != undefined && this.progressCurrentValue != undefined) {
                    progressText = this.progressCountMsg.replace("{0}", this.progressCurrentValue).replace("{1}", this.progressTotalValue);
                }
            } else {
                progressText = this.progressCountMsg;
            }
            console.log("setting progressText=" + progressText);
        }
        return progressText;
    }

    get showProgressBar() {
        var show;
        console.log('inside showProgressBar');
        if (this.processError) {
            show = false;
            console.log('inside this.processError');
        } else if (this.processPartiallyFailed && this.freezeWhenProcessFails) {
            show = true;
            console.log('inside this.processFailed');
        } else if (this.processCompleted && this.hideWhenProcessComplete) {
            show = false;
            console.log('inside this.processCompleted');
        } else if ((this.progressTotalValue > 0 && this.progressCurrentValue > 0) || this.processRunning) {
            show = true;
            console.log('inside this.processRunning');
        } else {
            show = false;
        }
        console.log('show value=' + show);
        return show;
    }

    get cssClassNames() {
        var classNames = "";
        if (this.containerClass != undefined) {
            classNames = this.containerClass;
        }
        return classNames;
    }

    connectedCallback() {
        if (!this.isInitialized) {
            this.isInitialized = true;
            console.log('inside connectedCallback');
            console.log('this.usePushTopicEvent = ' + this.usePushTopicEvent);
            console.log("totalCountFieldName=" + this.totalCountFieldName);
            console.log("successCountFieldName=" + this.successCountFieldName);
            console.log("statusFieldName=" + this.statusFieldName);
            console.log("statusInProgressValue=" + this.statusInProgressValue);
            console.log("statusSuccessValue=" + this.statusSuccessValue);
            console.log("statusFailureValue=" + this.statusFailureValue);
            console.log("successMsg=" + this.successMsg);
            console.log("partialFailureMsg=" + this.partialFailureMsg);
            console.log("failureMsg=" + this.failureMsg);
            console.log("containerClass=" + this.containerClass);
            try {
                if (this.usePushTopicEvent) {
                    console.log('inside this.usePushTopicEvent');

                    // Callback invoked whenever a new event message is received
                    const messageCallback = (response) => {
                        console.log('New message received: ', JSON.stringify(response));
                        //this.showAlert = false;
                        if (response != undefined && response != null) {
                            console.log("inside first if");
                            if (response["data"] != undefined && response["data"] != null &&
                                response["data"]["sobject"] != undefined && response["data"]["sobject"] != null) {
                                console.log("inside second if");
                                var sObject = response["data"]["sobject"];
                                this.actOnEvent(sObject, true);
                            } else {
                                this.processError = true;
                            }
                        } else {
                            this.processError = true;
                        }
                    };

                    const topicName = "/topic/" + this.pushTopicName;

                    // Invoke subscribe method of empApi. Pass reference to messageCallback
                    //TODO proper fix after Salesforce fixes this issue
                    //Method Promise.prototype.then called on incompatible receiver [object Object]
                    //TypeError: Method Promise.prototype.then called on incompatible receiver [object Object]
                    subscribe(topicName, -1, messageCallback).then(response => {
                        // Response contains the subscription information on subscribe call
                        console.log('inside subscribe');
                        console.log('Subscription request sent to: ', JSON.stringify(response.channel));
                        console.log('response=' + JSON.stringify(response));
                    });
                    //subscribe(topicName, -1, messageCallback);
                    this.registerErrorListener();
                }
            } catch (err) {
                console.log("error inside connectedcallback =>" + err.message + err.stack);
            }
        }
    }

    renderedCallback() {
        if (!this.hasRendered) {
            console.log("inside first time renderedCallback");
            this.hasRendered = true;
            console.log("initialSobjectRecord=" + this.initialSobjectRecord);
            if (this.usePushTopicEvent && this.initialSobjectRecord != undefined) {
                console.log("Going to call actOnevent");
                this.actOnEvent(this.initialSobjectRecord, false);
            }
        }
    }

    actOnEvent(sObject, onMessageCallback) {
        try {
            console.log("sObject value=" + JSON.stringify(sObject));
            console.log("onMessageCallback" + onMessageCallback);
            console.log("totalCountFieldName=" + this.totalCountFieldName);
            console.log("successCountFieldName=" + this.successCountFieldName);
            console.log("statusFieldName=" + this.statusFieldName);
            console.log("statusInProgressValue=" + this.statusInProgressValue);
            console.log("statusSuccessValue=" + this.statusSuccessValue);
            console.log("statusFailureValue=" + this.statusFailureValue);
            if (this.recordId != undefined && (sObject["Id"] == this.recordId || sObject["id"] == this.recordId)) {
                var currentVal;
                if (sObject[this.successCountFieldName] != undefined) {
                    this.progressCurrentValue = sObject[this.successCountFieldName];
                    currentVal = sObject[this.successCountFieldName];
                    console.log("setting this.progressCurrentValue" + this.progressCurrentValue);
                } else {
                    currentVal = 0;
                    this.progressCurrentValue = 0;
                }
                if (sObject[this.totalCountFieldName] != undefined) {
                    this.progressTotalValue = sObject[this.totalCountFieldName];
                    console.log("setting this.progressTotalValue" + this.progressTotalValue);
                } else {
                    this.progressTotalValue = 0;
                }
                if (sObject[this.statusFieldName] != undefined) {
                    console.log("inside first if");
                    var processStatus = sObject[this.statusFieldName];
                    this.processRunning = false;
                    this.processCompleted = false;
                    this.processFailed = false;
                    this.processPartiallyFailed = false;
                    var fireEventType = "";
                    var delayedEvent = false;
                    if (this.statusInProgressValue != undefined && this.statusInProgressValue.includes(processStatus)) {
                        console.log("setting processRunning");
                        this.processRunning = true;
                    } else if (this.statusSuccessValue != undefined && this.statusSuccessValue.includes(processStatus)) {
                        console.log("setting processCompleted");
                        fireEventType = processStatus;
                        delayedEvent = true;
                        console.log('before setTimeout on processcompleted');
                        setTimeout(() => {
                            console.log('inside setTimeout on processcompleted');
                            this.processCompleted = true;
                        }, 2000);
                        if (onMessageCallback) {
                            var toastMsg = "";
                            if (this.successMsg != undefined && this.successMsg.includes("{")) {
                                toastMsg = this.successMsg.replace("{0}", currentVal);
                            } else {
                                toastMsg = this.successMsg
                            }
                            this.showToast("success", "Success", toastMsg, this);
                        }
                    } else if (this.statusPartialSuccessValue != undefined && this.statusPartialSuccessValue.includes(processStatus)) {
                        console.log("setting processPartiallyFailed");
                        fireEventType = processStatus;
                        var toastMsg = "";
                        var failedCount = this.progressTotalValue - currentVal;
                        if (this.partialFailureMsg.includes("{")) {
                            toastMsg = this.partialFailureMsg.replace("{0}", failedCount).replace("{1}", this.progressTotalValue);
                        } else {
                            toastMsg = this.partialFailureMsg;
                        }
                        //if (this.partialFailureStickyBanner) {
                        //    console.log("partialFailureStickyBanner = true");
                        //this.showAlert = true;
                        //this.alertMsg = toastMsg;
                        //} else {
                        //    console.log("partialFailureStickyBanner = false Going to show showToast");
                        //    this.showToast("info", "Error", toastMsg, this);
                        //}
                        this.processPartiallyFailed = true;
                        this.showStickyToast("error", "Error", toastMsg, this);
                    } else if (this.statusFailureValue != undefined && this.statusFailureValue.includes(processStatus)) {
                        console.log("setting processFailed. Going to show sticky toast");
                        fireEventType = processStatus;
                        this.processFailed = true;
                        this.showStickyToast("error", "Error", this.failureMsg, this);
                    }
                    if (onMessageCallback && fireEventType != "") {
                        if (delayedEvent) {
                            console.log('before setTimeout on processcompleted');
                            setTimeout(() => {
                                console.log('inside setTimeout before dispatching event');
                                const eventChangeEvent = new CustomEvent('eventchange', { detail: { newStatus: fireEventType } });
                                this.dispatchEvent(eventChangeEvent);
                            }, 1000);
                        } else {
                            const eventChangeEvent = new CustomEvent('eventchange', { detail: { newStatus: fireEventType } });
                            this.dispatchEvent(eventChangeEvent);
                        }
                    }
                }
            }
        } catch (err) {
            console.log('actOnEvent error=' + err.message + err.stack);
            this.processError = true;
        };
    }

    registerErrorListener() {
        // Invoke onError empApi method
        onError(error => {
            console.log('Received error from server: ', JSON.stringify(error));
            // Error contains the server-side error
            this.processError = true;
        });
    }

    errorCallback(error, stack) {
        console.log('errorCallback error=' + error);
        console.log('errorCallback stack=' + stack);
    }

    showToast(variant, title, message) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                variant: variant,
                message: message
            })
        );
    }

    showStickyToast(variant, title, message) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                variant: variant,
                message: message,
                mode: "sticky"
            })
        );
    }
}