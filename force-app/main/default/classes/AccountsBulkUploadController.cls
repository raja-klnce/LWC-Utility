/* Name: QueueableJobsHandler
Description : Controller class for child accounts bulk upload
Author : Raja Karuppasamy
*/
public with sharing class AccountsBulkUploadController implements QueueableJobsHandler {

    @AuraEnabled
    public static ApexResponse createChildAccs(Id parentId, Id contentVersionId){
        ApexResponse response = new ApexResponse();
        try{
            upsertPushTopic('ChildAccountsUpload');
            List<Account> accsToInsert = new List<Account>();
            ContentVersion contVersion = [SELECT VersionData FROM ContentVersion WHERE ContentDocumentId =:contentVersionId];
            List<String> csvRows = contVersion.VersionData.toString().split('\n');
            csvRows.remove(0);          //Remove column headers
            for(String csvRow :csvRows){
                Account acc = new Account();
                List<String> csvRowData = csvRow.split(',');
                acc.ParentId = parentId;
                acc.Name = csvRowData[0];
                acc.Type = csvRowData[1];
                acc.Industry = csvRowData[2];
                acc.Rating = csvRowData[3];   
                acc.Website = csvRowData[4];
                accsToInsert.add(acc);
            }            
            if(!accsToInsert.isEmpty()) {
                System.enqueueJob(new ExecuteDmlQueuableBatches(accsToInsert, 'INSERT', 100, parentId, 'AccountsBulkUploadController'));
                Account acc = updateCurrentStatusinParent(parentId, accsToInsert.size(), 0, 'In Progress');
                response.status = true;
                response.data = JSON.serialize(acc);
            } else {
                throw new CustomException('No accounts to upload!');
            }
        } catch (Exception e) {
            response.status = false;
            response.errorMessage = e.getMessage();
        }
        return response;    
    }

    public static void handleSingleBatchCompletion(Id parentId, Integer successCount){
        updateCurrentStatusinParent(parentId, null, successCount, 'In Progress');
    }

    public static void handleAllJobsCompletion(Id parentId, Integer successCount){
        updateCurrentStatusinParent(parentId, null, successCount, 'COMPLETED');
    }

    private static Account updateCurrentStatusinParent(Id parentId, Integer totalCount, Integer successCount, String status){
        Account parentUpdate = [SELECT Id,Previous_Upload_Total_Count__c,Previous_Upload_Success_Count__c FROM Account WHERE Id = :parentId];
        if(totalCount != null){
            parentUpdate.Previous_Upload_Total_Count__c = totalCount;
        }
        parentUpdate.Previous_Upload_Success_Count__c = successCount;
        if(status == 'COMPLETED'){
            if(parentUpdate.Previous_Upload_Total_Count__c == successCount){
                parentUpdate.Previous_Upload_Status__c = 'Successful';
            } else if(successCount == null || successCount == 0){
                parentUpdate.Previous_Upload_Status__c = 'Failed';
            } else {
                parentUpdate.Previous_Upload_Status__c= 'Partially Successful';
            }
        } else {
            parentUpdate.Previous_Upload_Status__c = status;
        }        
        update parentUpdate;
        return parentUpdate;
    }

    //Upsert push topic method invoked before accounts upload to make sure push topic is always present
    public static void upsertPushTopic(String pushTopicName){
        List<PushTopic> topics = [SELECT Id FROM PushTopic WHERE Name = :pushTopicName]; 
        if(topics.isEmpty()) {
            PushTopic pushTopic = new PushTopic();
            pushTopic.Name = pushTopicName;
            pushTopic.Query = 'SELECT Id, Previous_Upload_Total_Count__c, Previous_Upload_Success_Count__c,  Previous_Upload_Status__c FROM Account WHERE Previous_Upload_Status__c <> null AND Previous_Upload_Success_Count__c <> null';             
            pushTopic.ApiVersion = 49.0;
            pushTopic.NotifyForOperationCreate = false;
            pushTopic.NotifyForOperationUpdate = true;
            pushTopic.NotifyForOperationUndelete = false;
            pushTopic.NotifyForOperationDelete = false;
            pushTopic.NotifyForFields = 'Where';
            insert pushTopic;
        }
    }    
}