public with sharing class ApexResponse {
    @AuraEnabled
    public Boolean status;
    @AuraEnabled
    public String errorMessage;    
    @AuraEnabled
    public String data;

    public ApexResponse() {
        this.status = false;
        this.errorMessage = null;        
        this.data = null;
    }    
    
    public ApexResponse(Boolean status, string errorMessage, String data) {
        this.status = status;
        this.errorMessage = errorMessage;        
        this.data = data;
    }
}