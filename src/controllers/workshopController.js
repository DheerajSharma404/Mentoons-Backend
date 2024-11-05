const asyncHandler = require("../utils/asyncHandler");
const messageHelper = require("../utils/messageHelper");
const { errorResponse, successResponse } = require("../utils/responseHelper");
const { saveWorkshopEnquiriesToDB, getWorkshopEnquiriesFromDB, getWorkshopEnquiriesByIdFromDB } = require("../helpers/workshopHelper");



module.exports={
  submitWorkshopForm:asyncHandler(async (req,res,next)=>{
    console.log(req.body)
   const{name,age,guardianName,guardianContact,guardianEmail,city,duration,workshop}=req.body
   if(!name||!age||!guardianName||!guardianContact||!guardianEmail||!city||!duration||!workshop){
     return errorResponse(res,400,messageHelper.BAD_REQUEST)
   }
   const EnquiryData = await saveWorkshopEnquiriesToDB({name,age,guardianName,guardianContact,guardianEmail,city,duration,workshop})
   if(!EnquiryData){
     return errorResponse(res,500,messageHelper.SOMETHING_WENT_WRONG)
   }
   return successResponse(res,200,messageHelper.FORM_SUBMITTED)
  }),
  getWorkshopEnquiries:asyncHandler(async(req,res,next)=>{
    const {search,page,limit} = req.query
    const EnquiryData = await getWorkshopEnquiriesFromDB(search,page,limit)
    console.log(EnquiryData,'oooooo')
    if(!EnquiryData){
      return errorResponse(res,500,messageHelper.SOMETHING_WENT_WRONG)
    }
    return successResponse(res,200,messageHelper.ENQUIRY_DATA_FETCHED,EnquiryData)
  }),
  getWorkshopEnquiriesById:asyncHandler(async(req,res,next)=>{
    const {workshopId} = req.params
    const EnquiryData = await getWorkshopEnquiriesByIdFromDB(workshopId)
    if(!EnquiryData){
      return errorResponse(res,404,messageHelper.ENQUIRY_NOT_FOUND)
    }
    return successResponse(res,200,messageHelper.ENQUIRY_DATA_FETCHED,EnquiryData)
  })
}